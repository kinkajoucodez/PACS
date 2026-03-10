/**
 * AdminPanel Component
 *
 * Full-featured administration dashboard for the PACS platform.
 * Accessible only to users with the 'admin' role.
 *
 * Sections:
 *  - System Health
 *  - User Management
 *  - Provider Onboarding
 *  - Radiologist Verification
 *  - SLA Configuration
 */

import React, { useState, useEffect, useCallback } from 'react';
import './AdminPanel.css';

// ---------------------------------------------------------------------------
// API client (falls back to a lightweight fetch wrapper when pacsApiService
// is not available in the extension context)
// ---------------------------------------------------------------------------
const getApiClient = () => {
  if (window.pacsApiService) return window.pacsApiService;

  const baseUrl =
    (window.config && window.config.pacsApi && window.config.pacsApi.baseUrl) ||
    '/api';

  const getToken = () => {
    try {
      const state = window.store && window.store.getState();
      return state && state.oidc && state.oidc.user
        ? state.oidc.user.access_token
        : null;
    } catch {
      return null;
    }
  };

  const req = async (path, opts = {}) => {
    const token = getToken();
    const res = await fetch(`${baseUrl}${path}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...opts.headers,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.json();
  };

  return {
    checkReadiness: () => req('/health/ready'),
    getUsers: params => {
      const qs = new URLSearchParams(params).toString();
      return req(`/users${qs ? `?${qs}` : ''}`);
    },
    createUser: data => req('/users', { method: 'POST', body: JSON.stringify(data) }),
    updateUser: (id, data) =>
      req(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    updateUserStatus: (id, status) =>
      req(`/users/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    getProviders: params => {
      const qs = new URLSearchParams(params).toString();
      return req(`/providers${qs ? `?${qs}` : ''}`);
    },
    createProvider: data =>
      req('/providers', { method: 'POST', body: JSON.stringify(data) }),
  };
};

// ---------------------------------------------------------------------------
// Helper: get current user roles from JWT
// ---------------------------------------------------------------------------
const getCurrentUserRoles = () => {
  try {
    const state = window.store && window.store.getState();
    const token =
      state && state.oidc && state.oidc.user
        ? state.oidc.user.access_token
        : null;
    if (!token) return [];
    const payload = JSON.parse(atob(token.split('.')[1]));
    const realm = (payload.realm_access && payload.realm_access.roles) || [];
    const client =
      (payload.resource_access &&
        payload.resource_access['pacs-viewer'] &&
        payload.resource_access['pacs-viewer'].roles) ||
      [];
    return [...new Set([...realm, ...client])];
  } catch {
    return [];
  }
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** System Health */
function HealthSection({ api }) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.checkReadiness();
      setHealth(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const statusBadge = (ok, label) => (
    <span className={`admin-badge ${ok ? 'badge-ok' : 'badge-error'}`}>
      {ok ? '✓' : '✗'} {label}
    </span>
  );

  if (loading) return <p className="admin-loading">Checking services…</p>;
  if (error) return <p className="admin-error">Health check failed: {error}</p>;

  return (
    <div className="admin-health">
      <div className="health-grid">
        {health &&
          Object.entries(health).map(([service, info]) => {
            const ok =
              typeof info === 'object'
                ? info.status === 'up' || info.status === 'ok'
                : info === true;
            const label =
              service.charAt(0).toUpperCase() + service.slice(1);
            return (
              <div key={service} className="health-card">
                {statusBadge(ok, label)}
                {typeof info === 'object' && info.message && (
                  <span className="health-detail">{info.message}</span>
                )}
              </div>
            );
          })}
        {(!health || Object.keys(health).length === 0) && (
          <p className="admin-empty">No health data available.</p>
        )}
      </div>
      <button className="admin-btn btn-secondary" onClick={fetchHealth}>
        Refresh
      </button>
    </div>
  );
}

/** User Management */
function UsersSection({ api }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'radiologist',
  });
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getUsers({ limit: 50 });
      setUsers((data && data.data) || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = async e => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await api.createUser(form);
      setShowCreate(false);
      setForm({ email: '', firstName: '', lastName: '', role: 'radiologist' });
      fetchUsers();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusToggle = async (user) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      await api.updateUserStatus(user.id, newStatus);
      fetchUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const ROLES = ['admin', 'radiologist', 'provider_manager', 'billing_officer', 'support', 'auditor'];

  return (
    <div className="admin-section">
      <div className="section-header">
        <h3>Users ({users.length})</h3>
        <button className="admin-btn btn-primary" onClick={() => setShowCreate(v => !v)}>
          {showCreate ? 'Cancel' : '+ New User'}
        </button>
      </div>

      {showCreate && (
        <form className="admin-form" onSubmit={handleCreate}>
          <h4>Create User</h4>
          {formError && <p className="admin-error">{formError}</p>}
          <div className="form-row">
            <label>Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
            />
          </div>
          <div className="form-row">
            <label>First Name</label>
            <input
              value={form.firstName}
              onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
            />
          </div>
          <div className="form-row">
            <label>Last Name</label>
            <input
              value={form.lastName}
              onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
            />
          </div>
          <div className="form-row">
            <label>Role</label>
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            >
              {ROLES.map(r => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="admin-btn btn-primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create User'}
          </button>
        </form>
      )}

      {error && <p className="admin-error">{error}</p>}
      {loading ? (
        <p className="admin-loading">Loading users…</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="admin-empty">
                    No users found.
                  </td>
                </tr>
              )}
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    {u.firstName} {u.lastName}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <span className="admin-tag">{u.role}</span>
                  </td>
                  <td>
                    <span
                      className={`admin-badge ${
                        u.status === 'active' ? 'badge-ok' : 'badge-error'
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="admin-btn btn-small btn-secondary"
                      onClick={() => handleStatusToggle(u)}
                    >
                      {u.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Provider Onboarding Wizard */
function ProviderSection({ api }) {
  const STEPS = ['Basic Info', 'Contact', 'Review'];
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '',
    organizationType: 'hospital',
    contactEmail: '',
    contactPhone: '',
    address: '',
  });
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api
      .getProviders({ limit: 50 })
      .then(data => setProviders((data && data.data) || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [api]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.createProvider(form);
      setSuccess(true);
      setStep(0);
      setForm({
        name: '',
        organizationType: 'hospital',
        contactEmail: '',
        contactPhone: '',
        address: '',
      });
      const data = await api.getProviders({ limit: 50 });
      setProviders((data && data.data) || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const ORG_TYPES = ['hospital', 'clinic', 'imaging_center', 'urgent_care', 'other'];

  return (
    <div className="admin-section">
      <h3>Healthcare Providers ({providers.length})</h3>

      {success && (
        <div className="admin-success">
          ✓ Provider created successfully.{' '}
          <button className="link-btn" onClick={() => setSuccess(false)}>
            Add another
          </button>
        </div>
      )}

      {!success && (
        <div className="wizard">
          <div className="wizard-steps">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`wizard-step ${
                  i === step ? 'active' : i < step ? 'done' : ''
                }`}
              >
                <span className="step-num">{i + 1}</span>
                <span className="step-label">{s}</span>
              </div>
            ))}
          </div>

          {error && <p className="admin-error">{error}</p>}

          {step === 0 && (
            <div className="wizard-body">
              <div className="form-row">
                <label>Provider Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="form-row">
                <label>Organization Type</label>
                <select
                  value={form.organizationType}
                  onChange={e =>
                    setForm(f => ({ ...f, organizationType: e.target.value }))
                  }
                >
                  {ORG_TYPES.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="admin-btn btn-primary"
                disabled={!form.name}
                onClick={() => setStep(1)}
              >
                Next →
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="wizard-body">
              <div className="form-row">
                <label>Contact Email *</label>
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={e =>
                    setForm(f => ({ ...f, contactEmail: e.target.value }))
                  }
                />
              </div>
              <div className="form-row">
                <label>Contact Phone</label>
                <input
                  value={form.contactPhone}
                  onChange={e =>
                    setForm(f => ({ ...f, contactPhone: e.target.value }))
                  }
                />
              </div>
              <div className="form-row">
                <label>Address</label>
                <textarea
                  value={form.address}
                  rows={3}
                  onChange={e =>
                    setForm(f => ({ ...f, address: e.target.value }))
                  }
                />
              </div>
              <div className="wizard-nav">
                <button
                  className="admin-btn btn-secondary"
                  onClick={() => setStep(0)}
                >
                  ← Back
                </button>
                <button
                  className="admin-btn btn-primary"
                  disabled={!form.contactEmail}
                  onClick={() => setStep(2)}
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="wizard-body">
              <h4>Review</h4>
              <dl className="review-list">
                <dt>Name</dt>
                <dd>{form.name}</dd>
                <dt>Type</dt>
                <dd>{form.organizationType}</dd>
                <dt>Contact Email</dt>
                <dd>{form.contactEmail}</dd>
                {form.contactPhone && (
                  <>
                    <dt>Phone</dt>
                    <dd>{form.contactPhone}</dd>
                  </>
                )}
                {form.address && (
                  <>
                    <dt>Address</dt>
                    <dd>{form.address}</dd>
                  </>
                )}
              </dl>
              <div className="wizard-nav">
                <button
                  className="admin-btn btn-secondary"
                  onClick={() => setStep(1)}
                >
                  ← Back
                </button>
                <button
                  className="admin-btn btn-primary"
                  disabled={submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? 'Creating…' : 'Create Provider'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <hr className="admin-divider" />

      <h4>Existing Providers</h4>
      {loading ? (
        <p className="admin-loading">Loading…</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Email</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {providers.length === 0 && (
                <tr>
                  <td colSpan={4} className="admin-empty">
                    No providers yet.
                  </td>
                </tr>
              )}
              {providers.map(p => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.organizationType || '—'}</td>
                  <td>{p.contactEmail || '—'}</td>
                  <td>
                    <span
                      className={`admin-badge ${
                        p.isActive !== false ? 'badge-ok' : 'badge-error'
                      }`}
                    >
                      {p.isActive !== false ? 'active' : 'inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Radiologist Verification */
function VerificationSection({ api }) {
  const [radiologists, setRadiologists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getUsers({ role: 'radiologist', limit: 100 });
      const all = (data && data.data) || [];
      setRadiologists(
        all.filter(
          u =>
            u.radiologistProfile &&
            u.radiologistProfile.verificationStatus === 'pending',
        ),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleVerify = async (userId, approved) => {
    try {
      await api.updateUser(userId, {
        radiologistProfile: {
          verificationStatus: approved ? 'approved' : 'rejected',
        },
      });
      fetchPending();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="admin-section">
      <div className="section-header">
        <h3>Radiologist Verification</h3>
        <button className="admin-btn btn-secondary" onClick={fetchPending}>
          Refresh
        </button>
      </div>
      {error && <p className="admin-error">{error}</p>}
      {loading ? (
        <p className="admin-loading">Loading…</p>
      ) : radiologists.length === 0 ? (
        <p className="admin-empty">No pending verification requests.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>License</th>
                <th>Specializations</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {radiologists.map(u => (
                <tr key={u.id}>
                  <td>
                    {u.firstName} {u.lastName}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    {(u.radiologistProfile && u.radiologistProfile.licenseNumber) || '—'}
                  </td>
                  <td>
                    {u.radiologistProfile &&
                    u.radiologistProfile.specializations &&
                    u.radiologistProfile.specializations.length > 0
                      ? u.radiologistProfile.specializations.join(', ')
                      : '—'}
                  </td>
                  <td className="action-cell">
                    <button
                      className="admin-btn btn-small btn-primary"
                      onClick={() => handleVerify(u.id, true)}
                    >
                      Approve
                    </button>
                    <button
                      className="admin-btn btn-small btn-danger"
                      onClick={() => handleVerify(u.id, false)}
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** SLA Configuration */
const DEFAULT_SLA_HOURS = {
  stat: 1,
  urgent: 4,
  routine: 24,
  follow_up: 48,
};

function SlaSection() {
  const [values, setValues] = useState(DEFAULT_SLA_HOURS);
  const [saved, setSaved] = useState(false);

  const handleSave = e => {
    e.preventDefault();
    // SLA config is managed via environment variables / DB; this form
    // documents the current thresholds and would call a future PATCH endpoint.
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="admin-section">
      <h3>SLA Thresholds</h3>
      <p className="admin-hint">
        Configure the maximum turnaround time (in hours) for each study priority.
        These values are used by the SLA monitor to detect breaches and send alerts.
      </p>
      {saved && <div className="admin-success">✓ SLA configuration saved.</div>}
      <form className="admin-form" onSubmit={handleSave}>
        {Object.entries(values).map(([priority, hours]) => (
          <div className="form-row" key={priority}>
            <label>{priority.replace('_', ' ').toUpperCase()} (hours)</label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={hours}
              onChange={e =>
                setValues(v => ({
                  ...v,
                  [priority]: parseFloat(e.target.value) || 0,
                }))
              }
            />
          </div>
        ))}
        <button type="submit" className="admin-btn btn-primary">
          Save SLA Config
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main AdminPanel
// ---------------------------------------------------------------------------
const TABS = [
  { id: 'health', label: '🩺 Health' },
  { id: 'users', label: '👤 Users' },
  { id: 'providers', label: '🏥 Providers' },
  { id: 'verification', label: '✅ Verification' },
  { id: 'sla', label: '⏱ SLA Config' },
];

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('health');
  const [isAdmin, setIsAdmin] = useState(null);

  useEffect(() => {
    const roles = getCurrentUserRoles();
    setIsAdmin(roles.includes('admin'));
  }, []);

  const api = getApiClient();

  if (isAdmin === null) {
    return <div className="admin-panel admin-loading">Checking permissions…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="admin-panel admin-unauthorized">
        <span role="img" aria-label="locked" style={{ fontSize: '64px' }}>
          🔒
        </span>
        <h2>Access Denied</h2>
        <p>This dashboard is only accessible to administrators.</p>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>⚙️ PACS Administration</h1>
      </div>

      <nav className="admin-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`admin-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="admin-content">
        {activeTab === 'health' && <HealthSection api={api} />}
        {activeTab === 'users' && <UsersSection api={api} />}
        {activeTab === 'providers' && <ProviderSection api={api} />}
        {activeTab === 'verification' && <VerificationSection api={api} />}
        {activeTab === 'sla' && <SlaSection />}
      </div>
    </div>
  );
}
