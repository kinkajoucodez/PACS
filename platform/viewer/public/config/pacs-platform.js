/**
 * PACS Platform Configuration
 * 
 * This configuration enables:
 * - Keycloak OIDC authentication
 * - Orthanc DICOMweb integration via nginx proxy
 * - Backend API integration for platform features
 */
window.config = {
  routerBasename: '/',
  showStudyList: true,
  
  // DICOMweb server configuration
  servers: {
    dicomWeb: [
      {
        name: 'Orthanc',
        wadoUriRoot: '/orthanc/wado',
        qidoRoot: '/orthanc/dicom-web',
        wadoRoot: '/orthanc/dicom-web',
        qidoSupportsIncludeField: false,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        // Authentication will be handled via JWT token from Keycloak
      },
    ],
  },
  
  // Keycloak OIDC configuration
  oidc: [
    {
      // Authorization Server URL - using nginx proxy path
      authority: '/auth/realms/pacs',
      client_id: 'pacs-viewer',
      redirect_uri: '/callback',
      // Authorization Code Flow with PKCE
      response_type: 'code',
      scope: 'openid profile email',
      // Post-logout redirect
      post_logout_redirect_uri: '/logout-redirect.html',
      // Silent token refresh
      automaticSilentRenew: true,
      revokeAccessTokenOnSignout: true,
    },
  ],
  
  // Backend API configuration for PACS platform features
  pacsApi: {
    baseUrl: '/api',
    endpoints: {
      users: '/users',
      providers: '/providers',
      studies: '/studies',
      reports: '/reports',
      health: '/health',
    },
  },
  
  // Study list configuration
  studyListFunctionsEnabled: true,
  
  // Hotkeys configuration
  hotkeys: [
    {
      commandName: 'incrementActiveViewport',
      label: 'Next Viewport',
      keys: ['right'],
    },
    {
      commandName: 'decrementActiveViewport',
      label: 'Previous Viewport',
      keys: ['left'],
    },
    {
      commandName: 'rotateViewportCW',
      label: 'Rotate Right',
      keys: ['r'],
    },
    {
      commandName: 'rotateViewportCCW',
      label: 'Rotate Left',
      keys: ['l'],
    },
    {
      commandName: 'invertViewport',
      label: 'Invert',
      keys: ['i'],
    },
    {
      commandName: 'flipViewportVertical',
      label: 'Flip Vertically',
      keys: ['v'],
    },
    {
      commandName: 'flipViewportHorizontal',
      label: 'Flip Horizontally',
      keys: ['h'],
    },
    {
      commandName: 'scaleUpViewport',
      label: 'Zoom In',
      keys: ['='],
    },
    {
      commandName: 'scaleDownViewport',
      label: 'Zoom Out',
      keys: ['-'],
    },
    {
      commandName: 'fitViewportToWindow',
      label: 'Fit to Screen',
      keys: ['0'],
    },
    {
      commandName: 'resetViewport',
      label: 'Reset',
      keys: ['space'],
    },
    {
      commandName: 'nextImage',
      label: 'Next Image',
      keys: ['down'],
    },
    {
      commandName: 'previousImage',
      label: 'Previous Image',
      keys: ['up'],
    },
  ],
  
  // Cornerstone tools configuration
  cornerstoneExtensionConfig: {},
  
  // Extensions to load (default OHIF extensions)
  extensions: [],
};
