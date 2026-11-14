/**
 * Reusable Cascading Dropdown Component
 * Used across Viewer search/filter and Admin upload & edit forms.
 * Options are populated dynamically via the API, never hardcoded.
 */
class CascadingDropdown {
  constructor(options = {}) {
    this.sectionSelect = typeof options.sectionSelect === 'string' 
      ? document.querySelector(options.sectionSelect) 
      : options.sectionSelect;

    this.subsectionSelect = typeof options.subsectionSelect === 'string' 
      ? document.querySelector(options.subsectionSelect) 
      : options.subsectionSelect;

    this.allowAllSections = options.allowAllSections ?? false;
    this.allowAllSubsections = options.allowAllSubsections ?? false;
    this.sectionPrompt = options.sectionPrompt || (this.allowAllSections ? 'All Sections' : '-- Select Section --');
    this.subsectionPrompt = options.subsectionPrompt || (this.allowAllSubsections ? 'All Subsections' : '-- Select Subsection --');
    this.disabledSubsectionPrompt = options.disabledSubsectionPrompt || 'Select a section first...';

    this.onChange = options.onChange || null;
    this.onError = options.onError || null;

    this.sectionsCache = [];
    this.subsectionsMap = new Map(); // sectionId -> array of subsections

    this.bindEvents();
  }

  bindEvents() {
    if (this.sectionSelect) {
      this.sectionSelect.addEventListener('change', async (e) => {
        const sectionId = e.target.value;
        await this.handleSectionChange(sectionId);
        this.triggerChange();
      });
    }

    if (this.subsectionSelect) {
      this.subsectionSelect.addEventListener('change', () => {
        this.triggerChange();
      });
    }
  }

  triggerChange() {
    if (typeof this.onChange === 'function') {
      const selected = this.getSelected();
      this.onChange(selected);
    }
  }

  /**
   * Initialize and load sections from the API
   */
  async init(initialSectionId = null, initialSubsectionId = null) {
    try {
      this.renderSectionLoading();
      this.sectionsCache = await API.getSections();
      this.renderSections();

      if (initialSectionId) {
        await this.setValues(initialSectionId, initialSubsectionId);
      } else {
        this.resetSubsection();
      }
    } catch (err) {
      console.error('Failed to initialize cascading dropdown:', err);
      if (this.onError) this.onError(err);
      if (this.sectionSelect) {
        this.sectionSelect.innerHTML = `<option value="">Error loading sections</option>`;
      }
    }
  }

  renderSectionLoading() {
    if (!this.sectionSelect) return;
    this.sectionSelect.innerHTML = `<option value="">Loading sections...</option>`;
    this.sectionSelect.disabled = true;
  }

  renderSections() {
    if (!this.sectionSelect) return;
    this.sectionSelect.disabled = false;
    this.sectionSelect.innerHTML = '';

    // First prompt option
    const promptOption = document.createElement('option');
    promptOption.value = this.allowAllSections ? 'all' : '';
    promptOption.textContent = this.sectionPrompt;
    this.sectionSelect.appendChild(promptOption);

    // Populate from API with optgroups: "Sections" and "Bills"
    const mainSections = this.sectionsCache.filter(s => (s.panel || 'main') === 'main');
    const billSections = this.sectionsCache.filter(s => s.panel === 'bills');

    if (mainSections.length > 0 && billSections.length > 0) {
      // Group under "Sections"
      const mainGroup = document.createElement('optgroup');
      mainGroup.label = 'Sections';
      for (const sec of mainSections) {
        const opt = document.createElement('option');
        opt.value = sec.id;
        opt.textContent = sec.name;
        mainGroup.appendChild(opt);
      }
      this.sectionSelect.appendChild(mainGroup);

      // Group under "Bills"
      const billGroup = document.createElement('optgroup');
      billGroup.label = 'Bills';
      for (const sec of billSections) {
        const opt = document.createElement('option');
        opt.value = sec.id;
        opt.textContent = sec.name;
        billGroup.appendChild(opt);
      }
      this.sectionSelect.appendChild(billGroup);
    } else {
      for (const sec of this.sectionsCache) {
        const opt = document.createElement('option');
        opt.value = sec.id;
        opt.textContent = sec.name;
        this.sectionSelect.appendChild(opt);
      }
    }
  }

