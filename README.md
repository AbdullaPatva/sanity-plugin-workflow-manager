# Sanity Plugin: Workflow Manager

A comprehensive Sanity Studio v4 plugin for managing content workflows with advanced features including drag-and-drop functionality, user assignments, publishing calendar, and state management.

## Video Tutorial
- [Workflow Manager Tutorial](https://share.cleanshot.com/V6k9r2t5rxDfnFm7tn8L)

## Screenshots
- [Workflow Manager Overview](https://share.cleanshot.com/GbTCjwh2f8xncSl2WGSS)
*Main workflow board showing drag-and-drop interface with document cards*

### Workflow Management
- [Workflow Board](https://share.cleanshot.com/6q4hyz5rbM6RKbwzNLRK)
*Visual workflow board with drag-and-drop functionality*

- [Document Cards](https://share.cleanshot.com/fbh8YYx6x3d77xfq0dz8)
*Rich document cards with metadata and user assignments*

### Publishing Calendar
- [Calendar View](https://share.cleanshot.com/spG2Y4sJS7RPwYbjYT2n)
*Publishing calendar with scheduled content and drag-and-drop scheduling*

### Quick Edit Modal
- [Quick Edit Modal](https://share.cleanshot.com/tWgrFmc5r9YxQhWlTCgf)
*Quick edit modal for rapid document editing*

### Context Menu
- [Context Menu](https://share.cleanshot.com/fSyg0DJPbry8Hh9yVMpY)
*Right-click context menu with document actions*

## Features

### Core Workflow Management
- **Visual Workflow Board**: Drag-and-drop interface for managing content through workflow states
- **Custom State Configuration**: Define custom workflow states with transitions, roles, and requirements
- **User Assignment System**: Assign users to documents for review and approval
- **State Transitions**: Control document movement between workflow states
- **Validation Integration**: Integrate with Sanity's validation system
- **Real-time Updates**: Live updates using Sanity's real-time capabilities

### Publishing Calendar
- **Calendar View**: Visual calendar interface for scheduled content
- **Drag-and-Drop Scheduling**: Drag documents to specific dates for publishing
- **Schedule Management**: Set, update, and cancel publishing schedules
- **Dependency Tracking**: Manage publishing dependencies between documents
- **Workflow State Integration**: View and manage workflow states within calendar context

### Rich Document Cards
- **Enhanced Visual Design**: Modern card layout with visual hierarchy
- **Document Type Icons**: Visual indicators for different content types
- **Status Badges**: Color-coded badges for workflow states and recent updates
- **Metadata Display**: Last modified time, word count, and other document information
- **User Assignment Display**: Visual representation of assigned users with avatars
- **Interactive Elements**: Hover effects, tooltips, and smooth animations

### Quick Edit Modal
- **Inline Editing**: Quick access to edit document details without leaving the calendar
- **Workflow State Management**: Change document states directly from the modal
- **User Assignment**: Assign or reassign users to documents
- **Dependency Management**: Add or remove publishing dependencies
- **Navigation**: Quick access to full document editor

### Context Menu
- **Right-click Actions**: Context menu for calendar events with relevant actions
- **State Transitions**: Quick state changes with permission checking
- **Document Navigation**: Direct links to edit pages
- **Schedule Management**: Unschedule or reschedule documents

### Publishing Dependencies
- **Dependency Management**: Set up "must-publish-before" relationships
- **Circular Dependency Prevention**: Validation to prevent circular dependencies
- **Visual Indicators**: Icons and UI elements showing dependency status
- **Smart Publishing**: Ensure proper content sequence and integrity

## Installation

### Prerequisites
- Sanity Studio v4
- Node.js 20 or higher
- React 18 or higher

### Install the Plugin

```bash
npm install @multidots/sanity-plugin-workflow-manager
```

### Required Dependencies

The plugin requires these peer dependencies (install if not already present):

```bash
npm install @sanity/ui @sanity/icons @hello-pangea/dnd framer-motion styled-components groq lexorank @tanstack/react-virtual
```

## Setup

### 1. Add Plugin to Sanity Config

```typescript
// sanity.config.ts
import {defineConfig} from 'sanity'
import {workflowManager} from '@multidots/sanity-plugin-workflow-manager'

export default defineConfig({
  name: 'default',
  title: 'Your Studio',
  projectId: 'your-project-id',
  dataset: 'production',
  
  plugins: [
    workflowManager({
      // Required: List of document types to include in workflow
      schemaTypes: ['post', 'article', 'product'],
      
      // Optional: Custom workflow states
      states: [
        {
          id: 'draft',
          title: 'Draft',
          color: 'primary',
          transitions: ['review']
        },
        {
          id: 'review',
          title: 'In Review',
          color: 'warning',
          transitions: ['approved', 'changes-requested'],
          requireAssignment: true
        },
        {
          id: 'approved',
          title: 'Approved',
          color: 'success',
          requireAssignment: true,
          requireValidation: true
        }
      ]
    })
  ],
  
  schema: {
    types: [
      // Your existing schemas
    ],
  },
})
```

### 2. Workflow Metadata Schema

The plugin automatically creates a `workflow.metadata` schema type that tracks:
- Document state and transitions
- User assignments
- Order ranking for drag-and-drop
- Publishing schedule information
- Publishing dependencies

### 3. Document Actions and Badges

The plugin provides several document actions and badges:
- **Begin Workflow**: Start a document in the workflow
- **Assign Workflow**: Assign users to a document
- **Update Workflow**: Move document between states
- **Complete Workflow**: Remove document from workflow
- **Schedule Workflow**: Schedule document for publishing
- **Schedule Badge**: Visual indicator of publishing status

## Usage

### Workflow Tool

1. Open your Sanity Studio
2. Navigate to the **Workflow** tool from the navigation menu on top
3. View all documents organized by workflow states
4. Drag and drop documents between states
5. Assign users to documents for review
6. Use filters to view specific users or document types

### Publishing Calendar

1. Navigate to the **Publishing Calendar** tool from the navigation menu on top
2. View scheduled content in calendar format
3. Drag documents to specific dates for scheduling
4. Click on calendar events to open Quick Edit Modal
5. Manage publishing dependencies
6. Filter by workflow states

### Rich Document Cards

Document cards display:
- Document type with appropriate icons
- Workflow state with color-coded badges
- Last modified timestamp
- Assigned users with avatars
- Action buttons for editing and state changes
- Visual indicators for validation status

### Quick Edit Modal

Access the Quick Edit Modal by:
1. Clicking on any calendar event
2. Right-clicking on a calendar event and selecting "Edit"
3. Using the context menu on document cards

Features:
- Edit document title and basic information
- Change workflow state with permission checking
- Assign or reassign users
- Manage publishing dependencies
- Navigate to full document editor

### Context Menu

Right-click on calendar events to access:
- Edit document details
- Navigate to document editor
- Change workflow state
- Unschedule document
- View dependency information

### Publishing Dependencies

Set up dependencies by:
1. Opening the Quick Edit Modal
2. Using the Dependency Manager
3. Searching for documents to depend on
4. Adding or removing dependencies

## Configuration

### Workflow States

Each workflow state supports:

```typescript
{
  id: 'state-id',                    // Unique identifier
  title: 'State Title',              // Display name
  color: 'primary',                  // Visual indicator (primary, success, warning, danger)
  roles: ['editor', 'admin'],        // User roles that can access this state
  transitions: ['next-state'],       // Allowed next states
  requireAssignment: true,           // Requires user assignment
  requireValidation: true            // Requires document validation
}
```

### Default States

If no custom states are provided:

```typescript
[
  {
    id: 'inReview',
    title: 'In review',
    color: 'primary',
    roles: ['editor', 'administrator'],
    transitions: ['changesRequested', 'approved'],
  },
  {
    id: 'changesRequested',
    title: 'Changes requested',
    color: 'warning',
    roles: ['editor', 'administrator'],
    transitions: ['approved'],
  },
  {
    id: 'approved',
    title: 'Approved',
    color: 'success',
    roles: ['administrator'],
    transitions: ['changesRequested'],
    requireAssignment: true,
  },
]
```

### Schema Types

Specify which document types should be included in the workflow:

```typescript
workflowManager({
  schemaTypes: ['post', 'article', 'product', 'page']
})
```

## Architecture

### Core Components

- **WorkflowTool**: Main workflow board interface
- **CalendarView**: Publishing calendar interface
- **DocumentCard**: Enhanced document display with rich metadata
- **DocumentList**: List of documents in a workflow state
- **QuickEditModal**: Inline editing modal for calendar events
- **ContextMenu**: Right-click context menu for calendar events
- **DependencyManager**: Publishing dependency management
- **UserDisplay**: User assignment interface with avatars
- **Filters**: Filter by user and schema type

### Hooks and Utilities

- **useWorkflowDocuments**: Fetch and manage workflow documents
- **useWorkflowMetadata**: Access workflow metadata
- **useWorkflowContext**: Workflow context provider
- **useProjectUsers**: Fetch project users for assignment
- **useListeningQuery**: Real-time data subscription
- **filterItemsAndSort**: Document filtering and sorting

### Data Types

- **State**: Workflow state definition
- **UserExtended**: Extended user information
- **SanityDocumentWithMetadata**: Document with workflow metadata
- **CalendarEvent**: Calendar event with workflow information
- **WorkflowConfig**: Plugin configuration type

## Advanced Features

### Real-time Updates
- Live updates when documents change state
- Real-time user assignment updates
- Calendar updates when schedules change
- Optimistic UI updates for better user experience

### Permission System
- Role-based access control
- Assignment-based permissions
- State transition validation
- User role checking for actions

### Drag and Drop
- LexoRank-based ordering system
- Conflict resolution for concurrent edits
- Visual feedback during drag operations
- Smooth animations and transitions

### Validation Integration
- Document validation before state transitions
- Visual validation status indicators
- Error handling and user feedback
- Integration with Sanity's validation system

## Troubleshooting

### Common Issues

1. **Documents not appearing in workflow**
   - Ensure documents are added to workflow using "Begin Workflow" action
   - Check that document types are included in plugin configuration

2. **Drag and drop not working**
   - Verify @hello-pangea/dnd is installed
   - Check browser console for JavaScript errors

3. **User assignment issues**
   - Ensure users have proper roles and permissions
   - Check that user data is loading correctly

4. **Calendar not showing documents**
   - Verify documents have been scheduled
   - Check GROQ query for data fetching issues

5. **Theme-related errors**
   - Plugin uses optional chaining for theme access
   - Fallback colors are provided for missing theme properties

### Debug Steps

1. Check browser console for error messages
2. Verify all required dependencies are installed
3. Ensure Sanity Studio v4 compatibility
4. Check plugin configuration in sanity.config.ts
5. Verify document types are properly configured

## Development

### Building

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

### TypeScript

The plugin is built with TypeScript and includes comprehensive type definitions for all components and utilities.

## Contributing

This plugin is designed to be extensible. Key areas for customization:

- Workflow state definitions and transitions
- User assignment logic and permissions
- Validation requirements and rules
- UI components and styling
- Calendar view customization
- Dependency management logic

## License

MIT

## Support

For issues and questions:

1. Check the configuration examples above
2. Verify your Sanity v4 setup and dependencies
3. Ensure all required peer dependencies are installed
4. Check browser console for error messages
5. Review the troubleshooting section above

## Changelog

### Latest Version
- Rich Document Cards with enhanced visual design
- Publishing Calendar with drag-and-drop scheduling
- Quick Edit Modal for inline document editing
- Context Menu for calendar events
- Publishing Dependencies management
- Enhanced user assignment with avatars
- Improved error handling and validation
- Real-time updates and optimistic UI
- Comprehensive TypeScript support