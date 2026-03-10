const TOOLBAR_BUTTON_TYPES = {
  COMMAND: 'command',
};

const definitions = [
  {
    id: 'Admin',
    label: 'Admin',
    icon: 'cog',
    type: TOOLBAR_BUTTON_TYPES.COMMAND,
    commandName: 'openAdminPanel',
    context: 'VIEWER',
  },
];

export default {
  definitions,
  defaultContext: 'VIEWER',
};
