/**
 * Viewer Module:
 * - Three-column layout: Left Sections panel | Center documents table | Right Bills panel
 * - Same visual style as Sections (solid blue background, darker on hover, dark navy when open)
 * - Accordion Sections with rotating chevron
 * - Single subsection direct-load (e.g. Service, RTF, Medical Reimbursement)
 * - Excel-style Table View (S.No, Title with meta, Description, Preview, Download)
 * - In-table subsection search filter
 * - Mobile slide-out drawers (left for Sections, right for Bills)
 */
const Viewer = {
  sections: [],
  bills: [],
  subsectionsCache: new Map(), // sectionId -> array of subsections
  activeSection: null,
  activeSubsection: null,
  activePanel: null,           // 'main' or 'bills'
  currentDocuments: [],
  tableSearchQuery: '',

  async init() {
    this.setupMobileDrawers();
    this.setupTableSearch();
    this.showPlaceholder();
    await this.loadSidebarSections();
  },

  setupMobileDrawers() {
    // Left Drawer (Sections)
    const toggleLeftBtn = document.getElementById('mobile-sidebar-toggle');
    const closeLeftBtn = document.getElementById('mobile-sidebar-close');
    const leftSidebar = document.getElementById('viewer-sidebar-left');
    const leftBackdrop = document.getElementById('sidebar-backdrop');

    // Right Drawer (Bills)
    const toggleRightBtn = document.getElementById('mobile-bills-toggle');
    const closeRightBtn = document.getElementById('mobile-bills-close');
    const rightSidebar = document.getElementById('viewer-sidebar-right');
    const rightBackdrop = document.getElementById('bills-backdrop');

    const openLeft = () => {
      if (leftSidebar) leftSidebar.classList.add('sidebar-open');
      if (leftBackdrop) leftBackdrop.classList.add('active');
      closeRight();
    };

    const closeLeft = () => {
      if (leftSidebar) leftSidebar.classList.remove('sidebar-open');
      if (leftBackdrop) leftBackdrop.classList.remove('active');
    };

    const openRight = () => {
      if (rightSidebar) rightSidebar.classList.add('bills-open');
      if (rightBackdrop) rightBackdrop.classList.add('active');
      closeLeft();
    };

    const closeRight = () => {
      if (rightSidebar) rightSidebar.classList.remove('bills-open');
      if (rightBackdrop) rightBackdrop.classList.remove('active');
    };

    if (toggleLeftBtn) toggleLeftBtn.addEventListener('click', openLeft);
    if (closeLeftBtn) closeLeftBtn.addEventListener('click', closeLeft);
    if (leftBackdrop) leftBackdrop.addEventListener('click', closeLeft);

    if (toggleRightBtn) toggleRightBtn.addEventListener('click', openRight);
    if (closeRightBtn) closeRightBtn.addEventListener('click', closeRight);
    if (rightBackdrop) rightBackdrop.addEventListener('click', closeRight);

    this.closeAllDrawers = () => {
      closeLeft();
      closeRight();
    };
  },

  setupTableSearch() {
    const searchInput = document.getElementById('viewer-table-search');
    const clearBtn = document.getElementById('viewer-table-search-clear');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.tableSearchQuery = e.target.value.trim().toLowerCase();
        if (clearBtn) {
          clearBtn.style.display = this.tableSearchQuery ? 'inline-flex' : 'none';
        }
        this.filterAndRenderTable();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        this.tableSearchQuery = '';
        clearBtn.style.display = 'none';
        this.filterAndRenderTable();
      });
    }
  },

  showPlaceholder() {
    const placeholder = document.getElementById('viewer-placeholder');
    const contentArea = document.getElementById('viewer-content-area');
    if (placeholder) placeholder.style.display = 'flex';
    if (contentArea) contentArea.style.display = 'none';
  },

  async loadSidebarSections() {
    const mainAccordion = document.getElementById('sidebar-sections-accordion');
    const billsAccordion = document.getElementById('sidebar-bills-accordion');

    try {
      const [mainSections, billsSections] = await Promise.all([
        API.getSections('main'),
        API.getSections('bills')
      ]);

      this.sections = mainSections || [];
      this.bills = billsSections || [];

      if (mainAccordion) {
        this.renderPanel(mainAccordion, this.sections, 'main');
      }
      if (billsAccordion) {
        this.renderPanel(billsAccordion, this.bills, 'bills');
      }
    } catch (err) {
      console.error('Failed to load sections/bills in sidebar:', err);
      if (mainAccordion) {
        mainAccordion.innerHTML = '<div class="sidebar-loading text-danger">Error loading sections.</div>';
      }
      if (billsAccordion) {
        billsAccordion.innerHTML = '<div class="sidebar-loading text-danger">Error loading bills.</div>';
      }
    }
  },

  renderPanel(container, sectionList, panel) {
    container.innerHTML = '';

    if (!sectionList || sectionList.length === 0) {
      container.innerHTML = `<div class="sidebar-loading">No ${panel === 'bills' ? 'bills' : 'sections'} found.</div>`;
      return;
    }

    for (const section of sectionList) {
      const sectionItem = document.createElement('div');
      sectionItem.className = 'accordion-section-item';
      sectionItem.id = `sidebar-section-item-${panel}-${section.id}`;

      // Section header button with clean chevron icon
      const headerBtn = document.createElement('button');
      headerBtn.className = 'accordion-section-header';
      headerBtn.setAttribute('data-section-id', section.id);
      headerBtn.setAttribute('data-panel', panel);
      headerBtn.innerHTML = `
        <span class="accordion-section-title">
          <span class="section-icon-bullet"></span>
          <span>${this.escapeHtml(section.name)}</span>
        </span>
        <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      `;

      // Subsections container (hidden by default)
      const subContainer = document.createElement('div');
      subContainer.className = 'accordion-subsections-container';
      subContainer.id = `sidebar-subs-${panel}-${section.id}`;
      subContainer.style.display = 'none';

      // Section Click Handler
      headerBtn.addEventListener('click', async () => {
        await this.handleSectionHeaderClick(section, headerBtn, subContainer, panel);
      });

      sectionItem.appendChild(headerBtn);
      sectionItem.appendChild(subContainer);
      container.appendChild(sectionItem);
    }
  },

  async handleSectionHeaderClick(section, headerBtn, subContainer, panel) {
    const isExpanded = headerBtn.classList.contains('expanded');

    // Fetch subsections if not cached
    let subsections = this.subsectionsCache.get(section.id);
    if (!subsections) {
      try {
        subsections = await API.getSubsections(section.id);
        this.subsectionsCache.set(section.id, subsections);
      } catch (err) {
        console.error('Failed to get subsections:', err);
        return;
      }
    }

    // SPECIAL REQUIREMENT:
    // "If a section with no real subsections (e.g. Service, RTF, Medical Reimbursement) is clicked, load its single subsection's documents directly."
    if (subsections && subsections.length === 1) {
      if (isExpanded) {
        headerBtn.classList.remove('expanded');
        subContainer.style.display = 'none';
        return;
      }

      // Automatically collapse any other section that was opened earlier in this panel
      this.collapseAllInPanel(panel, section.id);

      const singleSub = subsections[0];

      // Ensure accordion visual expanded state
      headerBtn.classList.add('expanded');
      subContainer.style.display = 'block';
      this.populateSubsections(section, subsections, subContainer, panel);

      // Directly select this single subsection and load its documents
      await this.selectSubsection(section, singleSub, panel);
      return;
    }

    // Toggle expand/collapse for sections with multiple subsections:
    if (isExpanded) {
      headerBtn.classList.remove('expanded');
      subContainer.style.display = 'none';
    } else {
      this.collapseAllInPanel(panel, section.id);
      headerBtn.classList.add('expanded');
      subContainer.style.display = 'block';
      this.populateSubsections(section, subsections, subContainer, panel);
    }
  },

  collapseAllInPanel(panel, excludeSectionId = null) {
    document.querySelectorAll(`.accordion-section-header[data-panel="${panel}"]`).forEach(btn => {
      const secId = parseInt(btn.getAttribute('data-section-id'), 10);
      if (secId !== excludeSectionId) {
        btn.classList.remove('expanded');
      }
    });
    document.querySelectorAll(`.accordion-subsections-container[id^="sidebar-subs-${panel}-"]`).forEach(container => {
      const containerSecId = parseInt(container.id.replace(`sidebar-subs-${panel}-`, ''), 10);
      if (containerSecId !== excludeSectionId) {
        container.style.display = 'none';
      }
    });
  },

  collapseAllSectionsExcept(excludeSectionId = null) {
    document.querySelectorAll('.accordion-section-header').forEach(btn => {
      const secId = parseInt(btn.getAttribute('data-section-id'), 10);
      if (secId !== excludeSectionId) {
        btn.classList.remove('expanded');
      }
    });
    document.querySelectorAll('.accordion-subsections-container').forEach(container => {
      container.style.display = 'none';
    });
  },

  populateSubsections(section, subsections, container, panel) {
    container.innerHTML = '';

    if (!subsections || subsections.length === 0) {
      container.innerHTML = `
        <div style="padding: 0.5rem 1.25rem 0.5rem 2rem; font-size: 0.85rem; color: #94a3b8; font-style: italic;">
          No subsections
        </div>
      `;
      return;
    }

    for (const sub of subsections) {
      const subBtn = document.createElement('button');
      subBtn.className = 'subsection-item-btn';
      subBtn.id = `sub-btn-${panel}-${sub.id}`;
      subBtn.setAttribute('data-sub-id', sub.id);
      subBtn.setAttribute('data-panel', panel);

      const isActive = this.activeSubsection && this.activeSubsection.id === sub.id;
      if (isActive) {
        subBtn.classList.add('active');
      }

      subBtn.innerHTML = `
        <span class="sub-item-name">
          <span class="sub-bullet-arrow">↳</span>
          <span>${this.escapeHtml(sub.name)}</span>
        </span>
        <span class="sub-item-count">${sub.document_count || 0}</span>
      `;

      subBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.selectSubsection(section, sub, panel);
      });

      container.appendChild(subBtn);
    }
  },

  async selectSubsection(section, subsection, panel) {
    this.activeSection = section;
    this.activeSubsection = subsection;
    this.activePanel = panel;

    // Remove active highlight across ALL panels (Sections and Bills)
    document.querySelectorAll('.subsection-item-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    const activeBtn = document.getElementById(`sub-btn-${panel}-${subsection.id}`);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }

    // Close mobile drawers if open
    if (this.closeAllDrawers) {
      this.closeAllDrawers();
    }

    // Update Breadcrumb
    const rootEl = document.getElementById('breadcrumb-root');
    const secEl = document.getElementById('breadcrumb-section');
    const subEl = document.getElementById('breadcrumb-subsection');

    if (rootEl) rootEl.textContent = panel === 'bills' ? 'Bills' : 'Sections';
    if (secEl) secEl.textContent = section.name;
    if (subEl) subEl.textContent = subsection.name;

    // Clear search box
    const searchInput = document.getElementById('viewer-table-search');
    const clearBtn = document.getElementById('viewer-table-search-clear');
    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    this.tableSearchQuery = '';

    // Load documents for this subsection
    await this.loadSubsectionDocuments(subsection.id);
  },

  async loadSubsectionDocuments(subsectionId) {
    const placeholder = document.getElementById('viewer-placeholder');
    const contentArea = document.getElementById('viewer-content-area');
    const loadingEl = document.getElementById('subsection-docs-loading');
    const emptyEl = document.getElementById('subsection-docs-empty');
    const tableWrapper = document.getElementById('documents-table-wrapper');
    const countBadge = document.getElementById('subsection-doc-count');

    // Switch view from placeholder to content area
    if (placeholder) placeholder.style.display = 'none';
    if (contentArea) contentArea.style.display = 'flex';

    if (loadingEl) loadingEl.style.display = 'flex';
    if (emptyEl) emptyEl.style.display = 'none';
    if (tableWrapper) tableWrapper.style.display = 'none';

    try {
      this.currentDocuments = await API.getDocuments({ subsection_id: subsectionId });

      if (loadingEl) loadingEl.style.display = 'none';

      if (!this.currentDocuments || this.currentDocuments.length === 0) {
        if (countBadge) countBadge.textContent = '0 documents';
        if (emptyEl) emptyEl.style.display = 'block';
        if (tableWrapper) tableWrapper.style.display = 'none';
        return;
      }

      // Render documents table
      if (emptyEl) emptyEl.style.display = 'none';
      if (tableWrapper) tableWrapper.style.display = 'block';
      this.filterAndRenderTable();
    } catch (err) {
      console.error('Failed to load subsection documents:', err);
      if (loadingEl) loadingEl.style.display = 'none';
      if (emptyEl) {
        emptyEl.style.display = 'block';
        emptyEl.innerHTML = `
          <h3 class="empty-state-title text-danger">Error Loading Documents</h3>
          <p class="empty-state-desc">${err.message || 'Could not connect to server'}</p>
        `;
      }
    }
  },

  filterAndRenderTable() {
    const tbody = document.getElementById('viewer-documents-tbody');
    const countBadge = document.getElementById('subsection-doc-count');
    if (!tbody) return;

    let filtered = this.currentDocuments;
    if (this.tableSearchQuery) {
      filtered = this.currentDocuments.filter(doc => {
        const titleMatch = (doc.title || '').toLowerCase().includes(this.tableSearchQuery);
        const descMatch = (doc.description || '').toLowerCase().includes(this.tableSearchQuery);
        return titleMatch || descMatch;
      });
    }

    if (countBadge) {
      countBadge.textContent = `${filtered.length} document${filtered.length === 1 ? '' : 's'}`;
    }

    tbody.innerHTML = '';

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 2.5rem; color: #64748b;">
            No documents matching "${this.escapeHtml(this.tableSearchQuery)}" in this subsection.
          </td>
        </tr>
      `;
      return;
    }

    // Render Excel-Style Rows
    filtered.forEach((doc, idx) => {
      const tr = document.createElement('tr');

      const formattedDate = new Date(doc.uploaded_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      const formattedSize = this.formatFileSize(doc.file_size);
      const downloadUrl = API.getDownloadUrl(doc.id);
      const viewUrl = API.getViewUrl(doc.id);

      tr.innerHTML = `
        <td class="cell-sno">${idx + 1}</td>
        <td class="col-title">
          <div class="doc-cell-title">${this.highlightMatch(this.escapeHtml(doc.title), this.tableSearchQuery)}</div>
          <div class="doc-cell-meta">
            <span class="file-type-badge">PDF</span>
            <span>${formattedSize}</span>
            <span>·</span>
            <span>${formattedDate}</span>
          </div>
        </td>
        <td class="col-desc">
          ${doc.description ? this.highlightMatch(this.escapeHtml(doc.description), this.tableSearchQuery) : '<span style="color: #94a3b8; font-style: italic;">No description provided.</span>'}
        </td>
        <td class="cell-action col-preview">
          <button class="btn btn-outline btn-xs btn-preview-doc" data-id="${doc.id}">
            Preview
          </button>
        </td>
        <td class="cell-action col-download">
          <a href="${downloadUrl}" class="btn btn-primary btn-xs" download title="Download ${this.escapeHtml(doc.title)}">
            Download
          </a>
        </td>
      `;

      // Preview button opens modal preview
      tr.querySelector('.btn-preview-doc').addEventListener('click', () => {
        App.openPdfModal(viewUrl, doc.title, downloadUrl);
      });

      tbody.appendChild(tr);
    });
  },

  formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  highlightMatch(text, query) {
    if (!query || !query.trim()) return text;
    const regex = new RegExp(`(${this.escapeRegex(query.trim())})`, 'gi');
    return text.replace(regex, '<mark style="background-color: #fef08a; padding: 0 2px; border-radius: 2px;">$1</mark>');
  },

  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

  /**
   * Refreshes both sidebars and reloads current subsection
   */
  async refresh() {
    this.subsectionsCache.clear();
    await this.loadSidebarSections();
    if (this.activeSubsection) {
      await this.loadSubsectionDocuments(this.activeSubsection.id);
    }
  },

  async loadDocuments() {
    return this.refresh();
  }
};

window.Viewer = Viewer;
