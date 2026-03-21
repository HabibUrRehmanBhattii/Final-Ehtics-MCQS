const COOKIE_NAME = 'mcq_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const PBKDF2_ITERATIONS = 100000;
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_IP_MAX = 15;
const RATE_LIMIT_EMAIL_MAX = 8;

const jsonResponse = (request, payload, init = {}) => {
  const headers = new Headers(init.headers || {});
  const origin = request.headers.get('Origin');
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Content-Type', 'application/json');

  return new Response(JSON.stringify(payload), {
    ...init,
    headers
  });
};

const hex = (buffer) => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
const base64url = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)))
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/g, '');

const textEncoder = new TextEncoder();

function getErrorStatus(error) {
  const message = String(error?.message || '');
  if (/too many attempts/i.test(message)) return 429;
  if (/missing/i.test(message) || /not configured/i.test(message)) return 503;
  if (/authentication required/i.test(message)) return 401;
  return 500;
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = cookieHeader.split(';').map((part) => part.trim());
  const match = cookies.find((entry) => entry.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function buildCookie(value, expiresAt) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Secure'
  ];

  if (expiresAt) {
    parts.push(`Expires=${new Date(expiresAt).toUTCString()}`);
  }

  return parts.join('; ');
}

function buildExpiredCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Secure; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getClientIp(request) {
  return request.headers.get('CF-Connecting-IP')
    || request.headers.get('x-forwarded-for')
    || 'unknown';
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(value));
  return hex(digest);
}

async function signSessionToken(secret, token) {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(token));
  return base64url(signature);
}

async function hashPassword(password, saltBytes = crypto.getRandomValues(new Uint8Array(16))) {
  const key = await crypto.subtle.importKey('raw', textEncoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt: saltBytes,
    iterations: PBKDF2_ITERATIONS,
    hash: 'SHA-256'
  }, key, 256);

  return `pbkdf2$${PBKDF2_ITERATIONS}$${base64url(saltBytes)}$${base64url(derived)}`;
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function verifyPassword(password, storedHash) {
  const [scheme, iterationsRaw, saltRaw, hashRaw] = String(storedHash || '').split('$');
  if (scheme !== 'pbkdf2' || !iterationsRaw || !saltRaw || !hashRaw) {
    return false;
  }

  const iterations = Number(iterationsRaw);
  const salt = decodeBase64Url(saltRaw);
  const derived = await hashPassword(password, salt);
  return derived === storedHash && iterations === PBKDF2_ITERATIONS;
}

async function validateTurnstile(env, request, token) {
  if (!env.TURNSTILE_SECRET_KEY) {
    throw new Error('TURNSTILE_SECRET_KEY secret is missing');
  }

  const body = new URLSearchParams();
  body.set('secret', env.TURNSTILE_SECRET_KEY);
  body.set('response', token);
  body.set('remoteip', getClientIp(request));

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    body
  });
  const result = await response.json();
  return Boolean(result.success);
}

async function recordAuthAttempt(db, scope, scopeKey, success) {
  await db.prepare(
    'INSERT INTO auth_attempts (id, scope, scope_key, success, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(
    crypto.randomUUID(),
    scope,
    scopeKey,
    success ? 1 : 0,
    new Date().toISOString()
  ).run();
}

async function enforceRateLimit(db, email, ip) {
  const cutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();

  const ipCount = await db.prepare(
    'SELECT COUNT(*) AS count FROM auth_attempts WHERE scope = ? AND scope_key = ? AND created_at >= ? AND success = 0'
  ).bind('ip', ip, cutoff).first();
  if (Number(ipCount?.count || 0) >= RATE_LIMIT_IP_MAX) {
    throw new Error('Too many attempts from this network. Please try again later.');
  }

  const emailCount = await db.prepare(
    'SELECT COUNT(*) AS count FROM auth_attempts WHERE scope = ? AND scope_key = ? AND created_at >= ? AND success = 0'
  ).bind('email', email, cutoff).first();
  if (Number(emailCount?.count || 0) >= RATE_LIMIT_EMAIL_MAX) {
    throw new Error('Too many attempts for this email. Please try again later.');
  }
}

