/**
 * Centralized API client for PDF Library
 */
const API = {
  baseUrl: '/api',

  getToken() {
    return localStorage.getItem('library_admin_token') || null;
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('library_admin_token', token);
    } else {
      localStorage.removeItem('library_admin_token');
    }
  },

  getHeaders(isFormData = false) {
    const headers = {};
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  },

  async handleResponse(response) {
    const contentType = response.headers.get('content-type');
    let data = null;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorMsg = (data && data.error) || (data && data.message) || (typeof data === 'string' && data) || `HTTP Error ${response.status}`;
      const error = new Error(errorMsg);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  },

  // Auth endpoints
  async login(username, password) {
    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await this.handleResponse(res);
    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  },

  async logout() {
    try {
      await fetch(`${this.baseUrl}/auth/logout`, {
        method: 'POST',
        headers: this.getHeaders()
      });
    } finally {
      this.setToken(null);
    }
  },

  async getMe() {
    const res = await fetch(`${this.baseUrl}/auth/me`, {
      headers: this.getHeaders()
    });
    return this.handleResponse(res);
  },

  // Sections
  async getSections(panel = null) {
    const url = panel 
      ? `${this.baseUrl}/sections?panel=${encodeURIComponent(panel)}` 
      : `${this.baseUrl}/sections`;
    const res = await fetch(url);
    return this.handleResponse(res);
  },

  async createSection(name, panel = 'main') {
    const res = await fetch(`${this.baseUrl}/sections`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ name, panel })
    });
    return this.handleResponse(res);
  },

  async updateSection(id, name, panel = null) {
    const body = { name };
    if (panel) body.panel = panel;
    const res = await fetch(`${this.baseUrl}/sections/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(body)
    });
    return this.handleResponse(res);
  },

  async deleteSection(id) {
    const res = await fetch(`${this.baseUrl}/sections/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return this.handleResponse(res);
  },

  // Subsections
  async getSubsections(sectionId = null) {
    const url = sectionId 
      ? `${this.baseUrl}/sections/${sectionId}/subsections` 
      : `${this.baseUrl}/subsections`;
    const res = await fetch(url);
    return this.handleResponse(res);
  },

  async createSubsection(section_id, name) {
    const res = await fetch(`${this.baseUrl}/sections/${section_id}/subsections`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ name })
    });
    return this.handleResponse(res);
  },

  async updateSubsection(id, name, section_id = null) {
    const body = { name };
    if (section_id) body.section_id = section_id;
    const res = await fetch(`${this.baseUrl}/subsections/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(body)
    });
    return this.handleResponse(res);
  },

  async deleteSubsection(id) {
    const res = await fetch(`${this.baseUrl}/subsections/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return this.handleResponse(res);
  },

  // Documents
  async getDocuments({ section_id = '', subsection_id = '', search = '' } = {}) {
    const params = new URLSearchParams();
    if (section_id && section_id !== 'all') params.append('section_id', section_id);
    if (subsection_id && subsection_id !== 'all') params.append('subsection_id', subsection_id);
    if (search && search.trim()) params.append('search', search.trim());

    const queryString = params.toString();
    const url = `${this.baseUrl}/documents${queryString ? '?' + queryString : ''}`;
    const res = await fetch(url);
    return this.handleResponse(res);
  },

  async getDocument(id) {
    const res = await fetch(`${this.baseUrl}/documents/${id}`);
    return this.handleResponse(res);
  },

  async uploadDocument(formData) {
    const res = await fetch(`${this.baseUrl}/documents`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData
    });
    return this.handleResponse(res);
  },

  async updateDocument(id, formData) {
    const res = await fetch(`${this.baseUrl}/documents/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(true),
      body: formData
    });
    return this.handleResponse(res);
  },

  async deleteDocument(id) {
    const res = await fetch(`${this.baseUrl}/documents/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return this.handleResponse(res);
  },

  getDownloadUrl(id) {
    return `${this.baseUrl}/documents/${id}/download`;
  },

  getViewUrl(id) {
    return `${this.baseUrl}/documents/${id}/view`;
  }
};

