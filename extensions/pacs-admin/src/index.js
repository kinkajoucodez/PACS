import getCommandsModule from './getCommandsModule';
import toolbarModule from './toolbarModule';

/**
 * PACS Admin Extension
 *
 * Provides an administration dashboard for the PACS platform.
 * Only accessible to users with the 'admin' role.
 *
 * Features:
 * - User management (list, create, edit, deactivate)
 * - Provider onboarding wizard
 * - Radiologist verification workflow
 * - SLA configuration editor
 * - System health dashboard
 */
export default {
  id: 'pacs-admin',
  version: '1.0.0',

  getToolbarModule() {
    return toolbarModule;
  },

  getCommandsModule({ servicesManager }) {
    return getCommandsModule(servicesManager);
  },
};