async function createSession(env, request, userId) {
  if (!env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET secret is missing');
  }

  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = base64url(tokenBytes);
  const signature = await signSessionToken(env.SESSION_SECRET, token);
  const cookieValue = `${token}.${signature}`;
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, session_token_hash, created_at, expires_at, revoked_at, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`
  ).bind(
    crypto.randomUUID(),
    userId,
    tokenHash,
    new Date().toISOString(),
    expiresAt,
    getClientIp(request),
    request.headers.get('User-Agent') || ''
  ).run();

  return {
    cookie: buildCookie(cookieValue, expiresAt),
    expiresAt
  };
}

async function getSessionContext(env, request) {
  const rawCookie = getCookie(request, COOKIE_NAME);
  if (!rawCookie || !env.SESSION_SECRET || !env.DB) {
    return null;
  }

  const [token, signature] = rawCookie.split('.');
  if (!token || !signature) return null;

  const expectedSignature = await signSessionToken(env.SESSION_SECRET, token);
  if (signature !== expectedSignature) return null;

  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(
    `SELECT sessions.id AS session_id, sessions.user_id, sessions.expires_at, sessions.revoked_at,
            users.email, users.status
     FROM sessions
     INNER JOIN users ON users.id = sessions.user_id
     WHERE sessions.session_token_hash = ?
     LIMIT 1`
  ).bind(tokenHash).first();

  if (!row || row.revoked_at || row.status !== 'active') {
    return null;
  }

  if (Date.parse(row.expires_at) <= Date.now()) {
    return null;
  }

  return {
    sessionId: row.session_id,
    user: {
      id: row.user_id,
      email: row.email
    }
  };
}

async function requireSession(env, request) {
  const session = await getSessionContext(env, request);
  if (!session) {
    throw new Error('Authentication required');
  }
  return session;
}

async function handleSignup(request, env) {
  const body = await request.json();
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  const turnstileToken = String(body.turnstileToken || '');
  const ip = getClientIp(request);

  if (!env.DB) {
    return jsonResponse(request, { error: 'D1 database is not configured.' }, { status: 503 });
  }

  if (!validateEmail(email)) {
    return jsonResponse(request, { error: 'Please enter a valid email address.' }, { status: 400 });
  }

  if (password.length < 8) {
    return jsonResponse(request, { error: 'Password must be at least 8 characters.' }, { status: 400 });
  }

  if (!turnstileToken) {
    return jsonResponse(request, { error: 'Turnstile token is required.' }, { status: 400 });
  }

  try {
    await enforceRateLimit(env.DB, email, ip);
    const turnstileOk = await validateTurnstile(env, request, turnstileToken);
    if (!turnstileOk) {
      await recordAuthAttempt(env.DB, 'ip', ip, false);
      await recordAuthAttempt(env.DB, 'email', email, false);
      return jsonResponse(request, { error: 'Security check failed. Please try again.' }, { status: 400 });
    }

    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ? LIMIT 1').bind(email).first();
    if (existing) {
      await recordAuthAttempt(env.DB, 'ip', ip, false);
      await recordAuthAttempt(env.DB, 'email', email, false);
      return jsonResponse(request, { error: 'An account with this email already exists.' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);

    await env.DB.prepare(
      'INSERT INTO users (id, email, password_hash, status, created_at, updated_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(userId, email, passwordHash, 'active', now, now, now).run();

    const session = await createSession(env, request, userId);
    await recordAuthAttempt(env.DB, 'ip', ip, true);
    await recordAuthAttempt(env.DB, 'email', email, true);

    return jsonResponse(request, {
      authenticated: true,
      user: { id: userId, email }
    }, {
      headers: {
        'Set-Cookie': session.cookie
      }
    });
  } catch (error) {
    return jsonResponse(request, { error: error.message || 'Sign up failed.' }, { status: getErrorStatus(error) });
  }
}

async function handleSignin(request, env) {
  const body = await request.json();
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  const turnstileToken = String(body.turnstileToken || '');
  const ip = getClientIp(request);

  if (!env.DB) {
    return jsonResponse(request, { error: 'D1 database is not configured.' }, { status: 503 });
  }

  if (!validateEmail(email) || !password || !turnstileToken) {
    return jsonResponse(request, { error: 'Email, password, and security check are required.' }, { status: 400 });
  }

  try {
    await enforceRateLimit(env.DB, email, ip);
    const turnstileOk = await validateTurnstile(env, request, turnstileToken);
    if (!turnstileOk) {
      await recordAuthAttempt(env.DB, 'ip', ip, false);
      await recordAuthAttempt(env.DB, 'email', email, false);
      return jsonResponse(request, { error: 'Security check failed. Please try again.' }, { status: 400 });
    }

    const user = await env.DB.prepare(
      'SELECT id, email, password_hash, status FROM users WHERE email = ? LIMIT 1'
    ).bind(email).first();

    if (!user || user.status !== 'active' || !(await verifyPassword(password, user.password_hash))) {
      await recordAuthAttempt(env.DB, 'ip', ip, false);
      await recordAuthAttempt(env.DB, 'email', email, false);
      return jsonResponse(request, { error: 'Invalid email or password.' }, { status: 401 });
    }

    const session = await createSession(env, request, user.id);
    await env.DB.prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?')
      .bind(new Date().toISOString(), new Date().toISOString(), user.id)
      .run();

    await recordAuthAttempt(env.DB, 'ip', ip, true);
    await recordAuthAttempt(env.DB, 'email', email, true);

    return jsonResponse(request, {
      authenticated: true,
      user: { id: user.id, email: user.email }
    }, {
      headers: {
        'Set-Cookie': session.cookie
      }
    });
  } catch (error) {
    return jsonResponse(request, { error: error.message || 'Sign in failed.' }, { status: getErrorStatus(error) });
  }
}

async function handleSignout(request, env) {
  if (env.DB) {
    const session = await getSessionContext(env, request);
    if (session?.sessionId) {
      await env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ?')
        .bind(new Date().toISOString(), session.sessionId)
        .run();
    }
  }

  return jsonResponse(request, { success: true }, {
    headers: {
      'Set-Cookie': buildExpiredCookie()
    }
  });
}

async function handleSession(request, env) {
  const session = await getSessionContext(env, request);
  if (!session) {
    return jsonResponse(request, { authenticated: false, user: null });
  }

  return jsonResponse(request, {
    authenticated: true,
    user: session.user
  });
}

async function handleSyncProgress(request, env) {
  if (!env.DB) {
    return jsonResponse(request, { error: 'D1 database is not configured.' }, { status: 503 });
  }

  try {
    const session = await requireSession(env, request);
    const body = await request.json();
    const payload = body.progress;
    const serialized = JSON.stringify(payload || {});

    if (serialized.length > 1024 * 1024) {
      return jsonResponse(request, { error: 'Progress payload is too large.' }, { status: 413 });
    }

    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO user_progress (user_id, payload, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`
    ).bind(session.user.id, serialized, now).run();

    return jsonResponse(request, { success: true, syncedAt: now });
  } catch (error) {
    const status = getErrorStatus(error);
    return jsonResponse(request, { error: error.message || 'Sync failed.' }, { status });
  }
}

