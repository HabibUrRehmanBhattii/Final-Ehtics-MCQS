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

function createDbMock({
  sessionRow = null,
  studentRows = [],
  studentById = {},
  resetActionById = {},
  pendingResetUndoByUser = {}
} = {}) {
  const resetActionStore = new Map(Object.entries(resetActionById));
  const pendingUndoStore = new Map(
    Object.entries(pendingResetUndoByUser).map(([userId, rows]) => [
      userId,
      Array.isArray(rows) ? rows.slice() : []
    ])
  );

  const state = {
    progressWrites: [],
    auditLogWrites: [],
    resetActionWrites: [],
    resetActionUpdateWrites: [],
    resetActionDeleteWrites: [],
    deleteRuns: []
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
          if (sql.includes('FROM admin_progress_reset_actions') && sql.includes('WHERE id = ?')) {
            return resetActionStore.get(statement.bound[0]) || null;
          }
          return null;
        },
        async all() {
          if (sql.includes("WHERE users.status = 'active'")) {
            return { results: studentRows };
          }
          if (sql.includes('FROM admin_progress_reset_actions') && sql.includes('WHERE target_user_id = ?')) {
            const [userId, nowIso] = statement.bound;
            const nowMs = Date.parse(nowIso || '');
            const rows = pendingUndoStore.get(userId) || [];
            const filteredRows = rows.filter((row) => {
              if (row?.undone_at) return false;
              const expiresMs = Date.parse(row?.expires_at || '');
              if (!Number.isFinite(expiresMs) || !Number.isFinite(nowMs)) return true;
              return expiresMs > nowMs;
            });
            return { results: filteredRows };
          }
          return { results: [] };
        },
        async run() {
          if (sql.includes('INSERT INTO user_progress')) {
            state.progressWrites.push(statement.bound);
            const [userId, payload, updatedAt] = statement.bound;
            if (studentById[userId]) {
              studentById[userId] = {
                ...studentById[userId],
                payload,
                progress_updated_at: updatedAt
              };
            }
          }
          if (sql.includes('INSERT INTO audit_logs')) {
            state.auditLogWrites.push(statement.bound);
          }
          if (sql.includes('INSERT INTO admin_progress_reset_actions')) {
            const [
              id,
              actorAdminUserId,
              targetUserId,
              scope,
              topicId,
              testId,
              beforePayload,
              afterPayload,
              removedKeysJson,
              createdAt,
              expiresAt
            ] = statement.bound;
            const row = {
              id,
              actor_admin_user_id: actorAdminUserId,
              target_user_id: targetUserId,
              scope,
              topic_id: topicId,
              test_id: testId,
              before_payload: beforePayload,
              after_payload: afterPayload,
              removed_keys_json: removedKeysJson,
              created_at: createdAt,
              expires_at: expiresAt,
              undone_at: null,
              undone_by_user_id: null
            };
            resetActionStore.set(id, row);
            const currentRows = pendingUndoStore.get(targetUserId) || [];
            currentRows.unshift(row);
            pendingUndoStore.set(targetUserId, currentRows);
            state.resetActionWrites.push(statement.bound);
          }
          if (sql.includes('UPDATE admin_progress_reset_actions')) {
            const [undoneAt, undoneByUserId, resetActionId] = statement.bound;
            const row = resetActionStore.get(resetActionId) || null;
            if (!row || row.undone_at) {
              state.resetActionUpdateWrites.push({ bound: statement.bound, changes: 0 });
              return { success: true, meta: { changes: 0 } };
            }
            row.undone_at = undoneAt;
            row.undone_by_user_id = undoneByUserId;
            state.resetActionUpdateWrites.push({ bound: statement.bound, changes: 1 });
            return { success: true, meta: { changes: 1 } };
          }
          if (sql.includes('DELETE FROM admin_progress_reset_actions WHERE id = ?')) {
            const [resetActionId] = statement.bound;
            const existing = resetActionStore.get(resetActionId) || null;
            if (existing) {
              const userRows = pendingUndoStore.get(existing.target_user_id) || [];
              pendingUndoStore.set(
                existing.target_user_id,
                userRows.filter((row) => String(row.id) !== String(resetActionId))
              );
            }
            resetActionStore.delete(resetActionId);
            state.resetActionDeleteWrites.push(statement.bound);
            return { success: true, meta: { changes: existing ? 1 : 0 } };
          }
          if (sql.includes('DELETE FROM admin_progress_reset_actions WHERE expires_at < ?')) {
            state.deleteRuns.push({ sql, bound: statement.bound });
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

function createHeatmapDbMock({
  sessionRow = null,
  replaySessionRow = null,
  replayChunkRows = []
} = {}) {
  const state = {
    authAttempts: [],
    heatmapSessions: [],
    heatmapEvents: [],
    heatmapAggregates: [],
    heatmapReplayChunks: [],
    auditLogWrites: [],
    deleteRuns: []
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
          if (sql.includes('FROM sessions')) {
            return sessionRow;
          }
          if (sql.includes('SELECT id FROM heatmap_sessions WHERE site_session_id = ? LIMIT 1')) {
            const siteSessionId = statement.bound[0];
            const existing = state.heatmapSessions.find((row) => row.siteSessionId === siteSessionId);
            return existing ? { id: existing.id } : null;
          }
          if (sql.includes('FROM heatmap_sessions') && sql.includes('WHERE id = ?')) {
            return replaySessionRow;
          }
          return null;
        },
        async all() {
          if (sql.includes('FROM heatmap_replay_chunks')) {
            return { results: replayChunkRows };
          }
          return { results: [] };
        },
        async run() {
          if (sql.includes('INSERT INTO auth_attempts')) {
            state.authAttempts.push(statement.bound);
          }
          if (sql.includes('INSERT INTO heatmap_sessions')) {
            state.heatmapSessions.push({
              id: statement.bound[0],
              siteSessionId: statement.bound[1],
              visitorId: statement.bound[2],
              userId: statement.bound[3]
            });
          }
          if (sql.includes('INSERT INTO heatmap_events')) {
            state.heatmapEvents.push(statement.bound);
          }
          if (sql.includes('INSERT INTO heatmap_daily_aggregates')) {
            state.heatmapAggregates.push(statement.bound);
          }
          if (sql.includes('INSERT INTO heatmap_replay_chunks')) {
            state.heatmapReplayChunks.push(statement.bound);
          }
          if (sql.includes('INSERT INTO audit_logs')) {
            state.auditLogWrites.push(statement.bound);
          }
          if (sql.includes('DELETE FROM heatmap_events')
            || sql.includes('DELETE FROM heatmap_daily_aggregates')
            || sql.includes('DELETE FROM heatmap_replay_chunks')
            || sql.includes('DELETE FROM heatmap_sessions')
            || sql.includes('DELETE FROM admin_progress_reset_actions')) {
            state.deleteRuns.push({ sql, bound: statement.bound });
          }
          return { success: true, meta: { changes: 1 } };
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

  const healthJson = await healthResponse.json();
  assert.equal(healthJson.status, 'ok');
  assert.equal(healthJson.authConfigured, true);
  assert.equal(typeof healthJson.version, 'string');
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

test('/api/admin/students includes signed-in admin progress but still excludes other admin accounts', async () => {
  const worker = loadWorkerModule();
  const secret = 'session-secret';

  const ownAdminPayload = JSON.stringify({
    version: 1,
    items: {
      'progress_llqp-ethics_ethics-01': JSON.stringify({
        viewed: ['1'],
        bookmarked: [],
        revealed: ['1'],
        timers: { '1': 45000 },
        firstAttemptCorrect: { '1': true },
        questionLayout: { questionOrder: ['1', '2'] },
        lastUpdated: '2026-03-25T09:00:00.000Z'
      })
    }
  });

  const adminSelfRow = {
    id: 'admin-1',
    email: 'habibcanad@gmail.com',
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-03-25T09:00:00.000Z',
    last_login_at: '2026-03-25T08:59:00.000Z',
    payload: ownAdminPayload,
    progress_updated_at: '2026-03-25T09:01:00.000Z'
  };

  const otherAdminRow = {
    id: 'admin-2',
    email: 'teammate.admin@example.com',
    status: 'active',
    created_at: '2026-01-03T00:00:00.000Z',
    updated_at: '2026-03-25T09:00:00.000Z',
    last_login_at: '2026-03-25T08:59:00.000Z',
    payload: ownAdminPayload,
    progress_updated_at: '2026-03-25T09:01:00.000Z'
  };

  const regularStudentRow = {
    id: 'student-1',
    email: 'alpha.student@example.com',
    status: 'active',
    created_at: '2026-01-02T00:00:00.000Z',
    updated_at: '2026-03-25T09:00:00.000Z',
    last_login_at: '2026-03-25T08:59:00.000Z',
    payload: null,
    progress_updated_at: null
  };

  const db = createDbMock({
    sessionRow: {
      session_id: 'sess-5',
      user_id: 'admin-1',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      revoked_at: null,
      email: 'habibcanad@gmail.com',
      status: 'active'
    },
    studentRows: [adminSelfRow, regularStudentRow, otherAdminRow],
    studentById: {
      'admin-1': adminSelfRow,
      'admin-2': otherAdminRow
    }
  });

  const env = {
    DB: db,
    SESSION_SECRET: secret,
    ADMIN_EMAIL_ALLOWLIST: 'habibcanad@gmail.com,teammate.admin@example.com'
  };

  const overviewResponse = await worker.defaultExport.fetch(
    new Request('https://hllqpmcqs.com/api/admin/students/overview', {
      headers: {
        Cookie: createSessionCookie(secret, 'admin-token')
      }
    }),
    env
  );

  assert.equal(overviewResponse.status, 200);
  const overviewPayload = await overviewResponse.json();
  assert.deepEqual(
    overviewPayload.students.map((student) => student.id).sort(),
    ['admin-1', 'student-1']
  );
  const ownRow = overviewPayload.students.find((student) => student.id === 'admin-1');
  assert.equal(ownRow.answeredCount, 1);

  const selfDetailResponse = await worker.defaultExport.fetch(
    new Request('https://hllqpmcqs.com/api/admin/students/admin-1', {
      headers: {
        Cookie: createSessionCookie(secret, 'admin-token-detail')
      }
    }),
    env
  );

  assert.equal(selfDetailResponse.status, 200);
  const selfDetailPayload = await selfDetailResponse.json();
  assert.equal(selfDetailPayload.student.id, 'admin-1');
  assert.equal(selfDetailPayload.summary.answeredCount, 1);

  const otherAdminDetailResponse = await worker.defaultExport.fetch(
    new Request('https://hllqpmcqs.com/api/admin/students/admin-2', {
      headers: {
        Cookie: createSessionCookie(secret, 'admin-token-other')
      }
    }),
    env
  );

  assert.equal(otherAdminDetailResponse.status, 404);
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
    },
    pendingResetUndoByUser: {
      'student-1': [
        {
          id: 'undo-1',
          scope: 'topic',
          topic_id: 'llqp-life',
          test_id: null,
          created_at: new Date(Date.now() - 60_000).toISOString(),
          expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
          undone_at: null
        }
      ]
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
  assert.equal(Array.isArray(detailPayload.pendingResetUndoActions), true);
  assert.equal(detailPayload.pendingResetUndoActions[0].resetActionId, 'undo-1');
  assert.equal(detailPayload.pendingResetUndoActions[0].scope, 'topic');

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
  assert.equal(resetPayload.scope, 'test');
  assert.equal(typeof resetPayload.resetActionId, 'string');
  assert.equal(typeof resetPayload.undoExpiresAt, 'string');

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

test('new admin reset and undo routes reject unauthenticated and non-admin sessions', async () => {
  const worker = loadWorkerModule();
  const secret = 'session-secret';
  const routes = [
    '/api/admin/students/student-1/reset-topic-progress',
    '/api/admin/students/student-1/reset-all-tests-progress',
    '/api/admin/students/student-1/undo-reset-progress'
  ];

  for (const route of routes) {
    const unauthenticatedResponse = await worker.defaultExport.fetch(
      new Request(`https://hllqpmcqs.com${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      }),
      {
        DB: createDbMock({ sessionRow: null }),
        SESSION_SECRET: secret,
        ADMIN_EMAIL_ALLOWLIST: 'habibcanad@gmail.com'
      }
    );
    assert.equal(unauthenticatedResponse.status, 401, `expected 401 for ${route}`);

    const nonAdminResponse = await worker.defaultExport.fetch(
      new Request(`https://hllqpmcqs.com${route}`, {
        method: 'POST',
        headers: {
          Cookie: createSessionCookie(secret, `non-admin-${route}`),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      }),
      {
        DB: createDbMock({
          sessionRow: {
            session_id: `sess-non-admin-${route}`,
            user_id: 'student-1',
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            revoked_at: null,
            email: 'student@example.com',
            status: 'active'
          }
        }),
        SESSION_SECRET: secret,
        ADMIN_EMAIL_ALLOWLIST: 'habibcanad@gmail.com'
      }
    );
    assert.equal(nonAdminResponse.status, 403, `expected 403 for ${route}`);
  }
});

test('topic and all-tests reset scopes remove scoped keys and preserve wrong-question stats', async () => {
  const worker = loadWorkerModule();
  const secret = 'session-secret';

  const baseSnapshot = {
    version: 1,
    items: {
      'progress_llqp-life_life-01': JSON.stringify({ revealed: ['1'] }),
      'shuffle_llqp-life_life-01': JSON.stringify({ order: ['1', '2'] }),
      'progress_llqp-life_life-02': JSON.stringify({ revealed: ['3'] }),
      'shuffle_llqp-life_life-02': JSON.stringify({ order: ['3', '4'] }),
      'progress_llqp-ethics_ethics-01': JSON.stringify({ revealed: ['5'] }),
      'shuffle_llqp-ethics_ethics-01': JSON.stringify({ order: ['5', '6'] }),
      wrong_questions: JSON.stringify([{ topicId: 'llqp-life', questionId: 'q-1' }]),
      study_daily_stats: JSON.stringify({ '2026-03-25': { answered: 20 } }),
      last_session: JSON.stringify({ topicId: 'llqp-life', testId: 'life-02' })
    }
  };

  const topicDb = createDbMock({
    sessionRow: {
      session_id: 'sess-topic-reset',
      user_id: 'admin-1',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      revoked_at: null,
      email: 'habibcanad@gmail.com',
      status: 'active'
    },
    studentById: {
      'student-1': {
        id: 'student-1',
        email: 'alpha.student@example.com',
        status: 'active',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-03-25T10:00:00.000Z',
        last_login_at: '2026-03-25T10:00:00.000Z',
        payload: JSON.stringify(baseSnapshot),
        progress_updated_at: '2026-03-25T10:00:00.000Z'
      }
    }
  });

  const topicResponse = await worker.defaultExport.fetch(
    new Request('https://hllqpmcqs.com/api/admin/students/student-1/reset-topic-progress', {
      method: 'POST',
      headers: {
        Cookie: createSessionCookie(secret, 'admin-topic-reset'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ topicId: 'llqp-life' })
    }),
    {
      DB: topicDb,
      SESSION_SECRET: secret,
      ADMIN_EMAIL_ALLOWLIST: 'habibcanad@gmail.com'
    }
  );

  assert.equal(topicResponse.status, 200);
  const topicPayload = await topicResponse.json();
  assert.equal(topicPayload.scope, 'topic');
  assert.equal(topicPayload.topicId, 'llqp-life');
  assert.equal(Array.isArray(topicPayload.removedKeys), true);
  assert.equal(typeof topicPayload.resetActionId, 'string');
  assert.equal(typeof topicPayload.undoExpiresAt, 'string');

  const topicWrittenSnapshot = JSON.parse(topicDb.state.progressWrites[0][1]);
  assert.equal(topicWrittenSnapshot.items['progress_llqp-life_life-01'], undefined);
  assert.equal(topicWrittenSnapshot.items['shuffle_llqp-life_life-01'], undefined);
  assert.equal(topicWrittenSnapshot.items['progress_llqp-life_life-02'], undefined);
  assert.equal(topicWrittenSnapshot.items['shuffle_llqp-life_life-02'], undefined);
  assert.equal(topicWrittenSnapshot.items.last_session, undefined);
  assert.ok(topicWrittenSnapshot.items['progress_llqp-ethics_ethics-01']);
  assert.ok(topicWrittenSnapshot.items['shuffle_llqp-ethics_ethics-01']);
  assert.ok(topicWrittenSnapshot.items.wrong_questions);
  assert.ok(topicWrittenSnapshot.items.study_daily_stats);
  assert.ok(topicDb.state.auditLogWrites.find((entry) => entry[2] === 'admin.progress_reset_topic'));

  const allTestsDb = createDbMock({
    sessionRow: {
      session_id: 'sess-all-tests-reset',
      user_id: 'admin-1',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      revoked_at: null,
      email: 'habibcanad@gmail.com',
      status: 'active'
    },
    studentById: {
      'student-1': {
        id: 'student-1',
        email: 'alpha.student@example.com',
        status: 'active',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-03-25T10:00:00.000Z',
        last_login_at: '2026-03-25T10:00:00.000Z',
        payload: JSON.stringify(baseSnapshot),
        progress_updated_at: '2026-03-25T10:00:00.000Z'
      }
    }
  });

  const allTestsResponse = await worker.defaultExport.fetch(
    new Request('https://hllqpmcqs.com/api/admin/students/student-1/reset-all-tests-progress', {
      method: 'POST',
      headers: {
        Cookie: createSessionCookie(secret, 'admin-all-tests-reset'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    }),
    {
      DB: allTestsDb,
      SESSION_SECRET: secret,
      ADMIN_EMAIL_ALLOWLIST: 'habibcanad@gmail.com'
    }
  );

  assert.equal(allTestsResponse.status, 200);
  const allTestsPayload = await allTestsResponse.json();
  assert.equal(allTestsPayload.scope, 'all-tests');
  assert.equal(typeof allTestsPayload.resetActionId, 'string');
  assert.equal(typeof allTestsPayload.undoExpiresAt, 'string');

  const allTestsWrittenSnapshot = JSON.parse(allTestsDb.state.progressWrites[0][1]);
  Object.keys(allTestsWrittenSnapshot.items).forEach((key) => {
    assert.equal(key.startsWith('progress_') || key.startsWith('shuffle_') || key === 'last_session', false);
  });
  assert.ok(allTestsWrittenSnapshot.items.wrong_questions);
  assert.ok(allTestsWrittenSnapshot.items.study_daily_stats);
  assert.equal(allTestsWrittenSnapshot.items.last_session, undefined);
  assert.ok(allTestsDb.state.auditLogWrites.find((entry) => entry[2] === 'admin.progress_reset_all_tests'));
});

test('undo reset restores pre-reset snapshot and rejects expired, already-undone, and foreign reset actions', async () => {
  const worker = loadWorkerModule();
  const secret = 'session-secret';

  const beforeSnapshot = {
    version: 1,
    items: {
      'progress_llqp-life_life-01': JSON.stringify({ revealed: ['1', '2'] }),
      'shuffle_llqp-life_life-01': JSON.stringify({ order: ['1', '2', '3'] }),
      wrong_questions: JSON.stringify([{ questionId: 'q-3' }]),
      study_daily_stats: JSON.stringify({ '2026-03-25': { answered: 10 } })
    }
  };
  const afterSnapshot = {
    version: 1,
    items: {
      wrong_questions: JSON.stringify([{ questionId: 'q-3' }]),
      study_daily_stats: JSON.stringify({ '2026-03-25': { answered: 10 } })
    }
  };

  const validActionId = 'reset-action-valid';
  const validDb = createDbMock({
    sessionRow: {
      session_id: 'sess-undo',
      user_id: 'admin-1',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      revoked_at: null,
      email: 'habibcanad@gmail.com',
      status: 'active'
    },
    studentById: {
      'student-1': {
        id: 'student-1',
        email: 'alpha.student@example.com',
        status: 'active',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-03-25T10:00:00.000Z',
        last_login_at: '2026-03-25T10:00:00.000Z',
        payload: JSON.stringify(afterSnapshot),
        progress_updated_at: '2026-03-25T10:00:00.000Z'
      }
    },
    resetActionById: {
      [validActionId]: {
        id: validActionId,
        actor_admin_user_id: 'admin-1',
        target_user_id: 'student-1',
        scope: 'all-tests',
        topic_id: null,
        test_id: null,
        before_payload: JSON.stringify(beforeSnapshot),
        after_payload: JSON.stringify(afterSnapshot),
        removed_keys_json: JSON.stringify(['progress_llqp-life_life-01', 'shuffle_llqp-life_life-01']),
        created_at: '2026-03-25T10:05:00.000Z',
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        undone_at: null,
        undone_by_user_id: null
      }
    }
  });

  const undoResponse = await worker.defaultExport.fetch(
    new Request('https://hllqpmcqs.com/api/admin/students/student-1/undo-reset-progress', {
      method: 'POST',
      headers: {
        Cookie: createSessionCookie(secret, 'admin-undo-reset'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ resetActionId: validActionId })
    }),
    {
      DB: validDb,
      SESSION_SECRET: secret,
      ADMIN_EMAIL_ALLOWLIST: 'habibcanad@gmail.com'
    }
  );

  assert.equal(undoResponse.status, 200);
  const undoPayload = await undoResponse.json();
  assert.equal(undoPayload.success, true);
  assert.equal(undoPayload.scope, 'all-tests');
  assert.equal(undoPayload.resetActionId, validActionId);
  assert.equal(validDb.state.progressWrites.length, 1);
  assert.deepEqual(JSON.parse(validDb.state.progressWrites[0][1]), beforeSnapshot);
  assert.equal(validDb.state.resetActionUpdateWrites.length, 1);
  assert.equal(validDb.state.resetActionUpdateWrites[0].changes, 1);
  assert.ok(validDb.state.auditLogWrites.find((entry) => entry[2] === 'admin.progress_reset_undo'));

  const expiredDb = createDbMock({
    sessionRow: {
      session_id: 'sess-undo-expired',
      user_id: 'admin-1',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      revoked_at: null,
      email: 'habibcanad@gmail.com',
      status: 'active'
    },
    studentById: {
      'student-1': {
        id: 'student-1',
        email: 'alpha.student@example.com',
        status: 'active',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-03-25T10:00:00.000Z',
        last_login_at: '2026-03-25T10:00:00.000Z',
        payload: JSON.stringify(afterSnapshot),
        progress_updated_at: '2026-03-25T10:00:00.000Z'
      }
    },
    resetActionById: {
      expired: {
        id: 'expired',
        actor_admin_user_id: 'admin-1',
        target_user_id: 'student-1',
        scope: 'test',
        topic_id: 'llqp-life',
        test_id: 'life-01',
        before_payload: JSON.stringify(beforeSnapshot),
        after_payload: JSON.stringify(afterSnapshot),
        removed_keys_json: JSON.stringify(['progress_llqp-life_life-01']),
        created_at: '2026-03-25T10:05:00.000Z',
        expires_at: new Date(Date.now() - 60 * 1000).toISOString(),
        undone_at: null,
        undone_by_user_id: null
      }
    }
  });
  const expiredResponse = await worker.defaultExport.fetch(
    new Request('https://hllqpmcqs.com/api/admin/students/student-1/undo-reset-progress', {
      method: 'POST',
      headers: {
        Cookie: createSessionCookie(secret, 'admin-undo-expired'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ resetActionId: 'expired' })
    }),
    {
      DB: expiredDb,
      SESSION_SECRET: secret,
      ADMIN_EMAIL_ALLOWLIST: 'habibcanad@gmail.com'
    }
  );
  assert.equal(expiredResponse.status, 410);

  const undoneDb = createDbMock({
    sessionRow: {
      session_id: 'sess-undo-already',
      user_id: 'admin-1',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      revoked_at: null,
      email: 'habibcanad@gmail.com',
      status: 'active'
    },
    studentById: {
      'student-1': {
        id: 'student-1',
        email: 'alpha.student@example.com',
        status: 'active',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-03-25T10:00:00.000Z',
        last_login_at: '2026-03-25T10:00:00.000Z',
        payload: JSON.stringify(afterSnapshot),
        progress_updated_at: '2026-03-25T10:00:00.000Z'
      }
    },
    resetActionById: {
      alreadyUndone: {
        id: 'alreadyUndone',
        actor_admin_user_id: 'admin-1',
        target_user_id: 'student-1',
        scope: 'topic',
        topic_id: 'llqp-life',
        test_id: null,
        before_payload: JSON.stringify(beforeSnapshot),
        after_payload: JSON.stringify(afterSnapshot),
        removed_keys_json: JSON.stringify(['progress_llqp-life_life-01']),
        created_at: '2026-03-25T10:05:00.000Z',
        expires_at: new Date(Date.now() + 60 * 1000).toISOString(),
        undone_at: '2026-03-25T10:07:00.000Z',
        undone_by_user_id: 'admin-1'
      }
    }
  });
  const alreadyUndoneResponse = await worker.defaultExport.fetch(
    new Request('https://hllqpmcqs.com/api/admin/students/student-1/undo-reset-progress', {
      method: 'POST',
      headers: {
        Cookie: createSessionCookie(secret, 'admin-undo-already'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ resetActionId: 'alreadyUndone' })
    }),
    {
      DB: undoneDb,
      SESSION_SECRET: secret,
      ADMIN_EMAIL_ALLOWLIST: 'habibcanad@gmail.com'
    }
  );
  assert.equal(alreadyUndoneResponse.status, 409);

  const foreignDb = createDbMock({
    sessionRow: {
      session_id: 'sess-undo-foreign',
      user_id: 'admin-1',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      revoked_at: null,
      email: 'habibcanad@gmail.com',
      status: 'active'
    },
    studentById: {
      'student-1': {
        id: 'student-1',
        email: 'alpha.student@example.com',
        status: 'active',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-03-25T10:00:00.000Z',
        last_login_at: '2026-03-25T10:00:00.000Z',
        payload: JSON.stringify(afterSnapshot),
        progress_updated_at: '2026-03-25T10:00:00.000Z'
      }
    },
    resetActionById: {
      foreign: {
        id: 'foreign',
        actor_admin_user_id: 'admin-1',
        target_user_id: 'student-2',
        scope: 'all-tests',
        topic_id: null,
        test_id: null,
        before_payload: JSON.stringify(beforeSnapshot),
        after_payload: JSON.stringify(afterSnapshot),
        removed_keys_json: JSON.stringify([]),
        created_at: '2026-03-25T10:05:00.000Z',
        expires_at: new Date(Date.now() + 60 * 1000).toISOString(),
        undone_at: null,
        undone_by_user_id: null
      }
    }
  });
  const foreignResponse = await worker.defaultExport.fetch(
    new Request('https://hllqpmcqs.com/api/admin/students/student-1/undo-reset-progress', {
      method: 'POST',
      headers: {
        Cookie: createSessionCookie(secret, 'admin-undo-foreign'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ resetActionId: 'foreign' })
    }),
    {
      DB: foreignDb,
      SESSION_SECRET: secret,
      ADMIN_EMAIL_ALLOWLIST: 'habibcanad@gmail.com'
    }
  );
  assert.equal(foreignResponse.status, 404);
});

test('/api/auth/config reports heatmapEnabled based on HEATMAP_ENABLED env flag', async () => {
  const worker = loadWorkerModule();

  const disabledResponse = await worker.defaultExport.fetch(
    new Request('https://hllqpmcqs.com/api/auth/config'),
    {
      DB: {},
      SESSION_SECRET: 'secret',
      TURNSTILE_SECRET_KEY: 'turnstile',
      TURNSTILE_SITE_KEY: 'site-key',
      HEATMAP_ENABLED: 'false'
    }
  );
  const disabledPayload = await disabledResponse.json();
  assert.equal(disabledPayload.heatmapEnabled, false);

  const enabledResponse = await worker.defaultExport.fetch(
    new Request('https://hllqpmcqs.com/api/auth/config'),
    {
      DB: {},
      SESSION_SECRET: 'secret',
      TURNSTILE_SECRET_KEY: 'turnstile',
      TURNSTILE_SITE_KEY: 'site-key',
      HEATMAP_ENABLED: 'true'
    }
  );
  const enabledPayload = await enabledResponse.json();
  assert.equal(enabledPayload.heatmapEnabled, true);
});

test('/api/analytics/track ingests guest and authenticated batches with replay chunks', async () => {
  const worker = loadWorkerModule();
  const secret = 'session-secret';

  const guestDb = createHeatmapDbMock();
  const guestResponse = await worker.defaultExport.fetch(
    new Request('https://hllqpmcqs.com/api/analytics/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: 'client-session-guest',
        context: {
          routePath: '/#mcq',
          topicId: 'llqp-life',
          testId: 'life-01',
          questionId: 'q-1',
          deviceType: 'mobile',
          viewport: { width: 390, height: 844 }
        },
        events: [
          {
            type: 'click',
            optionIndex: 1,
            xPercent: 48.5,
            yPercent: 62.2,
            selector: '.option[data-index="1"]'
          }
        ],
        replayChunk: {
          chunkIndex: 0,
          events: [
            {
              type: 'click',
              ts: '2026-03-25T11:00:00.000Z',
              selector: '.option[data-index="1"]'
            }
          ]
        }
      })
    }),
    {
      DB: guestDb,
      SESSION_SECRET: secret,
      HEATMAP_ENABLED: 'true'
    }
  );

  assert.equal(guestResponse.status, 200);
  const guestPayload = await guestResponse.json();
  assert.equal(guestPayload.success, true);
  assert.equal(guestPayload.authenticated, false);
  assert.equal(guestPayload.acceptedEventCount, 1);
  assert.equal(guestPayload.acceptedReplayEvents, 1);
  assert.match(String(guestResponse.headers.get('Set-Cookie') || ''), /mcq_visitor=/);
  assert.equal(guestDb.state.heatmapEvents.length, 1);
  assert.equal(guestDb.state.heatmapAggregates.length, 1);
  assert.equal(guestDb.state.heatmapReplayChunks.length, 1);

  const authDb = createHeatmapDbMock({
    sessionRow: {
      session_id: 'sess-track-admin',
      user_id: 'user-1',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      revoked_at: null,
      email: 'student@example.com',
      status: 'active'
    }
  });
  const authResponse = await worker.defaultExport.fetch(
    new Request('https://hllqpmcqs.com/api/analytics/track', {
      method: 'POST',
      headers: {
        Cookie: createSessionCookie(secret, 'track-auth-token'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: 'client-session-auth',
        context: {
          routePath: '/#mcq',
          topicId: 'llqp-ethics',
          testId: 'ethics-01',
          questionId: 'q-2',
          deviceType: 'desktop',
          viewport: { width: 1280, height: 800 }
        },
        events: [
          {
            type: 'hover',
            optionIndex: 0,
            xPercent: 44.1,
            yPercent: 22.7,
            selector: '.option[data-index="0"]'
          }
        ]
      })
    }),
    {
      DB: authDb,
      SESSION_SECRET: secret,
      HEATMAP_ENABLED: 'true'
    }
  );

  assert.equal(authResponse.status, 200);
  const authPayload = await authResponse.json();
  assert.equal(authPayload.authenticated, true);
  assert.equal(authPayload.acceptedEventCount, 1);
  assert.equal(authDb.state.heatmapEvents.length, 1);
  assert.equal(authDb.state.heatmapEvents[0][2], 'user-1');
});

test('/api/analytics/track enforces same-origin requests', async () => {
  const worker = loadWorkerModule();
  const db = createHeatmapDbMock();

  const response = await worker.defaultExport.fetch(
    new Request('https://hllqpmcqs.com/api/analytics/track', {
      method: 'POST',
      headers: {
        Origin: 'https://evil.example.com',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: 'cross-origin',
        events: [{ type: 'click' }]
      })
    }),
    {
      DB: db,
      SESSION_SECRET: 'secret',
      HEATMAP_ENABLED: 'true'
    }
  );

  assert.equal(response.status, 403);
  assert.equal(db.state.heatmapEvents.length, 0);
});

test('all /api/admin/heatmaps/* routes reject unauthenticated and non-admin access', async () => {
  const worker = loadWorkerModule();
  const secret = 'session-secret';
  const routes = [
    '/api/admin/heatmaps/overview',
    '/api/admin/heatmaps/question/q-1',
    '/api/admin/heatmaps/replays',
    '/api/admin/heatmaps/replays/session-1'
  ];

  for (const route of routes) {
    const unauthResponse = await worker.defaultExport.fetch(
      new Request(`https://hllqpmcqs.com${route}`),
      {
        DB: createHeatmapDbMock({ sessionRow: null }),
        SESSION_SECRET: secret,
        ADMIN_EMAIL_ALLOWLIST: 'habibcanad@gmail.com'
      }
    );
    assert.equal(unauthResponse.status, 401, `expected 401 for ${route}`);

    const nonAdminResponse = await worker.defaultExport.fetch(
      new Request(`https://hllqpmcqs.com${route}`, {
        headers: {
          Cookie: createSessionCookie(secret, `non-admin-${route}`)
        }
      }),
      {
        DB: createHeatmapDbMock({
          sessionRow: {
            session_id: `sess-non-admin-${route}`,
            user_id: 'student-1',
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            revoked_at: null,
            email: 'student@example.com',
            status: 'active'
          }
        }),
        SESSION_SECRET: secret,
        ADMIN_EMAIL_ALLOWLIST: 'habibcanad@gmail.com'
      }
    );
    assert.equal(nonAdminResponse.status, 403, `expected 403 for ${route}`);
  }
});

test('/api/admin/heatmaps/overview returns the expected summary and question list shape for admin users', async () => {
  const worker = loadWorkerModule();
  const secret = 'session-secret';
  const db = createHeatmapDbMock({
    sessionRow: {
      session_id: 'sess-admin-overview',
      user_id: 'admin-1',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      revoked_at: null,
      email: 'habibcanad@gmail.com',
      status: 'active'
    }
  });

  const response = await worker.defaultExport.fetch(
    new Request('https://hllqpmcqs.com/api/admin/heatmaps/overview', {
      headers: {
        Cookie: createSessionCookie(secret, 'admin-overview-token')
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
  assert.equal(typeof payload.summary.sessionCount, 'number');
  assert.equal(Array.isArray(payload.questions), true);
  assert.equal(typeof payload.generatedAt, 'string');
});

test('/api/admin/heatmaps/replays/:sessionId returns replay chunks and session metadata for admins', async () => {
  const worker = loadWorkerModule();
  const secret = 'session-secret';
  const db = createHeatmapDbMock({
    sessionRow: {
      session_id: 'sess-admin-heatmap',
      user_id: 'admin-1',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      revoked_at: null,
      email: 'habibcanad@gmail.com',
      status: 'active'
    },
    replaySessionRow: {
      id: 'session-123',
      site_session_id: 'client-session-123',
      visitor_id: 'visitor-123',
      user_id: 'student-1',
      is_authenticated: 1,
      device_type: 'mobile',
      route_path: '/#mcq',
      topic_id: 'llqp-life',
      test_id: 'life-01',
      quiz_key: 'llqp-life_life-01',
      viewport_width: 390,
      viewport_height: 844,
      created_at: '2026-03-25T09:00:00.000Z',
      updated_at: '2026-03-25T09:01:00.000Z',
      last_event_at: '2026-03-25T09:01:00.000Z'
    },
    replayChunkRows: [
      {
        chunk_index: 0,
        chunk_json: JSON.stringify({ events: [{ type: 'click', ts: '2026-03-25T09:00:01.000Z' }] }),
        event_count: 1,
        occurred_from: '2026-03-25T09:00:01.000Z',
        occurred_to: '2026-03-25T09:00:01.000Z',
        created_at: '2026-03-25T09:00:05.000Z'
      },
      {
        chunk_index: 1,
        chunk_json: JSON.stringify({ events: [{ type: 'scroll', ts: '2026-03-25T09:00:03.000Z' }] }),
        event_count: 1,
        occurred_from: '2026-03-25T09:00:03.000Z',
        occurred_to: '2026-03-25T09:00:03.000Z',
        created_at: '2026-03-25T09:00:06.000Z'
      }
    ]
  });

  const response = await worker.defaultExport.fetch(
    new Request('https://hllqpmcqs.com/api/admin/heatmaps/replays/session-123', {
      headers: {
        Cookie: createSessionCookie(secret, 'admin-heatmap-replay')
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
  assert.equal(payload.session.sessionId, 'session-123');
  assert.equal(payload.session.deviceType, 'mobile');
  assert.deepEqual(payload.chunks.map((chunk) => chunk.chunkIndex), [0, 1]);
  assert.equal(payload.chunks[0].payload.events[0].type, 'click');
  assert.equal(payload.chunks[1].payload.events[0].type, 'scroll');
});

test('scheduled cleanup runs retention deletes for events, aggregates, replay chunks, orphan sessions, and expired reset undo rows', async () => {
  const worker = loadWorkerModule();
  const db = createHeatmapDbMock();
  const waits = [];

  await worker.defaultExport.scheduled({}, { DB: db }, {
    waitUntil(promise) {
      waits.push(promise);
    }
  });
  await Promise.all(waits);

  const deleteSql = db.state.deleteRuns.map((entry) => entry.sql);
  assert.equal(deleteSql.some((sql) => sql.includes('DELETE FROM heatmap_events')), true);
  assert.equal(deleteSql.some((sql) => sql.includes('DELETE FROM heatmap_daily_aggregates')), true);
  assert.equal(deleteSql.some((sql) => sql.includes('DELETE FROM heatmap_replay_chunks')), true);
  assert.equal(deleteSql.some((sql) => sql.includes('DELETE FROM heatmap_sessions')), true);
  assert.equal(deleteSql.some((sql) => sql.includes('DELETE FROM admin_progress_reset_actions')), true);
});
