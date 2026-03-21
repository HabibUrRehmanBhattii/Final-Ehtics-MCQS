const COOKIE_NAME = 'mcq_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const PBKDF2_ITERATIONS = 100000;
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_IP_MAX = 15;
const RATE_LIMIT_EMAIL_MAX = 8;
const AI_RATE_LIMIT_WINDOW_MINUTES = 10;
const AI_RATE_LIMIT_IP_MAX = 20;
const RESET_RATE_LIMIT_WINDOW_MINUTES = 30;
const RESET_RATE_LIMIT_EMAIL_MAX = 5;
const PASSWORD_RESET_TTL_MS = 1000 * 60 * 30;
const RESEND_API_URL = 'https://api.resend.com/emails';
const POSTMARK_API_URL = 'https://api.postmarkapp.com/email';

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
    'SameSite=None',
    'Secure'
  ];

  if (expiresAt) {
    parts.push(`Expires=${new Date(expiresAt).toUTCString()}`);
  }

  return parts.join('; ');
}

function buildExpiredCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=None; Secure; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function getResetEmailConfig(env, request) {
  const provider = String(
    env.RESET_EMAIL_PROVIDER
    || (env.RESEND_API_KEY ? 'resend' : '')
    || (env.POSTMARK_SERVER_TOKEN ? 'postmark' : '')
  ).trim().toLowerCase();
  const from = String(env.RESET_EMAIL_FROM || '').trim();
  const replyTo = String(env.RESET_EMAIL_REPLY_TO || '').trim();
  const appName = String(env.APP_NAME || 'LLQP & WFG Exam Prep').trim();
  const baseUrl = String(env.RESET_BASE_URL || new URL(request.url).origin).trim().replace(/\/+$/, '');

  return {
    provider,
    from,
    replyTo,
    appName,
    baseUrl,
    subject: String(env.RESET_EMAIL_SUBJECT || `Reset your ${appName} password`).trim(),
    postmarkMessageStream: String(env.POSTMARK_MESSAGE_STREAM || 'outbound').trim(),
    resendApiKey: String(env.RESEND_API_KEY || '').trim(),
    postmarkServerToken: String(env.POSTMARK_SERVER_TOKEN || '').trim()
  };
}

function isResetEmailConfigured(config) {
  if (!config?.provider || !config.from || !config.baseUrl) {
    return false;
  }

  if (config.provider === 'resend') {
    return Boolean(config.resendApiKey);
  }

  if (config.provider === 'postmark') {
    return Boolean(config.postmarkServerToken);
  }

  return false;
}

