const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

function loadWorkerModule(options = {}) {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'worker.js'),
    'utf8'
  );
  const transformedSource = source.replace(
    /export default\s*{/,
    'const __DEFAULT_EXPORT__ = {'
  );

  const context = vm.createContext({
    console,
    fetch: options.fetchImpl || fetch,
    Request,
    Response,
    Headers,
    URL,
    URLSearchParams,
    TextEncoder,
    crypto: options.crypto || webcrypto,
    atob: (value) => Buffer.from(value, 'base64').toString('binary'),
    btoa: (value) => Buffer.from(value, 'binary').toString('base64')
  });

  vm.runInContext(
    `${transformedSource}
this.__TEST_EXPORTS__ = {
  jsonResponse,
  getErrorStatus,
  getCookie,
  buildCookie,
  buildExpiredCookie,
  validateEmail,
  normalizeEmail,
  getAdminEmailAllowlist,
  isAdminEmail,
  buildAuthUser,
  escapeHtml,
  getClientIp,
  getResetEmailConfig,
  isResetEmailConfigured,
  buildPasswordResetEmail,
  defaultExport: __DEFAULT_EXPORT__
};`,
    context
  );

  return context.__TEST_EXPORTS__;
}

module.exports = {
  loadWorkerModule
};
