/**
 * UserProfile Component
 * 
 * Displays user profile information in the header with:
 * - User avatar (initials-based)
 * - Full name and role badge
 * - Dropdown with profile options
 */

import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { withTranslation } from 'react-i18next';
import useUser from '../../customHooks/useUser';
import './UserProfile.css';

/**
 * Get user initials from name
 */
const getInitials = (firstName, lastName, username) => {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName.substring(0, 2).toUpperCase();
  }
  if (username) {
    return username.substring(0, 2).toUpperCase();
  }
  return '??';
};

/**
 * Get primary role display name
 */
const getPrimaryRoleLabel = (roles) => {
  // Priority order for display
  const roleLabels = {
    admin: 'Admin',
    radiologist: 'Radiologist',
    provider: 'Provider',
    billing_officer: 'Billing',
    support: 'Support',
    auditor: 'Auditor',
  };

  for (const role of Object.keys(roleLabels)) {
    if (roles.includes(role)) {
      return roleLabels[role];
    }
  }
  return 'User';
};

/**
 * Get role badge color
 */
const getRoleBadgeColor = (roles) => {
  if (roles.includes('admin')) return '#dc3545';
  if (roles.includes('radiologist')) return '#28a745';
  if (roles.includes('provider')) return '#007bff';
  if (roles.includes('billing_officer')) return '#17a2b8';
  if (roles.includes('support')) return '#ffc107';
  if (roles.includes('auditor')) return '#6c757d';
  return '#6c757d';
};

const UserProfile = ({ t, userManager, onShowPreferences, onShowAbout }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { isAuthenticated, profile, roles } = useUser();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  if (!isAuthenticated || !profile) {
    return null;
  }

  const initials = getInitials(profile.firstName, profile.lastName, profile.username);
  const roleLabel = getPrimaryRoleLabel(roles);
  const roleBadgeColor = getRoleBadgeColor(roles);

  const handleLogout = () => {
    setIsDropdownOpen(false);
    if (userManager) {
      userManager.signoutRedirect();
    }
  };

  const handlePreferences = () => {
    setIsDropdownOpen(false);
    if (onShowPreferences) {
      onShowPreferences();
    }
  };

  const handleAbout = () => {
    setIsDropdownOpen(false);
    if (onShowAbout) {
      onShowAbout();
    }
  };

  return (
    <div className="user-profile" ref={dropdownRef}>
      <button
        className="user-profile-trigger"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        aria-expanded={isDropdownOpen}
        aria-haspopup="true"
      >
        <div className="user-avatar">{initials}</div>
        <div className="user-info">
          <span className="user-name">{profile.fullName || profile.username}</span>
          <span className="user-role" style={{ backgroundColor: roleBadgeColor }}>
            {roleLabel}
          </span>
        </div>
        <span className={`dropdown-arrow ${isDropdownOpen ? 'open' : ''}`}>▼</span>
      </button>

      {isDropdownOpen && (
        <div className="user-profile-dropdown">
          <div className="dropdown-header">
            <div className="dropdown-avatar">{initials}</div>
            <div className="dropdown-user-details">
              <span className="dropdown-name">{profile.fullName || profile.username}</span>
              <span className="dropdown-email">{profile.email}</span>
              <span className="dropdown-role" style={{ borderColor: roleBadgeColor, color: roleBadgeColor }}>
                {roleLabel}
              </span>
            </div>
          </div>

          <div className="dropdown-divider" />

          <ul className="dropdown-menu">
            {onShowPreferences && (
              <li>
                <button className="dropdown-item" onClick={handlePreferences}>
                  <span className="dropdown-icon">⚙️</span>
                  {t('Preferences')}
                </button>
              </li>
            )}
            {onShowAbout && (
              <li>
                <button className="dropdown-item" onClick={handleAbout}>
                  <span className="dropdown-icon">ℹ️</span>
                  {t('About')}
                </button>
              </li>
            )}
            <li>
              <button className="dropdown-item" onClick={handleLogout}>
                <span className="dropdown-icon">🚪</span>
                {t('Logout')}
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

UserProfile.propTypes = {
  t: PropTypes.func.isRequired,
  userManager: PropTypes.object,
  onShowPreferences: PropTypes.func,
  onShowAbout: PropTypes.func,
};

export default withTranslation(['Header'])(UserProfile);
