# Reporting Extension

OHIF extension for radiology report editing and management.

## Features

- **Report Editor Panel** - Full-featured report editor in the viewer
- **Template System** - Pre-defined report templates by modality
- **Auto-Save** - Automatic draft saving with debouncing
- **Finalize Workflow** - Draft → Preliminary → Final status transitions
- **Report History** - View previous reports and addenda
- **Voice Dictation** - Web Speech API integration (coming soon)

## Usage

The extension adds a "Report" button to the viewer toolbar. Clicking it opens the report editor panel where radiologists can:

1. Create a new report for the current study
2. Select a template to populate default findings
3. Edit findings, impression, and conclusion
4. Save as draft (auto-saves every 30 seconds)
5. Finalize as preliminary or final report
6. View report history and create addenda

## Installation

This extension is included by default in the PACS Platform viewer.

## API Integration

The extension communicates with the backend API through the `pacsApiService`:

- `createReport()` - Create new draft report
- `updateReport()` - Save draft changes
- `finalizeReport()` - Finalize to preliminary/final
- `createReportAddendum()` - Add addendum to finalized report
- `getMyReports()` - List radiologist's reports