function buildPasswordResetEmail(config, rawToken) {
  const resetUrl = `${config.baseUrl}/?reset=${encodeURIComponent(rawToken)}`;
  const escapedAppName = escapeHtml(config.appName);
  const escapedResetUrl = escapeHtml(resetUrl);

  return {
    resetUrl,
    subject: config.subject,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;">
        <h2 style="margin:0 0 16px;">Reset your password</h2>
        <p style="margin:0 0 16px;">We received a request to reset your password for ${escapedAppName}.</p>
        <p style="margin:0 0 20px;">
          <a href="${escapedResetUrl}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;">
            Reset password
          </a>
        </p>
        <p style="margin:0 0 12px;">This link expires in 30 minutes.</p>
        <p style="margin:0 0 12px;">If the button does not open, copy this link into your browser:</p>
        <p style="margin:0 0 16px;word-break:break-all;"><a href="${escapedResetUrl}">${escapedResetUrl}</a></p>
        <p style="margin:0;color:#475569;">If you did not request this, you can ignore this email.</p>
      </div>
    `.trim(),
    text: [
      `Reset your ${config.appName} password`,
      '',
      `Open this link to reset your password: ${resetUrl}`,
      '',
      'This link expires in 30 minutes.',
      'If you did not request this, you can ignore this email.'
    ].join('\n')
  };
}

async function sendPasswordResetEmail(env, request, email, rawToken) {
  const config = getResetEmailConfig(env, request);
  if (!isResetEmailConfigured(config)) {
    return { sent: false, provider: config.provider || 'not_configured', reason: 'not_configured' };
  }

  const emailPayload = buildPasswordResetEmail(config, rawToken);

  if (config.provider === 'resend') {
    const resendResponse = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'final-ehtics-mcqs/1.0'
      },
      body: JSON.stringify({
        from: config.from,
        to: [email],
        subject: emailPayload.subject,
        html: emailPayload.html,
        text: emailPayload.text,
        ...(config.replyTo ? { reply_to: config.replyTo } : {})
      })
    });

    const rawBody = await resendResponse.text();
    let parsedBody = null;
    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      parsedBody = rawBody || null;
    }

    if (!resendResponse.ok) {
      throw new Error(`Resend email delivery failed (${resendResponse.status}).`);
    }

    return {
      sent: true,
      provider: 'resend',
      messageId: parsedBody?.id || null
    };
  }

  if (config.provider === 'postmark') {
    const postmarkResponse = await fetch(POSTMARK_API_URL, {
      method: 'POST',
      headers: {
        'X-Postmark-Server-Token': config.postmarkServerToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        From: config.from,
        To: email,
        Subject: emailPayload.subject,
        HtmlBody: emailPayload.html,
        TextBody: emailPayload.text,
        ...(config.replyTo ? { ReplyTo: config.replyTo } : {}),
        ...(config.postmarkMessageStream ? { MessageStream: config.postmarkMessageStream } : {})
      })
    });

    const rawBody = await postmarkResponse.text();
    let parsedBody = null;
    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      parsedBody = rawBody || null;
    }

    if (!postmarkResponse.ok || parsedBody?.ErrorCode) {
      throw new Error(`Postmark email delivery failed (${postmarkResponse.status}).`);
    }

    return {
      sent: true,
      provider: 'postmark',
      messageId: parsedBody?.MessageID || null
    };
  }

  throw new Error(`Unsupported reset email provider: ${config.provider}`);
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

async function logAuditEvent(db, request, eventType, eventStatus, userId = null, details = null) {
  if (!db) return;
  await db.prepare(
    `INSERT INTO audit_logs (id, user_id, event_type, event_status, ip_address, user_agent, details_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(),
    userId,
    eventType,
    eventStatus,
    getClientIp(request),
    request.headers.get('User-Agent') || '',
    details ? JSON.stringify(details) : null,
    new Date().toISOString()
  ).run();
}

async function enforceRateLimit(db, email, ip, options = {}) {
  const ipScope = options.ipScope || 'ip';
  const emailScope = options.emailScope || 'email';
  const windowMinutes = options.windowMinutes || RATE_LIMIT_WINDOW_MINUTES;
  const ipMax = options.ipMax ?? RATE_LIMIT_IP_MAX;
  const emailMax = options.emailMax ?? RATE_LIMIT_EMAIL_MAX;
  const failedOnly = options.failedOnly !== false;
  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const countSql = failedOnly
    ? 'SELECT COUNT(*) AS count FROM auth_attempts WHERE scope = ? AND scope_key = ? AND created_at >= ? AND success = 0'
    : 'SELECT COUNT(*) AS count FROM auth_attempts WHERE scope = ? AND scope_key = ? AND created_at >= ?';

  const ipCount = await db.prepare(
    countSql
  ).bind(ipScope, ip, cutoff).first();
  if (Number(ipCount?.count || 0) >= ipMax) {
    throw new Error('Too many attempts from this network. Please try again later.');
  }

  const emailCount = await db.prepare(
    countSql
  ).bind(emailScope, email, cutoff).first();
  if (Number(emailCount?.count || 0) >= emailMax) {
    throw new Error('Too many attempts for this email. Please try again later.');
  }
}

async function enforceIpOnlyRateLimit(db, ip, scope, maxAttempts, windowMinutes, failedOnly = true) {
  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const sql = failedOnly
    ? 'SELECT COUNT(*) AS count FROM auth_attempts WHERE scope = ? AND scope_key = ? AND created_at >= ? AND success = 0'
    : 'SELECT COUNT(*) AS count FROM auth_attempts WHERE scope = ? AND scope_key = ? AND created_at >= ?';
  const row = await db.prepare(
    sql
  ).bind(scope, ip, cutoff).first();
  if (Number(row?.count || 0) >= maxAttempts) {
    throw new Error('Too many attempts from this network. Please try again later.');
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
      await logAuditEvent(env.DB, request, 'auth.signup', 'failed', null, { reason: 'turnstile', email });
      return jsonResponse(request, { error: 'Security check failed. Please try again.' }, { status: 400 });
    }

    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ? LIMIT 1').bind(email).first();
    if (existing) {
      await recordAuthAttempt(env.DB, 'ip', ip, false);
      await recordAuthAttempt(env.DB, 'email', email, false);
      await logAuditEvent(env.DB, request, 'auth.signup', 'failed', existing.id, { reason: 'duplicate_email', email });
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
    await logAuditEvent(env.DB, request, 'auth.signup', 'success', userId, { email });

    return jsonResponse(request, {
      authenticated: true,
      user: { id: userId, email }
    }, {
      headers: {
        'Set-Cookie': session.cookie
      }
    });
  } catch (error) {
    await logAuditEvent(env.DB, request, 'auth.signup', 'failed', null, { reason: error.message, email });
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
      await logAuditEvent(env.DB, request, 'auth.signin', 'failed', null, { reason: 'turnstile', email });
      return jsonResponse(request, { error: 'Security check failed. Please try again.' }, { status: 400 });
    }

    const user = await env.DB.prepare(
      'SELECT id, email, password_hash, status FROM users WHERE email = ? LIMIT 1'
    ).bind(email).first();

    if (!user || user.status !== 'active' || !(await verifyPassword(password, user.password_hash))) {
      await recordAuthAttempt(env.DB, 'ip', ip, false);
      await recordAuthAttempt(env.DB, 'email', email, false);
      await logAuditEvent(env.DB, request, 'auth.signin', 'failed', user?.id || null, { reason: 'invalid_credentials', email });
      return jsonResponse(request, { error: 'Invalid email or password.' }, { status: 401 });
    }

    const session = await createSession(env, request, user.id);
    await env.DB.prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?')
      .bind(new Date().toISOString(), new Date().toISOString(), user.id)
      .run();

    await recordAuthAttempt(env.DB, 'ip', ip, true);
    await recordAuthAttempt(env.DB, 'email', email, true);
    await logAuditEvent(env.DB, request, 'auth.signin', 'success', user.id, { email });

    return jsonResponse(request, {
      authenticated: true,
      user: { id: user.id, email: user.email }
    }, {
      headers: {
        'Set-Cookie': session.cookie
      }
    });
  } catch (error) {
    await logAuditEvent(env.DB, request, 'auth.signin', 'failed', null, { reason: error.message, email });
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
      await logAuditEvent(env.DB, request, 'auth.signout', 'success', session.user.id, null);
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
    await logAuditEvent(env.DB, request, 'progress.sync', 'success', session.user.id, { bytes: serialized.length });

    return jsonResponse(request, { success: true, syncedAt: now });
  } catch (error) {
    try {
      const session = await getSessionContext(env, request);
      await logAuditEvent(env.DB, request, 'progress.sync', 'failed', session?.user?.id || null, { reason: error.message });
    } catch {}
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
    if (env.DB) {
      const ip = getClientIp(request);
      await enforceIpOnlyRateLimit(env.DB, ip, 'ai_ip', AI_RATE_LIMIT_IP_MAX, AI_RATE_LIMIT_WINDOW_MINUTES, false);
      await recordAuthAttempt(env.DB, 'ai_ip', ip, true);
    }
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
    if (env.DB) {
      await recordAuthAttempt(env.DB, 'ai_ip', getClientIp(request), false);
      await logAuditEvent(env.DB, request, 'ai.explain', 'failed', null, { reason: error.message });
    }
    return jsonResponse(request, { success: false, error: error.message }, { status: 500 });
  }
}

