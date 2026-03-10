import React, { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import './ReportEditorPanel.css';

/* eslint-disable no-console */

/**
 * Get the pacsApiService from the platform viewer services.
 */
const getPacsApiService = () => {
  try {
    const services = require('../../../../platform/viewer/src/services');
    return services.pacsApiService;
  } catch {
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
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: response.statusText }));
      throw new Error(
        error.message || `HTTP error! status: ${response.status}`
      );
    }

    if (response.status === 204) return null;
    return response.json();
  };

  return {
    getCurrentUser: () => request('/users/me'),
    getMyReports: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return request(
        `/reports/my-reports${queryString ? `?${queryString}` : ''}`
      );
    },
    getReportById: id => request(`/reports/${id}`),
    createReport: reportData =>
      request('/reports', {
        method: 'POST',
        body: JSON.stringify(reportData),
      }),
    updateReport: (id, reportData) =>
      request(`/reports/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(reportData),
      }),
    finalizeReport: (id, finalizeAs = 'final') =>
      request(`/reports/${id}/finalize`, {
        method: 'POST',
        body: JSON.stringify({ finalizeAs }),
      }),
    createReportAddendum: (id, addendumData) =>
      request(`/reports/${id}/addendum`, {
        method: 'POST',
        body: JSON.stringify(addendumData),
      }),
    getStudyById: id => request(`/studies/${id}`),
    getMyWorklist: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return request(
        `/studies/worklist${queryString ? `?${queryString}` : ''}`
      );
    },
  };
};

const pacsApiService = getPacsApiService();

/**
 * Report status configuration
 */
const STATUS_CONFIG = {
  draft: { label: 'Draft', color: '#6c757d', icon: '📝' },
  preliminary: { label: 'Preliminary', color: '#ffc107', icon: '⏳' },
  final: { label: 'Final', color: '#28a745', icon: '✓' },
  amended: { label: 'Amended', color: '#17a2b8', icon: '📋' },
  cancelled: { label: 'Cancelled', color: '#dc3545', icon: '✕' },
};

/**
 * Default report templates by modality
 */
const REPORT_TEMPLATES = {
  general: {
    name: 'General Report',
    findings: '',
    impression: '',
    conclusion: '',
  },
  CT: {
    name: 'CT Scan',
    findings:
      'TECHNIQUE: CT examination performed.\n\nFINDINGS:\nBrain: \nChest: \nAbdomen: \nPelvis: ',
    impression: '',
    conclusion: '',
  },
  MR: {
    name: 'MRI',
    findings:
      'TECHNIQUE: MRI examination performed.\n\nFINDINGS:\nBrain: \nSpine: \nJoints: ',
    impression: '',
    conclusion: '',
  },
  CR: {
    name: 'X-Ray',
    findings:
      'TECHNIQUE: Radiograph examination performed.\n\nFINDINGS:\nBones: \nSoft tissues: \nJoints: ',
    impression: '',
    conclusion: '',
  },
  US: {
    name: 'Ultrasound',
    findings: 'TECHNIQUE: Ultrasound examination performed.\n\nFINDINGS:\n',
    impression: '',
    conclusion: '',
  },
  DX: {
    name: 'Digital X-Ray',
    findings:
      'TECHNIQUE: Digital radiograph examination performed.\n\nFINDINGS:\n',
    impression: '',
    conclusion: '',
  },
  NM: {
    name: 'Nuclear Medicine',
    findings:
      'TECHNIQUE: Nuclear medicine examination performed.\n\nFINDINGS:\n',
    impression: '',
    conclusion: '',
  },
  PT: {
    name: 'PET Scan',
    findings: 'TECHNIQUE: PET examination performed.\n\nFINDINGS:\n',
    impression: '',
    conclusion: '',
  },
};

/**
 * Auto-save debounce delay in milliseconds
 */
const AUTO_SAVE_DELAY = 30000; // 30 seconds

/**
 * ReportEditorPanel Component
 *
 * Full-featured report editor for radiologists.
 */
const ReportEditorPanel = ({ servicesManager }) => {
  // State
  const [currentUser, setCurrentUser] = useState(null);
  const [studies, setStudies] = useState([]);
  const [selectedStudyId, setSelectedStudyId] = useState(null);
  const [selectedStudy, setSelectedStudy] = useState(null);
  const [report, setReport] = useState(null);
  const [existingReports, setExistingReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeTab, setActiveTab] = useState('editor'); // 'editor', 'history'
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Form state
  const [findings, setFindings] = useState('');
  const [impression, setImpression] = useState('');
  const [conclusion, setConclusion] = useState('');

  // Refs
  const autoSaveTimerRef = useRef(null);
  const findingsRef = useRef(null);

  /**
   * Load user and worklist on mount
   */
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load current user
        const user = await pacsApiService.getCurrentUser();
        setCurrentUser(user);

        // Load worklist studies
        const worklistResponse = await pacsApiService.getMyWorklist();
        const worklistStudies = worklistResponse.data || worklistResponse || [];
        setStudies(worklistStudies);

        // Auto-select first study if available
        if (worklistStudies.length > 0) {
          setSelectedStudyId(worklistStudies[0].id);
        }
      } catch (err) {
        console.error('Error loading initial data:', err);
        setError(err.message || 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, []);

  /**
   * Load study details and reports when study is selected
   */
  useEffect(() => {
    if (!selectedStudyId) {
      setSelectedStudy(null);
      setReport(null);
      setExistingReports([]);
      return;
    }

    const loadStudyData = async () => {
      try {
        // Find study in worklist
        const study = studies.find(s => s.id === selectedStudyId);
        setSelectedStudy(study);

        // Load existing reports for this study
        const reportsResponse = await pacsApiService.getMyReports({
          studyId: selectedStudyId,
        });
        const reports = reportsResponse.data || reportsResponse || [];
        setExistingReports(reports);

        // Check for existing draft report
        const draftReport = reports.find(r => r.status === 'draft');

        if (draftReport) {
          // Load existing draft
          setReport(draftReport);
          setFindings(draftReport.findings || '');
          setImpression(draftReport.impression || '');
          setConclusion(draftReport.conclusion || '');
        } else {
          // Clear form for new report
          setReport(null);
          setFindings('');
          setImpression('');
          setConclusion('');
        }

        setHasUnsavedChanges(false);
        setLastSaved(null);
      } catch (err) {
        console.error('Error loading study data:', err);
        setError(err.message || 'Failed to load study data');
      }
    };

    loadStudyData();
  }, [selectedStudyId, studies]);

  /**
   * Auto-save handler with debouncing
   */
  useEffect(() => {
    if (!hasUnsavedChanges || !report) return;

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new auto-save timer
    autoSaveTimerRef.current = setTimeout(() => {
      handleSaveDraft(true);
    }, AUTO_SAVE_DELAY);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [
    hasUnsavedChanges,
    findings,
    impression,
    conclusion,
    report,
    handleSaveDraft,
  ]);

  /**
   * Handle form field changes
   */
  const handleFieldChange = useCallback((field, value) => {
    switch (field) {
      case 'findings':
        setFindings(value);
        break;
      case 'impression':
        setImpression(value);
        break;
      case 'conclusion':
        setConclusion(value);
        break;
      default:
        break;
    }
    setHasUnsavedChanges(true);
  }, []);

  /**
   * Apply a template to the report
   */
  const applyTemplate = useCallback(templateKey => {
    const template = REPORT_TEMPLATES[templateKey] || REPORT_TEMPLATES.general;
    setFindings(template.findings);
    setImpression(template.impression);
    setConclusion(template.conclusion);
    setHasUnsavedChanges(true);
    setShowTemplateModal(false);

    // Focus on findings field
    if (findingsRef.current) {
      findingsRef.current.focus();
    }
  }, []);

  /**
   * Create a new draft report
   */
  const handleCreateReport = useCallback(async () => {
    if (!selectedStudyId) return;

    try {
      setIsSaving(true);
      setError(null);

      const newReport = await pacsApiService.createReport({
        studyId: selectedStudyId,
        findings,
        impression,
        conclusion,
      });

      setReport(newReport);
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
      showNotification('Report created successfully', 'success');
    } catch (err) {
      console.error('Error creating report:', err);
      setError(err.message || 'Failed to create report');
      showNotification(err.message || 'Failed to create report', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [selectedStudyId, findings, impression, conclusion, showNotification]);

  /**
   * Save draft report
   */
  const handleSaveDraft = useCallback(
    async (isAutoSave = false) => {
      if (!report) {
        // No existing report - create new one
        await handleCreateReport();
        return;
      }

      if (report.status !== 'draft') {
        showNotification('Cannot modify a finalized report', 'warning');
        return;
      }

      try {
        setIsSaving(true);
        setError(null);

        const updatedReport = await pacsApiService.updateReport(report.id, {
          findings,
          impression,
          conclusion,
        });

        setReport(updatedReport);
        setHasUnsavedChanges(false);
        setLastSaved(new Date());

        if (!isAutoSave) {
          showNotification('Draft saved successfully', 'success');
        }
      } catch (err) {
        console.error('Error saving draft:', err);
        setError(err.message || 'Failed to save draft');
        if (!isAutoSave) {
          showNotification(err.message || 'Failed to save draft', 'error');
        }
      } finally {
        setIsSaving(false);
      }
    },
    [
      report,
      handleCreateReport,
      showNotification,
      findings,
      impression,
      conclusion,
    ]
  );

  /**
   * Finalize report
   */
  const handleFinalize = useCallback(
    async finalizeAs => {
      if (!report) {
        showNotification('Please save the report first', 'warning');
        return;
      }

      if (report.status !== 'draft') {
        showNotification('Report is already finalized', 'warning');
        return;
      }

      // Validate required fields
      if (!findings.trim()) {
        showNotification('Findings are required to finalize', 'warning');
        return;
      }

      try {
        setIsSaving(true);
        setError(null);

        // Save any pending changes first
        if (hasUnsavedChanges) {
          await pacsApiService.updateReport(report.id, {
            findings,
            impression,
            conclusion,
          });
        }

        // Finalize the report
        const finalizedReport = await pacsApiService.finalizeReport(
          report.id,
          finalizeAs
        );

        setReport(finalizedReport);
        setHasUnsavedChanges(false);
        showNotification(`Report finalized as ${finalizeAs}`, 'success');

        // Refresh existing reports list
        const reportsResponse = await pacsApiService.getMyReports({
          studyId: selectedStudyId,
        });
        setExistingReports(reportsResponse.data || reportsResponse || []);
      } catch (err) {
        console.error('Error finalizing report:', err);
        setError(err.message || 'Failed to finalize report');
        showNotification(err.message || 'Failed to finalize report', 'error');
      } finally {
        setIsSaving(false);
      }
    },
    [
      report,
      findings,
      showNotification,
      hasUnsavedChanges,
      selectedStudyId,
      impression,
      conclusion,
    ]
  );

  /**
   * Create addendum
   */
  const handleCreateAddendum = useCallback(
    async parentReportId => {
      try {
        setIsSaving(true);
        setError(null);

        const addendumReport = await pacsApiService.createReportAddendum(
          parentReportId,
          {
            findings: '',
            impression: '',
            conclusion: '',
          }
        );

        setReport(addendumReport);
        setFindings(addendumReport.findings || '');
        setImpression(addendumReport.impression || '');
        setConclusion(addendumReport.conclusion || '');
        setHasUnsavedChanges(false);
        setActiveTab('editor');
        showNotification('Addendum created', 'success');

        // Refresh existing reports list
        const reportsResponse = await pacsApiService.getMyReports({
          studyId: selectedStudyId,
        });
        setExistingReports(reportsResponse.data || reportsResponse || []);
      } catch (err) {
        console.error('Error creating addendum:', err);
        setError(err.message || 'Failed to create addendum');
        showNotification(err.message || 'Failed to create addendum', 'error');
      } finally {
        setIsSaving(false);
      }
    },
    [selectedStudyId, showNotification]
  );

  /**
   * Show notification using the services manager or fallback
   */
  const showNotification = useCallback(
    (message, type = 'info') => {
      try {
        const { UINotificationService } = servicesManager.services;
        if (UINotificationService) {
          UINotificationService.show({
            title: 'Report Editor',
            message,
            type,
            duration: 4000,
          });
          return;
        }
      } catch {
        // Fallback - just log
      }
      console.log(`[${type.toUpperCase()}] ${message}`);
    },
    [servicesManager]
  );

  /**
   * Format date for display
   */
  const formatDate = dateString => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="report-panel report-loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  // Error state
  if (error && !studies.length) {
    return (
      <div className="report-panel report-error">
        <span className="error-icon" role="img" aria-label="warning">
          ⚠️
        </span>
        <p>{error}</p>
        <button
          className="btn btn-primary"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="report-panel">
      {/* Header */}
      <div className="report-header">
        <div className="header-left">
          <h2>
            <span role="img" aria-label="clipboard">
              📋
            </span>{' '}
            Report Editor
          </h2>
          {currentUser && (
            <span className="user-badge">
              {currentUser.firstName} {currentUser.lastName}
            </span>
          )}
        </div>
        <div className="header-right">
          {lastSaved && (
            <span className="last-saved">
              Last saved: {formatDate(lastSaved)}
            </span>
          )}
          {hasUnsavedChanges && (
            <span className="unsaved-indicator">● Unsaved changes</span>
          )}
          {report && (
            <span
              className="status-badge"
              style={{
                backgroundColor:
                  STATUS_CONFIG[report.status]?.color || '#6c757d',
                color: '#ffffff',
              }}
            >
              {STATUS_CONFIG[report.status]?.icon}{' '}
              {STATUS_CONFIG[report.status]?.label || report.status}
            </span>
          )}
        </div>
      </div>

      {/* Study Selector */}
      <div className="study-selector">
        <label>Select Study:</label>
        <select
          value={selectedStudyId || ''}
          onChange={e => setSelectedStudyId(e.target.value || null)}
          className="study-select"
        >
          <option value="">-- Select a study --</option>
          {studies.map(study => (
            <option key={study.id} value={study.id}>
              {study.patientName || 'Unknown'} | {study.modality} |{' '}
              {study.studyDescription || 'No description'} |{' '}
              {formatDate(study.studyDate)}
            </option>
          ))}
        </select>
        {studies.length === 0 && (
          <p className="no-studies">
            No studies assigned. Check your worklist.
          </p>
        )}
      </div>

      {/* Tabs */}
      {selectedStudyId && (
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'editor' ? 'active' : ''}`}
            onClick={() => setActiveTab('editor')}
          >
            Editor
          </button>
          <button
            className={`tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            History ({existingReports.length})
          </button>
        </div>
      )}

      {/* Editor Tab */}
      {selectedStudyId && activeTab === 'editor' && (
        <div className="editor-content">
          {/* Study Info */}
          {selectedStudy && (
            <div className="study-info">
              <div className="info-item">
                <strong>Patient:</strong>{' '}
                {selectedStudy.patientName || 'Unknown'}
              </div>
              <div className="info-item">
                <strong>Modality:</strong> {selectedStudy.modality}
              </div>
              <div className="info-item">
                <strong>Description:</strong>{' '}
                {selectedStudy.studyDescription || 'N/A'}
              </div>
              <div className="info-item">
                <strong>Date:</strong> {formatDate(selectedStudy.studyDate)}
              </div>
            </div>
          )}

          {/* Template Button */}
          <div className="template-section">
            <button
              className="btn btn-secondary"
              onClick={() => setShowTemplateModal(true)}
              disabled={report?.status !== 'draft' && report !== null}
            >
              <span role="img" aria-label="document">
                📄
              </span>{' '}
              Insert Template
            </button>
          </div>

          {/* Report Form */}
          <div className="report-form">
            <div className="form-group">
              <label htmlFor="findings">Findings *</label>
              <textarea
                id="findings"
                ref={findingsRef}
                value={findings}
                onChange={e => handleFieldChange('findings', e.target.value)}
                placeholder="Enter findings..."
                rows={10}
                disabled={report?.status !== 'draft' && report !== null}
              />
            </div>

            <div className="form-group">
              <label htmlFor="impression">Impression</label>
              <textarea
                id="impression"
                value={impression}
                onChange={e => handleFieldChange('impression', e.target.value)}
                placeholder="Enter impression..."
                rows={4}
                disabled={report?.status !== 'draft' && report !== null}
              />
            </div>

            <div className="form-group">
              <label htmlFor="conclusion">Conclusion</label>
              <textarea
                id="conclusion"
                value={conclusion}
                onChange={e => handleFieldChange('conclusion', e.target.value)}
                placeholder="Enter conclusion..."
                rows={4}
                disabled={report?.status !== 'draft' && report !== null}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="action-buttons">
            {(!report || report.status === 'draft') && (
              <>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleSaveDraft(false)}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    'Saving...'
                  ) : (
                    <>
                      <span role="img" aria-label="save">
                        💾
                      </span>{' '}
                      Save Draft
                    </>
                  )}
                </button>
                <button
                  className="btn btn-warning"
                  onClick={() => handleFinalize('preliminary')}
                  disabled={isSaving || !findings.trim()}
                >
                  <span role="img" aria-label="pending">
                    ⏳
                  </span>{' '}
                  Finalize as Preliminary
                </button>
                <button
                  className="btn btn-success"
                  onClick={() => handleFinalize('final')}
                  disabled={isSaving || !findings.trim()}
                >
                  <span role="img" aria-label="check">
                    ✓
                  </span>{' '}
                  Finalize as Final
                </button>
              </>
            )}
            {report && report.status !== 'draft' && (
              <div className="finalized-message">
                <p>
                  This report has been finalized as{' '}
                  <strong>{report.status}</strong>.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => handleCreateAddendum(report.id)}
                  disabled={isSaving}
                >
                  <span role="img" aria-label="clipboard">
                    📋
                  </span>{' '}
                  Create Addendum
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {selectedStudyId && activeTab === 'history' && (
        <div className="history-content">
          {existingReports.length === 0 ? (
            <p className="no-reports">No reports found for this study.</p>
          ) : (
            <div className="reports-list">
              {existingReports.map(reportItem => (
                <div key={reportItem.id} className="report-card">
                  <div className="report-card-header">
                    <span
                      className="status-badge"
                      style={{
                        backgroundColor:
                          STATUS_CONFIG[reportItem.status]?.color || '#6c757d',
                        color: '#ffffff',
                      }}
                    >
                      {STATUS_CONFIG[reportItem.status]?.icon}{' '}
                      {STATUS_CONFIG[reportItem.status]?.label}
                    </span>
                    <span className="report-date">
                      {formatDate(reportItem.createdAt)}
                    </span>
                  </div>
                  <div className="report-card-body">
                    {reportItem.isAddendum && (
                      <span className="addendum-badge">Addendum</span>
                    )}
                    <p className="report-preview">
                      <strong>Findings:</strong>{' '}
                      {reportItem.findings?.substring(0, 200) || 'No findings'}
                      {reportItem.findings?.length > 200 && '...'}
                    </p>
                    {reportItem.impression && (
                      <p className="report-preview">
                        <strong>Impression:</strong>{' '}
                        {reportItem.impression?.substring(0, 100) || ''}
                        {reportItem.impression?.length > 100 && '...'}
                      </p>
                    )}
                  </div>
                  <div className="report-card-footer">
                    {reportItem.status !== 'draft' && (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleCreateAddendum(reportItem.id)}
                      >
                        Create Addendum
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowTemplateModal(false)}
        >
          <div className="template-modal" onClick={e => e.stopPropagation()}>
            <h3>Select Template</h3>
            <div className="template-list">
              {Object.entries(REPORT_TEMPLATES).map(([key, template]) => (
                <button
                  key={key}
                  className="template-item"
                  onClick={() => applyTemplate(key)}
                >
                  <span className="template-name">{template.name}</span>
                  <span className="template-modality">{key.toUpperCase()}</span>
                </button>
              ))}
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => setShowTemplateModal(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

ReportEditorPanel.propTypes = {
  servicesManager: PropTypes.shape({
    services: PropTypes.shape({
      UINotificationService: PropTypes.shape({
        show: PropTypes.func,
      }),
    }),
  }),
};

export default ReportEditorPanel;
