Object.assign(MCQApp, {
  getAuthApiBaseUrl() {
    return window.location.origin;
  },

  normalizeAuthUser(user) {
    if (!user || typeof user !== 'object') return null;
    return {
      ...user,
      isAdmin: Boolean(user.isAdmin)
    };
  },

  ensureAdminDashboardState() {
    if (!this.state.auth.admin || typeof this.state.auth.admin !== 'object') {
      this.state.auth.admin = {
        overview: null,
        students: [],
        selectedStudentId: '',
        selectedStudentDetail: null,
        searchQuery: '',
        loadingOverview: false,
        loadingDetail: false,
        loadingResetKey: '',
        error: '',
        detailError: '',
        refreshIntervalId: null,
        lastRefreshedAt: null
      };
    }
    return this.state.auth.admin;
  },

  isCurrentUserAdmin() {
    return Boolean(this.state.auth.authenticated && this.state.auth.user && this.state.auth.user.isAdmin);
  },

  formatAdminDuration(ms = 0) {
    const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  },

  stopAdminDashboardAutoRefresh() {
    const admin = this.ensureAdminDashboardState();
    if (admin.refreshIntervalId) {
      window.clearInterval(admin.refreshIntervalId);
      admin.refreshIntervalId = null;
    }
  },

  startAdminDashboardAutoRefresh() {
    const admin = this.ensureAdminDashboardState();
    this.stopAdminDashboardAutoRefresh();
    admin.refreshIntervalId = window.setInterval(() => {
      if (this.state.currentView !== 'admin' || !this.isCurrentUserAdmin()) {
        this.stopAdminDashboardAutoRefresh();
        return;
      }
      this.refreshAdminDashboard({ silent: true, preserveSelection: true });
    }, 60000);
  },

  openAdminDashboard() {
    if (!this.isCurrentUserAdmin()) {
      this.showToast('Admin access is not enabled for this account.', 'warning');
      return;
    }
    this.showView('admin');
  },

  onEnterAdminView() {
    if (!this.isCurrentUserAdmin()) {
      this.showView('home');
      this.showToast('Admin access is restricted to allowed accounts.', 'warning');
      return;
    }

    this.ensureAdminDashboardState();
    this.renderAdminDashboard();
    this.startAdminDashboardAutoRefresh();
    this.refreshAdminDashboard({ silent: false, preserveSelection: true });
  },

  onLeaveAdminView() {
    this.stopAdminDashboardAutoRefresh();
  },

  async refreshAdminDashboard({ silent = false, preserveSelection = true } = {}) {
    if (!this.isCurrentUserAdmin()) {
      return false;
    }

    const admin = this.ensureAdminDashboardState();
    admin.loadingOverview = true;
    admin.error = '';
    if (!silent) {
      this.renderAdminDashboard();
    }

    try {
      const params = new URLSearchParams();
      if (admin.searchQuery) {
        params.set('q', admin.searchQuery);
      }
      const queryString = params.toString();
      const endpoint = `/api/admin/students/overview${queryString ? `?${queryString}` : ''}`;
      const data = await this.fetchAuthJson(endpoint, { method: 'GET' });

      admin.overview = data.metrics || null;
      admin.students = Array.isArray(data.students) ? data.students : [];
      admin.lastRefreshedAt = data.generatedAt || new Date().toISOString();
      admin.error = '';

      if (admin.students.length === 0) {
        admin.selectedStudentId = '';
        admin.selectedStudentDetail = null;
      } else {
        const hasSelectedStudent = preserveSelection &&
          admin.selectedStudentId &&
          admin.students.some((student) => String(student.id) === String(admin.selectedStudentId));
        admin.selectedStudentId = hasSelectedStudent
          ? String(admin.selectedStudentId)
          : String(admin.students[0].id);
        await this.loadAdminStudentDetail(admin.selectedStudentId, { silent: true });
      }

      return true;
    } catch (error) {
      admin.error = error.message || 'Unable to load student overview.';
      if (!silent) {
        this.showToast(admin.error, 'warning');
      }
      return false;
    } finally {
      admin.loadingOverview = false;
      this.renderAdminDashboard();
    }
  },

  async loadAdminStudentDetail(userId, { silent = false } = {}) {
    const admin = this.ensureAdminDashboardState();
    if (!this.isCurrentUserAdmin()) {
      return false;
    }
    if (!userId) {
      admin.selectedStudentId = '';
      admin.selectedStudentDetail = null;
      admin.detailError = '';
      this.renderAdminDashboard();
      return true;
    }

    admin.loadingDetail = true;
    admin.detailError = '';
    admin.selectedStudentId = String(userId);
    if (!silent) {
      this.renderAdminDashboard();
    }

    try {
      const data = await this.fetchAuthJson(`/api/admin/students/${encodeURIComponent(String(userId))}`, { method: 'GET' });
      admin.selectedStudentDetail = data;
      admin.detailError = '';
      return true;
    } catch (error) {
      admin.selectedStudentDetail = null;
      admin.detailError = error.message || 'Unable to load student details.';
      if (!silent) {
        this.showToast(admin.detailError, 'warning');
      }
      return false;
    } finally {
      admin.loadingDetail = false;
      this.renderAdminDashboard();
    }
  },

  async resetAdminStudentTestProgress(topicId, testId) {
    const admin = this.ensureAdminDashboardState();
    const userId = admin.selectedStudentId;
    if (!this.isCurrentUserAdmin() || !userId || !topicId || !testId) {
      return false;
    }

    if (!confirm(`Reset progress for ${topicId} / ${testId} for this student?`)) {
      return false;
    }

    const resetKey = `${topicId}_${testId}`;
    admin.loadingResetKey = resetKey;
    this.renderAdminDashboard();

    try {
      await this.fetchAuthJson(`/api/admin/students/${encodeURIComponent(String(userId))}/reset-test-progress`, {
        method: 'POST',
        body: JSON.stringify({ topicId, testId })
      });
      this.showToast('Student test progress reset.', 'success');
      await this.refreshAdminDashboard({ silent: true, preserveSelection: true });
      return true;
    } catch (error) {
      this.showToast(error.message || 'Unable to reset test progress.', 'warning');
      return false;
    } finally {
      admin.loadingResetKey = '';
      this.renderAdminDashboard();
    }
  },

  renderAdminDashboard() {
    const root = document.getElementById('admin-dashboard-root');
    if (!root) return;

    if (!this.isCurrentUserAdmin()) {
      root.innerHTML = `
        <div class="admin-empty-card">
          <h3>Admin access required</h3>
          <p>Sign in with an allowlisted admin account to open this dashboard.</p>
        </div>
      `;
      return;
    }

    const admin = this.ensureAdminDashboardState();
    const overview = admin.overview || {
      studentsCount: 0,
      activeStudents: 0,
      totalAnswered: 0,
      avgCompletionPct: 0,
      avgFirstTryAccuracyPct: 0
    };
    const students = Array.isArray(admin.students) ? admin.students : [];
    const selectedDetail = admin.selectedStudentDetail || null;
    const selectedSummary = selectedDetail?.summary || null;
    const topics = Array.isArray(selectedDetail?.topics) ? selectedDetail.topics : [];
    const lastRefreshed = admin.lastRefreshedAt
      ? new Date(admin.lastRefreshedAt).toLocaleString()
      : 'Not refreshed yet';

    const studentRowsHtml = students.length === 0
      ? `
        <tr>
          <td colspan="7" class="admin-empty-row">No students matched this filter.</td>
        </tr>
      `
      : students.map((student) => {
        const isSelected = String(student.id) === String(admin.selectedStudentId);
        return `
          <tr class="${isSelected ? 'is-selected' : ''}">
            <td>${this.escapeHtml(student.email || '')}</td>
            <td>${Number(student.totalTests || 0)}</td>
            <td>${Number(student.answeredCount || 0)}</td>
            <td>${Number(student.completionPct || 0)}%</td>
            <td>${Number(student.firstTryAccuracyPct || 0)}%</td>
            <td>${this.escapeHtml(this.formatAdminDuration(student.totalStudyTimeMs || 0))}</td>
            <td>
              <button class="btn-outline admin-table-btn" type="button" data-admin-action="load-student" data-user-id="${this.escapeHtml(String(student.id))}">
                View
              </button>
            </td>
          </tr>
        `;
      }).join('');

    const detailTopicsHtml = topics.length === 0
      ? '<div class="admin-empty-card"><p>No synced test payload available for this student yet.</p></div>'
      : topics.map((topic) => {
        const testsHtml = (topic.tests || []).map((testItem) => {
          const resetKey = `${testItem.topicId}_${testItem.testId}`;
          const isResetting = admin.loadingResetKey === resetKey;
          return `
            <tr>
              <td>${this.escapeHtml(testItem.testId || '')}</td>
              <td>${Number(testItem.answeredCount || 0)}</td>
              <td>${Number(testItem.viewedCount || 0)}</td>
              <td>${Number(testItem.revealedCount || 0)}</td>
              <td>${Number(testItem.bookmarkedCount || 0)}</td>
              <td>${Number(testItem.firstTryAccuracyPct || 0)}%</td>
              <td>${this.escapeHtml(this.formatAdminDuration(testItem.studyTimeMs || 0))}</td>
              <td>${this.escapeHtml(testItem.lastUpdatedAt ? new Date(testItem.lastUpdatedAt).toLocaleString() : 'n/a')}</td>
              <td>
                <button class="btn-outline admin-reset-btn" type="button" data-admin-action="reset-test" data-topic-id="${this.escapeHtml(testItem.topicId || '')}" data-test-id="${this.escapeHtml(testItem.testId || '')}" ${isResetting ? 'disabled' : ''}>
                  ${isResetting ? 'Resetting...' : 'Reset'}
                </button>
              </td>
            </tr>
          `;
        }).join('');

        return `
          <section class="admin-topic-card">
            <header class="admin-topic-head">
              <h4>${this.escapeHtml(topic.topicId || '')}</h4>
              <div class="admin-topic-meta">
                <span>Answered ${Number(topic.answeredCount || 0)}</span>
                <span>Completion ${Number(topic.completionPct || 0)}%</span>
                <span>Accuracy ${Number(topic.firstTryAccuracyPct || 0)}%</span>
              </div>
            </header>
            <div class="admin-table-wrap">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>Test</th>
                    <th>Answered</th>
                    <th>Viewed</th>
                    <th>Revealed</th>
                    <th>Bookmarked</th>
                    <th>First try</th>
                    <th>Study time</th>
                    <th>Updated</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>${testsHtml}</tbody>
              </table>
            </div>
          </section>
        `;
      }).join('');

    root.innerHTML = `
      <section class="admin-toolbar">
        <div>
          <h3>Student Progress Monitor</h3>
          <p>Last refresh: ${this.escapeHtml(lastRefreshed)}</p>
        </div>
        <div class="admin-toolbar-actions">
          <input id="admin-search-input" class="admin-search-input" type="search" placeholder="Search student email" value="${this.escapeHtml(admin.searchQuery || '')}">
          <button class="btn-outline" type="button" data-admin-action="search">Search</button>
          <button class="btn-outline" type="button" data-admin-action="refresh">${admin.loadingOverview ? 'Refreshing...' : 'Refresh'}</button>
          <button class="btn-outline" type="button" data-admin-action="back-home">Home</button>
        </div>
      </section>

      ${admin.error ? `<div class="admin-error">${this.escapeHtml(admin.error)}</div>` : ''}

      <section class="admin-kpi-grid">
        <article class="admin-kpi-card"><span>Students</span><strong>${Number(overview.studentsCount || 0)}</strong></article>
        <article class="admin-kpi-card"><span>Active (7d)</span><strong>${Number(overview.activeStudents || 0)}</strong></article>
        <article class="admin-kpi-card"><span>Total Answered</span><strong>${Number(overview.totalAnswered || 0)}</strong></article>
        <article class="admin-kpi-card"><span>Avg Completion</span><strong>${Number(overview.avgCompletionPct || 0)}%</strong></article>
        <article class="admin-kpi-card"><span>Avg First-Try</span><strong>${Number(overview.avgFirstTryAccuracyPct || 0)}%</strong></article>
      </section>

      <section class="admin-table-section">
        <h4>Students</h4>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Tests</th>
                <th>Answered</th>
                <th>Completion</th>
                <th>First try</th>
                <th>Study time</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>${studentRowsHtml}</tbody>
          </table>
        </div>
      </section>

      <section class="admin-detail-section">
        <h4>Student Detail</h4>
        ${admin.loadingDetail ? '<div class="admin-empty-card"><p>Loading student details...</p></div>' : ''}
        ${admin.detailError ? `<div class="admin-error">${this.escapeHtml(admin.detailError)}</div>` : ''}
        ${selectedDetail ? `
          <div class="admin-student-summary">
            <div><strong>${this.escapeHtml(selectedDetail.student?.email || '')}</strong></div>
            <div>Answered: ${Number(selectedSummary?.answeredCount || 0)} | Completion: ${Number(selectedSummary?.completionPct || 0)}% | First-try: ${Number(selectedSummary?.firstTryAccuracyPct || 0)}%</div>
            <div>Total study time: ${this.escapeHtml(this.formatAdminDuration(selectedSummary?.totalStudyTimeMs || 0))}</div>
          </div>
          ${detailTopicsHtml}
        ` : '<div class="admin-empty-card"><p>Select a student to inspect topic/test detail.</p></div>'}
      </section>
    `;
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
    this.ensureAdminDashboardState();
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
      this.state.auth.user = this.normalizeAuthUser(data.user || null);
      if (restoreProgress && this.state.auth.authenticated) {
        await this.loadCloudProgress({ silent: true });
      }
      if (!this.isCurrentUserAdmin() && this.state.currentView === 'admin') {
        this.showView('home');
      }
      this.renderAuthPanel();
      return data;
    } catch (error) {
      this.state.auth.authenticated = false;
      this.state.auth.user = null;
      if (this.state.currentView === 'admin') {
        this.showView('home');
      }
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
      const adminAction = auth.user.isAdmin
        ? '<button class="btn-outline" type="button" data-auth-action="admin-dashboard">Admin Dashboard</button>'
        : '';

      host.innerHTML = `
        <div class="auth-card auth-card-active">
          <div>
            <div class="auth-panel-title">Cloud sync is on</div>
            <div class="auth-panel-kicker">${this.escapeHtml(auth.user.email)}</div>
            <div class="auth-panel-copy">${this.escapeHtml(syncedCopy)}</div>
          </div>
          <div class="auth-panel-actions">
            <button class="btn-outline" type="button" data-auth-action="sync">Sync</button>
            ${adminAction}
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

      if (action === 'admin-dashboard') {
        this.openAdminDashboard();
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

    document.getElementById('admin-view')?.addEventListener('click', (event) => {
      const actionEl = event.target.closest('[data-admin-action]');
      const action = actionEl?.getAttribute('data-admin-action');
      if (!action) return;

      if (action === 'back-home') {
        this.showView('home');
        return;
      }
      if (action === 'refresh') {
        this.refreshAdminDashboard({ silent: false, preserveSelection: true });
        return;
      }
      if (action === 'search') {
        const input = document.getElementById('admin-search-input');
        const admin = this.ensureAdminDashboardState();
        admin.searchQuery = String(input?.value || '').trim().toLowerCase();
        this.refreshAdminDashboard({ silent: false, preserveSelection: false });
        return;
      }
      if (action === 'load-student') {
        const userId = String(actionEl?.getAttribute('data-user-id') || '').trim();
        if (userId) {
          this.loadAdminStudentDetail(userId, { silent: false });
        }
        return;
      }
      if (action === 'reset-test') {
        const topicId = String(actionEl?.getAttribute('data-topic-id') || '').trim();
        const testId = String(actionEl?.getAttribute('data-test-id') || '').trim();
        if (topicId && testId) {
          this.resetAdminStudentTestProgress(topicId, testId);
        }
      }
    });

    document.getElementById('admin-view')?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      const target = event.target;
      if (!target || target.id !== 'admin-search-input') {
        return;
      }
      event.preventDefault();
      const admin = this.ensureAdminDashboardState();
      admin.searchQuery = String(target.value || '').trim().toLowerCase();
      this.refreshAdminDashboard({ silent: false, preserveSelection: false });
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
      this.state.auth.user = this.normalizeAuthUser(data.user || null);

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
    this.stopAdminDashboardAutoRefresh();
    try {
      await this.fetchAuthJson('/api/auth/signout', { method: 'POST', body: JSON.stringify({}) });
    } catch (error) {
      console.warn('Sign out request failed', error);
    }

    this.state.auth.authenticated = false;
    this.state.auth.user = null;
    this.state.auth.lastSyncedAt = null;
    this.ensureAdminDashboardState();
    this.state.auth.admin.overview = null;
    this.state.auth.admin.students = [];
    this.state.auth.admin.selectedStudentId = '';
    this.state.auth.admin.selectedStudentDetail = null;
    this.state.auth.admin.error = '';
    this.state.auth.admin.detailError = '';
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
