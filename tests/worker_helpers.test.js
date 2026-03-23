const test = require('node:test');
const assert = require('node:assert/strict');

const {
  loadWorkerModule
} = require('./helpers/worker_test_utils');

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
