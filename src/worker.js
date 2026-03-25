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
const ADMIN_ACTIVE_WINDOW_DAYS = 7;
const DEFAULT_ADMIN_EMAIL = 'habibcanad@gmail.com';
const HEATMAP_VISITOR_COOKIE = 'mcq_visitor';
const HEATMAP_VISITOR_TTL_SECONDS = 60 * 60 * 24 * 365;
const HEATMAP_BATCH_MAX_EVENTS = 500;
const HEATMAP_MAX_PAYLOAD_BYTES = 256 * 1024;
const HEATMAP_REPLAY_MAX_EVENTS = 1000;
const HEATMAP_RATE_LIMIT_WINDOW_MINUTES = 10;
const HEATMAP_RATE_LIMIT_IP_MAX = 1500;
const HEATMAP_EVENT_RETENTION_DAYS = 90;
const HEATMAP_REPLAY_RETENTION_DAYS = 14;

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

const textResponse = (request, payload, init = {}) => {
  const headers = new Headers(init.headers || {});
  const origin = request.headers.get('Origin');
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'text/plain; charset=utf-8');
  }

  return new Response(payload, {
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
  if (/admin access denied/i.test(message)) return 403;
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

function buildVisitorCookie(visitorId) {
  return [
    `${HEATMAP_VISITOR_COOKIE}=${encodeURIComponent(visitorId)}`,
    'Path=/',
    'SameSite=Lax',
    'Secure',
    `Max-Age=${HEATMAP_VISITOR_TTL_SECONDS}`
  ].join('; ');
}

function getOrCreateHeatmapVisitorId(request) {
  const existing = getCookie(request, HEATMAP_VISITOR_COOKIE);
  if (existing) {
    return {
      visitorId: existing,
      shouldSetCookie: false
    };
  }

  return {
    visitorId: `v_${base64url(crypto.getRandomValues(new Uint8Array(18)))}`,
    shouldSetCookie: true
  };
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getAdminEmailAllowlist(env) {
  const configuredRaw = String(env?.ADMIN_EMAIL_ALLOWLIST || '').trim();
  const source = configuredRaw || DEFAULT_ADMIN_EMAIL;
  return Array.from(
    new Set(
      source
        .split(',')
        .map((email) => normalizeEmail(email))
        .filter(Boolean)
    )
  );
}

function isAdminEmail(env, email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return getAdminEmailAllowlist(env).includes(normalized);
}

function buildAuthUser(env, userId, email) {
  return {
    id: userId,
    email,
    isAdmin: isAdminEmail(env, email)
  };
}

function isHeatmapEnabled(env) {
  const rawValue = String(env?.HEATMAP_ENABLED ?? 'true').trim().toLowerCase();
  if (!rawValue) return true;
  return !['0', 'false', 'off', 'no', 'disabled'].includes(rawValue);
}

function normalizeDateOnly(input, fallback) {
  const value = String(input || '').trim();
  if (!value) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  return value;
}

function clampNumber(value, min, max, fallback = null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeHeatmapDeviceType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'mobile' || normalized === 'desktop' || normalized === 'tablet') {
    return normalized;
  }
  return 'unknown';
}

function normalizeHeatmapAudience(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'authenticated' || normalized === 'guest' || normalized === 'all') {
    return normalized;
  }
  return 'all';
}

function trimTo(value, maxLength = 255, fallback = '') {
  const normalized = String(value || '').trim();
  if (!normalized) return fallback;
  return normalized.slice(0, maxLength);
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
  const cfIp = String(request.headers.get('CF-Connecting-IP') || '').trim();
  if (cfIp) {
    return cfIp;
  }

  const forwardedFor = String(request.headers.get('x-forwarded-for') || '').trim();
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  return 'unknown';
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
    user: buildAuthUser(env, row.user_id, row.email)
  };
}

async function requireSession(env, request) {
  const session = await getSessionContext(env, request);
  if (!session) {
    throw new Error('Authentication required');
  }
  return session;
}

async function requireAdminSession(env, request) {
  const session = await requireSession(env, request);
  if (!session.user?.isAdmin) {
    throw new Error('Admin access denied');
  }
  return session;
}

