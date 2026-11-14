/**
 * Main application controller
 * Manages tab switching, modals, PDF viewer, alerts, and bootstrap
 */
const App = {
  currentTab: 'viewer',

  async init() {
    this.setupNavigation();
    this.setupPdfModal();

    // Check Auth
    await Auth.checkAuth();
    Auth.setupLoginForm();

    // Initialize Viewer
    await Viewer.init();

    // Initialize Admin
    await Admin.init();
  },

  setupNavigation() {
    const navViewerBtn = document.getElementById('nav-viewer-btn');
    const navAdminBtn = document.getElementById('nav-admin-dashboard-btn');

    if (navViewerBtn) {
      navViewerBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchTab('viewer');
        if (window.Viewer) {
          Viewer.showPlaceholder();
          Viewer.collapseAllSectionsExcept(null);
        }
      });
    }

    if (navAdminBtn) {
      navAdminBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!Auth.currentUser) {
          const loginModal = document.getElementById('login-modal');
          if (loginModal) loginModal.style.display = 'flex';
          return;
        }
        this.switchTab('admin');
      });
    }

    // Admin inner tabs: Documents vs Sections Hierarchy
    const adminDocsTabBtn = document.getElementById('admin-tab-btn-docs');
    const adminSectionsTabBtn = document.getElementById('admin-tab-btn-sections');

    const adminDocsSection = document.getElementById('admin-section-docs');
    const adminSectionsSection = document.getElementById('admin-section-hierarchy');

    if (adminDocsTabBtn && adminSectionsTabBtn) {
      adminDocsTabBtn.addEventListener('click', () => {
        adminDocsTabBtn.classList.add('active');
        adminSectionsTabBtn.classList.remove('active');
        if (adminDocsSection) adminDocsSection.style.display = 'block';
        if (adminSectionsSection) adminSectionsSection.style.display = 'none';
      });

      adminSectionsTabBtn.addEventListener('click', () => {
        adminSectionsTabBtn.classList.add('active');
        adminDocsTabBtn.classList.remove('active');
        if (adminDocsSection) adminDocsSection.style.display = 'none';
        if (adminSectionsSection) adminSectionsSection.style.display = 'block';
      });
    }
  },

  switchTab(tabName) {
    this.currentTab = tabName;
    const viewerView = document.getElementById('view-viewer');
    const adminView = document.getElementById('view-admin');

    const navViewerBtn = document.getElementById('nav-viewer-btn');
    const navAdminBtn = document.getElementById('nav-admin-dashboard-btn');

    if (tabName === 'viewer') {
      if (viewerView) viewerView.style.display = 'block';
      if (adminView) adminView.style.display = 'none';
      if (navViewerBtn) navViewerBtn.classList.add('active');
      if (navAdminBtn) navAdminBtn.classList.remove('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (tabName === 'admin') {
      if (viewerView) viewerView.style.display = 'none';
      if (adminView) adminView.style.display = 'block';
      if (navViewerBtn) navViewerBtn.classList.remove('active');
      if (navAdminBtn) navAdminBtn.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  },

  setupPdfModal() {
    const modal = document.getElementById('pdf-viewer-modal');
    const closeBtn = document.getElementById('close-pdf-modal-btn');
    const iframe = document.getElementById('pdf-modal-iframe');

    const closeModal = () => {
      if (modal) modal.style.display = 'none';
      if (iframe) iframe.src = 'about:blank';
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    // Close when clicking outside content
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }
  },

  openPdfModal(viewUrl, title, downloadUrl) {
    const modal = document.getElementById('pdf-viewer-modal');
    const titleEl = document.getElementById('pdf-modal-title');
    const downloadLink = document.getElementById('pdf-modal-download-btn');
    const iframe = document.getElementById('pdf-modal-iframe');

    if (titleEl) titleEl.textContent = title;
    if (downloadLink) downloadLink.href = downloadUrl;
    if (iframe) iframe.src = viewUrl;

    if (modal) modal.style.display = 'flex';
  },

  showAlert(containerId, type, message, autoHideMs = 6000) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.className = `alert alert-${type}`;
    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    } else {
      iconSvg = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }

    container.innerHTML = `
      ${iconSvg}
      <div class="alert-content">${message}</div>
    `;
    container.style.display = 'flex';

    if (autoHideMs) {
      setTimeout(() => {
        if (container.style.display !== 'none') {
          container.style.display = 'none';
        }
      }, autoHideMs);
    }
  }
};

window.App = App;

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

