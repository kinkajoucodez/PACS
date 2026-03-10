import getCommandsModule from './getCommandsModule';
import toolbarModule from './toolbarModule';

/**
 * Reporting Extension
 *
 * Provides a radiology report editor panel for creating and managing reports.
 * Features:
 * - In-viewer report editor with rich text support
 * - Template selection by modality
 * - Auto-save draft functionality
 * - Finalize workflow (draft → preliminary → final)
 * - Report history and addenda management
 * - Voice dictation support (Web Speech API)
 */
export default {
  /**
   * Only required property. Should be a unique value across all extensions.
   */
  id: 'reporting',

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
