import React from 'react';
import WorklistPanel from './components/WorklistPanel';

export default function getCommandsModule(servicesManager) {
  const actions = {
    openWorklist() {
      const { UIModalService } = servicesManager.services;

      const WrappedWorklistPanel = function() {
        return <WorklistPanel servicesManager={servicesManager} />;
      };

      UIModalService.show({
        content: WrappedWorklistPanel,
        title: 'Radiologist Worklist',
        fullscreen: true,
        noScroll: false,
      });
    },
  };

  const definitions = {
    openWorklist: {
      commandFn: actions.openWorklist,
      storeContexts: ['servers', 'viewports'],
    },
  };

  return {
    actions,
    definitions,
  };
}
