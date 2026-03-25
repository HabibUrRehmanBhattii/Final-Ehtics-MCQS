const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');

const {
  loadWorkerModule
} = require('./helpers/worker_test_utils');

function signSessionToken(secret, token) {
  return createHmac('sha256', secret)
    .update(token)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createSessionCookie(secret, token = 'session-token') {
  const signature = signSessionToken(secret, token);
  return `mcq_session=${encodeURIComponent(`${token}.${signature}`)}`;
}

function createDbMock({ sessionRow = null, studentRows = [], studentById = {} } = {}) {
  const state = {
    progressWrites: [],
    auditLogWrites: []
  };

  return {
    state,
    prepare(sql) {
      const statement = {
        sql,
        bound: []
      };

      return {
        bind(...args) {
          statement.bound = args;
          return this;
        },
        async first() {
          if (sql.includes('FROM sessions')) {
            return sessionRow;
          }
          if (sql.includes('WHERE users.id = ?')) {
            return studentById[statement.bound[0]] || null;
          }
          return null;
        },
        async all() {
          if (sql.includes("WHERE users.status = 'active'")) {
            return { results: studentRows };
          }
          return { results: [] };
        },
        async run() {
          if (sql.includes('INSERT INTO user_progress')) {
            state.progressWrites.push(statement.bound);
          }
          if (sql.includes('INSERT INTO audit_logs')) {
            state.auditLogWrites.push(statement.bound);
          }
          return { success: true };
        }
      };
    }
  };
}

function createAuthDbMock() {
  const state = {
    usersById: new Map(),
    usersByEmail: new Map(),
    sessions: [],
    authAttempts: [],
    auditLogWrites: []
  };

  const getUserByEmail = (rawEmail) => {
    const email = String(rawEmail || '').trim().toLowerCase();
    return state.usersByEmail.get(email) || null;
  };

  return {
    state,
    prepare(sql) {
      const statement = {
        sql,
        bound: []
      };

      return {
        bind(...args) {
          statement.bound = args;
          return this;
        },
        async first() {
          if (sql.includes('SELECT COUNT(*) AS count FROM auth_attempts')) {
            return { count: 0 };
          }

          if (sql.includes('SELECT id FROM users WHERE email = ? LIMIT 1')) {
            const user = getUserByEmail(statement.bound[0]);
            return user ? { id: user.id } : null;
          }

          if (sql.includes('SELECT id, email, password_hash, status FROM users WHERE email = ? LIMIT 1')) {
            const user = getUserByEmail(statement.bound[0]);
            return user ? {
              id: user.id,
              email: user.email,
              password_hash: user.password_hash,
              status: user.status
            } : null;
          }

          return null;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          if (sql.includes('INSERT INTO users (id, email, password_hash, status, created_at, updated_at, last_login_at)')) {
            const [id, rawEmail, passwordHash, status, createdAt, updatedAt, lastLoginAt] = statement.bound;
            const email = String(rawEmail || '').trim().toLowerCase();
            const user = {
              id,
              email,
              password_hash: passwordHash,
              status,
              created_at: createdAt,
              updated_at: updatedAt,
              last_login_at: lastLoginAt
            };
            state.usersById.set(id, user);
            state.usersByEmail.set(email, user);
          }

          if (sql.includes('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?')) {
            const [lastLoginAt, updatedAt, userId] = statement.bound;
            const user = state.usersById.get(userId);
            if (user) {
              user.last_login_at = lastLoginAt;
              user.updated_at = updatedAt;
            }
          }

          if (sql.includes('INSERT INTO sessions (id, user_id, session_token_hash, created_at, expires_at, revoked_at, ip_address, user_agent)')) {
            const [id, userId, tokenHash, createdAt, expiresAt, revokedAt, ipAddress, userAgent] = statement.bound;
            state.sessions.push({
              id,
              userId,
              tokenHash,
              createdAt,
              expiresAt,
              revokedAt,
              ipAddress,
              userAgent
            });
          }

          if (sql.includes('INSERT INTO auth_attempts')) {
            state.authAttempts.push(statement.bound);
          }

          if (sql.includes('INSERT INTO audit_logs')) {
            state.auditLogWrites.push(statement.bound);
          }

          return { success: true };
        }
      };
    }
  };
}

test('getClientIp prefers CF headers and falls back to the first forwarded IP', () => {
  const worker = loadWorkerModule();

  const cfRequest = new Request('https://hllqpmcqs.com/api/auth/session', {
    headers: {
      'CF-Connecting-IP': '203.0.113.10',
      'x-forwarded-for': '198.51.100.2, 198.51.100.3'
    }
  });
  const forwardedRequest = new Request('https://hllqpmcqs.com/api/auth/session', {
    headers: {
      'x-forwarded-for': '198.51.100.2, 198.51.100.3'
    }
  });

  assert.equal(worker.getClientIp(cfRequest), '203.0.113.10');
  assert.equal(worker.getClientIp(forwardedRequest), '198.51.100.2');
});

test('getResetEmailConfig infers provider, trims the base URL, and reports when delivery is configured', () => {
  const worker = loadWorkerModule();
  const request = new Request('https://hllqpmcqs.com/account/reset');

  const config = worker.getResetEmailConfig({
    RESEND_API_KEY: 're_123',
    RESET_EMAIL_FROM: 'Study App <reset@example.com>',
    RESET_EMAIL_REPLY_TO: 'support@example.com',
    RESET_BASE_URL: 'https://hllqpmcqs.com///',
    APP_NAME: 'Study Portal'
  }, request);

  assert.deepEqual(JSON.parse(JSON.stringify(config)), {
    provider: 'resend',
    from: 'Study App <reset@example.com>',
    replyTo: 'support@example.com',
    appName: 'Study Portal',
    baseUrl: 'https://hllqpmcqs.com',
    subject: 'Reset your Study Portal password',
    postmarkMessageStream: 'outbound',
    resendApiKey: 're_123',
    postmarkServerToken: ''
  });
  assert.equal(worker.isResetEmailConfigured(config), true);
});

test('buildPasswordResetEmail escapes HTML-sensitive content and URL-encodes the raw token', () => {
  const worker = loadWorkerModule();

  const email = worker.buildPasswordResetEmail({
    baseUrl: 'https://hllqpmcqs.com',
    appName: 'LLQP <Prep>',
    subject: 'Reset your password'
  }, 'tok+/=unsafe');

  assert.equal(email.resetUrl, 'https://hllqpmcqs.com/?reset=tok%2B%2F%3Dunsafe');
  assert.match(email.html, /LLQP &lt;Prep&gt;/);
  assert.match(email.html, /href="https:\/\/hllqpmcqs\.com\/\?reset=tok%2B%2F%3Dunsafe"/);
  assert.match(email.text, /tok%2B%2F%3Dunsafe/);
});

test('jsonResponse includes CORS and content headers for same-origin API callers', async () => {
  const worker = loadWorkerModule();
  const request = new Request('https://hllqpmcqs.com/api/auth/config', {
    headers: {
      Origin: 'https://hllqpmcqs.com'
    }
  });

  const response = worker.jsonResponse(request, { ok: true }, { status: 201 });

  assert.equal(response.status, 201);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://hllqpmcqs.com');
  assert.equal(response.headers.get('Access-Control-Allow-Credentials'), 'true');
  assert.equal(response.headers.get('Content-Type'), 'application/json');
  assert.deepEqual(await response.json(), { ok: true });
});

test('worker fetch serves the health and auth config endpoints without hitting static assets', async () => {
  const worker = loadWorkerModule();
  let assetFetches = 0;

  const healthResponse = await worker.defaultExport.fetch(
    new Request('https://hllqpmcqs.com/health'),
    {
      DB: {},
      SESSION_SECRET: 'secret',
      TURNSTILE_SECRET_KEY: 'turnstile',
      TURNSTILE_SITE_KEY: 'site-key',
      ASSETS: {
        fetch() {
          assetFetches += 1;
          return new Response('asset');
        }
      }
    }
  );

  const configResponse = await worker.defaultExport.fetch(
    new Request('https://hllqpmcqs.com/api/auth/config'),
    {
      DB: {},
      SESSION_SECRET: 'secret',
      TURNSTILE_SECRET_KEY: 'turnstile',
      TURNSTILE_SITE_KEY: 'site-key'
    }
  );

  assert.deepEqual(await healthResponse.json(), {
    status: 'ok',
    authConfigured: true
  });
  assert.equal((await configResponse.json()).enabled, true);
  assert.equal(assetFetches, 0);
});

test('admin allowlist utilities normalize emails and mark admin users in session responses', async () => {
  const worker = loadWorkerModule();

  const allowlist = worker.getAdminEmailAllowlist({
    ADMIN_EMAIL_ALLOWLIST: ' HABIBCANAD@gmail.com, teammate@example.com '
  });
  assert.deepEqual(Array.from(allowlist), ['habibcanad@gmail.com', 'teammate@example.com']);
  assert.equal(worker.isAdminEmail({ ADMIN_EMAIL_ALLOWLIST: 'habibcanad@gmail.com' }, 'HabibCanad@gmail.com'), true);
  assert.equal(worker.buildAuthUser({ ADMIN_EMAIL_ALLOWLIST: 'habibcanad@gmail.com' }, 'u-1', 'student@example.com').isAdmin, false);

  const secret = 'session-secret';
  const db = createDbMock({
    sessionRow: {
      session_id: 'sess-1',
      user_id: 'user-1',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      revoked_at: null,
      email: 'habibcanad@gmail.com',
      status: 'active'
    }
  });

  const response = await worker.defaultExport.fetch(
    new Request('https://hllqpmcqs.com/api/auth/session', {
      headers: {
        Cookie: createSessionCookie(secret)
      }
    }),
    {
      DB: db,
      SESSION_SECRET: secret,
      ADMIN_EMAIL_ALLOWLIST: 'habibcanad@gmail.com'
    }
  );

  const payload = await response.json();
  assert.equal(payload.authenticated, true);
  assert.equal(payload.user.email, 'habibcanad@gmail.com');
  assert.equal(payload.user.isAdmin, true);
});

test('signup and signin responses include user.isAdmin from allowlist-matched emails', async () => {
  const worker = loadWorkerModule({
    fetchImpl: async (url) => {
      if (String(url).startsWith('https://challenges.cloudflare.com/turnstile/')) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      throw new Error(`Unexpected outbound fetch: ${url}`);
    }
  });

  const db = createAuthDbMock();
  const env = {
    DB: db,
    SESSION_SECRET: 'session-secret',
    TURNSTILE_SECRET_KEY: 'turnstile-secret',
    TURNSTILE_SITE_KEY: 'site-key',
    ADMIN_EMAIL_ALLOWLIST: 'habibcanad@gmail.com'
  };

  const signupAdminResponse = await worker.defaultExport.fetch(
    new Request('https://hllqpmcqs.com/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'HabibCanad@gmail.com',
        password: 'StrongPass123',
        turnstileToken: 'pass'
      })
    }),
    env
  );

  assert.equal(signupAdminResponse.status, 200);
  const signupAdminPayload = await signupAdminResponse.json();
  assert.equal(signupAdminPayload.authenticated, true);
  assert.equal(signupAdminPayload.user.email, 'habibcanad@gmail.com');
  assert.equal(signupAdminPayload.user.isAdmin, true);

  const signupStudentResponse = await worker.defaultExport.fetch(
    new Request('https://hllqpmcqs.com/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'student@example.com',
        password: 'StrongPass123',
        turnstileToken: 'pass'
      })
    }),
    env
  );

  assert.equal(signupStudentResponse.status, 200);
  const signupStudentPayload = await signupStudentResponse.json();
  assert.equal(signupStudentPayload.authenticated, true);
  assert.equal(signupStudentPayload.user.email, 'student@example.com');
  assert.equal(signupStudentPayload.user.isAdmin, false);

  const signinAdminResponse = await worker.defaultExport.fetch(
    new Request('https://hllqpmcqs.com/api/auth/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'habibcanad@gmail.com',
        password: 'StrongPass123',
        turnstileToken: 'pass'
      })
    }),
    env
  );

  assert.equal(signinAdminResponse.status, 200);
  const signinAdminPayload = await signinAdminResponse.json();
  assert.equal(signinAdminPayload.authenticated, true);
  assert.equal(signinAdminPayload.user.email, 'habibcanad@gmail.com');
  assert.equal(signinAdminPayload.user.isAdmin, true);

  const signinStudentResponse = await worker.defaultExport.fetch(
    new Request('https://hllqpmcqs.com/api/auth/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'student@example.com',
        password: 'StrongPass123',
        turnstileToken: 'pass'
      })
    }),
    env
  );

  assert.equal(signinStudentResponse.status, 200);
  const signinStudentPayload = await signinStudentResponse.json();
  assert.equal(signinStudentPayload.authenticated, true);
  assert.equal(signinStudentPayload.user.email, 'student@example.com');
  assert.equal(signinStudentPayload.user.isAdmin, false);
});