async function handlePasswordResetRequest(request, env) {
  const body = await request.json();
  const email = normalizeEmail(body.email);
  const turnstileToken = String(body.turnstileToken || '');
  const ip = getClientIp(request);

  if (!env.DB) {
    return jsonResponse(request, { error: 'D1 database is not configured.' }, { status: 503 });
  }

  if (!validateEmail(email) || !turnstileToken) {
    return jsonResponse(request, { error: 'Email and security check are required.' }, { status: 400 });
  }

  try {
    const emailConfig = getResetEmailConfig(env, request);

    await enforceRateLimit(env.DB, email, ip, {
      ipScope: 'password_reset_ip',
      emailScope: 'password_reset_email',
      ipMax: RESET_RATE_LIMIT_EMAIL_MAX,
      emailMax: RESET_RATE_LIMIT_EMAIL_MAX,
      windowMinutes: RESET_RATE_LIMIT_WINDOW_MINUTES,
      failedOnly: false
    });

    const turnstileOk = await validateTurnstile(env, request, turnstileToken);
    if (!turnstileOk) {
      await recordAuthAttempt(env.DB, 'password_reset_ip', ip, false);
      await recordAuthAttempt(env.DB, 'password_reset_email', email, false);
      await logAuditEvent(env.DB, request, 'auth.password_reset_request', 'failed', null, { reason: 'turnstile', email });
      return jsonResponse(request, { error: 'Security check failed. Please try again.' }, { status: 400 });
    }

    const user = await env.DB.prepare(
      'SELECT id, email, status FROM users WHERE email = ? LIMIT 1'
    ).bind(email).first();

    if (user?.id && user.status === 'active') {
      await recordAuthAttempt(env.DB, 'password_reset_ip', ip, true);
      await recordAuthAttempt(env.DB, 'password_reset_email', email, true);
      const rawToken = base64url(crypto.getRandomValues(new Uint8Array(24)));
      const tokenHash = await sha256(rawToken);
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString();

      await env.DB.prepare(
        `INSERT INTO password_reset_tokens (id, user_id, token_hash, created_at, expires_at, used_at, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`
      ).bind(
        crypto.randomUUID(),
        user.id,
        tokenHash,
        now,
        expiresAt,
        ip,
        request.headers.get('User-Agent') || ''
      ).run();

      const delivery = await sendPasswordResetEmail(env, request, email, rawToken);

      await logAuditEvent(env.DB, request, 'auth.password_reset_request', 'success', user.id, {
        email,
        expiresAt,
        delivery: delivery.provider,
        messageId: delivery.messageId || null
      });
    } else {
      await recordAuthAttempt(env.DB, 'password_reset_ip', ip, true);
      await recordAuthAttempt(env.DB, 'password_reset_email', email, true);
      await logAuditEvent(env.DB, request, 'auth.password_reset_request', 'ignored', null, { email });
    }

    return jsonResponse(request, {
      success: true,
      message: isResetEmailConfigured(emailConfig)
        ? 'If the account exists, reset instructions will be sent.'
        : 'If the account exists, a reset request has been recorded. Email delivery is not configured yet.'
    });
  } catch (error) {
    await logAuditEvent(env.DB, request, 'auth.password_reset_request', 'failed', null, { reason: error.message, email });
    return jsonResponse(request, { error: error.message || 'Reset request failed.' }, { status: getErrorStatus(error) });
  }
}

