/**
 * Authentication module
 * Manages admin login/logout, rate limit notices, and UI state sync
 */
const Auth = {
  currentUser: null,

  async checkAuth() {
    try {
      const data = await API.getMe();
      this.currentUser = data.user;
      this.updateUI();
      return true;
    } catch (err) {
      this.currentUser = null;
      API.setToken(null);
      this.updateUI();
      return false;
    }
  },

  updateUI() {
    const navLoginBtn = document.getElementById('nav-login-btn');
    const navAdminGroup = document.getElementById('nav-admin-group');
    const adminUserDisplay = document.getElementById('admin-user-display');
    const adminTab = document.getElementById('tab-admin-dashboard');

    if (this.currentUser) {
      if (navLoginBtn) navLoginBtn.style.display = 'none';
      if (navAdminGroup) navAdminGroup.style.display = 'flex';
      if (adminUserDisplay) adminUserDisplay.textContent = this.currentUser.username;
    } else {
      if (navLoginBtn) navLoginBtn.style.display = 'inline-flex';
      if (navAdminGroup) navAdminGroup.style.display = 'none';
      // If user was on admin tab, switch back to viewer
      if (adminTab && adminTab.classList.contains('active')) {
        App.switchTab('viewer');
      }
    }
  },

  setupLoginForm() {
    const loginForm = document.getElementById('admin-login-form');
    const loginModal = document.getElementById('login-modal');
    const closeBtn = document.getElementById('close-login-modal-btn');
    const cancelBtn = document.getElementById('cancel-login-btn');
    const navLoginBtn = document.getElementById('nav-login-btn');
    const logoutBtn = document.getElementById('nav-logout-btn');

    const openModal = () => {
      const alertBox = document.getElementById('login-status-alert');
      if (alertBox) alertBox.style.display = 'none';
      if (loginModal) loginModal.style.display = 'flex';
      const usernameInput = document.getElementById('login-username');
      if (usernameInput) usernameInput.focus();
    };

    const closeModal = () => {
      if (loginModal) loginModal.style.display = 'none';
    };

    if (navLoginBtn) navLoginBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await API.logout();
        this.currentUser = null;
        this.updateUI();
        App.showAlert('global-toast', 'info', 'You have been logged out.');
      });
    }

    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const usernameInput = document.getElementById('login-username');
        const passwordInput = document.getElementById('login-password');
        const submitBtn = document.getElementById('login-submit-btn');

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!username || !password) {
          App.showAlert('login-status-alert', 'error', 'Both username and password are required.');
          return;
        }

        try {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `
            <svg class="spinner icon-inline" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/></svg>
            Signing In...
          `;

          const response = await API.login(username, password);
          this.currentUser = response.user;
          this.updateUI();
          closeModal();
          loginForm.reset();

          // Show success toast and switch to admin dashboard
          App.showAlert('global-toast', 'success', `Welcome back, ${response.user.username}!`);
          App.switchTab('admin');
        } catch (err) {
          console.error('Login error:', err);
          let message = err.message || 'Invalid username or password.';
          if (err.status === 429) {
            message = 'Too many failed login attempts. Please wait 15 minutes before trying again.';
          }
          App.showAlert('login-status-alert', 'error', message);
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `Sign In as Admin`;
        }
      });
    }
  }
};

window.Auth = Auth;
