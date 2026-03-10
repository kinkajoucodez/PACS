const TOOLBAR_BUTTON_TYPES = {
  COMMAND: 'command',
};

const definitions = [
  {
    id: 'Worklist',
    label: 'Worklist',
    icon: 'th-list',
    type: TOOLBAR_BUTTON_TYPES.COMMAND,
    commandName: 'openWorklist',
    context: 'VIEWER',
  },
];

export default {
  definitions,
  defaultContext: 'VIEWER',
};