async function issuePasswordResetToken(db, request, userId) {
  const rawToken = base64url(crypto.getRandomValues(new Uint8Array(24)));
  const tokenHash = await sha256(rawToken);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString();

  await db.prepare(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, created_at, expires_at, used_at, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`
  ).bind(
    crypto.randomUUID(),
    userId,
    tokenHash,
    now,
    expiresAt,
    getClientIp(request),
    request.headers.get('User-Agent') || ''
  ).run();

  return { rawToken, expiresAt };
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
      user: buildAuthUser(env, userId, email)
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
      user: buildAuthUser(env, user.id, user.email)
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
      const { rawToken, expiresAt } = await issuePasswordResetToken(env.DB, request, user.id);

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

function parseJsonString(rawValue, fallback = null) {
  if (typeof rawValue !== 'string') {
    return fallback;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return fallback;
  }
}

function roundToOneDecimal(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 10) / 10;
}

function parseProgressStorageKey(key, prefix) {
  if (typeof key !== 'string' || !key.startsWith(prefix)) {
    return null;
  }

  const remainder = key.slice(prefix.length);
  const separatorIndex = remainder.indexOf('_');
  if (separatorIndex <= 0 || separatorIndex === remainder.length - 1) {
    return null;
  }

  return {
    topicId: remainder.slice(0, separatorIndex),
    testId: remainder.slice(separatorIndex + 1)
  };
}

function countUniqueEntries(list) {
  if (!Array.isArray(list)) return 0;
  return new Set(list.map((value) => String(value))).size;
}

function sumTimerValues(timerMap) {
  if (!timerMap || typeof timerMap !== 'object') {
    return 0;
  }

  return Object.values(timerMap).reduce((sum, value) => {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return sum;
    }
    return sum + numeric;
  }, 0);
}

function extractProgressItems(payloadRaw) {
  const snapshot = parseJsonString(payloadRaw, {});
  if (!snapshot || typeof snapshot !== 'object') {
    return {};
  }
  if (!snapshot.items || typeof snapshot.items !== 'object') {
    return {};
  }
  return snapshot.items;
}

function buildStudentAnalyticsFromPayload(payloadRaw) {
  const items = extractProgressItems(payloadRaw);
  const testMetrics = new Map();

  const ensureTestMetric = (topicId, testId) => {
    const testKey = `${topicId}_${testId}`;
    if (!testMetrics.has(testKey)) {
      testMetrics.set(testKey, {
        testKey,
        topicId,
        testId,
        progressKey: `progress_${topicId}_${testId}`,
        shuffleKey: `shuffle_${topicId}_${testId}`,
        hasProgress: false,
        hasShuffle: false,
        viewedCount: 0,
        bookmarkedCount: 0,
        revealedCount: 0,
        answeredCount: 0,
        firstTryCorrectCount: 0,
        firstTryAttemptedCount: 0,
        firstTryAccuracyPct: 0,
        totalQuestions: 0,
        completionPct: 0,
        studyTimeMs: 0,
        studyTimeMinutes: 0,
        lastUpdatedAt: null
      });
    }
    return testMetrics.get(testKey);
  };

  let lastSession = null;

  Object.entries(items).forEach(([storageKey, storageValue]) => {
    if (storageKey === 'last_session') {
      const parsedSession = parseJsonString(storageValue, null);
      if (parsedSession && typeof parsedSession === 'object') {
        lastSession = {
          topicId: String(parsedSession.topicId || '').trim() || null,
          testId: String(parsedSession.testId || '').trim() || null,
          savedAt: typeof parsedSession.savedAt === 'string' ? parsedSession.savedAt : null
        };
      }
      return;
    }

    const progressMatch = parseProgressStorageKey(storageKey, 'progress_');
    if (progressMatch) {
      const parsedProgress = parseJsonString(storageValue, {});
      const metric = ensureTestMetric(progressMatch.topicId, progressMatch.testId);
      metric.hasProgress = true;

      const viewedCount = countUniqueEntries(parsedProgress?.viewed);
      const bookmarkedCount = countUniqueEntries(parsedProgress?.bookmarked);
      const revealedCount = countUniqueEntries(parsedProgress?.revealed);
      const firstAttemptMap = parsedProgress?.firstAttemptCorrect && typeof parsedProgress.firstAttemptCorrect === 'object'
        ? parsedProgress.firstAttemptCorrect
        : {};
      const timerMap = parsedProgress?.timers && typeof parsedProgress.timers === 'object'
        ? parsedProgress.timers
        : {};

      let firstTryCorrectCount = 0;
      let firstTryAttemptedCount = 0;
      Object.values(firstAttemptMap).forEach((value) => {
        if (value === true || value === false) {
          firstTryAttemptedCount += 1;
          if (value === true) {
            firstTryCorrectCount += 1;
          }
        }
      });

      const layoutQuestionCount = Array.isArray(parsedProgress?.questionLayout?.questionOrder)
        ? parsedProgress.questionLayout.questionOrder.length
        : 0;
      const fallbackQuestionCount = Math.max(
        viewedCount,
        bookmarkedCount,
        revealedCount,
        Object.keys(firstAttemptMap).length,
        Object.keys(timerMap).length
      );
      const totalQuestions = Math.max(layoutQuestionCount, fallbackQuestionCount);
      const studyTimeMs = sumTimerValues(timerMap);
      const firstTryAccuracyPct = firstTryAttemptedCount > 0
        ? roundToOneDecimal((firstTryCorrectCount / firstTryAttemptedCount) * 100)
        : 0;
      const completionPct = totalQuestions > 0
        ? roundToOneDecimal((revealedCount / totalQuestions) * 100)
        : 0;

      metric.viewedCount = viewedCount;
      metric.bookmarkedCount = bookmarkedCount;
      metric.revealedCount = revealedCount;
      metric.answeredCount = revealedCount;
      metric.firstTryCorrectCount = firstTryCorrectCount;
      metric.firstTryAttemptedCount = firstTryAttemptedCount;
      metric.firstTryAccuracyPct = firstTryAccuracyPct;
      metric.totalQuestions = totalQuestions;
      metric.completionPct = completionPct;
      metric.studyTimeMs = studyTimeMs;
      metric.studyTimeMinutes = roundToOneDecimal(studyTimeMs / 60000);
      metric.lastUpdatedAt = typeof parsedProgress?.lastUpdated === 'string' ? parsedProgress.lastUpdated : null;
      return;
    }

    const shuffleMatch = parseProgressStorageKey(storageKey, 'shuffle_');
    if (shuffleMatch) {
      const metric = ensureTestMetric(shuffleMatch.topicId, shuffleMatch.testId);
      metric.hasShuffle = true;
    }
  });

  const tests = Array.from(testMetrics.values()).sort((a, b) => {
    if (a.topicId === b.topicId) {
      return a.testId.localeCompare(b.testId);
    }
    return a.topicId.localeCompare(b.topicId);
  });

  const topicMap = new Map();
  let totalTests = 0;
  let totalQuestions = 0;
  let answeredCount = 0;
  let viewedCount = 0;
  let bookmarkedCount = 0;
  let firstTryCorrectCount = 0;
  let firstTryAttemptedCount = 0;
  let totalStudyTimeMs = 0;
  let lastUpdatedAt = null;

  tests.forEach((test) => {
    totalTests += 1;
    totalQuestions += Number(test.totalQuestions || 0);
    answeredCount += Number(test.answeredCount || 0);
    viewedCount += Number(test.viewedCount || 0);
    bookmarkedCount += Number(test.bookmarkedCount || 0);
    firstTryCorrectCount += Number(test.firstTryCorrectCount || 0);
    firstTryAttemptedCount += Number(test.firstTryAttemptedCount || 0);
    totalStudyTimeMs += Number(test.studyTimeMs || 0);

    if (test.lastUpdatedAt && (!lastUpdatedAt || Date.parse(test.lastUpdatedAt) > Date.parse(lastUpdatedAt))) {
      lastUpdatedAt = test.lastUpdatedAt;
    }

    if (!topicMap.has(test.topicId)) {
      topicMap.set(test.topicId, {
        topicId: test.topicId,
        totalTests: 0,
        totalQuestions: 0,
        answeredCount: 0,
        viewedCount: 0,
        bookmarkedCount: 0,
        firstTryCorrectCount: 0,
        firstTryAttemptedCount: 0,
        firstTryAccuracyPct: 0,
        completionPct: 0,
        totalStudyTimeMs: 0,
        totalStudyTimeMinutes: 0,
        lastUpdatedAt: null,
        tests: []
      });
    }

    const topic = topicMap.get(test.topicId);
    topic.totalTests += 1;
    topic.totalQuestions += Number(test.totalQuestions || 0);
    topic.answeredCount += Number(test.answeredCount || 0);
    topic.viewedCount += Number(test.viewedCount || 0);
    topic.bookmarkedCount += Number(test.bookmarkedCount || 0);
    topic.firstTryCorrectCount += Number(test.firstTryCorrectCount || 0);
    topic.firstTryAttemptedCount += Number(test.firstTryAttemptedCount || 0);
    topic.totalStudyTimeMs += Number(test.studyTimeMs || 0);
    topic.totalStudyTimeMinutes = roundToOneDecimal(topic.totalStudyTimeMs / 60000);
    topic.completionPct = topic.totalQuestions > 0
      ? roundToOneDecimal((topic.answeredCount / topic.totalQuestions) * 100)
      : 0;
    topic.firstTryAccuracyPct = topic.firstTryAttemptedCount > 0
      ? roundToOneDecimal((topic.firstTryCorrectCount / topic.firstTryAttemptedCount) * 100)
      : 0;
    if (test.lastUpdatedAt && (!topic.lastUpdatedAt || Date.parse(test.lastUpdatedAt) > Date.parse(topic.lastUpdatedAt))) {
      topic.lastUpdatedAt = test.lastUpdatedAt;
    }
    topic.tests.push(test);
  });

  const completionPct = totalQuestions > 0
    ? roundToOneDecimal((answeredCount / totalQuestions) * 100)
    : 0;
  const firstTryAccuracyPct = firstTryAttemptedCount > 0
    ? roundToOneDecimal((firstTryCorrectCount / firstTryAttemptedCount) * 100)
    : 0;

  const topics = Array.from(topicMap.values()).sort((a, b) => a.topicId.localeCompare(b.topicId));

  return {
    summary: {
      totalTests,
      totalQuestions,
      answeredCount,
      viewedCount,
      bookmarkedCount,
      firstTryCorrectCount,
      firstTryAttemptedCount,
      firstTryAccuracyPct,
      completionPct,
      totalStudyTimeMs,
      totalStudyTimeMinutes: roundToOneDecimal(totalStudyTimeMs / 60000),
      lastUpdatedAt
    },
    topics,
    tests,
    lastSession
  };
}

function isTimestampWithinDays(isoTimestamp, days = ADMIN_ACTIVE_WINDOW_DAYS) {
  if (!isoTimestamp) return false;
  const parsed = Date.parse(isoTimestamp);
  if (!Number.isFinite(parsed)) return false;
  return parsed >= (Date.now() - (days * 24 * 60 * 60 * 1000));
}

async function listStudentRows(env, options = {}) {
  const includeUserId = String(options.includeUserId || '').trim();
  const rows = await env.DB.prepare(
    `SELECT users.id, users.email, users.status, users.created_at, users.updated_at, users.last_login_at,
            user_progress.payload, user_progress.updated_at AS progress_updated_at
     FROM users
     LEFT JOIN user_progress ON user_progress.user_id = users.id
     WHERE users.status = 'active'
     ORDER BY users.email ASC`
  ).all();

  return (rows?.results || []).filter((row) => {
    const isAdminRow = isAdminEmail(env, row.email);
    if (!isAdminRow) {
      return true;
    }
    return Boolean(includeUserId && String(row.id) === includeUserId);
  });
}

async function getStudentRowById(env, userId, options = {}) {
  const allowAdminUserId = String(options.allowAdminUserId || '').trim();
  const row = await env.DB.prepare(
    `SELECT users.id, users.email, users.status, users.created_at, users.updated_at, users.last_login_at,
            user_progress.payload, user_progress.updated_at AS progress_updated_at
     FROM users
     LEFT JOIN user_progress ON user_progress.user_id = users.id
     WHERE users.id = ?
     LIMIT 1`
  ).bind(userId).first();

  if (!row || row.status !== 'active') {
    return null;
  }
  if (isAdminEmail(env, row.email) && (!allowAdminUserId || String(row.id) !== allowAdminUserId)) {
    return null;
  }

  return row;
}

async function handleAdminStudentsOverview(request, env) {
  if (!env.DB) {
    return jsonResponse(request, { error: 'D1 database is not configured.' }, { status: 503 });
  }

  try {
    const adminSession = await requireAdminSession(env, request);
    const url = new URL(request.url);
    const query = normalizeEmail(url.searchParams.get('q') || url.searchParams.get('email') || '');
    const studentRows = await listStudentRows(env, {
      includeUserId: adminSession.user.id
    });
    const filteredRows = query
      ? studentRows.filter((row) => normalizeEmail(row.email).includes(query))
      : studentRows;

    let totalAnswered = 0;
    let completionAccumulator = 0;
    let firstTryAccuracyAccumulator = 0;
    let firstTryAccuracyCount = 0;

    const students = filteredRows.map((row) => {
      const analytics = buildStudentAnalyticsFromPayload(row.payload);
      const lastSyncedAt = row.progress_updated_at || analytics.summary.lastUpdatedAt || null;
      const isActive = isTimestampWithinDays(lastSyncedAt);

      totalAnswered += analytics.summary.answeredCount;
      completionAccumulator += analytics.summary.completionPct;
      if (analytics.summary.firstTryAttemptedCount > 0) {
        firstTryAccuracyAccumulator += analytics.summary.firstTryAccuracyPct;
        firstTryAccuracyCount += 1;
      }

      return {
        id: row.id,
        email: row.email,
        createdAt: row.created_at,
        lastLoginAt: row.last_login_at || null,
        lastSyncedAt,
        isActive,
        ...analytics.summary
      };
    });

    const studentsCount = students.length;
    const activeStudents = students.filter((student) => student.isActive).length;
    const avgCompletionPct = studentsCount > 0
      ? roundToOneDecimal(completionAccumulator / studentsCount)
      : 0;
    const avgFirstTryAccuracyPct = firstTryAccuracyCount > 0
      ? roundToOneDecimal(firstTryAccuracyAccumulator / firstTryAccuracyCount)
      : 0;

    return jsonResponse(request, {
      metrics: {
        studentsCount,
        activeStudents,
        totalAnswered,
        avgCompletionPct,
        avgFirstTryAccuracyPct
      },
      filters: {
        query: query || ''
      },
      students,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    return jsonResponse(request, { error: error.message || 'Unable to load student overview.' }, { status: getErrorStatus(error) });
  }
}

async function handleAdminStudentDetail(request, env, userId) {
  if (!env.DB) {
    return jsonResponse(request, { error: 'D1 database is not configured.' }, { status: 503 });
  }

  try {
    const adminSession = await requireAdminSession(env, request);
    const row = await getStudentRowById(env, userId, {
      allowAdminUserId: adminSession.user.id
    });
    if (!row) {
      return jsonResponse(request, { error: 'Student not found.' }, { status: 404 });
    }

    const analytics = buildStudentAnalyticsFromPayload(row.payload);
    const lastSyncedAt = row.progress_updated_at || analytics.summary.lastUpdatedAt || null;

    return jsonResponse(request, {
      student: {
        id: row.id,
        email: row.email,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastLoginAt: row.last_login_at || null,
        lastSyncedAt,
        isActive: isTimestampWithinDays(lastSyncedAt)
      },
      summary: analytics.summary,
      topics: analytics.topics,
      tests: analytics.tests,
      lastSession: analytics.lastSession,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    return jsonResponse(request, { error: error.message || 'Unable to load student details.' }, { status: getErrorStatus(error) });
  }
}

async function handleAdminResetStudentTestProgress(request, env, userId) {
  if (!env.DB) {
    return jsonResponse(request, { error: 'D1 database is not configured.' }, { status: 503 });
  }

  let adminSession = null;
  try {
    adminSession = await requireAdminSession(env, request);
    const body = await request.json();
    const topicId = String(body?.topicId || '').trim();
    const testId = String(body?.testId || '').trim();

    if (!topicId || !testId) {
      return jsonResponse(request, { error: 'topicId and testId are required.' }, { status: 400 });
    }

    const row = await getStudentRowById(env, userId, {
      allowAdminUserId: adminSession.user.id
    });
    if (!row) {
      return jsonResponse(request, { error: 'Student not found.' }, { status: 404 });
    }
    if (!row.payload) {
      return jsonResponse(request, { error: 'No synced progress found for this student.' }, { status: 404 });
    }

    const snapshot = parseJsonString(row.payload, null);
    if (!snapshot || typeof snapshot !== 'object') {
      return jsonResponse(request, { error: 'Stored progress payload is invalid.' }, { status: 500 });
    }

    const items = snapshot.items && typeof snapshot.items === 'object'
      ? { ...snapshot.items }
      : {};
    const progressKey = `progress_${topicId}_${testId}`;
    const shuffleKey = `shuffle_${topicId}_${testId}`;
    const removedKeys = [];

    if (Object.prototype.hasOwnProperty.call(items, progressKey)) {
      delete items[progressKey];
      removedKeys.push(progressKey);
    }
    if (Object.prototype.hasOwnProperty.call(items, shuffleKey)) {
      delete items[shuffleKey];
      removedKeys.push(shuffleKey);
    }

    const lastSession = parseJsonString(items.last_session, null);
    if (
      lastSession &&
      typeof lastSession === 'object' &&
      String(lastSession.topicId || '') === topicId &&
      String(lastSession.testId || '') === testId
    ) {
      delete items.last_session;
      removedKeys.push('last_session');
    }

    const now = new Date().toISOString();
    const nextSnapshot = {
      ...snapshot,
      version: Number(snapshot.version || 1),
      items
    };

    await env.DB.prepare(
      `INSERT INTO user_progress (user_id, payload, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`
    ).bind(
      row.id,
      JSON.stringify(nextSnapshot),
      now
    ).run();

    await logAuditEvent(env.DB, request, 'admin.progress_reset_test', 'success', adminSession.user.id, {
      actorAdminUserId: adminSession.user.id,
      targetUserId: row.id,
      testKey: `${topicId}_${testId}`,
      removedKeys
    });

    return jsonResponse(request, {
      success: true,
      targetUserId: row.id,
      testKey: `${topicId}_${testId}`,
      removedKeys,
      updatedAt: now
    });
  } catch (error) {
    try {
      await logAuditEvent(env.DB, request, 'admin.progress_reset_test', 'failed', adminSession?.user?.id || null, {
        actorAdminUserId: adminSession?.user?.id || null,
        targetUserId: userId,
        reason: error.message
      });
    } catch {}
    return jsonResponse(request, { error: error.message || 'Unable to reset student test progress.' }, { status: getErrorStatus(error) });
  }
}

async function handleAdminPasswordResetLink(request, env) {
  if (!env.DB) {
    return jsonResponse(request, { error: 'D1 database is not configured.' }, { status: 503 });
  }

  let adminSession = null;
  try {
    adminSession = await requireAdminSession(env, request);
    const body = await request.json();
    const email = normalizeEmail(body.email);

    if (!validateEmail(email)) {
      return jsonResponse(request, { error: 'A valid email is required.' }, { status: 400 });
    }

    const user = await env.DB.prepare(
      'SELECT id, email, status FROM users WHERE email = ? LIMIT 1'
    ).bind(email).first();

    if (!user || user.status !== 'active') {
      await logAuditEvent(env.DB, request, 'auth.password_reset_admin', 'failed', user?.id || null, { reason: 'user_not_found', email });
      return jsonResponse(request, { error: 'Active account not found for that email.' }, { status: 404 });
    }

    const { rawToken, expiresAt } = await issuePasswordResetToken(env.DB, request, user.id);
    const resetUrl = `${getResetEmailConfig(env, request).baseUrl}/?reset=${encodeURIComponent(rawToken)}`;

    await logAuditEvent(env.DB, request, 'auth.password_reset_admin', 'success', adminSession.user.id, {
      actorAdminUserId: adminSession.user.id,
      targetUserId: user.id,
      email,
      expiresAt
    });

    return jsonResponse(request, {
      success: true,
      email: user.email,
      token: rawToken,
      resetUrl,
      expiresAt
    });
  } catch (error) {
    try {
      await logAuditEvent(env.DB, request, 'auth.password_reset_admin', 'failed', adminSession?.user?.id || null, {
        actorAdminUserId: adminSession?.user?.id || null,
        reason: error.message
      });
    } catch {}
    return jsonResponse(request, { error: error.message || 'Admin reset link generation failed.' }, { status: getErrorStatus(error) });
  }
}

async function handlePasswordResetConfirm(request, env) {
  const body = await request.json();
  const token = String(body.token || '');
  const newPassword = String(body.newPassword || '');
  const ip = getClientIp(request);

  if (!env.DB) {
    return jsonResponse(request, { error: 'D1 database is not configured.' }, { status: 503 });
  }

  if (!token || newPassword.length < 8) {
    return jsonResponse(request, { error: 'Reset token and new password are required.' }, { status: 400 });
  }

  try {
    await enforceIpOnlyRateLimit(env.DB, ip, 'password_reset_confirm_ip', RESET_RATE_LIMIT_EMAIL_MAX, RESET_RATE_LIMIT_WINDOW_MINUTES, false);
    await recordAuthAttempt(env.DB, 'password_reset_confirm_ip', ip, true);

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

function isSameOriginRequest(request) {
  const originHeader = String(request.headers.get('Origin') || '').trim();
  if (!originHeader) return true;
  try {
    const requestOrigin = new URL(request.url).origin;
    const origin = new URL(originHeader).origin;
    return origin === requestOrigin;
  } catch {
    return false;
  }
}

function sanitizeHeatmapSelector(rawValue) {
  const selector = trimTo(rawValue, 255, '');
  if (!selector) return '';
  if (/(password|token|email|auth|secret|reset)/i.test(selector)) {
    return '[masked]';
  }
  return selector;
}

function normalizeHeatmapDeviceFilter(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['mobile', 'desktop', 'tablet', 'unknown'].includes(normalized)) {
    return normalized;
  }
  return 'all';
}

function inferDeviceType(request, contextDeviceType = '') {
  const normalizedContext = normalizeHeatmapDeviceType(contextDeviceType);
  if (normalizedContext !== 'unknown') {
    return normalizedContext;
  }
  const userAgent = String(request.headers.get('User-Agent') || '').toLowerCase();
  if (/ipad|tablet/.test(userAgent)) return 'tablet';
  if (/mobile|iphone|android|ipod/.test(userAgent)) return 'mobile';
  if (userAgent) return 'desktop';
  return 'unknown';
}

function normalizeOccurredAt(value, fallbackIso) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  return fallbackIso;
}

function sanitizeHeatmapEvent(rawEvent, defaults = {}, fallbackIso = new Date().toISOString()) {
  if (!rawEvent || typeof rawEvent !== 'object') return null;
  const eventType = trimTo(rawEvent.type || rawEvent.eventType, 24, '').toLowerCase();
  if (!['click', 'move', 'scroll', 'hover'].includes(eventType)) {
    return null;
  }

  const metadata = rawEvent.metadata && typeof rawEvent.metadata === 'object'
    ? rawEvent.metadata
    : (rawEvent.meta && typeof rawEvent.meta === 'object' ? rawEvent.meta : null);
  const metadataJson = metadata
    ? JSON.stringify(metadata).slice(0, 1024)
    : null;

  const optionIndexRaw = rawEvent.optionIndex;
  const optionIndex = Number.isInteger(optionIndexRaw) && optionIndexRaw >= 0 && optionIndexRaw <= 32
    ? optionIndexRaw
    : null;

  return {
    eventType,
    occurredAt: normalizeOccurredAt(rawEvent.ts || rawEvent.occurredAt || rawEvent.timestamp, fallbackIso),
    routePath: trimTo(rawEvent.routePath || defaults.routePath, 255, ''),
    topicId: trimTo(rawEvent.topicId || defaults.topicId, 120, ''),
    testId: trimTo(rawEvent.testId || defaults.testId, 120, ''),
    questionId: trimTo(rawEvent.questionId || defaults.questionId, 120, ''),
    optionIndex,
    xPercent: clampNumber(rawEvent.xPercent ?? rawEvent.x ?? rawEvent.x_percent, 0, 100, null),
    yPercent: clampNumber(rawEvent.yPercent ?? rawEvent.y ?? rawEvent.y_percent, 0, 100, null),
    scrollPercent: clampNumber(rawEvent.scrollPercent ?? rawEvent.scroll ?? rawEvent.scroll_percent, 0, 100, null),
    selector: sanitizeHeatmapSelector(rawEvent.selector || rawEvent.elementSelector || rawEvent.element),
    metadataJson
  };
}

function sanitizeReplayEvents(rawEvents, fallbackIso) {
  const source = Array.isArray(rawEvents) ? rawEvents : [];
  const sanitized = [];

  for (let index = 0; index < source.length && sanitized.length < HEATMAP_REPLAY_MAX_EVENTS; index += 1) {
    const item = source[index];
    if (!item || typeof item !== 'object') continue;
    const selector = sanitizeHeatmapSelector(item.selector || item.element || '');
    const value = selector === '[masked]'
      ? '[masked]'
      : trimTo(item.value, 180, '');
    sanitized.push({
      type: trimTo(item.type, 32, 'event'),
      ts: normalizeOccurredAt(item.ts || item.occurredAt || item.timestamp, fallbackIso),
      xPercent: clampNumber(item.xPercent ?? item.x, 0, 100, null),
      yPercent: clampNumber(item.yPercent ?? item.y, 0, 100, null),
      scrollPercent: clampNumber(item.scrollPercent ?? item.scroll, 0, 100, null),
      selector: selector || '',
      value: value || ''
    });
  }

  return sanitized;
}

function parseHeatmapFilters(request) {
  const url = new URL(request.url);
  const today = new Date().toISOString().slice(0, 10);
  const defaultFrom = new Date(Date.now() - (6 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
  let fromDate = normalizeDateOnly(url.searchParams.get('from'), defaultFrom);
  let toDate = normalizeDateOnly(url.searchParams.get('to'), today);

  if (fromDate > toDate) {
    const originalFrom = fromDate;
    fromDate = toDate;
    toDate = originalFrom;
  }

  const toDateExclusive = new Date(`${toDate}T00:00:00.000Z`);
  toDateExclusive.setUTCDate(toDateExclusive.getUTCDate() + 1);

  return {
    fromDate,
    toDate,
    fromIso: `${fromDate}T00:00:00.000Z`,
    toIsoExclusive: toDateExclusive.toISOString(),
    topicId: trimTo(url.searchParams.get('topicId'), 120, ''),
    testId: trimTo(url.searchParams.get('testId'), 120, ''),
    questionId: trimTo(url.searchParams.get('questionId'), 120, ''),
    device: normalizeHeatmapDeviceFilter(url.searchParams.get('device') || ''),
    audience: normalizeHeatmapAudience(url.searchParams.get('audience') || 'all'),
    format: trimTo(url.searchParams.get('format'), 16, 'json').toLowerCase() || 'json',
    page: Math.max(1, Math.floor(clampNumber(url.searchParams.get('page'), 1, 100000, 1))),
    pageSize: Math.max(1, Math.floor(clampNumber(url.searchParams.get('pageSize'), 1, 100, 20)))
  };
}

function buildHeatmapEventFilterClause(filters, alias = 'heatmap_events') {
  const params = [filters.fromIso, filters.toIsoExclusive];
  const conditions = [
    `${alias}.occurred_at >= ?`,
    `${alias}.occurred_at < ?`
  ];

  if (filters.topicId) {
    conditions.push(`${alias}.topic_id = ?`);
    params.push(filters.topicId);
  }
  if (filters.testId) {
    conditions.push(`${alias}.test_id = ?`);
    params.push(filters.testId);
  }
  if (filters.questionId) {
    conditions.push(`${alias}.question_id = ?`);
    params.push(filters.questionId);
  }
  if (filters.device !== 'all') {
    conditions.push(`${alias}.device_type = ?`);
    params.push(filters.device);
  }
  if (filters.audience === 'authenticated') {
    conditions.push(`${alias}.is_authenticated = 1`);
  } else if (filters.audience === 'guest') {
    conditions.push(`${alias}.is_authenticated = 0`);
  }

  return {
    whereSql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params
  };
}

async function getOrCreateHeatmapSession(env, request, options = {}) {
  const nowIso = new Date().toISOString();
  const siteSessionId = trimTo(options.siteSessionId, 96, `s_${base64url(crypto.getRandomValues(new Uint8Array(14)))}`);
  const visitorId = trimTo(options.visitorId, 120, `v_${base64url(crypto.getRandomValues(new Uint8Array(14)))}`);
  const userId = options.userId || null;
  const isAuthenticated = userId ? 1 : 0;
  const routePath = trimTo(options.routePath, 255, '');
  const topicId = trimTo(options.topicId, 120, '');
  const testId = trimTo(options.testId, 120, '');
  const quizKey = trimTo(options.quizKey, 180, '');
  const viewportWidth = Math.floor(clampNumber(options.viewportWidth, 0, 12000, 0));
  const viewportHeight = Math.floor(clampNumber(options.viewportHeight, 0, 12000, 0));
  const timezoneOffset = Math.floor(clampNumber(options.timezoneOffset, -1000, 1000, 0));
  const deviceType = inferDeviceType(request, options.deviceType);
  const ipAddress = getClientIp(request);
  const userAgent = trimTo(request.headers.get('User-Agent') || '', 512, '');

  const existing = await env.DB.prepare(
    'SELECT id FROM heatmap_sessions WHERE site_session_id = ? LIMIT 1'
  ).bind(siteSessionId).first();

  if (existing?.id) {
    await env.DB.prepare(
      `UPDATE heatmap_sessions
       SET visitor_id = ?, user_id = ?, is_authenticated = ?, device_type = ?, user_agent = ?, ip_address = ?,
           route_path = ?, topic_id = ?, test_id = ?, quiz_key = ?, viewport_width = ?, viewport_height = ?,
           timezone_offset = ?, updated_at = ?, last_event_at = ?
       WHERE id = ?`
    ).bind(
      visitorId,
      userId,
      isAuthenticated,
      deviceType,
      userAgent,
      ipAddress,
      routePath,
      topicId,
      testId,
      quizKey,
      viewportWidth,
      viewportHeight,
      timezoneOffset,
      nowIso,
      nowIso,
      existing.id
    ).run();

    return {
      id: existing.id,
      siteSessionId,
      visitorId,
      isAuthenticated
    };
  }

  const sessionId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO heatmap_sessions (
      id, site_session_id, visitor_id, user_id, is_authenticated, device_type, user_agent, ip_address,
      route_path, topic_id, test_id, quiz_key, viewport_width, viewport_height, timezone_offset,
      created_at, updated_at, last_event_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    sessionId,
    siteSessionId,
    visitorId,
    userId,
    isAuthenticated,
    deviceType,
    userAgent,
    ipAddress,
    routePath,
    topicId,
    testId,
    quizKey,
    viewportWidth,
    viewportHeight,
    timezoneOffset,
    nowIso,
    nowIso,
    nowIso
  ).run();

  return {
    id: sessionId,
    siteSessionId,
    visitorId,
    isAuthenticated
  };
}

async function upsertHeatmapAggregate(env, event, audienceScope) {
  const nowIso = new Date().toISOString();
  const dayKey = String(event.occurredAt || nowIso).slice(0, 10);
  const clickCount = event.eventType === 'click' ? 1 : 0;
  const moveCount = event.eventType === 'move' ? 1 : 0;
  const scrollCount = event.eventType === 'scroll' ? 1 : 0;
  const hoverCount = event.eventType === 'hover' ? 1 : 0;
  const sumScrollPercent = event.eventType === 'scroll' && Number.isFinite(event.scrollPercent)
    ? Number(event.scrollPercent)
    : 0;
  const sampleCount = 1;
  const optionIndex = Number.isInteger(event.optionIndex) ? event.optionIndex : -1;

  await env.DB.prepare(
    `INSERT INTO heatmap_daily_aggregates (
      day_key, question_id, topic_id, test_id, device_type, audience_scope, event_type, option_index,
      click_count, move_count, scroll_count, hover_count, sum_scroll_percent, sample_count, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(day_key, question_id, topic_id, test_id, device_type, audience_scope, event_type, option_index)
    DO UPDATE SET
      click_count = click_count + excluded.click_count,
      move_count = move_count + excluded.move_count,
      scroll_count = scroll_count + excluded.scroll_count,
      hover_count = hover_count + excluded.hover_count,
      sum_scroll_percent = sum_scroll_percent + excluded.sum_scroll_percent,
      sample_count = sample_count + excluded.sample_count,
      updated_at = excluded.updated_at`
  ).bind(
    dayKey,
    event.questionId || '',
    event.topicId || '',
    event.testId || '',
    event.deviceType || 'unknown',
    audienceScope,
    event.eventType,
    optionIndex,
    clickCount,
    moveCount,
    scrollCount,
    hoverCount,
    sumScrollPercent,
    sampleCount,
    nowIso
  ).run();
}

function buildHeatmapCsv(questions = []) {
  const header = [
    'question_id',
    'topic_id',
    'test_id',
    'click_count',
    'move_count',
    'scroll_count',
    'hover_count',
    'avg_scroll_percent',
    'top_option_index',
    'top_option_click_count',
    'distractor_pressure_percent'
  ];
  const lines = [header.join(',')];
  questions.forEach((row) => {
    const values = [
      row.questionId || '',
      row.topicId || '',
      row.testId || '',
      Number(row.clickCount || 0),
      Number(row.moveCount || 0),
      Number(row.scrollCount || 0),
      Number(row.hoverCount || 0),
      Number(row.avgScrollPercent || 0),
      Number.isInteger(row.topOptionIndex) ? row.topOptionIndex : '',
      Number(row.topOptionClickCount || 0),
      Number(row.distractorPressurePct || 0)
    ];
    lines.push(values.map((value) => {
      const raw = String(value);
      if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
        return `"${raw.replace(/"/g, '""')}"`;
      }
      return raw;
    }).join(','));
  });
  return `${lines.join('\n')}\n`;
}