test('/api/admin/students/overview rejects unauthenticated and non-admin sessions', async () => {
  const worker = loadWorkerModule();
  const secret = 'session-secret';

  const unauthenticatedResponse = await worker.defaultExport.fetch(
    new Request('https://hllqpmcqs.com/api/admin/students/overview'),
    {
      DB: createDbMock({ sessionRow: null }),
      SESSION_SECRET: secret,
      ADMIN_EMAIL_ALLOWLIST: 'habibcanad@gmail.com'
    }
  );
  assert.equal(unauthenticatedResponse.status, 401);

  const nonAdminDb = createDbMock({
    sessionRow: {
      session_id: 'sess-2',
      user_id: 'user-2',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      revoked_at: null,
      email: 'student@example.com',
      status: 'active'
    }
  });

  const nonAdminResponse = await worker.defaultExport.fetch(
    new Request('https://hllqpmcqs.com/api/admin/students/overview', {
      headers: {
        Cookie: createSessionCookie(secret, 'non-admin-token')
      }
    }),
    {
      DB: nonAdminDb,
      SESSION_SECRET: secret,
      ADMIN_EMAIL_ALLOWLIST: 'habibcanad@gmail.com'
    }
  );
  assert.equal(nonAdminResponse.status, 403);
});

test('/api/admin/students/overview aggregates student payload metrics correctly', async () => {
  const worker = loadWorkerModule();
  const secret = 'session-secret';

  const studentPayload = JSON.stringify({
    version: 1,
    items: {
      'progress_llqp-life_life-01': JSON.stringify({
        viewed: ['1', '2'],
        bookmarked: ['1'],
        revealed: ['1'],
        timers: { '1': 60000, '2': 30000 },
        firstAttemptCorrect: { '1': true, '2': false },
        questionLayout: { questionOrder: ['1', '2', '3'] },
        lastUpdated: '2026-03-24T10:00:00.000Z'
      }),
      'shuffle_llqp-life_life-01': JSON.stringify({ order: ['1', '2', '3'] }),
      'progress_llqp-life_life-02': JSON.stringify({
        viewed: ['4'],
        bookmarked: [],
        revealed: ['4'],
        timers: { '4': 120000 },
        firstAttemptCorrect: { '4': true },
        questionLayout: { questionOrder: ['4', '5'] },
        lastUpdated: '2026-03-24T11:00:00.000Z'
      }),
      'last_session': JSON.stringify({ topicId: 'llqp-life', testId: 'life-02', savedAt: '2026-03-24T11:05:00.000Z' })
    }
  });

  const db = createDbMock({
    sessionRow: {
      session_id: 'sess-3',
      user_id: 'admin-1',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      revoked_at: null,
      email: 'habibcanad@gmail.com',
      status: 'active'
    },
    studentRows: [
      {
        id: 'student-1',
        email: 'alpha.student@example.com',
        status: 'active',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-03-24T11:00:00.000Z',
        last_login_at: '2026-03-24T10:59:00.000Z',
        payload: studentPayload,
        progress_updated_at: '2026-03-24T11:06:00.000Z'
      },
      {
        id: 'student-2',
        email: 'beta.student@example.com',
        status: 'active',
        created_at: '2026-01-02T00:00:00.000Z',
        updated_at: '2026-03-01T00:00:00.000Z',
        last_login_at: '2026-03-01T00:00:00.000Z',
        payload: null,
        progress_updated_at: null
      },
      {
        id: 'admin-2',
        email: 'habibcanad@gmail.com',
        status: 'active',
        created_at: '2026-01-03T00:00:00.000Z',
        updated_at: '2026-03-02T00:00:00.000Z',
        last_login_at: '2026-03-02T00:00:00.000Z',
        payload: null,
        progress_updated_at: null
      }
    ]
  });

  const response = await worker.defaultExport.fetch(
    new Request('https://hllqpmcqs.com/api/admin/students/overview', {
      headers: {
        Cookie: createSessionCookie(secret, 'admin-token')
      }
    }),
    {
      DB: db,
      SESSION_SECRET: secret,
      ADMIN_EMAIL_ALLOWLIST: 'habibcanad@gmail.com'
    }
  );

  assert.equal(response.status, 200);
  const payload = await response.json();

  assert.equal(payload.metrics.studentsCount, 2);
  assert.equal(payload.metrics.totalAnswered, 2);
  assert.equal(payload.metrics.avgCompletionPct, 20);
  assert.equal(payload.metrics.avgFirstTryAccuracyPct, 66.7);

  const alpha = payload.students.find((student) => student.id === 'student-1');
  assert.equal(alpha.totalTests, 2);
  assert.equal(alpha.answeredCount, 2);
  assert.equal(alpha.completionPct, 40);
  assert.equal(alpha.firstTryAccuracyPct, 66.7);
  assert.equal(alpha.totalStudyTimeMs, 210000);
});

