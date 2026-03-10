const TOOLBAR_BUTTON_TYPES = {
  COMMAND: 'command',
};

const definitions = [
  {
    id: 'Report',
    label: 'Report',
    icon: 'clipboard',
    type: TOOLBAR_BUTTON_TYPES.COMMAND,
    commandName: 'openReportEditor',
    context: 'VIEWER',
  },
];

export default {
  definitions,
  defaultContext: 'VIEWER',
};
