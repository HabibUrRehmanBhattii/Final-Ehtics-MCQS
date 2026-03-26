/**
 * Worker Auth/Session Handlers
 * Centralized authentication, session, and token management for Cloudflare Worker
 */

// Constants
const AUTH_CONSTANTS = {
  COOKIE_NAME: 'mcq_session',
  SESSION_TTL_MS: 1000 * 60 * 60 * 24 * 30,
  PBKDF2_ITERATIONS: 100000,
  TURNSTILE_VERIFY_URL: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
  PASSWORD_RESET_TTL_MS: 1000 * 60 * 30,
  RATE_LIMIT_WINDOW_MINUTES: 15,
  RATE_LIMIT_IP_MAX: 15,
  RATE_LIMIT_EMAIL_MAX: 8,
  RESET_RATE_LIMIT_WINDOW_MINUTES: 30,
  RESET_RATE_LIMIT_EMAIL_MAX: 5
};

/**
 * Extract session token from cookie
 */
function getCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = cookieHeader.split(';').map((part) => part.trim());
  const match = cookies.find((entry) => entry.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

/**
 * Build Set-Cookie header for session
 */
function buildCookie(value, expiresAt) {
  const parts = [
    `${AUTH_CONSTANTS.COOKIE_NAME}=${encodeURIComponent(value)}`,
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

/**
 * Build expired cookie (for logout)
 */
function buildExpiredCookie() {
  return `${AUTH_CONSTANTS.COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Secure; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

/**
 * Get client IP address from request
 */
function getClientIp(request) {
  const cfIp = String(request.headers.get('CF-Connecting-IP') || '').trim();
  if (cfIp) return cfIp;

  const forwardedFor = String(request.headers.get('x-forwarded-for') || '').trim();
  if (forwardedFor) return forwardedFor.split(',')[0].trim();

  return 'unknown';
}

/**
 * Validate email format
 */
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Normalize email to lowercase
 */
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Get admin email allowlist from environment
 */
function getAdminEmailAllowlist(env) {
  const configuredRaw = String(env?.ADMIN_EMAIL_ALLOWLIST || '').trim();
  const source = configuredRaw || 'habibcanad@gmail.com';
  return Array.from(
    new Set(
      source
        .split(',')
        .map((email) => normalizeEmail(email))
        .filter(Boolean)
    )
  );
}

/**
 * Check if email is admin
 */
function isAdminEmail(env, email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return getAdminEmailAllowlist(env).includes(normalized);
}

/**
 * Build authenticated user object
 */
function buildAuthUser(env, userId, email) {
  return {
    id: userId,
    email,
    isAdmin: isAdminEmail(env, email)
  };
}

/**
 * Hash password using PBKDF2
 */
async function hashPassword(password, saltBytes = crypto.getRandomValues(new Uint8Array(16))) {
  const textEncoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', textEncoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt: saltBytes,
    iterations: AUTH_CONSTANTS.PBKDF2_ITERATIONS,
    hash: 'SHA-256'
  }, key, 256);

  const base64url = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  return `pbkdf2$${AUTH_CONSTANTS.PBKDF2_ITERATIONS}$${base64url(saltBytes)}$${base64url(derived)}`;
}

/**
 * Decode base64url
 */
function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/**
 * Verify password against stored hash
 */
async function verifyPassword(password, storedHash) {
  const [scheme, iterationsRaw, saltRaw, hashRaw] = String(storedHash || '').split('$');
  if (scheme !== 'pbkdf2' || !iterationsRaw || !saltRaw || !hashRaw) {
    return false;
  }

  const iterations = Number(iterationsRaw);
  const salt = decodeBase64Url(saltRaw);
  const derived = await hashPassword(password, salt);
  return derived === storedHash && iterations === AUTH_CONSTANTS.PBKDF2_ITERATIONS;
}

/**
 * Validate Turnstile CAPTCHA token
 */
async function validateTurnstile(env, request, token) {
  if (!env.TURNSTILE_SECRET_KEY) {
    throw new Error('TURNSTILE_SECRET_KEY secret is missing');
  }

  const body = new URLSearchParams();
  body.set('secret', env.TURNSTILE_SECRET_KEY);
  body.set('response', token);
  body.set('remoteip', getClientIp(request));

  const response = await fetch(AUTH_CONSTANTS.TURNSTILE_VERIFY_URL, {
    method: 'POST',
    body
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error('Turnstile verification failed');
  }

  return true;
}

/**
 * Sign session token
 */
async function signSessionToken(secret, token) {
  const textEncoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(token));

  const base64url = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  return base64url(signature);
}

/**
 * Export auth handlers for use in worker
 */
const AuthHandlers = {
  getCookie,
  buildCookie,
  buildExpiredCookie,
  getClientIp,
  validateEmail,
  normalizeEmail,
  getAdminEmailAllowlist,
  isAdminEmail,
  buildAuthUser,
  hashPassword,
  decodeBase64Url,
  verifyPassword,
  validateTurnstile,
  signSessionToken,
  AUTH_CONSTANTS
};