  resetSubsection() {
    if (!this.subsectionSelect) return;
    this.subsectionSelect.innerHTML = '';

    const opt = document.createElement('option');
    if (this.allowAllSubsections) {
      opt.value = 'all';
      opt.textContent = this.subsectionPrompt;
      this.subsectionSelect.appendChild(opt);
      // If viewer has "All Sections" selected, subsection can stay on "All Subsections"
      this.subsectionSelect.disabled = !this.allowAllSections;
    } else {
      opt.value = '';
      opt.textContent = this.disabledSubsectionPrompt;
      this.subsectionSelect.appendChild(opt);
      this.subsectionSelect.disabled = true;
    }
  }

  async handleSectionChange(sectionId) {
    if (!this.subsectionSelect) return;

    if (!sectionId || sectionId === 'all') {
      this.resetSubsection();
      return;
    }

    try {
      this.subsectionSelect.disabled = true;
      this.subsectionSelect.innerHTML = `<option value="">Loading subsections...</option>`;

      let subsections = this.subsectionsMap.get(sectionId);
      if (!subsections) {
        subsections = await API.getSubsections(sectionId);
        this.subsectionsMap.set(sectionId, subsections);
      }

      this.renderSubsections(subsections);
    } catch (err) {
      console.error('Failed to load subsections for section ' + sectionId, err);
      this.subsectionSelect.innerHTML = `<option value="">Error loading subsections</option>`;
      this.subsectionSelect.disabled = true;
      if (this.onError) this.onError(err);
    }
  }

  renderSubsections(subsections) {
    if (!this.subsectionSelect) return;
    this.subsectionSelect.innerHTML = '';

    // Default/Prompt option
    const promptOption = document.createElement('option');
    if (this.allowAllSubsections) {
      promptOption.value = 'all';
      promptOption.textContent = this.subsectionPrompt;
    } else {
      promptOption.value = '';
      promptOption.textContent = this.subsectionPrompt;
    }
    this.subsectionSelect.appendChild(promptOption);

    for (const sub of subsections) {
      const opt = document.createElement('option');
      opt.value = sub.id;
      opt.textContent = sub.name;
      this.subsectionSelect.appendChild(opt);
    }

    // Enable dropdown now that subsections are loaded
    this.subsectionSelect.disabled = false;
  }

  /**
   * Programmatically set section and subsection values
   */
  async setValues(sectionId, subsectionId = null) {
    if (!this.sectionSelect) return;

    this.sectionSelect.value = sectionId !== null && sectionId !== undefined ? String(sectionId) : '';
    await this.handleSectionChange(sectionId);

    if (this.subsectionSelect && subsectionId !== null && subsectionId !== undefined) {
      this.subsectionSelect.value = String(subsectionId);
    }
  }

  /**
   * Reset dropdowns to initial state
   */
  reset() {
    if (this.sectionSelect) {
      this.sectionSelect.value = this.allowAllSections ? 'all' : '';
    }
    this.resetSubsection();
  }

  /**
   * Get currently selected values and metadata
   */
  getSelected() {
    const sectionVal = this.sectionSelect ? this.sectionSelect.value : '';
    const subsectionVal = this.subsectionSelect ? this.subsectionSelect.value : '';

    const sectionOpt = this.sectionSelect ? this.sectionSelect.selectedOptions[0] : null;
    const subsectionOpt = this.subsectionSelect ? this.subsectionSelect.selectedOptions[0] : null;

    return {
      sectionId: sectionVal,
      subsectionId: subsectionVal,
      sectionName: sectionOpt ? sectionOpt.textContent : '',
      subsectionName: subsectionOpt ? subsectionOpt.textContent : ''
    };
  }

  /**
   * Refresh sections from API (e.g. after adding a section in admin)
   */
  async refresh() {
    this.subsectionsMap.clear();
    const current = this.getSelected();
    await this.init(current.sectionId, current.subsectionId);
  }
}

// Make accessible globally
window.CascadingDropdown = CascadingDropdown;

