import {definePlugin, DocumentActionProps, isObjectInputProps} from 'sanity'

import {AssignWorkflow} from './actions/AssignWorkflow'
import {BeginWorkflow} from './actions/BeginWorkflow'
import {CompleteWorkflow} from './actions/CompleteWorkflow'
import {ScheduleWorkflow} from './actions/ScheduleWorkflow'
import {UpdateWorkflow} from './actions/UpdateWorkflow'
import {AssigneesBadge} from './badges/AssigneesBadge'
import {ScheduleBadge} from './badges/ScheduleBadge'
import {StateBadge} from './badges/StateBadge'
import {WorkflowProvider} from './components/WorkflowContext'
import WorkflowSignal from './components/WorkflowSignal'
import {DEFAULT_CONFIG} from './constants'
import metadata from './schema/workflow/workflow.metadata'
import {workflowTool, calendarTool} from './tools'
import {WorkflowConfig} from './types'

export const workflowManager = definePlugin<WorkflowConfig>(
  (config = DEFAULT_CONFIG) => {
    const {schemaTypes, states} = {...DEFAULT_CONFIG, ...config}

    if (!states?.length) {
      throw new Error(`Workflow plugin: Missing "states" in config`)
    }

    if (!schemaTypes?.length) {
      throw new Error(`Workflow plugin: Missing "schemaTypes" in config`)
    }

    return {
      name: 'sanity-plugin-workflow-manager',
      schema: {
        types: [metadata(states)],
      },
      studio: {
        components: {
          layout: (props) =>
            WorkflowProvider({...props, workflow: {schemaTypes, states}}),
        },
      },
      form: {
        components: {
          input: (props) => {
            if (
              props.id === `root` &&
              isObjectInputProps(props) &&
              schemaTypes.includes(props.schemaType.name)
            ) {
              return WorkflowSignal(props)
            }

            return props.renderDefault(props)
          },
        },
      },
      document: {
        actions: (prev, context) => {
          if (!schemaTypes.includes(context.schemaType)) {
            return prev
          }

          return [
            (props) => BeginWorkflow(props),
            (props) => AssignWorkflow(props),
            (props) => ScheduleWorkflow(props),
            ...states.map(
              (state) => (props: DocumentActionProps) =>
                UpdateWorkflow(props, state)
            ),
            (props) => CompleteWorkflow(props),
            ...prev,
          ]
        },
        badges: (prev, context) => {
          if (!schemaTypes.includes(context.schemaType)) {
            return prev
          }

          const {documentId, currentUser} = context

          if (!documentId) {
            return prev
          }

          return [
            () => StateBadge(documentId),
            () => AssigneesBadge(documentId, currentUser),
            () => ScheduleBadge(documentId),
            ...prev,
          ]
        },
      },
      tools: [
        workflowTool({schemaTypes, states}),
        calendarTool({schemaTypes, states}),
      ],
    }
  }
)

export default workflowManager

// Export the workflow tool configuration for standalone use
export {workflowTool, calendarTool} from './tools'

// Export types and utilities
export * from './types'
export * from './constants' 