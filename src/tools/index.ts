import {SplitVerticalIcon, CalendarIcon} from '@sanity/icons'
import {Tool} from 'sanity'
import React from 'react'

import WorkflowTool from '../components/WorkflowTool'
import CalendarView from '../components/CalendarView'
import {WorkflowConfig} from '../types'

export type WorkflowToolConfig = (options: WorkflowConfig) => Tool

export const workflowTool: WorkflowToolConfig = (options: WorkflowConfig) => ({
  name: 'workflow-manager',
  title: 'Workflow',
  component: WorkflowTool,
  icon: SplitVerticalIcon,
  options,
})

export const calendarTool: WorkflowToolConfig = (options: WorkflowConfig) => ({
  name: 'calendar',
  title: 'Publishing Calendar',
  component: () => React.createElement(CalendarView, {schemaTypes: options.schemaTypes}),
  icon: CalendarIcon,
  options,
})
