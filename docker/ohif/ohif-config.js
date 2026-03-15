// Legacy config shape required by OHIF viewer 4.12.23 in this codebase.
// Newer OHIF versions use dataSources/defaultDataSourceName/modes/extensions,
// but this build expects window.config.servers.dicomWeb[].
window.config = {
  routerBasename: '/',
  showStudyList: true,
  // Use the legacy servers.dicomWeb array — required for OHIF 4.12.23.
  // Orthanc is reachable via the nginx reverse proxy at /orthanc/.
  servers: {
    dicomWeb: [
      {
        name: 'Orthanc',
        wadoUriRoot: '/orthanc/wado',
        qidoRoot: '/orthanc/dicom-web',
        wadoRoot: '/orthanc/dicom-web',
        qidoSupportsIncludeField: true,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
      },
    ],
  },
};
