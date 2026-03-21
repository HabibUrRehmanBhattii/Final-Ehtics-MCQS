Object.assign(MCQApp, {
  getAuthApiBaseUrl() {
    return window.location.origin;
  },

  getManagedProgressKeys() {
    const explicitKeys = new Set([
      'wrong_questions',
      'study_daily_stats',
      'last_session',
      'auto-advance',
      'home-insights-expanded',
      'theme'
    ]);

    const keys = new Set();
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('progress_') || key.startsWith('shuffle_') || explicitKeys.has(key)) {
        keys.add(key);
      }
    }
    return keys;
  },

  collectProgressSnapshot() {
    const items = {};
    this.getManagedProgressKeys().forEach((key) => {
      const value = localStorage.getItem(key);
      if (value !== null) {
        items[key] = value;
      }
    });

    return {
      version: 1,
      items
    };
  },

  hasMeaningfulProgressSnapshot(snapshot = this.collectProgressSnapshot()) {
    return Object.keys(snapshot?.items || {}).some((key) =>
      key.startsWith('progress_') ||
      key === 'wrong_questions' ||
      key === 'study_daily_stats' ||
      key === 'last_session'
    );
  },

  getEmptyProgressSnapshot() {
    return {
      version: 1,
      items: {}
    };
  },

  clearPendingSyncTimer() {
    if (this.state.auth.syncTimer) {
      window.clearTimeout(this.state.auth.syncTimer);
      this.state.auth.syncTimer = null;
    }
  },

  applyProgressSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || typeof snapshot.items !== 'object') {
      return;
    }

    this.state.auth.migrating = true;
    try {
      const nextItems = snapshot.items || {};
      this.getManagedProgressKeys().forEach((key) => {
        if (!(key in nextItems)) {
          localStorage.removeItem(key);
        }
      });

      Object.entries(nextItems).forEach(([key, value]) => {
        if (typeof value === 'string') {
          localStorage.setItem(key, value);
        }
      });

      this.state.autoAdvanceEnabled = localStorage.getItem('auto-advance') === 'true';
      this.state.homeInsightsExpanded = localStorage.getItem('home-insights-expanded') === 'true';
      this.initDarkMode();
      this.loadWrongQuestions();
      if (this.state.currentTopic && this.state.currentPracticeTest) {
        this.loadProgress();
      }
      this.renderTopicsGrid();
      if (this.state.currentView === 'mcq' && this.state.questions.length > 0) {
        this.renderQuestion();
      }
    } finally {
      this.state.auth.migrating = false;
    }
  },

  getAuthMigrationKey(userId) {
    return `auth_migrated_${userId}`;
  },

  async fetchAuthJson(path, options = {}) {
    const apiUrl = new URL(path, this.getAuthApiBaseUrl()).toString();
    const response = await fetch(apiUrl, {
      credentials: 'include',
      cache: 'no-store',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    const raw = await response.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { error: raw || `Request failed (${response.status})` };
    }

    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }

    return data;
  },

  async loadAuthConfig() {
    try {
      const data = await this.fetchAuthJson('/api/auth/config', { method: 'GET' });
      this.state.auth.available = Boolean(data.enabled);
      this.state.auth.turnstileSiteKey = String(data.turnstileSiteKey || '');
      this.state.auth.passwordResetEmailEnabled = Boolean(data.passwordResetEmailEnabled);
      return data;
    } catch (error) {
      this.state.auth.available = false;
      this.state.auth.turnstileSiteKey = '';
      this.state.auth.passwordResetEmailEnabled = false;
      return null;
    }
  },

  async initAuth() {
    await this.loadAuthConfig();
    await this.refreshAuthSession({ restoreProgress: true, silent: true });
    this.renderAuthPanel();
  },

  async refreshAuthSession({ restoreProgress = false, silent = false } = {}) {
    if (!this.state.auth.available) {
      this.state.auth.authenticated = false;
      this.state.auth.user = null;
      this.renderAuthPanel();
      return null;
    }

    try {
      const data = await this.fetchAuthJson('/api/auth/session', { method: 'GET' });
      this.state.auth.authenticated = Boolean(data.authenticated);
      this.state.auth.user = data.user || null;
      if (restoreProgress && this.state.auth.authenticated) {
        await this.loadCloudProgress({ silent: true });
      }
      this.renderAuthPanel();
      return data;
    } catch (error) {
      this.state.auth.authenticated = false;
      this.state.auth.user = null;
      this.renderAuthPanel();
      if (!silent) {
        this.showToast('Unable to load your account session right now.', 'warning');
      }
      return null;
    }
  },

  renderAuthPanel() {
    const host = document.getElementById('auth-panel');
    if (!host) return;

    const auth = this.state.auth;
    if (!auth.available) {
      host.innerHTML = `
        <div class="auth-card auth-card-muted">
          <div>
            <div class="auth-panel-title">Cloud Sync</div>
            <div class="auth-panel-copy">Available when the app is served through the Cloudflare Worker.</div>
          </div>
        </div>
      `;
      return;
    }

    if (auth.authenticated && auth.user) {
      const syncedCopy = auth.lastSyncedAt
        ? `Last synced ${new Date(auth.lastSyncedAt).toLocaleString()}`
        : 'Cloud sync ready';

      host.innerHTML = `
        <div class="auth-card auth-card-active">
          <div>
            <div class="auth-panel-title">Cloud sync is on</div>
            <div class="auth-panel-kicker">${this.escapeHtml(auth.user.email)}</div>
            <div class="auth-panel-copy">${this.escapeHtml(syncedCopy)}</div>
          </div>
          <div class="auth-panel-actions">
            <button class="btn-outline" type="button" data-auth-action="sync">Sync</button>
            <button class="btn-outline" type="button" data-auth-action="password">Password</button>
            <button class="btn-outline" type="button" data-auth-action="signout">Sign out</button>
          </div>
        </div>
      `;
      return;
    }

    host.innerHTML = `
      <div class="auth-card">
        <div>
          <div class="auth-panel-title">Cloud sync is optional</div>
          <div class="auth-panel-copy">Save progress and wrong-answer review across devices when you want it.</div>
        </div>
        <div class="auth-panel-actions">
          <button class="btn-outline" type="button" data-auth-action="signin">Sign in</button>
          <button class="btn-primary" type="button" data-auth-action="signup">Sign up</button>
        </div>
      </div>
    `;
  },

  setupAuthEventListeners() {
    document.getElementById('auth-panel')?.addEventListener('click', (event) => {
      const action = event.target.closest('[data-auth-action]')?.getAttribute('data-auth-action');
      if (!action) return;

      if (action === 'signin' || action === 'signup') {
        this.openAuthModal(action);
        return;
      }

      if (action === 'password') {
        this.openAuthModal('change-password');
        return;
      }

      if (action === 'signout') {
        this.signOut();
        return;
      }

      if (action === 'sync') {
        this.syncProgressToCloud({ silent: false, force: true });
      }
    });

    document.getElementById('auth-close-btn')?.addEventListener('click', () => this.closeAuthModal());
    document.getElementById('auth-modal')?.addEventListener('click', (event) => {
      if (event.target.closest('[data-auth-close="true"]')) {
        this.closeAuthModal();
      }
    });

    document.getElementById('auth-switch-btn')?.addEventListener('click', () => {
      const nextMode = this.state.auth.authMode === 'signup' ? 'signin' : 'signup';
      this.openAuthModal(nextMode);
    });

    document.getElementById('auth-forgot-btn')?.addEventListener('click', () => {
      this.openAuthModal('reset-request');
    });

    document.getElementById('auth-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      this.handleAuthSubmit();
    });
  },

  setAuthError(message = '') {
    this.state.auth.error = message;
    const errorEl = document.getElementById('auth-error');
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.classList.toggle('hidden', !message);
  },

  clearPendingPasswordResetLink() {
    this.state.auth.pendingResetToken = '';
    const url = new URL(window.location.href);
    if (!url.searchParams.has('reset')) return;
    url.searchParams.delete('reset');
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, '', nextUrl);
  },

  consumePendingPasswordResetLink() {
    const url = new URL(window.location.href);
    const token = String(url.searchParams.get('reset') || '').trim();
    if (!token || !this.state.auth.available) {
      return;
    }

    this.state.auth.pendingResetToken = token;
    this.openAuthModal('reset-confirm');
    this.showToast('Choose a new password to finish resetting your account.', 'info');
  },

  openAuthModal(mode = 'signin') {
    if (!this.state.auth.available) {
      this.showToast('Account sign-in is not configured in this environment yet.', 'info');
      return;
    }

    this.state.auth.authMode = mode;
    this.state.auth.turnstileReady = false;
    this.setAuthError('');

    const modal = document.getElementById('auth-modal');
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const submitBtn = document.getElementById('auth-submit-btn');
    const switchCopy = document.getElementById('auth-switch-copy');
    const switchBtn = document.getElementById('auth-switch-btn');
    const passwordInput = document.getElementById('auth-password');
    const currentPasswordField = document.getElementById('auth-current-password-field');
    const newPasswordField = document.getElementById('auth-new-password-field');
    const confirmPasswordField = document.getElementById('auth-confirm-password-field');
    const resetTokenField = document.getElementById('auth-reset-token-field');
    const emailField = document.getElementById('auth-email')?.closest('.auth-field');
    const forgotBtn = document.getElementById('auth-forgot-btn');
    const secondaryActions = document.getElementById('auth-secondary-actions');
    const turnstileContainer = document.getElementById('auth-turnstile');
    const form = document.getElementById('auth-form');
    const emailInput = document.getElementById('auth-email');
    const currentPasswordInput = document.getElementById('auth-current-password');
    const newPasswordInput = document.getElementById('auth-new-password');
    const confirmPasswordInput = document.getElementById('auth-confirm-password');
    const resetTokenInput = document.getElementById('auth-reset-token');

    const configureField = (input, visible, required = false) => {
      if (!input) return;
      input.disabled = !visible;
      input.required = required;
    };

    const isSignup = mode === 'signup';
    const isSignin = mode === 'signin';
    const isResetRequest = mode === 'reset-request';
    const isResetConfirm = mode === 'reset-confirm';
    const isChangePassword = mode === 'change-password';
    const hasPrefilledResetToken = Boolean(this.state.auth.pendingResetToken);

    if (title) {
      title.textContent = isSignup
        ? 'Create account'
        : isResetRequest
          ? 'Reset password'
          : isResetConfirm
            ? 'Set new password'
          : isChangePassword
            ? 'Change password'
            : 'Sign in';
    }
    if (subtitle) {
      subtitle.textContent = isSignup
        ? 'Save your study progress and wrong-answer review to the cloud.'
        : isResetRequest
          ? this.state.auth.passwordResetEmailEnabled
            ? 'Enter your email and we will send you a secure reset link.'
            : 'Request a password reset token. Email delivery is not configured yet.'
          : isResetConfirm
            ? 'Create a new password for your account.'
          : isChangePassword
            ? 'Update your password for this account.'
            : 'Continue your study progress from any device.';
    }
    if (submitBtn) {
      submitBtn.textContent = isSignup
        ? 'Create Account'
        : isResetRequest
          ? 'Request Reset'
          : isResetConfirm
            ? 'Set New Password'
          : isChangePassword
            ? 'Update Password'
            : 'Sign In';
    }
    if (switchCopy) switchCopy.textContent = isSignup ? 'Already have an account?' : 'Need an account?';
    if (switchBtn) switchBtn.textContent = isSignup ? 'Sign in' : 'Sign up';
    if (secondaryActions) secondaryActions.classList.toggle('hidden', !isSignin);
    if (forgotBtn) forgotBtn.classList.toggle('hidden', !isSignin);
    if (turnstileContainer) turnstileContainer.classList.toggle('hidden', isResetConfirm);
    if (emailField) emailField.classList.toggle('hidden', isChangePassword || isResetConfirm);
    if (currentPasswordField) currentPasswordField.classList.toggle('hidden', !isChangePassword);
    if (newPasswordField) newPasswordField.classList.toggle('hidden', !(isChangePassword || isResetConfirm));
    if (confirmPasswordField) confirmPasswordField.classList.toggle('hidden', !(isChangePassword || isResetConfirm));
    if (resetTokenField) resetTokenField.classList.toggle('hidden', !isResetConfirm || hasPrefilledResetToken);
    if (switchCopy) switchCopy.parentElement?.classList.toggle('hidden', isResetRequest || isResetConfirm || isChangePassword);
    if (passwordInput) {
      passwordInput.closest('.auth-field')?.classList.toggle('hidden', isResetRequest || isResetConfirm || isChangePassword);
      passwordInput.setAttribute('autocomplete', isSignup ? 'new-password' : 'current-password');
    }
    if (form) form.reset();
    configureField(emailInput, !isChangePassword && !isResetConfirm, !isChangePassword && !isResetConfirm);
    configureField(passwordInput, !(isResetRequest || isResetConfirm || isChangePassword), isSignup || isSignin);
    configureField(currentPasswordInput, isChangePassword, isChangePassword);
    configureField(newPasswordInput, isChangePassword || isResetConfirm, isChangePassword || isResetConfirm);
    configureField(confirmPasswordInput, isChangePassword || isResetConfirm, isChangePassword || isResetConfirm);
    configureField(resetTokenInput, isResetConfirm && !hasPrefilledResetToken, isResetConfirm && !hasPrefilledResetToken);
    if (resetTokenInput) {
      resetTokenInput.value = hasPrefilledResetToken ? this.state.auth.pendingResetToken : '';
    }

    modal?.classList.remove('hidden');
    modal?.setAttribute('aria-hidden', 'false');

    window.setTimeout(() => {
      if (isResetConfirm) {
        document.getElementById('auth-new-password')?.focus();
      } else if (isChangePassword) {
        document.getElementById('auth-current-password')?.focus();
      } else {
        document.getElementById('auth-email')?.focus();
      }
      if (!isResetConfirm) {
        this.ensureTurnstileWidget(true);
      }
    }, 20);
  },

  closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    modal?.classList.add('hidden');
    modal?.setAttribute('aria-hidden', 'true');
    this.setAuthError('');
    this.resetTurnstileWidget();
    if (this.state.auth.authMode === 'reset-confirm') {
      this.clearPendingPasswordResetLink();
    }
  },

  resetTurnstileWidget() {
    this.state.auth.turnstileReady = false;
    if (window.turnstile && this.state.auth.widgetId !== null) {
      try {
        window.turnstile.reset(this.state.auth.widgetId);
      } catch (error) {
        console.warn('Turnstile reset failed', error);
      }
    }
  },

  ensureTurnstileWidget(forceReset = false) {
    const container = document.getElementById('auth-turnstile');
    if (!container || !this.state.auth.turnstileSiteKey || !window.turnstile) {
      return;
    }

    if (forceReset && this.state.auth.widgetId !== null) {
      container.innerHTML = '';
      this.state.auth.widgetId = null;
    }

    if (this.state.auth.widgetId === null) {
      this.state.auth.widgetId = window.turnstile.render(container, {
        sitekey: this.state.auth.turnstileSiteKey,
        theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
        callback: () => {
          this.state.auth.turnstileReady = true;
          this.setAuthError('');
        },
        'expired-callback': () => {
          this.state.auth.turnstileReady = false;
        },
        'error-callback': () => {
          this.state.auth.turnstileReady = false;
          this.setAuthError('Security check failed to load. Please try again.');
        }
      });
      return;
    }

    this.resetTurnstileWidget();
  },

  async handleAuthSubmit() {
    const email = String(document.getElementById('auth-email')?.value || '').trim();
    const password = String(document.getElementById('auth-password')?.value || '');
    const currentPassword = String(document.getElementById('auth-current-password')?.value || '');
    const newPassword = String(document.getElementById('auth-new-password')?.value || '');
    const confirmPassword = String(document.getElementById('auth-confirm-password')?.value || '');
    const resetToken = String(document.getElementById('auth-reset-token')?.value || this.state.auth.pendingResetToken || '').trim();
    const submitBtn = document.getElementById('auth-submit-btn');
    const mode = this.state.auth.authMode;
    const localSnapshotBeforeAuth = this.collectProgressSnapshot();
    this.clearPendingSyncTimer();

    if (mode === 'change-password' || mode === 'reset-confirm') {
      if (mode === 'change-password' && (!currentPassword || !newPassword || !confirmPassword)) {
        this.setAuthError('Please complete all password fields.');
        return;
      }
      if (mode === 'reset-confirm' && (!newPassword || !confirmPassword)) {
        this.setAuthError('Please enter and confirm your new password.');
        return;
      }
      if (newPassword.length < 8) {
        this.setAuthError('New password must be at least 8 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        this.setAuthError('New passwords do not match.');
        return;
      }
      if (mode === 'reset-confirm' && !resetToken) {
        this.setAuthError('Reset token is missing or invalid.');
        return;
      }
    } else if (mode === 'reset-request') {
      if (!email) {
        this.setAuthError('Please enter your email address.');
        return;
      }
    } else {
      if (!email || !password) {
        this.setAuthError('Please enter both email and password.');
        return;
      }
      if (password.length < 8) {
        this.setAuthError('Password must be at least 8 characters.');
        return;
      }
    }

    const requiresTurnstile = mode !== 'reset-confirm';
    let turnstileToken = '';
    if (requiresTurnstile) {
      if (!window.turnstile || this.state.auth.widgetId === null) {
        this.setAuthError('Security check is still loading. Please wait a moment.');
        return;
      }

      turnstileToken = window.turnstile.getResponse(this.state.auth.widgetId);
      if (!turnstileToken) {
        this.setAuthError('Please complete the security check.');
        return;
      }
    }

    this.state.auth.loading = true;
    const defaultSubmitLabel = submitBtn?.textContent || '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = mode === 'reset-confirm' ? 'Saving...' : 'Please wait...';
    }
    this.setAuthError('');

    try {
      let data;
      if (mode === 'reset-request') {
        data = await this.fetchAuthJson('/api/auth/password-reset/request', {
          method: 'POST',
          body: JSON.stringify({ email, turnstileToken })
        });
        this.closeAuthModal();
        this.showToast(data.message || 'If the account exists, reset instructions will be issued.', 'success');
        return;
      }

      if (mode === 'change-password') {
        data = await this.fetchAuthJson('/api/auth/password-change', {
          method: 'POST',
          body: JSON.stringify({ currentPassword, newPassword, turnstileToken })
        });
        this.closeAuthModal();
        this.showToast(data.message || 'Password updated successfully.', 'success');
        return;
      }

      if (mode === 'reset-confirm') {
        data = await this.fetchAuthJson('/api/auth/password-reset/confirm', {
          method: 'POST',
          body: JSON.stringify({ token: resetToken, newPassword })
        });
        this.clearPendingPasswordResetLink();
        this.closeAuthModal();
        this.showToast(data.message || 'Password reset successfully. You can sign in now.', 'success');
        this.openAuthModal('signin');
        return;
      }

      const endpoint = mode === 'signup' ? 'signup' : 'signin';
      data = await this.fetchAuthJson(`/api/auth/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify({ email, password, turnstileToken })
      });

      this.state.auth.authenticated = Boolean(data.authenticated);
      this.state.auth.user = data.user || null;

      if (this.state.auth.user) {
        const migrationKey = this.getAuthMigrationKey(this.state.auth.user.id);
        if (mode === 'signup' && !localStorage.getItem(migrationKey) && this.hasMeaningfulProgressSnapshot(localSnapshotBeforeAuth)) {
          this.applyProgressSnapshot(localSnapshotBeforeAuth);
          await this.syncProgressToCloud({ silent: true, force: true });
          localStorage.setItem(migrationKey, new Date().toISOString());
        } else {
          await this.loadCloudProgress({ silent: true, resetToEmpty: true });
        }
      }

      this.closeAuthModal();
      this.renderAuthPanel();
      this.renderTopicsGrid();
      this.showToast(mode === 'signup' ? 'Account created successfully.' : 'Signed in successfully.', 'success');
    } catch (error) {
      this.setAuthError(error.message || 'Authentication failed. Please try again.');
      if (requiresTurnstile) {
        this.resetTurnstileWidget();
      }
    } finally {
      this.state.auth.loading = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = defaultSubmitLabel;
      }
    }
  },

  async signOut() {
    this.clearPendingSyncTimer();
    try {
      await this.fetchAuthJson('/api/auth/signout', { method: 'POST', body: JSON.stringify({}) });
    } catch (error) {
      console.warn('Sign out request failed', error);
    }

    this.state.auth.authenticated = false;
    this.state.auth.user = null;
    this.state.auth.lastSyncedAt = null;
    this.state.currentTopic = null;
    this.state.currentPracticeTest = null;
    this.state.practiceTestParent = null;
    this.state.lifeSection = null;
    this.state.questions = [];
    this.state.currentQuestionIndex = 0;
    this.state.isReviewMode = false;
    this.applyProgressSnapshot(this.getEmptyProgressSnapshot());
    this.showView('home');
    this.renderAuthPanel();
    this.showToast('Signed out.', 'success');
  },

  scheduleProgressSync() {
    if (!this.state.auth.authenticated || this.state.auth.migrating) return;

    if (this.state.auth.syncTimer) {
      window.clearTimeout(this.state.auth.syncTimer);
    }

    this.state.auth.syncTimer = window.setTimeout(() => {
      this.state.auth.syncTimer = null;
      this.syncProgressToCloud({ silent: true, force: false });
    }, 900);
  },

  async syncProgressToCloud({ silent = true, force = false } = {}) {
    if (!this.state.auth.available || !this.state.auth.authenticated || !navigator.onLine) {
      return false;
    }

    const snapshot = this.collectProgressSnapshot();
    if (!force && !this.hasMeaningfulProgressSnapshot(snapshot)) {
      return false;
    }

    try {
      const data = await this.fetchAuthJson('/api/auth/sync-progress', {
        method: 'POST',
        body: JSON.stringify({ progress: snapshot })
      });
      this.state.auth.lastSyncedAt = data.syncedAt || new Date().toISOString();
      this.renderAuthPanel();
      return true;
    } catch (error) {
      console.warn('Cloud sync failed', error);
      if (!silent) {
        this.showToast('Cloud sync failed. Local progress is still saved on this device.', 'warning');
      }
      return false;
    }
  },

  async loadCloudProgress({ silent = false, resetToEmpty = false } = {}) {
    if (!this.state.auth.available || !this.state.auth.authenticated) {
      return false;
    }

    try {
      const data = await this.fetchAuthJson('/api/auth/progress', { method: 'GET' });
      if (data.progress && typeof data.progress === 'object') {
        this.applyProgressSnapshot(data.progress);
      } else if (resetToEmpty) {
        this.applyProgressSnapshot(this.getEmptyProgressSnapshot());
      }
      this.state.auth.lastSyncedAt = data.syncedAt || null;
      this.renderAuthPanel();
      return true;
    } catch (error) {
      console.warn('Progress restore failed', error);
      if (resetToEmpty) {
        this.applyProgressSnapshot(this.getEmptyProgressSnapshot());
        this.renderAuthPanel();
      }
      if (!silent) {
        this.showToast('Unable to restore cloud progress right now.', 'warning');
      }
      return false;
    }
  }
});
