# Worklist Extension

OHIF extension for radiologist worklist management in the PACS-EMR platform.

## Features

- **Study List** - View all studies assigned to the current radiologist
- **SLA Timers** - Visual countdown indicators for SLA deadlines
- **Priority Indicators** - Color-coded STAT, Urgent, Routine, and Follow-up priorities
- **Status Tracking** - Real-time study status display
- **Filtering** - Filter by modality, priority, status, or search terms
- **Sorting** - Click column headers to sort by any field
- **Actions** - Accept, Release, Flag as STAT, and View Study buttons
- **Pagination** - Navigate through large worklists
- **Auto-Refresh** - Automatically refreshes every 60 seconds

## Installation

This extension is included in the PACS-EMR platform. No additional installation is required.

## Usage

1. Log in to the OHIF Viewer as a radiologist
2. Click the "Worklist" button in the toolbar
3. View your assigned studies in the panel
4. Use filters to find specific studies
5. Click actions to manage study assignments

## API Integration

The extension uses the following backend API endpoints:

- `GET /api/studies/worklist` - Fetch radiologist's worklist
- `POST /api/studies/{id}/assign` - Accept a study assignment
- `POST /api/studies/{id}/release` - Release a study assignment
- `POST /api/studies/{id}/flag-stat` - Flag a study as STAT priority

## Development

```bash
# Build the extension
cd extensions/worklist
yarn build

# Development mode with watch
yarn dev
```

## SLA Status Colors

| Status | Color | Condition |
|--------|-------|-----------|
| On Track | Green | > 1 hour remaining |
| Warning | Yellow | 30 min - 1 hour remaining |
| Critical | Orange | < 30 minutes remaining |
| Overdue | Red | Past deadline |

## Priority Levels

| Priority | Color | Description |
|----------|-------|-------------|
| STAT | Red | Immediate attention required |
| Urgent | Orange | High priority |
| Routine | Green | Standard priority |
| Follow-up | Gray | Low priority follow-up |

## License

MIT
