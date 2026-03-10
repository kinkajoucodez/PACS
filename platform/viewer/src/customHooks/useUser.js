/**
 * useUser Hook
 *
 * Provides easy access to the current user's data from Keycloak OIDC.
 * Extracts user profile information, roles, and authentication status.
 */

import { useSelector } from 'react-redux';
import { useMemo } from 'react';

/**
 * Parse JWT token to extract claims
 * @param {string} token - JWT access token
 * @returns {Object} Decoded token payload
 */
const parseJwt = token => {
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to parse JWT token:', e);
    return null;
  }
};

/**
 * Get user roles from Keycloak token
 * @param {Object} decodedToken - Decoded JWT token
 * @returns {string[]} Array of user roles
 */
const extractRoles = decodedToken => {
  if (!decodedToken) return [];

  const roles = [];

  // Realm roles
  if (decodedToken.realm_access?.roles) {
    roles.push(...decodedToken.realm_access.roles);
  }

  // Resource roles (for 'pacs-viewer' client)
  if (decodedToken.resource_access?.['pacs-viewer']?.roles) {
    roles.push(...decodedToken.resource_access['pacs-viewer'].roles);
  }

  // Also check for 'pacs-backend' client roles
  if (decodedToken.resource_access?.['pacs-backend']?.roles) {
    roles.push(...decodedToken.resource_access['pacs-backend'].roles);
  }

  return [...new Set(roles)]; // Remove duplicates
};

/**
 * Hook to access current user information
 * @returns {Object} User state and utilities
 */
const useUser = () => {
  const oidcState = useSelector(state => state.oidc);
  const user = oidcState?.user;

  const userInfo = useMemo(() => {
    if (!user) {
      return {
        isAuthenticated: false,
        isExpired: true,
        user: null,
        profile: null,
        roles: [],
        accessToken: null,
      };
    }

    const isExpired = user.expired;
    const accessToken = user.access_token;
    const decodedToken = parseJwt(accessToken);
    const roles = extractRoles(decodedToken);

    // Get profile from user or decoded token
    const profile = user.profile || {
      sub: decodedToken?.sub,
      name: decodedToken?.name || decodedToken?.preferred_username,
      email: decodedToken?.email,
      given_name: decodedToken?.given_name,
      family_name: decodedToken?.family_name,
      preferred_username: decodedToken?.preferred_username,
    };

    return {
      isAuthenticated: !isExpired,
      isExpired,
      user,
      profile: {
        id: profile.sub,
        username: profile.preferred_username || profile.name,
        email: profile.email,
        firstName: profile.given_name,
        lastName: profile.family_name,
        fullName:
          profile.name ||
          `${profile.given_name || ''} ${profile.family_name || ''}`.trim(),
      },
      roles,
      accessToken,
      // Convenience role checks
      isAdmin: roles.includes('admin'),
      isRadiologist: roles.includes('radiologist'),
      isProvider: roles.includes('provider'),
      isBillingOfficer: roles.includes('billing_officer'),
      isSupport: roles.includes('support'),
      isAuditor: roles.includes('auditor'),
    };
  }, [user]);

  return userInfo;
};

/**
 * Check if user has any of the specified roles
 * @param {string[]} requiredRoles - Array of role names
 * @returns {boolean} True if user has at least one of the required roles
 */
export const useHasRole = requiredRoles => {
  const { roles } = useUser();

  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }

  return requiredRoles.some(role => roles.includes(role));
};

/**
 * Check if user has all of the specified roles
 * @param {string[]} requiredRoles - Array of role names
 * @returns {boolean} True if user has all of the required roles
 */
export const useHasAllRoles = requiredRoles => {
  const { roles } = useUser();

  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }

  return requiredRoles.every(role => roles.includes(role));
};

export default useUser;
