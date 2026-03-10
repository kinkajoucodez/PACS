/**
 * PACS Platform API Service
 * 
 * Provides methods to interact with the backend API endpoints.
 * Uses the user's JWT token from Keycloak for authentication.
 */

class PacsApiService {
  constructor() {
    this.baseUrl = window.config?.pacsApi?.baseUrl || '/api';
  }

  /**
   * Get the current user's access token from the Redux store
   */
  getAccessToken() {
    if (window.store) {
      const state = window.store.getState();
      if (state.oidc && state.oidc.user) {
        return state.oidc.user.access_token;
      }
    }
    return null;
  }

  /**
   * Make an authenticated API request
   */
  async request(endpoint, options = {}) {
    const token = this.getAccessToken();
    
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  // ==================== Health ====================

  async getHealth() {
    return this.request('/health');
  }

  async checkReadiness() {
    return this.request('/health/ready');
  }

  // ==================== Users ====================

  async getCurrentUser() {
    return this.request('/users/me');
  }

  async getUsers(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/users${queryString ? `?${queryString}` : ''}`);
  }

  async getUserById(id) {
    return this.request(`/users/${id}`);
  }

  async createUser(userData) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(id, userData) {
    return this.request(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(userData),
    });
  }

  async updateUserStatus(id, status) {
    return this.request(`/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async getRadiologists() {
    return this.request('/users/radiologists');
  }

  async createRadiologistProfile(profileData) {
    return this.request('/users/radiologist-profile', {
      method: 'POST',
      body: JSON.stringify(profileData),
    });
  }

  // ==================== Providers ====================

  async getProviders(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/providers${queryString ? `?${queryString}` : ''}`);
  }

  async getProviderById(id) {
    return this.request(`/providers/${id}`);
  }

  async getProviderStudies(id, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/providers/${id}/studies${queryString ? `?${queryString}` : ''}`);
  }

  async createProvider(providerData) {
    return this.request('/providers', {
      method: 'POST',
      body: JSON.stringify(providerData),
    });
  }

  async updateProvider(id, providerData) {
    return this.request(`/providers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(providerData),
    });
  }

  // ==================== Studies ====================

  async getStudies(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/studies${queryString ? `?${queryString}` : ''}`);
  }

  async getStudyById(id) {
    return this.request(`/studies/${id}`);
  }

  async getMyWorklist(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/studies/worklist${queryString ? `?${queryString}` : ''}`);
  }

  async createStudy(studyData) {
    return this.request('/studies', {
      method: 'POST',
      body: JSON.stringify(studyData),
    });
  }

  async assignStudy(studyId, radiologistId) {
    return this.request(`/studies/${studyId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ radiologistId }),
    });
  }

  async releaseStudyAssignment(studyId, reason = '') {
    return this.request(`/studies/${studyId}/release`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async flagStudyAsStat(studyId, reason = '') {
    return this.request(`/studies/${studyId}/flag-stat`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // ==================== Reports ====================

  async getReports(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/reports${queryString ? `?${queryString}` : ''}`);
  }

  async getReportById(id) {
    return this.request(`/reports/${id}`);
  }

  async getMyReports(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/reports/my-reports${queryString ? `?${queryString}` : ''}`);
  }

  async createReport(reportData) {
    return this.request('/reports', {
      method: 'POST',
      body: JSON.stringify(reportData),
    });
  }

  async updateReport(id, reportData) {
    return this.request(`/reports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(reportData),
    });
  }

  async finalizeReport(id, finalizeAs = 'final') {
    return this.request(`/reports/${id}/finalize`, {
      method: 'POST',
      body: JSON.stringify({ finalizeAs }),
    });
  }

  async createReportAddendum(id, addendumData) {
    return this.request(`/reports/${id}/addendum`, {
      method: 'POST',
      body: JSON.stringify(addendumData),
    });
  }

  // ==================== Notifications ====================

  async getNotifications(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/notifications${queryString ? `?${queryString}` : ''}`);
  }

  async getUnreadNotificationCount() {
    return this.request('/notifications/unread-count');
  }

  async markNotificationRead(id) {
    return this.request(`/notifications/${id}/read`, {
      method: 'PATCH',
    });
  }

  async markAllNotificationsRead() {
    return this.request('/notifications/read-all', {
      method: 'PATCH',
    });
  }
}

// Export singleton instance
const pacsApiService = new PacsApiService();

export default pacsApiService;
export { PacsApiService };
