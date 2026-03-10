import React from 'react';
import AdminPanel from './components/AdminPanel';

export default function getCommandsModule(servicesManager) {
  const actions = {
    openAdminPanel() {
      const { UIModalService } = servicesManager.services;

      const WrappedAdminPanel = function() {
        return <AdminPanel servicesManager={servicesManager} />;
      };

      UIModalService.show({
        content: WrappedAdminPanel,
        title: 'PACS Administration',
        fullscreen: true,
        noScroll: false,
      });
    },
  };

  const definitions = {
    openAdminPanel: {
      commandFn: actions.openAdminPanel,
      storeContexts: [],
    },
  };

  return {
    actions,
    definitions,
  };
}
