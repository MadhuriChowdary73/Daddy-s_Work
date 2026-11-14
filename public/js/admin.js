/**
 * Admin Dashboard Logic:
 * - PDF Upload form with CascadingDropdown
 * - Client-side validation (PDF only, max 10MB, required fields)
 * - Documents management table (Edit, Delete, Preview)
 * - Edit Document Modal with cascading dropdown
 * - Sections and Subsections manager
 */
const Admin = {
  uploadDropdown: null,
  editDropdown: null,
  currentEditDocId: null,

  async init() {
    this.setupUploadForm();
    this.setupEditModal();
    this.setupDeleteModal();
    this.setupSectionManager();
    await this.loadAdminDocuments();
    await this.loadSectionsManager();
  },

  setupUploadForm() {
    const sectionSelect = document.getElementById('admin-upload-section');
    const subsectionSelect = document.getElementById('admin-upload-subsection');
    const uploadForm = document.getElementById('admin-upload-form');
    const fileInput = document.getElementById('upload-file-input');
    const fileDropArea = document.getElementById('file-drop-area');
    const filePreview = document.getElementById('file-chosen-preview');
    const fileNameSpan = document.getElementById('file-chosen-name');
    const fileSizeSpan = document.getElementById('file-chosen-size');
    const removeFileBtn = document.getElementById('remove-chosen-file');

    // Instantiate Reusable Cascading Dropdown for Upload Form
    this.uploadDropdown = new CascadingDropdown({
      sectionSelect: sectionSelect,
      subsectionSelect: subsectionSelect,
      allowAllSections: false,
      allowAllSubsections: false,
      sectionPrompt: '-- Choose Section --',
      subsectionPrompt: '-- Choose Subsection --',
      disabledSubsectionPrompt: 'Select a section first...'
    });
    this.uploadDropdown.init();

    // File input change
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        this.handleFileSelected(file, filePreview, fileNameSpan, fileSizeSpan, fileDropArea);
      });
    }

    // Drag and drop support
    if (fileDropArea) {
      ['dragenter', 'dragover'].forEach(evt => {
        fileDropArea.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          fileDropArea.classList.add('drag-active');
        });
      });

      ['dragleave', 'drop'].forEach(evt => {
        fileDropArea.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          fileDropArea.classList.remove('drag-active');
        });
      });

      fileDropArea.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
          fileInput.files = files;
          this.handleFileSelected(files[0], filePreview, fileNameSpan, fileSizeSpan, fileDropArea);
        }
      });
    }

    // Remove chosen file
    if (removeFileBtn) {
      removeFileBtn.addEventListener('click', () => {
        if (fileInput) fileInput.value = '';
        if (filePreview) filePreview.style.display = 'none';
        if (fileDropArea) fileDropArea.style.display = 'block';
      });
    }

    // Handle Form Submit
    if (uploadForm) {
      uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleUploadSubmit(uploadForm, fileInput);
      });
    }
  },

  handleFileSelected(file, filePreview, fileNameSpan, fileSizeSpan, fileDropArea) {
    const alertBox = document.getElementById('upload-status-alert');
    if (alertBox) alertBox.style.display = 'none';

    if (!file) return;

    // Validate type
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      App.showAlert('upload-status-alert', 'error', 'Invalid file type. Only PDF (.pdf) files are accepted.');
      const fileInput = document.getElementById('upload-file-input');
      if (fileInput) fileInput.value = '';
      return;
    }

    // Validate size (10 MB = 10 * 1024 * 1024 bytes)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      App.showAlert('upload-status-alert', 'error', `File size exceeds the 10 MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB).`);
      const fileInput = document.getElementById('upload-file-input');
      if (fileInput) fileInput.value = '';
      return;
    }

    if (fileNameSpan) fileNameSpan.textContent = file.name;
    if (fileSizeSpan) fileSizeSpan.textContent = Viewer.formatFileSize(file.size);
    if (fileDropArea) fileDropArea.style.display = 'none';
    if (filePreview) filePreview.style.display = 'flex';
  },

  async handleUploadSubmit(form, fileInput) {
    const titleInput = document.getElementById('admin-upload-title');
    const descInput = document.getElementById('admin-upload-desc');
    const submitBtn = document.getElementById('admin-upload-submit');
    const selected = this.uploadDropdown.getSelected();

    // Client validations
    if (!titleInput.value.trim()) {
      App.showAlert('upload-status-alert', 'error', 'Please enter a document title.');
      titleInput.focus();
      return;
    }

    if (!selected.sectionId) {
      App.showAlert('upload-status-alert', 'error', 'Please select a Section.');
      return;
    }

    if (!selected.subsectionId) {
      App.showAlert('upload-status-alert', 'error', 'Please select a Subsection.');
      return;
    }

    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      App.showAlert('upload-status-alert', 'error', 'Please select or drop a PDF file to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('title', titleInput.value.trim());
    formData.append('description', descInput.value.trim());
    formData.append('subsection_id', selected.subsectionId);
    formData.append('pdf', file);

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg class="spinner icon-inline" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/></svg>
        Uploading PDF...
      `;

      const result = await API.uploadDocument(formData);

      App.showAlert('upload-status-alert', 'success', `Document "${result.title}" uploaded successfully!`);

      // Reset form
      form.reset();
      this.uploadDropdown.reset();
      const filePreview = document.getElementById('file-chosen-preview');
      const fileDropArea = document.getElementById('file-drop-area');
      if (filePreview) filePreview.style.display = 'none';
      if (fileDropArea) fileDropArea.style.display = 'block';

      // Refresh documents table and viewer
      await this.loadAdminDocuments();
      if (window.Viewer) {
        Viewer.loadDocuments();
      }
      this.loadSectionsManager();
    } catch (err) {
      console.error('Upload failed:', err);
      App.showAlert('upload-status-alert', 'error', `Upload failed: ${err.message}`);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <svg class="icon-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Upload Document
      `;
    }
  },

  async loadAdminDocuments() {
    const tableBody = document.getElementById('admin-docs-tbody');
    const loadingEl = document.getElementById('admin-docs-loading');
    const emptyEl = document.getElementById('admin-docs-empty');
    const countBadge = document.getElementById('admin-total-docs-count');

    if (!tableBody) return;

    if (loadingEl) loadingEl.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';

    try {
      const documents = await API.getDocuments();

      if (loadingEl) loadingEl.style.display = 'none';

      if (countBadge) {
        countBadge.textContent = `${documents.length} document${documents.length === 1 ? '' : 's'}`;
      }

      if (!documents || documents.length === 0) {
        tableBody.innerHTML = '';
        if (emptyEl) emptyEl.style.display = 'block';
        return;
      }

      tableBody.innerHTML = '';
      for (const doc of documents) {
        const tr = document.createElement('tr');
        const formattedDate = new Date(doc.uploaded_at).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        const formattedSize = Viewer.formatFileSize(doc.file_size);

        tr.innerHTML = `
          <td>
            <div class="table-doc-title">${Viewer.escapeHtml(doc.title)}</div>
            ${doc.description ? `<div class="table-doc-desc">${Viewer.escapeHtml(doc.description)}</div>` : ''}
          </td>
          <td>
            <span class="badge badge-section">${Viewer.escapeHtml(doc.section_name)}</span>
          </td>
          <td>
            <span class="badge badge-subsection">${Viewer.escapeHtml(doc.subsection_name)}</span>
          </td>
          <td class="text-nowrap text-muted">${formattedSize}</td>
          <td class="text-nowrap text-muted">${formattedDate}</td>
          <td class="text-right text-nowrap">
            <button class="btn btn-outline btn-xs btn-table-view" data-id="${doc.id}" title="Preview document">
              <svg class="icon-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              View
            </button>
            <button class="btn btn-secondary btn-xs btn-table-edit" data-id="${doc.id}" title="Edit document">
              <svg class="icon-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit
            </button>
            <button class="btn btn-danger btn-xs btn-table-delete" data-id="${doc.id}" data-title="${Viewer.escapeHtml(doc.title)}" title="Delete document">
              <svg class="icon-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              Delete
            </button>
          </td>
        `;

        // Attach action handlers
        tr.querySelector('.btn-table-view').addEventListener('click', () => {
          App.openPdfModal(API.getViewUrl(doc.id), doc.title, API.getDownloadUrl(doc.id));
        });

        tr.querySelector('.btn-table-edit').addEventListener('click', () => {
          this.openEditModal(doc);
        });

        tr.querySelector('.btn-table-delete').addEventListener('click', () => {
          this.openDeleteModal(doc.id, doc.title);
        });

        tableBody.appendChild(tr);
      }
    } catch (err) {
      console.error('Failed to load admin documents:', err);
      if (loadingEl) loadingEl.style.display = 'none';
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error: ${err.message}</td></tr>`;
    }
  },

  setupEditModal() {
    const editModal = document.getElementById('edit-doc-modal');
    const closeBtn = document.getElementById('close-edit-modal-btn');
    const cancelBtn = document.getElementById('cancel-edit-doc-btn');
    const editForm = document.getElementById('edit-doc-form');

    // Instantiate Reusable Cascading Dropdown for Edit Modal
    this.editDropdown = new CascadingDropdown({
      sectionSelect: '#edit-doc-section',
      subsectionSelect: '#edit-doc-subsection',
      allowAllSections: false,
      allowAllSubsections: false,
      sectionPrompt: '-- Choose Section --',
      subsectionPrompt: '-- Choose Subsection --',
      disabledSubsectionPrompt: 'Select a section first...'
    });
    this.editDropdown.init();

    const closeModal = () => {
      if (editModal) editModal.style.display = 'none';
      this.currentEditDocId = null;
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    if (editForm) {
      editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleEditSubmit(editForm);
      });
    }
  },

  async openEditModal(doc) {
    const editModal = document.getElementById('edit-doc-modal');
    const titleInput = document.getElementById('edit-doc-title');
    const descInput = document.getElementById('edit-doc-desc');
    const fileInput = document.getElementById('edit-doc-file');
    const alertBox = document.getElementById('edit-status-alert');

    if (alertBox) alertBox.style.display = 'none';
    if (fileInput) fileInput.value = '';

    this.currentEditDocId = doc.id;
    if (titleInput) titleInput.value = doc.title;
    if (descInput) descInput.value = doc.description || '';

    // Set cascading values in edit modal
    await this.editDropdown.setValues(doc.section_id, doc.subsection_id);

    if (editModal) editModal.style.display = 'flex';
  },

  async handleEditSubmit(form) {
    if (!this.currentEditDocId) return;

    const titleInput = document.getElementById('edit-doc-title');
    const descInput = document.getElementById('edit-doc-desc');
    const fileInput = document.getElementById('edit-doc-file');
    const submitBtn = document.getElementById('save-edit-doc-btn');
    const selected = this.editDropdown.getSelected();

    if (!titleInput.value.trim()) {
      App.showAlert('edit-status-alert', 'error', 'Document title is required.');
      return;
    }

    if (!selected.subsectionId) {
      App.showAlert('edit-status-alert', 'error', 'Please select a valid section and subsection.');
      return;
    }

    const formData = new FormData();
    formData.append('title', titleInput.value.trim());
    formData.append('description', descInput.value.trim());
    formData.append('subsection_id', selected.subsectionId);

    if (fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        App.showAlert('edit-status-alert', 'error', 'Invalid file type. Only PDF (.pdf) files are allowed.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        App.showAlert('edit-status-alert', 'error', 'Replacement file exceeds the 10 MB limit.');
        return;
      }
      formData.append('pdf', file);
    }

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `Saving...`;

      await API.updateDocument(this.currentEditDocId, formData);

      const editModal = document.getElementById('edit-doc-modal');
      if (editModal) editModal.style.display = 'none';

      await this.loadAdminDocuments();
      if (window.Viewer) Viewer.loadDocuments();
      this.loadSectionsManager();
    } catch (err) {
      console.error('Failed to update document:', err);
      App.showAlert('edit-status-alert', 'error', `Update failed: ${err.message}`);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `Save Changes`;
    }
  },

  setupDeleteModal() {
    const deleteModal = document.getElementById('delete-doc-modal');
    const cancelBtn = document.getElementById('cancel-delete-doc-btn');
    const confirmBtn = document.getElementById('confirm-delete-doc-btn');

    let targetDocId = null;

    this.openDeleteModal = (id, title) => {
      targetDocId = id;
      const titleSpan = document.getElementById('delete-doc-title-display');
      if (titleSpan) titleSpan.textContent = `"${title}"`;
      if (deleteModal) deleteModal.style.display = 'flex';
    };

    const closeModal = () => {
      if (deleteModal) deleteModal.style.display = 'none';
      targetDocId = null;
    };

    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        if (!targetDocId) return;
        try {
          confirmBtn.disabled = true;
          confirmBtn.textContent = 'Deleting...';
          await API.deleteDocument(targetDocId);
          closeModal();
          await this.loadAdminDocuments();
          if (window.Viewer) Viewer.loadDocuments();
          this.loadSectionsManager();
        } catch (err) {
          console.error('Delete document failed:', err);
          alert('Delete failed: ' + err.message);
        } finally {
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Delete Document';
        }
      });
    }
  },

  setupSectionManager() {
    // Add Section Form
    const addSectionForm = document.getElementById('add-section-form');
    if (addSectionForm) {
      addSectionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('new-section-name');
        const panelSelect = document.getElementById('new-section-panel');
        const name = input.value.trim();
        const panel = panelSelect ? panelSelect.value : 'main';
        if (!name) return;

        try {
          await API.createSection(name, panel);
          input.value = '';
          await this.refreshAllDropdowns();
          await this.loadSectionsManager();
          App.showAlert('global-toast', 'success', `Section "${name}" added to ${panel === 'bills' ? 'Bills (Right)' : 'Sections (Left)'} panel.`);
        } catch (err) {
          alert('Failed to add section: ' + err.message);
        }
      });
    }

    // Add Subsection Form
    const addSubForm = document.getElementById('add-subsection-form');
    if (addSubForm) {
      addSubForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const sectionSelect = document.getElementById('sub-parent-section-select');
        const nameInput = document.getElementById('new-subsection-name');

        const sectionId = sectionSelect.value;
        const name = nameInput.value.trim();

        if (!sectionId) {
          alert('Please select a parent Section.');
          return;
        }
        if (!name) return;

        try {
          await API.createSubsection(sectionId, name);
          nameInput.value = '';
          await this.refreshAllDropdowns();
          await this.loadSectionsManager();
        } catch (err) {
          alert('Failed to add subsection: ' + err.message);
        }
      });
    }
  },

  async loadSectionsManager() {
    const container = document.getElementById('sections-hierarchy-tree');
    const parentSelect = document.getElementById('sub-parent-section-select');
    if (!container) return;

    try {
      const sections = await API.getSections();

      // Populate parent section select for adding subsections with optgroups
      if (parentSelect) {
        const curVal = parentSelect.value;
        parentSelect.innerHTML = '<option value="">-- Choose Section --</option>';

        const mainSections = sections.filter(s => (s.panel || 'main') === 'main');
        const billsSections = sections.filter(s => s.panel === 'bills');

        if (mainSections.length > 0 && billsSections.length > 0) {
          const mainGroup = document.createElement('optgroup');
          mainGroup.label = 'Sections Panel (Left)';
          for (const s of mainSections) {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name;
            mainGroup.appendChild(opt);
          }
          parentSelect.appendChild(mainGroup);

          const billsGroup = document.createElement('optgroup');
          billsGroup.label = 'Bills Panel (Right)';
          for (const s of billsSections) {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name;
            billsGroup.appendChild(opt);
          }
          parentSelect.appendChild(billsGroup);
        } else {
          for (const s of sections) {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name;
            parentSelect.appendChild(opt);
          }
        }

        if (curVal) parentSelect.value = curVal;
      }

      container.innerHTML = '';
      if (!sections || sections.length === 0) {
        container.innerHTML = '<p class="text-muted">No sections available.</p>';
        return;
      }

      for (const section of sections) {
        const sectionCard = document.createElement('div');
        sectionCard.className = 'hierarchy-section-card';

        const panelLabel = section.panel === 'bills' ? 'Bills (Right)' : 'Sections (Left)';
        const panelBadgeClass = section.panel === 'bills' ? 'badge-subsection' : 'badge-section';

        sectionCard.innerHTML = `
          <div class="hierarchy-section-header">
            <div class="hierarchy-section-title-wrap">
              <svg class="icon-inline text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              <span class="hierarchy-section-title" id="sec-title-${section.id}">${Viewer.escapeHtml(section.name)}</span>
              <span class="badge ${panelBadgeClass}" style="font-size: 0.75rem;">${panelLabel}</span>
              <span class="hierarchy-badge">${section.subsection_count} subsections · ${section.document_count} documents</span>
            </div>
            <div class="hierarchy-actions">
              <button class="btn btn-outline btn-xs btn-rename-section" data-id="${section.id}" data-name="${Viewer.escapeHtml(section.name)}">
                Rename
              </button>
              <button class="btn btn-danger btn-xs btn-delete-section" data-id="${section.id}" data-name="${Viewer.escapeHtml(section.name)}">
                Delete
              </button>
            </div>
          </div>
          <div class="hierarchy-subsections-list" id="sub-list-${section.id}">
            <span class="text-muted text-xs">Loading subsections...</span>
          </div>
        `;

        // Rename section
        sectionCard.querySelector('.btn-rename-section').addEventListener('click', async () => {
          const currentName = section.name;
          const newName = prompt(`Enter new name for section "${currentName}":`, currentName);
          if (newName && newName.trim() && newName.trim() !== currentName) {
            try {
              await API.updateSection(section.id, newName.trim());
              await this.refreshAllDropdowns();
              await this.loadSectionsManager();
            } catch (err) {
              alert('Rename failed: ' + err.message);
            }
          }
        });

        // Delete section
        sectionCard.querySelector('.btn-delete-section').addEventListener('click', async () => {
          const confirmed = confirm(`Are you sure you want to delete section "${section.name}"?\nWarning: All ${section.subsection_count} subsections and ${section.document_count} documents inside it will also be deleted!`);
          if (confirmed) {
            try {
              await API.deleteSection(section.id);
              await this.refreshAllDropdowns();
              await this.loadSectionsManager();
              await this.loadAdminDocuments();
              if (window.Viewer) Viewer.loadDocuments();
            } catch (err) {
              alert('Delete failed: ' + err.message);
            }
          }
        });

        container.appendChild(sectionCard);

        // Fetch subsections for this section
        API.getSubsections(section.id).then((subsections) => {
          const subListEl = document.getElementById(`sub-list-${section.id}`);
          if (!subListEl) return;

          if (!subsections || subsections.length === 0) {
            subListEl.innerHTML = '<span class="text-muted text-xs">No subsections yet.</span>';
            return;
          }

          subListEl.innerHTML = '';
          for (const sub of subsections) {
            const subRow = document.createElement('div');
            subRow.className = 'hierarchy-sub-row';
            subRow.innerHTML = `
              <div class="sub-name-wrap">
                <span class="sub-bullet">↳</span>
                <span class="sub-name">${Viewer.escapeHtml(sub.name)}</span>
                <span class="text-muted text-xs">(${sub.document_count} docs)</span>
              </div>
              <div class="sub-actions">
                <button class="btn-link btn-xs btn-rename-sub" title="Rename subsection">Rename</button>
                <button class="btn-link text-danger btn-xs btn-delete-sub" title="Delete subsection">Delete</button>
              </div>
            `;

            // Rename subsection
            subRow.querySelector('.btn-rename-sub').addEventListener('click', async () => {
              const newSubName = prompt(`Enter new name for subsection "${sub.name}":`, sub.name);
              if (newSubName && newSubName.trim() && newSubName.trim() !== sub.name) {
                try {
                  await API.updateSubsection(sub.id, newSubName.trim());
                  await this.refreshAllDropdowns();
                  await this.loadSectionsManager();
                } catch (err) {
                  alert('Rename failed: ' + err.message);
                }
              }
            });

            // Delete subsection
            subRow.querySelector('.btn-delete-sub').addEventListener('click', async () => {
              const confirmed = confirm(`Are you sure you want to delete subsection "${sub.name}"?\nAny documents under it will also be deleted.`);
              if (confirmed) {
                try {
                  await API.deleteSubsection(sub.id);
                  await this.refreshAllDropdowns();
                  await this.loadSectionsManager();
                  await this.loadAdminDocuments();
                  if (window.Viewer) Viewer.loadDocuments();
                } catch (err) {
                  alert('Delete failed: ' + err.message);
                }
              }
            });

            subListEl.appendChild(subRow);
          }
        }).catch(err => {
          console.error(err);
        });
      }
    } catch (err) {
      console.error('Failed to load sections manager:', err);
      container.innerHTML = `<p class="text-danger">Error: ${err.message}</p>`;
    }
  },

  async refreshAllDropdowns() {
    if (this.uploadDropdown) await this.uploadDropdown.refresh();
    if (this.editDropdown) await this.editDropdown.refresh();
    if (window.Viewer && typeof Viewer.refresh === 'function') await Viewer.refresh();
  }
};

window.Admin = Admin;

