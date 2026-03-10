import React, { useState, useEffect, useCallback } from 'react';
import './WorklistPanel.css';

/**
 * Get the pacsApiService from the platform viewer services.
 * This handles the import dynamically to work in both dev and production builds.
 */
const getPacsApiService = () => {
  // Try to get from the services module export
  try {
    // Use require for synchronous loading within the monorepo
    const services = require('../../../../platform/viewer/src/services');
    return services.pacsApiService;
  } catch {
    // Fallback: create a minimal API client
    console.warn('pacsApiService not found, using fallback client');
    return createFallbackApiService();
  }
};

/**
 * Create a fallback API service if the main one is not available
 */
const createFallbackApiService = () => {
  const baseUrl = window.config?.pacsApi?.baseUrl || '/api';
  
  const getAccessToken = () => {
    if (window.store) {
      const state = window.store.getState();
      if (state.oidc && state.oidc.user) {
        return state.oidc.user.access_token;
      }
    }
    return null;
  };

  const request = async (endpoint, options = {}) => {
    const token = getAccessToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    if (response.status === 204) return null;
    return response.json();
  };

  return {
    getMyWorklist: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return request(`/studies/worklist${queryString ? `?${queryString}` : ''}`);
    },
    getCurrentUser: () => request('/users/me'),
    assignStudy: (studyId, radiologistId) => request(`/studies/${studyId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ radiologistId }),
    }),
    releaseStudyAssignment: (studyId, reason = '') => request(`/studies/${studyId}/release`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
    flagStudyAsStat: (studyId, reason = '') => request(`/studies/${studyId}/flag-stat`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  };
};

// Initialize the API service
const pacsApiService = getPacsApiService();

/**
 * Priority levels with colors and labels
 */
const PRIORITY_CONFIG = {
  stat: { label: 'STAT', color: '#dc3545', bgColor: '#ffeef0' },
  urgent: { label: 'Urgent', color: '#fd7e14', bgColor: '#fff4e5' },
  routine: { label: 'Routine', color: '#28a745', bgColor: '#e8f5e9' },
  follow_up: { label: 'Follow-up', color: '#6c757d', bgColor: '#f5f5f5' },
};

/**
 * Status levels with colors and labels
 */
const STATUS_CONFIG = {
  received: { label: 'Received', color: '#6c757d' },
  queued: { label: 'Queued', color: '#007bff' },
  assigned: { label: 'Assigned', color: '#17a2b8' },
  in_progress: { label: 'In Progress', color: '#ffc107' },
  reported: { label: 'Reported', color: '#28a745' },
  verified: { label: 'Verified', color: '#20c997' },
  disputed: { label: 'Disputed', color: '#dc3545' },
  amended: { label: 'Amended', color: '#6f42c1' },
};

/**
 * Calculate time remaining until SLA deadline
 */
function calculateTimeRemaining(deadline) {
  if (!deadline) return null;
  
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diff = deadlineDate - now;
  
  if (diff <= 0) {
    return { expired: true, text: 'OVERDUE', minutes: 0 };
  }
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return { expired: false, text: `${days}d ${hours % 24}h`, minutes: diff / (1000 * 60) };
  }
  
  if (hours > 0) {
    return { expired: false, text: `${hours}h ${minutes}m`, minutes: diff / (1000 * 60) };
  }
  
  return { expired: false, text: `${minutes}m`, minutes };
}

/**
 * Get SLA status class based on time remaining
 */
function getSlaStatusClass(timeRemaining) {
  if (!timeRemaining) return '';
  if (timeRemaining.expired) return 'sla-overdue';
  if (timeRemaining.minutes <= 30) return 'sla-critical';
  if (timeRemaining.minutes <= 60) return 'sla-warning';
  return 'sla-ok';
}

/**
 * Format date for display
 */
function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * WorklistPanel Component
 * 
 * Displays the radiologist's assigned studies with filtering, sorting,
 * SLA indicators, and action buttons.
 */
const WorklistPanel = ({ servicesManager }) => {
  // State
  const [studies, setStudies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filters
  const [modalityFilter, setModalityFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sorting
  const [sortBy, setSortBy] = useState('priority');
  const [sortOrder, setSortOrder] = useState('desc');

  const ITEMS_PER_PAGE = 20;

  /**
   * Fetch worklist data from API
   */
  const fetchWorklist = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      const params = {
        page,
        limit: ITEMS_PER_PAGE,
      };

      // Add filters if set
      if (modalityFilter) params.modality = modalityFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (statusFilter) params.status = statusFilter;
      if (searchQuery) params.search = searchQuery;
      if (sortBy) {
        params.sortBy = sortBy;
        params.sortOrder = sortOrder;
      }

      const response = await pacsApiService.getMyWorklist(params);
      
      // Handle response - could be paginated or direct array
      if (response && response.data) {
        setStudies(response.data);
        setTotalCount(response.total || response.data.length);
        setTotalPages(Math.ceil((response.total || response.data.length) / ITEMS_PER_PAGE));
      } else if (Array.isArray(response)) {
        setStudies(response);
        setTotalCount(response.length);
        setTotalPages(1);
      } else {
        setStudies([]);
        setTotalCount(0);
        setTotalPages(1);
      }
    } catch (err) {
      console.error('Failed to fetch worklist:', err);
      setError(err.message || 'Failed to load worklist');
      setStudies([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, modalityFilter, priorityFilter, statusFilter, searchQuery, sortBy, sortOrder]);

  // Fetch data on mount and when filters change
  useEffect(() => {
    fetchWorklist();
  }, [fetchWorklist]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchWorklist(false);
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchWorklist]);

  /**
   * Handle study actions
   */
  const handleViewStudy = async (study) => {
    // Navigate to the study viewer using the orthanc study ID
    if (study.orthancStudyId || study.studyInstanceUid) {
      const studyId = study.orthancStudyId || study.studyInstanceUid;
      window.location.href = `/viewer/${studyId}`;
    }
  };

  const handleAcceptStudy = async (study) => {
    try {
      // Get current user to assign to self
      const currentUser = await pacsApiService.getCurrentUser();
      await pacsApiService.assignStudy(study.id, currentUser.id);
      // Refresh the worklist
      fetchWorklist(false);
      showNotification('Study accepted successfully', 'success');
    } catch (err) {
      console.error('Failed to accept study:', err);
      showNotification(err.message || 'Failed to accept study', 'error');
    }
  };

  const handleReleaseStudy = async (study) => {
    try {
      const reason = window.prompt('Reason for releasing this study (optional):') || '';
      await pacsApiService.releaseStudyAssignment(study.id, reason);
      fetchWorklist(false);
      showNotification('Study released successfully', 'success');
    } catch (err) {
      console.error('Failed to release study:', err);
      showNotification(err.message || 'Failed to release study', 'error');
    }
  };

  const handleFlagStat = async (study) => {
    try {
      const reason = window.prompt('Reason for flagging as STAT:');
      if (reason === null) return; // Cancelled
      await pacsApiService.flagStudyAsStat(study.id, reason);
      fetchWorklist(false);
      showNotification('Study flagged as STAT', 'success');
    } catch (err) {
      console.error('Failed to flag study:', err);
      showNotification(err.message || 'Failed to flag study as STAT', 'error');
    }
  };

  /**
   * Show notification using service manager or alert
   */
  const showNotification = (message, type) => {
    if (servicesManager?.services?.UINotificationService) {
      servicesManager.services.UINotificationService.show({
        message,
        type,
      });
    } else {
      alert(message);
    }
  };

  /**
   * Handle sorting
   */
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  /**
   * Get sort indicator
   */
  const getSortIndicator = (field) => {
    if (sortBy !== field) return '';
    return sortOrder === 'asc' ? ' ▲' : ' ▼';
  };

  /**
   * Clear all filters
   */
  const clearFilters = () => {
    setModalityFilter('');
    setPriorityFilter('');
    setStatusFilter('');
    setSearchQuery('');
    setPage(1);
  };

  /**
   * Get unique modalities from current studies
   */
  const getUniqueModalities = () => {
    const modalities = [...new Set(studies.map(s => s.modality).filter(Boolean))];
    return modalities.sort();
  };

  // Loading state
  if (loading && studies.length === 0) {
    return (
      <div className="worklist-panel">
        <div className="worklist-loading">
          <div className="loading-spinner"></div>
          <p>Loading worklist...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && studies.length === 0) {
    return (
      <div className="worklist-panel">
        <div className="worklist-error">
          <div className="error-icon">⚠️</div>
          <p>{error}</p>
          <button onClick={() => fetchWorklist()} className="btn btn-primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="worklist-panel">
      {/* Header */}
      <div className="worklist-header">
        <div className="worklist-title">
          <h2>My Worklist</h2>
          <span className="worklist-count">{totalCount} studies</span>
          {refreshing && <span className="refreshing-indicator">Refreshing...</span>}
        </div>
        <div className="worklist-actions">
          <button 
            onClick={() => fetchWorklist(false)} 
            className="btn btn-secondary"
            disabled={refreshing}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="worklist-filters">
        <div className="filter-group">
          <label>Search</label>
          <input
            type="text"
            placeholder="Patient ID, Name, Description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="filter-input"
          />
        </div>
        
        <div className="filter-group">
          <label>Modality</label>
          <select
            value={modalityFilter}
            onChange={(e) => setModalityFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">All</option>
            {getUniqueModalities().map(mod => (
              <option key={mod} value={mod}>{mod}</option>
            ))}
            <option value="CT">CT</option>
            <option value="MR">MR</option>
            <option value="XR">X-Ray</option>
            <option value="US">Ultrasound</option>
            <option value="NM">Nuclear Medicine</option>
            <option value="PT">PET</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Priority</label>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">All</option>
            {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">All</option>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </div>

        <button onClick={clearFilters} className="btn btn-link">
          Clear Filters
        </button>
      </div>

      {/* Table */}
      <div className="worklist-table-container">
        <table className="worklist-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('priority')} className="sortable">
                Priority{getSortIndicator('priority')}
              </th>
              <th onClick={() => handleSort('patientId')} className="sortable">
                Patient ID{getSortIndicator('patientId')}
              </th>
              <th onClick={() => handleSort('modality')} className="sortable">
                Modality{getSortIndicator('modality')}
              </th>
              <th onClick={() => handleSort('studyDescription')} className="sortable">
                Description{getSortIndicator('studyDescription')}
              </th>
              <th onClick={() => handleSort('bodyPart')} className="sortable">
                Body Part{getSortIndicator('bodyPart')}
              </th>
              <th onClick={() => handleSort('status')} className="sortable">
                Status{getSortIndicator('status')}
              </th>
              <th onClick={() => handleSort('receivedAt')} className="sortable">
                Received{getSortIndicator('receivedAt')}
              </th>
              <th>SLA</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {studies.length === 0 ? (
              <tr>
                <td colSpan="9" className="empty-message">
                  No studies found. Your worklist is empty or no studies match the filters.
                </td>
              </tr>
            ) : (
              studies.map((study) => {
                const priorityConfig = PRIORITY_CONFIG[study.priority] || PRIORITY_CONFIG.routine;
                const statusConfig = STATUS_CONFIG[study.status] || STATUS_CONFIG.received;
                const slaDeadline = study.slaTracking?.deadline || study.slaDeadline;
                const timeRemaining = calculateTimeRemaining(slaDeadline);
                const slaClass = getSlaStatusClass(timeRemaining);

                return (
                  <tr 
                    key={study.id} 
                    className={`worklist-row ${study.priority === 'stat' ? 'stat-row' : ''}`}
                  >
                    <td>
                      <span 
                        className="priority-badge"
                        style={{ 
                          backgroundColor: priorityConfig.bgColor,
                          color: priorityConfig.color,
                          borderColor: priorityConfig.color,
                        }}
                      >
                        {priorityConfig.label}
                      </span>
                    </td>
                    <td className="patient-id">{study.patientId || '-'}</td>
                    <td>
                      <span className="modality-badge">{study.modality || '-'}</span>
                    </td>
                    <td className="description">{study.studyDescription || '-'}</td>
                    <td>{study.bodyPart || '-'}</td>
                    <td>
                      <span 
                        className="status-badge"
                        style={{ color: statusConfig.color }}
                      >
                        {statusConfig.label}
                      </span>
                    </td>
                    <td className="received-date">{formatDate(study.receivedAt)}</td>
                    <td>
                      {timeRemaining ? (
                        <span className={`sla-timer ${slaClass}`}>
                          {timeRemaining.text}
                        </span>
                      ) : (
                        <span className="sla-na">N/A</span>
                      )}
                    </td>
                    <td className="actions-cell">
                      <div className="action-buttons">
                        <button
                          onClick={() => handleViewStudy(study)}
                          className="btn btn-sm btn-primary"
                          title="View Study"
                        >
                          👁️ View
                        </button>
                        {study.status === 'assigned' && (
                          <button
                            onClick={() => handleAcceptStudy(study)}
                            className="btn btn-sm btn-success"
                            title="Accept Assignment"
                          >
                            ✓ Accept
                          </button>
                        )}
                        {(study.status === 'assigned' || study.status === 'in_progress') && (
                          <button
                            onClick={() => handleReleaseStudy(study)}
                            className="btn btn-sm btn-warning"
                            title="Release Study"
                          >
                            ↩️ Release
                          </button>
                        )}
                        {study.priority !== 'stat' && (
                          <button
                            onClick={() => handleFlagStat(study)}
                            className="btn btn-sm btn-danger"
                            title="Flag as STAT"
                          >
                            🚨 STAT
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="worklist-pagination">
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="btn btn-sm"
          >
            First
          </button>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn btn-sm"
          >
            Previous
          </button>
          <span className="page-info">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn btn-sm"
          >
            Next
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            className="btn btn-sm"
          >
            Last
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="worklist-legend">
        <div className="legend-section">
          <span className="legend-title">SLA Status:</span>
          <span className="sla-timer sla-ok">On Track</span>
          <span className="sla-timer sla-warning">Warning (&lt;1h)</span>
          <span className="sla-timer sla-critical">Critical (&lt;30m)</span>
          <span className="sla-timer sla-overdue">Overdue</span>
        </div>
      </div>
    </div>
  );
};

export default WorklistPanel;