async function handlePasswordResetConfirm(request, env) {
  const body = await request.json();
  const token = String(body.token || '');
  const newPassword = String(body.newPassword || '');
  const turnstileToken = String(body.turnstileToken || '');
  const ip = getClientIp(request);

  if (!env.DB) {
    return jsonResponse(request, { error: 'D1 database is not configured.' }, { status: 503 });
  }

  if (!token || newPassword.length < 8 || !turnstileToken) {
    return jsonResponse(request, { error: 'Reset token, new password, and security check are required.' }, { status: 400 });
  }

  try {
    await enforceIpOnlyRateLimit(env.DB, ip, 'password_reset_confirm_ip', RESET_RATE_LIMIT_EMAIL_MAX, RESET_RATE_LIMIT_WINDOW_MINUTES, false);
    await recordAuthAttempt(env.DB, 'password_reset_confirm_ip', ip, true);
    const turnstileOk = await validateTurnstile(env, request, turnstileToken);
    if (!turnstileOk) {
      await recordAuthAttempt(env.DB, 'password_reset_confirm_ip', ip, false);
      return jsonResponse(request, { error: 'Security check failed. Please try again.' }, { status: 400 });
    }

    const tokenHash = await sha256(token);
    const row = await env.DB.prepare(
      `SELECT id, user_id, expires_at, used_at
       FROM password_reset_tokens
       WHERE token_hash = ?
       LIMIT 1`
    ).bind(tokenHash).first();

    if (!row || row.used_at || Date.parse(row.expires_at) <= Date.now()) {
      await recordAuthAttempt(env.DB, 'password_reset_confirm_ip', ip, false);
      await logAuditEvent(env.DB, request, 'auth.password_reset_confirm', 'failed', row?.user_id || null, { reason: 'invalid_or_expired' });
      return jsonResponse(request, { error: 'Reset token is invalid or expired.' }, { status: 400 });
    }

    const passwordHash = await hashPassword(newPassword);
    const now = new Date().toISOString();
    await env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .bind(passwordHash, now, row.user_id)
      .run();
    await env.DB.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE id = ?')
      .bind(now, row.id)
      .run();
    await env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL')
      .bind(now, row.user_id)
      .run();
    await logAuditEvent(env.DB, request, 'auth.password_reset_confirm', 'success', row.user_id, null);

    return jsonResponse(request, { success: true, message: 'Password reset successfully.' });
  } catch (error) {
    await logAuditEvent(env.DB, request, 'auth.password_reset_confirm', 'failed', null, { reason: error.message });
    return jsonResponse(request, { error: error.message || 'Password reset failed.' }, { status: getErrorStatus(error) });
  }
}