test('/api/admin/students/:userId returns deep analytics and reset endpoint removes only targeted keys', async () => {
  const worker = loadWorkerModule();
  const secret = 'session-secret';

  const originalSnapshot = {
    version: 1,
    items: {
      'progress_llqp-life_life-01': JSON.stringify({
        viewed: ['1', '2'],
        bookmarked: ['1'],
        revealed: ['1'],
        timers: { '1': 60000, '2': 30000 },
        firstAttemptCorrect: { '1': true, '2': false },
        questionLayout: { questionOrder: ['1', '2', '3'] },
        lastUpdated: '2026-03-24T10:00:00.000Z'
      }),
      'shuffle_llqp-life_life-01': JSON.stringify({ order: ['1', '2', '3'] }),
      'progress_llqp-life_life-02': JSON.stringify({
        viewed: ['4'],
        bookmarked: [],
        revealed: ['4'],
        timers: { '4': 120000 },
        firstAttemptCorrect: { '4': true },
        questionLayout: { questionOrder: ['4', '5'] },
        lastUpdated: '2026-03-24T11:00:00.000Z'
      }),
      'last_session': JSON.stringify({ topicId: 'llqp-life', testId: 'life-01', savedAt: '2026-03-24T11:05:00.000Z' })
    }
  };

  const studentRow = {
    id: 'student-1',
    email: 'alpha.student@example.com',
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-03-24T11:00:00.000Z',
    last_login_at: '2026-03-24T10:59:00.000Z',
    payload: JSON.stringify(originalSnapshot),
    progress_updated_at: '2026-03-24T11:06:00.000Z'
  };

  const db = createDbMock({
    sessionRow: {
      session_id: 'sess-4',
      user_id: 'admin-1',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      revoked_at: null,
      email: 'habibcanad@gmail.com',
      status: 'active'
    },
    studentById: {
      'student-1': studentRow
    }
  });

  const detailResponse = await worker.defaultExport.fetch(
    new Request('https://hllqpmcqs.com/api/admin/students/student-1', {
      headers: {
        Cookie: createSessionCookie(secret, 'admin-token-detail')
      }
    }),
    {
      DB: db,
      SESSION_SECRET: secret,
      ADMIN_EMAIL_ALLOWLIST: 'habibcanad@gmail.com'
    }
  );

  assert.equal(detailResponse.status, 200);
  const detailPayload = await detailResponse.json();
  assert.equal(detailPayload.summary.totalTests, 2);
  assert.equal(detailPayload.summary.answeredCount, 2);
  assert.equal(detailPayload.summary.viewedCount, 3);
  assert.equal(detailPayload.summary.bookmarkedCount, 1);
  assert.equal(detailPayload.summary.firstTryAccuracyPct, 66.7);
  assert.equal(detailPayload.summary.totalStudyTimeMs, 210000);
  assert.equal(detailPayload.lastSession.topicId, 'llqp-life');
  assert.equal(detailPayload.lastSession.testId, 'life-01');

  const resetResponse = await worker.defaultExport.fetch(
    new Request('https://hllqpmcqs.com/api/admin/students/student-1/reset-test-progress', {
      method: 'POST',
      headers: {
        Cookie: createSessionCookie(secret, 'admin-token-reset'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        topicId: 'llqp-life',
        testId: 'life-01'
      })
    }),
    {
      DB: db,
      SESSION_SECRET: secret,
      ADMIN_EMAIL_ALLOWLIST: 'habibcanad@gmail.com'
    }
  );

  assert.equal(resetResponse.status, 200);
  const resetPayload = await resetResponse.json();
  assert.deepEqual(resetPayload.removedKeys.sort(), [
    'last_session',
    'progress_llqp-life_life-01',
    'shuffle_llqp-life_life-01'
  ]);

  assert.equal(db.state.progressWrites.length, 1);
  const [, serializedSnapshot] = db.state.progressWrites[0];
  const writtenSnapshot = JSON.parse(serializedSnapshot);
  assert.equal(writtenSnapshot.items['progress_llqp-life_life-01'], undefined);
  assert.equal(writtenSnapshot.items['shuffle_llqp-life_life-01'], undefined);
  assert.equal(writtenSnapshot.items['last_session'], undefined);
  assert.ok(writtenSnapshot.items['progress_llqp-life_life-02']);

  const resetAudit = db.state.auditLogWrites.find((entry) => entry[2] === 'admin.progress_reset_test');
  assert.ok(resetAudit);
  const details = JSON.parse(resetAudit[6]);
  assert.equal(details.actorAdminUserId, 'admin-1');
  assert.equal(details.targetUserId, 'student-1');
  assert.equal(details.testKey, 'llqp-life_life-01');
});
