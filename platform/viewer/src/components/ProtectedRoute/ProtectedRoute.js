/**
 * ProtectedRoute Component
 *
 * A route wrapper that enforces role-based access control.
 * Redirects unauthorized users to an appropriate page.
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Route, Redirect } from 'react-router-dom';
import useUser, { useHasRole } from '../../customHooks/useUser';

/**
 * Protected Route component for role-based access
 */
const ProtectedRoute = ({
  component: Component,
  render,
  roles,
  redirectTo,
  unauthorizedComponent: UnauthorizedComponent,
  ...rest
}) => {
  const { isAuthenticated, isExpired } = useUser();
  const hasRequiredRole = useHasRole(roles);

  return (
    <Route
      {...rest}
      render={props => {
        // Not authenticated - let the main app handle redirect to login
        if (!isAuthenticated || isExpired) {
          return null;
        }

        // No specific roles required or user has required role
        if (!roles || roles.length === 0 || hasRequiredRole) {
          if (Component) {
            return <Component {...props} />;
          }
          if (render) {
            return render(props);
          }
          return null;
        }

        // User doesn't have required role
        if (UnauthorizedComponent) {
          return <UnauthorizedComponent {...props} requiredRoles={roles} />;
        }

        if (redirectTo) {
          return <Redirect to={redirectTo} />;
        }

        // Default unauthorized view
        return <UnauthorizedPage requiredRoles={roles} />;
      }}
    />
  );
};

ProtectedRoute.propTypes = {
  component: PropTypes.elementType,
  render: PropTypes.func,
  roles: PropTypes.arrayOf(PropTypes.string),
  redirectTo: PropTypes.string,
  unauthorizedComponent: PropTypes.elementType,
};

ProtectedRoute.defaultProps = {
  roles: [],
  redirectTo: null,
  unauthorizedComponent: null,
};

/**
 * Default unauthorized page
 */
const UnauthorizedPage = ({ requiredRoles }) => {
  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <span style={styles.icon} role="img" aria-label="locked">
          🔒
        </span>
        <h1 style={styles.title}>Access Denied</h1>
        <p style={styles.message}>
          You do not have permission to access this page.
        </p>
        {requiredRoles && requiredRoles.length > 0 && (
          <p style={styles.roles}>
            Required role{requiredRoles.length > 1 ? 's' : ''}:{' '}
            {requiredRoles.join(', ')}
          </p>
        )}
        <a href="/" style={styles.link}>
          Return to Home
        </a>
      </div>
    </div>
  );
};

UnauthorizedPage.propTypes = {
  requiredRoles: PropTypes.arrayOf(PropTypes.string),
};

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#1e1e1e',
    color: '#e0e0e0',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
  },
  content: {
    textAlign: 'center',
    padding: '40px',
    maxWidth: '400px',
  },
  icon: {
    fontSize: '64px',
    marginBottom: '20px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '600',
    marginBottom: '16px',
    color: '#ffffff',
  },
  message: {
    fontSize: '16px',
    color: '#888',
    marginBottom: '12px',
  },
  roles: {
    fontSize: '14px',
    color: '#6c9bd1',
    marginBottom: '24px',
    fontFamily: '"SF Mono", Monaco, Inconsolata, monospace',
  },
  link: {
    display: 'inline-block',
    padding: '12px 24px',
    backgroundColor: '#2d5aa7',
    color: '#ffffff',
    borderRadius: '6px',
    textDecoration: 'none',
    fontWeight: '500',
    transition: 'background-color 0.2s',
  },
};

export default ProtectedRoute;