async function handleAnalyticsTrack(request, env) {
  if (!env.DB) {
    return jsonResponse(request, { error: 'D1 database is not configured.' }, { status: 503 });
  }
  if (!isHeatmapEnabled(env)) {
    return jsonResponse(request, { error: 'Heatmap tracking is disabled.' }, { status: 503 });
  }
  if (!isSameOriginRequest(request)) {
    return jsonResponse(request, { error: 'Tracking origin is not allowed.' }, { status: 403 });
  }

  const ip = getClientIp(request);
  const nowIso = new Date().toISOString();

  try {
    await enforceIpOnlyRateLimit(
      env.DB,
      ip,
      'analytics_track_ip',
      HEATMAP_RATE_LIMIT_IP_MAX,
      HEATMAP_RATE_LIMIT_WINDOW_MINUTES,
      false
    );
    await recordAuthAttempt(env.DB, 'analytics_track_ip', ip, true);

    const rawBody = await request.text();
    if (textEncoder.encode(rawBody).length > HEATMAP_MAX_PAYLOAD_BYTES) {
      return jsonResponse(request, { error: 'Tracking payload is too large.' }, { status: 413 });
    }

    let body = {};
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return jsonResponse(request, { error: 'Tracking payload is invalid JSON.' }, { status: 400 });
    }

    const sessionContext = await getSessionContext(env, request).catch(() => null);
    const { visitorId, shouldSetCookie } = getOrCreateHeatmapVisitorId(request);
    const context = body.context && typeof body.context === 'object' ? body.context : {};
    const defaults = {
      routePath: trimTo(context.routePath, 255, ''),
      topicId: trimTo(context.topicId, 120, ''),
      testId: trimTo(context.testId, 120, ''),
      questionId: trimTo(context.questionId, 120, '')
    };

    const incomingEvents = Array.isArray(body.events) ? body.events : [];
    if (incomingEvents.length > HEATMAP_BATCH_MAX_EVENTS) {
      return jsonResponse(request, { error: `A maximum of ${HEATMAP_BATCH_MAX_EVENTS} events is allowed per batch.` }, { status: 400 });
    }

    const replayChunk = body.replayChunk && typeof body.replayChunk === 'object'
      ? body.replayChunk
      : null;

    if (incomingEvents.length === 0 && !replayChunk) {
      return jsonResponse(request, { error: 'No events or replay chunk provided.' }, { status: 400 });
    }

    const heatmapSession = await getOrCreateHeatmapSession(env, request, {
      siteSessionId: body.sessionId,
      visitorId,
      userId: sessionContext?.user?.id || null,
      routePath: defaults.routePath,
      topicId: defaults.topicId,
      testId: defaults.testId,
      quizKey: trimTo(context.quizKey || `${defaults.topicId}_${defaults.testId}`.replace(/^_+|_+$/g, ''), 180, ''),
      viewportWidth: context.viewport?.width ?? context.viewportWidth,
      viewportHeight: context.viewport?.height ?? context.viewportHeight,
      timezoneOffset: context.timezoneOffset,
      deviceType: context.deviceType
    });

    const audienceScope = heatmapSession.isAuthenticated ? 'authenticated' : 'guest';
    let acceptedEvents = 0;

    for (const rawEvent of incomingEvents) {
      const event = sanitizeHeatmapEvent(rawEvent, defaults, nowIso);
      if (!event) continue;
      event.deviceType = inferDeviceType(request, context.deviceType);

      await env.DB.prepare(
        `INSERT INTO heatmap_events (
          id, heatmap_session_id, user_id, visitor_id, is_authenticated, event_type, route_path, topic_id, test_id, question_id,
          option_index, x_percent, y_percent, scroll_percent, element_selector, metadata_json, device_type, occurred_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(),
        heatmapSession.id,
        sessionContext?.user?.id || null,
        heatmapSession.visitorId,
        heatmapSession.isAuthenticated,
        event.eventType,
        event.routePath || defaults.routePath,
        event.topicId || defaults.topicId,
        event.testId || defaults.testId,
        event.questionId || defaults.questionId,
        Number.isInteger(event.optionIndex) ? event.optionIndex : null,
        event.xPercent,
        event.yPercent,
        event.scrollPercent,
        event.selector || '',
        event.metadataJson,
        event.deviceType,
        event.occurredAt,
        nowIso
      ).run();

      await upsertHeatmapAggregate(env, event, audienceScope);
      acceptedEvents += 1;
    }

    let acceptedReplayEvents = 0;
    if (replayChunk) {
      const chunkIndex = Math.max(0, Math.floor(clampNumber(replayChunk.chunkIndex, 0, 1000000, 0)));
      const replayEvents = sanitizeReplayEvents(replayChunk.events, nowIso);
      acceptedReplayEvents = replayEvents.length;
      const replayJson = JSON.stringify({
        source: 'native-v1',
        routePath: defaults.routePath,
        topicId: defaults.topicId,
        testId: defaults.testId,
        events: replayEvents
      }).slice(0, HEATMAP_MAX_PAYLOAD_BYTES);

      const firstTimestamp = replayEvents.length > 0 ? replayEvents[0].ts : nowIso;
      const lastTimestamp = replayEvents.length > 0 ? replayEvents[replayEvents.length - 1].ts : nowIso;

      await env.DB.prepare(
        `INSERT INTO heatmap_replay_chunks (
          id, heatmap_session_id, chunk_index, chunk_json, event_count, occurred_from, occurred_to, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(heatmap_session_id, chunk_index)
        DO UPDATE SET
          chunk_json = excluded.chunk_json,
          event_count = excluded.event_count,
          occurred_from = excluded.occurred_from,
          occurred_to = excluded.occurred_to,
          created_at = excluded.created_at`
      ).bind(
        crypto.randomUUID(),
        heatmapSession.id,
        chunkIndex,
        replayJson,
        replayEvents.length,
        firstTimestamp,
        lastTimestamp,
        nowIso
      ).run();
    }

    const responsePayload = {
      success: true,
      sessionId: heatmapSession.siteSessionId,
      visitorId: heatmapSession.visitorId,
      authenticated: Boolean(heatmapSession.isAuthenticated),
      acceptedEventCount: acceptedEvents,
      acceptedReplayEvents,
      ingestedAt: nowIso
    };

    if (shouldSetCookie) {
      return jsonResponse(request, responsePayload, {
        headers: {
          'Set-Cookie': buildVisitorCookie(heatmapSession.visitorId)
        }
      });
    }

    return jsonResponse(request, responsePayload);
  } catch (error) {
    try {
      await recordAuthAttempt(env.DB, 'analytics_track_ip', ip, false);
    } catch {}
    return jsonResponse(request, { error: error.message || 'Unable to ingest heatmap data.' }, { status: getErrorStatus(error) });
  }
}

async function handleAdminHeatmapsOverview(request, env) {
  if (!env.DB) {
    return jsonResponse(request, { error: 'D1 database is not configured.' }, { status: 503 });
  }

  let adminSession = null;
  try {
    adminSession = await requireAdminSession(env, request);
    const filters = parseHeatmapFilters(request);
    const { whereSql, params } = buildHeatmapEventFilterClause(filters, 'heatmap_events');

    const summaryRow = await env.DB.prepare(
      `SELECT
        COUNT(*) AS event_count,
        COUNT(DISTINCT heatmap_session_id) AS session_count,
        SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END) AS click_count,
        SUM(CASE WHEN event_type = 'move' THEN 1 ELSE 0 END) AS move_count,
        SUM(CASE WHEN event_type = 'scroll' THEN 1 ELSE 0 END) AS scroll_count,
        SUM(CASE WHEN event_type = 'hover' THEN 1 ELSE 0 END) AS hover_count,
        AVG(CASE WHEN event_type = 'scroll' THEN scroll_percent END) AS avg_scroll_percent
      FROM heatmap_events
      ${whereSql}`
    ).bind(...params).first();

    const authenticatedSessionsRow = await env.DB.prepare(
      `SELECT COUNT(*) AS count
       FROM (
         SELECT heatmap_session_id
         FROM heatmap_events
         ${whereSql} AND is_authenticated = 1
         GROUP BY heatmap_session_id
       )`
    ).bind(...params).first();

    const guestSessionsRow = await env.DB.prepare(
      `SELECT COUNT(*) AS count
       FROM (
         SELECT heatmap_session_id
         FROM heatmap_events
         ${whereSql} AND is_authenticated = 0
         GROUP BY heatmap_session_id
       )`
    ).bind(...params).first();

    const aggregateParams = [filters.fromDate, filters.toDate];
    const aggregateConditions = [
      'day_key >= ?',
      'day_key <= ?',
      "question_id != ''"
    ];
    if (filters.topicId) {
      aggregateConditions.push('topic_id = ?');
      aggregateParams.push(filters.topicId);
    }
    if (filters.testId) {
      aggregateConditions.push('test_id = ?');
      aggregateParams.push(filters.testId);
    }
    if (filters.questionId) {
      aggregateConditions.push('question_id = ?');
      aggregateParams.push(filters.questionId);
    }
    if (filters.device !== 'all') {
      aggregateConditions.push('device_type = ?');
      aggregateParams.push(filters.device);
    }
    if (filters.audience !== 'all') {
      aggregateConditions.push('audience_scope = ?');
      aggregateParams.push(filters.audience);
    }

    const aggregateWhereSql = `WHERE ${aggregateConditions.join(' AND ')}`;
    const questionRows = await env.DB.prepare(
      `SELECT
        question_id,
        topic_id,
        test_id,
        SUM(click_count) AS click_count,
        SUM(move_count) AS move_count,
        SUM(scroll_count) AS scroll_count,
        SUM(hover_count) AS hover_count,
        SUM(sum_scroll_percent) AS sum_scroll_percent,
        SUM(sample_count) AS sample_count
      FROM heatmap_daily_aggregates
      ${aggregateWhereSql}
      GROUP BY question_id, topic_id, test_id
      ORDER BY click_count DESC, sample_count DESC
      LIMIT 300`
    ).bind(...aggregateParams).all();

    const optionRows = await env.DB.prepare(
      `SELECT
        question_id,
        option_index,
        SUM(click_count) AS click_count
      FROM heatmap_daily_aggregates
      ${aggregateWhereSql} AND event_type = 'click' AND option_index >= 0
      GROUP BY question_id, option_index`
    ).bind(...aggregateParams).all();

    const optionMap = new Map();
    (optionRows?.results || []).forEach((row) => {
      const key = String(row.question_id || '');
      if (!optionMap.has(key)) {
        optionMap.set(key, []);
      }
      optionMap.get(key).push({
        optionIndex: Number(row.option_index),
        clickCount: Number(row.click_count || 0)
      });
    });

    const questions = (questionRows?.results || []).map((row) => {
      const key = String(row.question_id || '');
      const optionStats = optionMap.get(key) || [];
      const totalOptionClicks = optionStats.reduce((sum, option) => sum + Number(option.clickCount || 0), 0);
      const topOption = optionStats.sort((a, b) => b.clickCount - a.clickCount)[0] || null;
      const topOptionClicks = Number(topOption?.clickCount || 0);
      const distractorPressurePct = totalOptionClicks > 0
        ? roundToOneDecimal(((totalOptionClicks - topOptionClicks) / totalOptionClicks) * 100)
        : 0;
      const avgScrollPercent = Number(row.sample_count || 0) > 0
        ? roundToOneDecimal(Number(row.sum_scroll_percent || 0) / Number(row.sample_count || 1))
        : 0;

      return {
        questionId: key,
        topicId: String(row.topic_id || ''),
        testId: String(row.test_id || ''),
        clickCount: Number(row.click_count || 0),
        moveCount: Number(row.move_count || 0),
        scrollCount: Number(row.scroll_count || 0),
        hoverCount: Number(row.hover_count || 0),
        avgScrollPercent,
        topOptionIndex: Number.isInteger(topOption?.optionIndex) ? topOption.optionIndex : null,
        topOptionClickCount: topOptionClicks,
        distractorPressurePct
      };
    });

    const summary = {
      sessionCount: Number(summaryRow?.session_count || 0),
      eventCount: Number(summaryRow?.event_count || 0),
      clickCount: Number(summaryRow?.click_count || 0),
      moveCount: Number(summaryRow?.move_count || 0),
      scrollCount: Number(summaryRow?.scroll_count || 0),
      hoverCount: Number(summaryRow?.hover_count || 0),
      avgScrollPercent: roundToOneDecimal(Number(summaryRow?.avg_scroll_percent || 0)),
      authenticatedSessions: Number(authenticatedSessionsRow?.count || 0),
      guestSessions: Number(guestSessionsRow?.count || 0)
    };

    const generatedAt = new Date().toISOString();

    if (filters.format === 'csv') {
      const csv = buildHeatmapCsv(questions);
      await logAuditEvent(env.DB, request, 'admin.heatmap_overview_export', 'success', adminSession.user.id, {
        format: 'csv',
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        rowCount: questions.length
      });
      return textResponse(request, csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="heatmaps-overview-${filters.fromDate}-to-${filters.toDate}.csv"`
        }
      });
    }

    await logAuditEvent(env.DB, request, 'admin.heatmap_overview_read', 'success', adminSession.user.id, {
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      rowCount: questions.length
    });

    return jsonResponse(request, {
      filters,
      summary,
      questions,
      generatedAt
    });
  } catch (error) {
    try {
      await logAuditEvent(env.DB, request, 'admin.heatmap_overview_read', 'failed', adminSession?.user?.id || null, {
        reason: error.message
      });
    } catch {}
    return jsonResponse(request, { error: error.message || 'Unable to load heatmap overview.' }, { status: getErrorStatus(error) });
  }
}

