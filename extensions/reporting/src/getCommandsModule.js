import React from 'react';
import ReportEditorPanel from './components/ReportEditorPanel';

export default function getCommandsModule(servicesManager) {
  const actions = {
    openReportEditor() {
      const { UIModalService } = servicesManager.services;

      const WrappedReportEditorPanel = function() {
        return <ReportEditorPanel servicesManager={servicesManager} />;
      };

      UIModalService.show({
        content: WrappedReportEditorPanel,
        title: 'Report Editor',
        fullscreen: true,
        noScroll: false,
      });
    },
  };

  const definitions = {
    openReportEditor: {
      commandFn: actions.openReportEditor,
      storeContexts: ['servers', 'viewports'],
    },
  };

  return {
    actions,
    definitions,
  };
}