async function handlePasswordChange(request, env) {
  if (!env.DB) {
    return jsonResponse(request, { error: 'D1 database is not configured.' }, { status: 503 });
  }

  try {
    const session = await requireSession(env, request);
    const body = await request.json();
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');
    const turnstileToken = String(body.turnstileToken || '');

    if (!currentPassword || newPassword.length < 8 || !turnstileToken) {
      return jsonResponse(request, { error: 'Current password, new password, and security check are required.' }, { status: 400 });
    }

    const turnstileOk = await validateTurnstile(env, request, turnstileToken);
    if (!turnstileOk) {
      await logAuditEvent(env.DB, request, 'auth.password_change', 'failed', session.user.id, { reason: 'turnstile' });
      return jsonResponse(request, { error: 'Security check failed. Please try again.' }, { status: 400 });
    }

    const user = await env.DB.prepare(
      'SELECT id, password_hash, status FROM users WHERE id = ? LIMIT 1'
    ).bind(session.user.id).first();
    if (!user || user.status !== 'active' || !(await verifyPassword(currentPassword, user.password_hash))) {
      await logAuditEvent(env.DB, request, 'auth.password_change', 'failed', session.user.id, { reason: 'invalid_current_password' });
      return jsonResponse(request, { error: 'Current password is incorrect.' }, { status: 401 });
    }

    const passwordHash = await hashPassword(newPassword);
    const now = new Date().toISOString();
    await env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .bind(passwordHash, now, user.id)
      .run();
    await env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND id != ? AND revoked_at IS NULL')
      .bind(now, user.id, session.sessionId)
      .run();
    await logAuditEvent(env.DB, request, 'auth.password_change', 'success', user.id, null);

    return jsonResponse(request, { success: true, message: 'Password updated successfully.' });
  } catch (error) {
    const session = await getSessionContext(env, request).catch(() => null);
    await logAuditEvent(env.DB, request, 'auth.password_change', 'failed', session?.user?.id || null, { reason: error.message });
    return jsonResponse(request, { error: error.message || 'Password change failed.' }, { status: getErrorStatus(error) });
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
      const resetEmailConfig = getResetEmailConfig(env, request);
      return jsonResponse(request, {
        enabled: Boolean(env.DB && env.SESSION_SECRET && env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY),
        turnstileSiteKey: env.TURNSTILE_SITE_KEY || '',
        authMode: 'email-password',
        passwordResetEmailEnabled: isResetEmailConfigured(resetEmailConfig)
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

    if (path === '/api/auth/password-reset/request' && request.method === 'POST') {
      return handlePasswordResetRequest(request, env);
    }

    if (path === '/api/auth/password-reset/confirm' && request.method === 'POST') {
      return handlePasswordResetConfirm(request, env);
    }

    if (path === '/api/auth/password-change' && request.method === 'POST') {
      return handlePasswordChange(request, env);
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