async function handleAdminHeatmapQuestion(request, env, questionIdParam) {
  if (!env.DB) {
    return jsonResponse(request, { error: 'D1 database is not configured.' }, { status: 503 });
  }

  let adminSession = null;
  try {
    adminSession = await requireAdminSession(env, request);
    const questionId = trimTo(questionIdParam, 120, '');
    if (!questionId) {
      return jsonResponse(request, { error: 'Question ID is required.' }, { status: 400 });
    }
    const filters = parseHeatmapFilters(request);
    filters.questionId = questionId;

    const { whereSql, params } = buildHeatmapEventFilterClause(filters, 'heatmap_events');
    const metricsRow = await env.DB.prepare(
      `SELECT
        COUNT(*) AS event_count,
        SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END) AS click_count,
        SUM(CASE WHEN event_type = 'move' THEN 1 ELSE 0 END) AS move_count,
        SUM(CASE WHEN event_type = 'scroll' THEN 1 ELSE 0 END) AS scroll_count,
        SUM(CASE WHEN event_type = 'hover' THEN 1 ELSE 0 END) AS hover_count,
        AVG(CASE WHEN event_type = 'scroll' THEN scroll_percent END) AS avg_scroll_percent
      FROM heatmap_events
      ${whereSql}`
    ).bind(...params).first();

    const optionRows = await env.DB.prepare(
      `SELECT option_index, COUNT(*) AS click_count
       FROM heatmap_events
       ${whereSql} AND event_type = 'click' AND option_index IS NOT NULL
       GROUP BY option_index
       ORDER BY click_count DESC`
    ).bind(...params).all();

    const clickPointRows = await env.DB.prepare(
      `SELECT
        CAST(ROUND(x_percent) AS INTEGER) AS x,
        CAST(ROUND(y_percent) AS INTEGER) AS y,
        COUNT(*) AS weight
      FROM heatmap_events
      ${whereSql} AND event_type = 'click' AND x_percent IS NOT NULL AND y_percent IS NOT NULL
      GROUP BY x, y
      ORDER BY weight DESC
      LIMIT 1200`
    ).bind(...params).all();

    const movePointRows = await env.DB.prepare(
      `SELECT
        CAST(ROUND(x_percent) AS INTEGER) AS x,
        CAST(ROUND(y_percent) AS INTEGER) AS y,
        COUNT(*) AS weight
      FROM heatmap_events
      ${whereSql} AND event_type = 'move' AND x_percent IS NOT NULL AND y_percent IS NOT NULL
      GROUP BY x, y
      ORDER BY weight DESC
      LIMIT 1600`
    ).bind(...params).all();

    const scrollBucketRows = await env.DB.prepare(
      `SELECT CAST(scroll_percent / 10 AS INTEGER) AS bucket, COUNT(*) AS count
       FROM heatmap_events
       ${whereSql} AND event_type = 'scroll' AND scroll_percent IS NOT NULL
       GROUP BY bucket
       ORDER BY bucket ASC`
    ).bind(...params).all();

    const optionStatsRaw = (optionRows?.results || []).map((row) => ({
      optionIndex: Number(row.option_index),
      clickCount: Number(row.click_count || 0)
    }));
    const totalOptionClicks = optionStatsRaw.reduce((sum, row) => sum + row.clickCount, 0);
    const optionStats = optionStatsRaw.map((row) => ({
      ...row,
      sharePct: totalOptionClicks > 0 ? roundToOneDecimal((row.clickCount / totalOptionClicks) * 100) : 0
    }));

    await logAuditEvent(env.DB, request, 'admin.heatmap_question_read', 'success', adminSession.user.id, {
      questionId,
      fromDate: filters.fromDate,
      toDate: filters.toDate
    });

    return jsonResponse(request, {
      questionId,
      filters,
      metrics: {
        eventCount: Number(metricsRow?.event_count || 0),
        clickCount: Number(metricsRow?.click_count || 0),
        moveCount: Number(metricsRow?.move_count || 0),
        scrollCount: Number(metricsRow?.scroll_count || 0),
        hoverCount: Number(metricsRow?.hover_count || 0),
        avgScrollPercent: roundToOneDecimal(Number(metricsRow?.avg_scroll_percent || 0))
      },
      optionStats,
      clickPoints: (clickPointRows?.results || []).map((row) => ({
        x: Number(row.x),
        y: Number(row.y),
        weight: Number(row.weight || 0)
      })),
      movePoints: (movePointRows?.results || []).map((row) => ({
        x: Number(row.x),
        y: Number(row.y),
        weight: Number(row.weight || 0)
      })),
      scrollBuckets: (scrollBucketRows?.results || []).map((row) => {
        const bucket = Math.max(0, Math.min(10, Number(row.bucket || 0)));
        const bucketStart = bucket * 10;
        const bucketEnd = Math.min(100, bucketStart + 10);
        return {
          bucketStart,
          bucketEnd,
          count: Number(row.count || 0)
        };
      }),
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    try {
      await logAuditEvent(env.DB, request, 'admin.heatmap_question_read', 'failed', adminSession?.user?.id || null, {
        questionId: questionIdParam,
        reason: error.message
      });
    } catch {}
    return jsonResponse(request, { error: error.message || 'Unable to load question heatmap.' }, { status: getErrorStatus(error) });
  }
}

async function handleAdminHeatmapReplays(request, env) {
  if (!env.DB) {
    return jsonResponse(request, { error: 'D1 database is not configured.' }, { status: 503 });
  }

  let adminSession = null;
  try {
    adminSession = await requireAdminSession(env, request);
    const filters = parseHeatmapFilters(request);
    const params = [filters.fromIso, filters.toIsoExclusive];
    const conditions = [
      'last_event_at >= ?',
      'last_event_at < ?'
    ];

    if (filters.topicId) {
      conditions.push('topic_id = ?');
      params.push(filters.topicId);
    }
    if (filters.testId) {
      conditions.push('test_id = ?');
      params.push(filters.testId);
    }
    if (filters.device !== 'all') {
      conditions.push('device_type = ?');
      params.push(filters.device);
    }
    if (filters.audience === 'authenticated') {
      conditions.push('is_authenticated = 1');
    } else if (filters.audience === 'guest') {
      conditions.push('is_authenticated = 0');
    }
    if (filters.questionId) {
      conditions.push('EXISTS (SELECT 1 FROM heatmap_events he WHERE he.heatmap_session_id = heatmap_sessions.id AND he.question_id = ?)');
      params.push(filters.questionId);
    }

    const whereSql = `WHERE ${conditions.join(' AND ')}`;
    const offset = (filters.page - 1) * filters.pageSize;

    const totalRow = await env.DB.prepare(
      `SELECT COUNT(*) AS count
       FROM heatmap_sessions
       ${whereSql}`
    ).bind(...params).first();

    const rows = await env.DB.prepare(
      `SELECT
        id,
        site_session_id,
        visitor_id,
        user_id,
        is_authenticated,
        device_type,
        route_path,
        topic_id,
        test_id,
        quiz_key,
        viewport_width,
        viewport_height,
        created_at,
        updated_at,
        last_event_at,
        (SELECT COUNT(*) FROM heatmap_events he WHERE he.heatmap_session_id = heatmap_sessions.id) AS event_count,
        (SELECT COUNT(*) FROM heatmap_replay_chunks hc WHERE hc.heatmap_session_id = heatmap_sessions.id) AS replay_chunk_count
      FROM heatmap_sessions
      ${whereSql}
      ORDER BY last_event_at DESC
      LIMIT ? OFFSET ?`
    ).bind(...params, filters.pageSize, offset).all();

    await logAuditEvent(env.DB, request, 'admin.heatmap_replays_read', 'success', adminSession.user.id, {
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      page: filters.page,
      pageSize: filters.pageSize
    });

    return jsonResponse(request, {
      filters,
      page: filters.page,
      pageSize: filters.pageSize,
      total: Number(totalRow?.count || 0),
      sessions: (rows?.results || []).map((row) => ({
        sessionId: row.id,
        siteSessionId: row.site_session_id,
        visitorId: row.visitor_id,
        userId: row.user_id || null,
        isAuthenticated: Boolean(row.is_authenticated),
        deviceType: row.device_type,
        routePath: row.route_path,
        topicId: row.topic_id,
        testId: row.test_id,
        quizKey: row.quiz_key,
        viewportWidth: Number(row.viewport_width || 0),
        viewportHeight: Number(row.viewport_height || 0),
        eventCount: Number(row.event_count || 0),
        replayChunkCount: Number(row.replay_chunk_count || 0),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastEventAt: row.last_event_at
      })),
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    try {
      await logAuditEvent(env.DB, request, 'admin.heatmap_replays_read', 'failed', adminSession?.user?.id || null, {
        reason: error.message
      });
    } catch {}
    return jsonResponse(request, { error: error.message || 'Unable to load heatmap replay list.' }, { status: getErrorStatus(error) });
  }
}

async function handleAdminHeatmapReplayDetail(request, env, sessionId) {
  if (!env.DB) {
    return jsonResponse(request, { error: 'D1 database is not configured.' }, { status: 503 });
  }

  let adminSession = null;
  try {
    adminSession = await requireAdminSession(env, request);
    const normalizedSessionId = trimTo(sessionId, 64, '');
    if (!normalizedSessionId) {
      return jsonResponse(request, { error: 'Session ID is required.' }, { status: 400 });
    }

    const sessionRow = await env.DB.prepare(
      `SELECT
        id,
        site_session_id,
        visitor_id,
        user_id,
        is_authenticated,
        device_type,
        route_path,
        topic_id,
        test_id,
        quiz_key,
        viewport_width,
        viewport_height,
        created_at,
        updated_at,
        last_event_at
      FROM heatmap_sessions
      WHERE id = ?
      LIMIT 1`
    ).bind(normalizedSessionId).first();

    if (!sessionRow) {
      return jsonResponse(request, { error: 'Replay session not found.' }, { status: 404 });
    }

    const chunkRows = await env.DB.prepare(
      `SELECT
        chunk_index,
        chunk_json,
        event_count,
        occurred_from,
        occurred_to,
        created_at
      FROM heatmap_replay_chunks
      WHERE heatmap_session_id = ?
      ORDER BY chunk_index ASC`
    ).bind(normalizedSessionId).all();

    await logAuditEvent(env.DB, request, 'admin.heatmap_replay_read', 'success', adminSession.user.id, {
      replaySessionId: normalizedSessionId,
      chunkCount: (chunkRows?.results || []).length
    });

    return jsonResponse(request, {
      session: {
        sessionId: sessionRow.id,
        siteSessionId: sessionRow.site_session_id,
        visitorId: sessionRow.visitor_id,
        userId: sessionRow.user_id || null,
        isAuthenticated: Boolean(sessionRow.is_authenticated),
        deviceType: sessionRow.device_type,
        routePath: sessionRow.route_path,
        topicId: sessionRow.topic_id,
        testId: sessionRow.test_id,
        quizKey: sessionRow.quiz_key,
        viewportWidth: Number(sessionRow.viewport_width || 0),
        viewportHeight: Number(sessionRow.viewport_height || 0),
        createdAt: sessionRow.created_at,
        updatedAt: sessionRow.updated_at,
        lastEventAt: sessionRow.last_event_at
      },
      chunks: (chunkRows?.results || []).map((row) => {
        let parsed = null;
        try {
          parsed = row.chunk_json ? JSON.parse(row.chunk_json) : null;
        } catch {
          parsed = null;
        }
        return {
          chunkIndex: Number(row.chunk_index || 0),
          eventCount: Number(row.event_count || 0),
          occurredFrom: row.occurred_from || null,
          occurredTo: row.occurred_to || null,
          createdAt: row.created_at || null,
          payload: parsed
        };
      }),
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    try {
      await logAuditEvent(env.DB, request, 'admin.heatmap_replay_read', 'failed', adminSession?.user?.id || null, {
        replaySessionId: sessionId,
        reason: error.message
      });
    } catch {}
    return jsonResponse(request, { error: error.message || 'Unable to load replay session details.' }, { status: getErrorStatus(error) });
  }
}

async function runHeatmapRetentionCleanup(env) {
  if (!env?.DB) return null;

  const now = Date.now();
  const eventCutoffIso = new Date(now - (HEATMAP_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000)).toISOString();
  const replayCutoffIso = new Date(now - (HEATMAP_REPLAY_RETENTION_DAYS * 24 * 60 * 60 * 1000)).toISOString();
  const aggregateCutoffDay = eventCutoffIso.slice(0, 10);

  const deletedEvents = await env.DB.prepare(
    'DELETE FROM heatmap_events WHERE created_at < ?'
  ).bind(eventCutoffIso).run();

  const deletedAggregates = await env.DB.prepare(
    'DELETE FROM heatmap_daily_aggregates WHERE day_key < ?'
  ).bind(aggregateCutoffDay).run();

  const deletedReplayChunks = await env.DB.prepare(
    'DELETE FROM heatmap_replay_chunks WHERE created_at < ?'
  ).bind(replayCutoffIso).run();

  const deletedSessions = await env.DB.prepare(
    `DELETE FROM heatmap_sessions
     WHERE last_event_at < ?
       AND id NOT IN (SELECT DISTINCT heatmap_session_id FROM heatmap_events)
       AND id NOT IN (SELECT DISTINCT heatmap_session_id FROM heatmap_replay_chunks)`
  ).bind(eventCutoffIso).run();

  return {
    eventCutoffIso,
    replayCutoffIso,
    deletedEvents: Number(deletedEvents?.meta?.changes || 0),
    deletedAggregates: Number(deletedAggregates?.meta?.changes || 0),
    deletedReplayChunks: Number(deletedReplayChunks?.meta?.changes || 0),
    deletedSessions: Number(deletedSessions?.meta?.changes || 0)
  };
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
        heatmapEnabled: isHeatmapEnabled(env),
        turnstileSiteKey: env.TURNSTILE_SITE_KEY || '',
        authMode: 'email-password',
        passwordResetEmailEnabled: isResetEmailConfigured(resetEmailConfig),
        passwordResetEmailDebug: {
          provider: resetEmailConfig.provider || '',
          hasFrom: Boolean(resetEmailConfig.from),
          hasBaseUrl: Boolean(resetEmailConfig.baseUrl),
          hasResendKey: Boolean(resetEmailConfig.resendApiKey),
          hasPostmarkKey: Boolean(resetEmailConfig.postmarkServerToken)
        }
      });
    }

    if (path === '/api/debug/reset-email' && request.method === 'GET') {
      const resetEmailConfig = getResetEmailConfig(env, request);
      return jsonResponse(request, {
        provider: resetEmailConfig.provider || '',
        hasFrom: Boolean(resetEmailConfig.from),
        hasBaseUrl: Boolean(resetEmailConfig.baseUrl),
        hasResendKey: Boolean(resetEmailConfig.resendApiKey),
        hasPostmarkKey: Boolean(resetEmailConfig.postmarkServerToken)
      });
    }

    if (path === '/api/analytics/track' && request.method === 'POST') {
      return handleAnalyticsTrack(request, env);
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

    if (path === '/api/admin/students/overview' && request.method === 'GET') {
      return handleAdminStudentsOverview(request, env);
    }

    const adminStudentDetailMatch = path.match(/^\/api\/admin\/students\/([^/]+)$/);
    if (adminStudentDetailMatch && request.method === 'GET') {
      return handleAdminStudentDetail(request, env, decodeURIComponent(adminStudentDetailMatch[1]));
    }

    const adminStudentResetMatch = path.match(/^\/api\/admin\/students\/([^/]+)\/reset-test-progress$/);
    if (adminStudentResetMatch && request.method === 'POST') {
      return handleAdminResetStudentTestProgress(request, env, decodeURIComponent(adminStudentResetMatch[1]));
    }

    if (path === '/api/admin/password-reset-link' && request.method === 'POST') {
      return handleAdminPasswordResetLink(request, env);
    }

    if (path === '/api/admin/heatmaps/overview' && request.method === 'GET') {
      return handleAdminHeatmapsOverview(request, env);
    }

    const adminHeatmapQuestionMatch = path.match(/^\/api\/admin\/heatmaps\/question\/([^/]+)$/);
    if (adminHeatmapQuestionMatch && request.method === 'GET') {
      return handleAdminHeatmapQuestion(request, env, decodeURIComponent(adminHeatmapQuestionMatch[1]));
    }

    if (path === '/api/admin/heatmaps/replays' && request.method === 'GET') {
      return handleAdminHeatmapReplays(request, env);
    }

    const adminHeatmapReplayMatch = path.match(/^\/api\/admin\/heatmaps\/replays\/([^/]+)$/);
    if (adminHeatmapReplayMatch && request.method === 'GET') {
      return handleAdminHeatmapReplayDetail(request, env, decodeURIComponent(adminHeatmapReplayMatch[1]));
    }

    if (path === '/api/explain' && request.method === 'POST') {
      return handleAIExplain(request, env);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runHeatmapRetentionCleanup(env).catch(() => null));
  }
};