async function handleGetProgress(request, env) {
  if (!env.DB) {
    return jsonResponse(request, { error: 'D1 database is not configured.' }, { status: 503 });
  }

  try {
    const session = await requireSession(env, request);
    const row = await env.DB.prepare(
      'SELECT payload, updated_at FROM user_progress WHERE user_id = ? LIMIT 1'
    ).bind(session.user.id).first();

    return jsonResponse(request, {
      progress: row?.payload ? JSON.parse(row.payload) : null,
      syncedAt: row?.updated_at || null
    });
  } catch (error) {
    const status = getErrorStatus(error);
    return jsonResponse(request, { error: error.message || 'Load failed.' }, { status });
  }
}

async function handleAIExplain(request, env) {
  try {
    const {
      question,
      correctAnswer,
      userAnswer,
      options,
      isCorrect,
      difficulty,
      tags,
      optionFeedback,
      correctFeedback,
      explanation,
      examTips,
      isFollowUp,
      followUpQuestion
    } = await request.json();

    const systemPrompt = `You are an expert LLQP/HLLQP ethics tutor.
Teach the student, do not just state the answer.
Use plain language, short sentences, and exam-focused coaching.
If the student is wrong, explain the misconception respectfully.
Never output markdown headings or bold markers.
Return ONLY valid JSON. No prose outside JSON.`;

    let userPrompt;

    if (isFollowUp) {
      const specificQuestion = (followUpQuestion || '').trim();
      userPrompt = `The student needs a DEEPER UNDERSTANDING of this ethics concept:

Question: ${question}
Correct Answer: ${correctAnswer}
User's Answer: ${userAnswer}
Difficulty: ${difficulty}
Topics: ${tags}

Student's specific follow-up question:
${specificQuestion || 'Provide one additional exam-focused insight and practical application.'}

Provide a deeper insight that connects this concept to:
1. Related ethical principles
2. Common misconceptions
3. Real-world application scenarios

Make it thought-provoking and help them see the bigger picture.

Return JSON exactly in this shape:
{"followUpInsight":"..."}`;
    } else {
      userPrompt = `Generate a comprehensive breakdown of this ethics question:

QUESTION: ${question}

OPTIONS: ${options.join(' | ')}

STUDENT ANSWERED: ${userAnswer}
CORRECT ANSWER: ${correctAnswer}
IS CORRECT: ${isCorrect}
DIFFICULTY: ${difficulty}
TOPICS: ${tags}

AVAILABLE CONTEXT:
- Option Feedback for student's choice: ${optionFeedback || 'N/A'}
- Why the correct answer is right: ${correctFeedback || 'N/A'}
- Official Explanation: ${explanation || 'N/A'}
- Exam Tips: ${examTips || 'N/A'}

Return JSON exactly in this shape:
{
  "mainExplanation": "2-4 sentences teaching the topic",
  "whyCorrect": "2-3 sentences",
  "whyIncorrect": "2-3 sentences, required only if student is incorrect",
  "keyConcept": "1-2 sentences",
  "studyTip": "practical memory aid",
  "relatedConcept": "what to study next"
}

No markdown. No extra keys. No text before/after JSON.`;
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const responseSchema = isFollowUp
      ? {
          type: 'object',
          properties: {
            followUpInsight: { type: 'string' }
          },
          required: ['followUpInsight']
        }
      : {
          type: 'object',
          properties: {
            mainExplanation: { type: 'string' },
            whyCorrect: { type: 'string' },
            whyIncorrect: { type: 'string' },
            keyConcept: { type: 'string' },
            studyTip: { type: 'string' },
            relatedConcept: { type: 'string' }
          },
          required: ['mainExplanation', 'whyCorrect', 'keyConcept', 'studyTip', 'relatedConcept']
        };

    let response;
    try {
      response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
        messages,
        response_format: {
          type: 'json_schema',
          json_schema: responseSchema
        },
        max_tokens: isFollowUp ? 300 : 700,
        temperature: 0.2
      });
    } catch {
      response = await env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
        messages,
        max_tokens: isFollowUp ? 300 : 700,
        temperature: 0.2
      });
    }

    const responsePayload = response.response;
    const responseText = typeof responsePayload === 'string' ? responsePayload : JSON.stringify(responsePayload);
    let result = { success: true };

    const safeJsonParse = (raw) => {
      if (!raw || typeof raw !== 'string') return null;
      const trimmed = raw.trim();
      try {
        return JSON.parse(trimmed);
      } catch {
        const start = trimmed.indexOf('{');
        const end = trimmed.lastIndexOf('}');
        if (start >= 0 && end > start) {
          try {
            return JSON.parse(trimmed.slice(start, end + 1));
          } catch {
            return null;
          }
        }
        return null;
      }
    };

    if (isFollowUp) {
      const parsed = typeof responsePayload === 'object' && responsePayload !== null
        ? responsePayload
        : safeJsonParse(responseText);
      result.followUpInsight = parsed?.followUpInsight || responseText.trim();
    } else {
      const parsed = typeof responsePayload === 'object' && responsePayload !== null
        ? responsePayload
        : safeJsonParse(responseText);
      if (parsed && typeof parsed === 'object') {
        result.mainExplanation = parsed.mainExplanation;
        result.whyCorrect = parsed.whyCorrect;
        result.whyIncorrect = parsed.whyIncorrect;
        result.keyConcept = parsed.keyConcept;
        result.studyTip = parsed.studyTip;
        result.relatedConcept = parsed.relatedConcept;
      }
      if (!result.mainExplanation && responseText) {
        result.mainExplanation = responseText.trim().substring(0, 700);
      }
    }

    return jsonResponse(request, result);
  } catch (error) {
    return jsonResponse(request, { success: false, error: error.message }, { status: 500 });
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return jsonResponse(request, { ok: true });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/health') {
      return jsonResponse(request, {
        status: 'ok',
        authConfigured: Boolean(env.DB && env.SESSION_SECRET && env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY)
      });
    }

    if (path === '/api/auth/config' && request.method === 'GET') {
      return jsonResponse(request, {
        enabled: Boolean(env.DB && env.SESSION_SECRET && env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY),
        turnstileSiteKey: env.TURNSTILE_SITE_KEY || '',
        authMode: 'email-password'
      });
    }

    if (path === '/api/auth/signup' && request.method === 'POST') {
      return handleSignup(request, env);
    }

    if (path === '/api/auth/signin' && request.method === 'POST') {
      return handleSignin(request, env);
    }

    if (path === '/api/auth/signout' && request.method === 'POST') {
      return handleSignout(request, env);
    }

    if (path === '/api/auth/session' && request.method === 'GET') {
      return handleSession(request, env);
    }

    if (path === '/api/auth/sync-progress' && request.method === 'POST') {
      return handleSyncProgress(request, env);
    }

    if (path === '/api/auth/progress' && request.method === 'GET') {
      return handleGetProgress(request, env);
    }

    if (path === '/api/explain' && request.method === 'POST') {
      return handleAIExplain(request, env);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  }
};
