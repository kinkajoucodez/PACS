import getCommandsModule from './getCommandsModule';
import toolbarModule from './toolbarModule';

/**
 * Worklist Extension
 * 
 * Provides a radiologist worklist panel for managing assigned studies.
 * Features:
 * - View studies assigned to current radiologist
 * - SLA countdown timers with visual indicators
 * - STAT/urgent priority highlighting
 * - Filter by modality, priority, status
 * - Actions: Accept, Release, Flag as STAT, View Study
 */
export default {
  /**
   * Only required property. Should be a unique value across all extensions.
   */
  id: 'worklist',

  /**
   * Module version
   */
  version: '1.0.0',

  /**
   * Returns the toolbar module with button definitions
   */
  getToolbarModule() {
    return toolbarModule;
  },

  /**
   * Returns the commands module with action handlers
   */
  getCommandsModule({ servicesManager }) {
    return getCommandsModule(servicesManager);
  },
};
