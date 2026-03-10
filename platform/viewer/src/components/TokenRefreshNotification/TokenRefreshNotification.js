/**
 * TokenRefreshNotification Component
 * 
 * Shows toast notifications for:
 * - Token refresh success
 * - Token expiration warning
 * - Session expiration
 */

import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { withTranslation } from 'react-i18next';
import './TokenRefreshNotification.css';

const NOTIFICATION_DURATION = 5000; // 5 seconds
const EXPIRING_SOON_THRESHOLD = 60 * 5; // 5 minutes before expiry

const TokenRefreshNotification = ({ t, userManager }) => {
  const [notifications, setNotifications] = useState([]);
  const [lastRefreshTime, setLastRefreshTime] = useState(null);
  const [hasShownExpiringWarning, setHasShownExpiringWarning] = useState(false);
  const user = useSelector(state => state.oidc?.user);

  /**
   * Add a notification to the queue
   */
  const addNotification = useCallback((type, message, duration = NOTIFICATION_DURATION) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, type, message }]);

    // Auto-remove after duration
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, duration);
  }, []);

  /**
   * Listen for token refresh events from OIDC
   */
  useEffect(() => {
    if (!userManager) return;

    const handleTokenRefreshed = (refreshedUser) => {
      const now = Date.now();
      
      // Only show notification if this is a background refresh
      // (not the initial load or manual login)
      if (lastRefreshTime && (now - lastRefreshTime) > 30000) {
        addNotification('success', t('Session refreshed successfully'));
      }
      setLastRefreshTime(now);
      setHasShownExpiringWarning(false);
    };

    const handleSilentRenewError = (error) => {
      console.error('Silent renew error:', error);
      addNotification('warning', t('Session could not be refreshed. You may need to log in again.'), 10000);
    };

    const handleAccessTokenExpiring = () => {
      if (!hasShownExpiringWarning) {
        addNotification('info', t('Your session will expire soon. Refreshing...'));
        setHasShownExpiringWarning(true);
      }
    };

    const handleAccessTokenExpired = () => {
      addNotification('error', t('Your session has expired. Please log in again.'), 10000);
    };

    // Add event listeners
    userManager.events.addUserLoaded(handleTokenRefreshed);
    userManager.events.addSilentRenewError(handleSilentRenewError);
    userManager.events.addAccessTokenExpiring(handleAccessTokenExpiring);
    userManager.events.addAccessTokenExpired(handleAccessTokenExpired);

    return () => {
      // Remove event listeners on cleanup
      userManager.events.removeUserLoaded(handleTokenRefreshed);
      userManager.events.removeSilentRenewError(handleSilentRenewError);
      userManager.events.removeAccessTokenExpiring(handleAccessTokenExpiring);
      userManager.events.removeAccessTokenExpired(handleAccessTokenExpired);
    };
  }, [userManager, lastRefreshTime, hasShownExpiringWarning, addNotification, t]);

  /**
   * Check for expiring token on mount and periodically
   */
  useEffect(() => {
    if (!user || user.expired) return;

    const checkExpiration = () => {
      if (!user.expires_at) return;
      
      const expiresAt = user.expires_at * 1000; // Convert to milliseconds
      const now = Date.now();
      const timeUntilExpiry = (expiresAt - now) / 1000; // Seconds

      // Warn if expiring within threshold
      if (timeUntilExpiry > 0 && timeUntilExpiry <= EXPIRING_SOON_THRESHOLD && !hasShownExpiringWarning) {
        const minutes = Math.ceil(timeUntilExpiry / 60);
        addNotification(
          'warning',
          t('Session expires in {{minutes}} minutes', { minutes }),
          8000
        );
        setHasShownExpiringWarning(true);
      }
    };

    // Check immediately and then every minute
    checkExpiration();
    const interval = setInterval(checkExpiration, 60000);

    return () => clearInterval(interval);
  }, [user, hasShownExpiringWarning, addNotification, t]);

  /**
   * Remove a notification manually
   */
  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="token-notifications-container">
      {notifications.map(notification => (
        <div
          key={notification.id}
          className={`token-notification token-notification-${notification.type}`}
          role="alert"
        >
          <span className="token-notification-icon">
            {notification.type === 'success' && '✓'}
            {notification.type === 'error' && '✕'}
            {notification.type === 'warning' && '⚠'}
            {notification.type === 'info' && 'ℹ'}
          </span>
          <span className="token-notification-message">{notification.message}</span>
          <button
            className="token-notification-close"
            onClick={() => removeNotification(notification.id)}
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

TokenRefreshNotification.propTypes = {
  t: PropTypes.func.isRequired,
  userManager: PropTypes.object,
};

export default withTranslation(['Common'])(TokenRefreshNotification);
