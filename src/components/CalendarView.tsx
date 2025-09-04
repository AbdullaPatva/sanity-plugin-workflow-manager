import React from 'react'
import {
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Spinner,
  Text,
  useTheme,
  useToast,
} from '@sanity/ui'
import {ChevronLeftIcon, ChevronRightIcon, CalendarIcon, LinkIcon} from '@sanity/icons'
import {useClient, useCurrentUser} from 'sanity'
import {useListeningQuery} from '../lib/compatibility'
import {API_VERSION, DEFAULT_CONFIG} from '../constants'
import {SanityDocumentWithMetadata} from '../types'
import QuickEditModal from './QuickEditModal'
import ContextMenu, {createCalendarEventActions} from './ContextMenu'
import groq from 'groq'

type CalendarViewProps = {
  schemaTypes: string[]
}

type CalendarEvent = {
  id: string
  title: string
  date: Date
  status: 'scheduled' | 'published' | 'cancelled'
  documentId: string
  documentType: string
  assignees: string[]
  workflowState: string
  dependencies: string[]
}

type ViewMode = 'month' | 'week' | 'day'

export default function CalendarView({schemaTypes}: CalendarViewProps) {
  const client = useClient({apiVersion: API_VERSION})
  const theme = useTheme()
  const toast = useToast()
  const currentUser = useCurrentUser()
  const [currentDate, setCurrentDate] = React.useState(new Date())
  const [viewMode, setViewMode] = React.useState<ViewMode>('month')
  const [draggedEvent, setDraggedEvent] = React.useState<CalendarEvent | null>(null)
  const [selectedEvent, setSelectedEvent] = React.useState<CalendarEvent | null>(null)
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [selectedWorkflowStates, setSelectedWorkflowStates] = React.useState<string[]>([])
  const [contextMenu, setContextMenu] = React.useState<{
    isOpen: boolean
    position: { x: number; y: number }
    event: CalendarEvent | null
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    event: null,
  })

  // Query for documents with publishing schedules - includes workflow state
  const query = groq`*[_type == "workflow.metadata" && defined(publishSchedule.scheduledDate)] {
    _rev,
    assignees,
    documentId,
    state,
    orderRank,
    publishSchedule,
    "document": *[_id == ^.documentId || _id == "drafts." + ^.documentId]|order(_updatedAt)[0]{ 
      _id, 
      _type, 
      title
    }
  } | order(publishSchedule.scheduledDate)`

  const {data: scheduledDocuments, loading, error} = useListeningQuery<
    SanityDocumentWithMetadata[]
  >(query, {
    params: {schemaTypes},
    initialValue: [],
  })



  // Convert documents to calendar events
  const events: CalendarEvent[] = React.useMemo(() => {
    if (!Array.isArray(scheduledDocuments)) return []
    
    const filteredDocs = scheduledDocuments.filter(doc => {
      const hasSchedule = doc.publishSchedule?.scheduledDate
      const matchesWorkflowState = selectedWorkflowStates.length === 0 || (doc.state && selectedWorkflowStates.includes(doc.state))
      return hasSchedule && matchesWorkflowState
    })
    
    return filteredDocs.map(doc => {
      const title = doc.document?.title || `${doc.document?._type || 'Document'}`
      
      return {
        id: doc.documentId || doc._id,
        title: title,
        date: new Date(doc.publishSchedule!.scheduledDate),
        status: doc.publishSchedule!.publishStatus || 'scheduled',
        documentId: doc.documentId || doc._id,
        documentType: doc.document?._type || 'unknown',
        assignees: doc.assignees || [],
        workflowState: doc.state || 'draft',
        dependencies: doc.publishSchedule?.dependencies || [],
      }
    })
  }, [scheduledDocuments, selectedWorkflowStates])

  const handleDateChange = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    
    switch (viewMode) {
      case 'month':
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
        break
      case 'week':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
        break
      case 'day':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1))
        break
    }
    
    setCurrentDate(newDate)
  }

  const handleReschedule = async (eventId: string, newDate: Date) => {
    try {
      await client
        .patch(`workflow-metadata.${eventId}`)
        .set({
          'publishSchedule.scheduledDate': newDate.toISOString(),
        })
        .commit()
      
      toast.push({
        title: 'Event rescheduled',
        description: `Moved to ${newDate.toLocaleDateString()}`,
        status: 'success',
      })
    } catch (error) {
      console.error('Failed to reschedule:', error)
      toast.push({
        title: 'Failed to reschedule',
        description: 'Could not update the publishing schedule',
        status: 'error',
      })
    }
  }

  const handleDragStart = (event: CalendarEvent) => {
    setDraggedEvent(event)
  }

  const handleDragEnd = () => {
    setDraggedEvent(null)
  }

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedEvent(null)
  }

  const handleModalSave = (updatedEvent: CalendarEvent) => {
    // The real-time subscription will automatically update the calendar
    // when the document is updated in Sanity
    setSelectedEvent(updatedEvent)
  }

  const handleContextMenu = (event: React.MouseEvent, calendarEvent: CalendarEvent) => {
    event.preventDefault()
    event.stopPropagation()
    
    setContextMenu({
      isOpen: true,
      position: { x: event.clientX, y: event.clientY },
      event: calendarEvent,
    })
  }

  const handleContextMenuClose = () => {
    setContextMenu({
      isOpen: false,
      position: { x: 0, y: 0 },
      event: null,
    })
  }

  const handleContextMenuEdit = () => {
    if (contextMenu.event) {
      setSelectedEvent(contextMenu.event)
      setIsModalOpen(true)
    }
  }

  const handleContextMenuNavigate = () => {
    if (contextMenu.event) {
      try {
        // Navigate to the document editor using window.location
        const documentUrl = `/desk/${contextMenu.event.documentType};${contextMenu.event.documentId}`
        window.location.href = documentUrl

        toast.push({
          title: 'Navigating to document',
          description: 'Opening document editor',
          status: 'info',
        })
      } catch (error) {
        console.error('Failed to navigate to document:', error)
        toast.push({
          title: 'Navigation failed',
          description: 'Could not open the document editor',
          status: 'error',
        })
      }
    }
  }

  const handleContextMenuUnschedule = async () => {
    if (!contextMenu.event) return

    try {
      // Find the workflow metadata document
      const metadataQuery = groq`*[_type == "workflow.metadata" && documentId == $documentId][0]`
      const metadataDoc = await client.fetch(metadataQuery, { documentId: contextMenu.event.documentId })
      
      if (!metadataDoc) {
        throw new Error('Workflow metadata not found for this document')
      }

      // Remove the publish schedule
      await client
        .patch(metadataDoc._id)
        .unset(['publishSchedule'])
        .commit()

      toast.push({
        title: 'Document unscheduled',
        description: `${contextMenu.event.title} removed from calendar`,
        status: 'success',
      })

    } catch (error) {
      console.error('Failed to unschedule document:', error)
      toast.push({
        title: 'Unschedule failed',
        description: 'Could not remove document from calendar',
        status: 'error',
      })
    }
  }

  const getWorkflowStateColor = (state: string) => {
    const stateColors: Record<string, string> = {
      'draft': '#6b7280', // gray
      'inReview': '#f59e0b', // amber
      'changesRequested': '#ef4444', // red
      'approved': '#10b981', // emerald
      'published': '#3b82f6', // blue
    }
    return stateColors[state] || '#6b7280'
  }

  const getWorkflowStateTone = (state: string) => {
    const stateTones: Record<string, 'default' | 'primary' | 'positive' | 'caution' | 'critical'> = {
      'draft': 'default',
      'inReview': 'caution',
      'changesRequested': 'critical',
      'approved': 'positive',
      'published': 'primary',
    }
    return stateTones[state] || 'default'
  }

  const availableWorkflowStates = React.useMemo(() => {
    const states = new Set<string>()
    scheduledDocuments?.forEach(doc => {
      if (doc.state) {
        states.add(doc.state)
      }
    })
    return Array.from(states).sort()
  }, [scheduledDocuments])

  const handleWorkflowStateToggle = (state: string) => {
    setSelectedWorkflowStates(prev => 
      prev.includes(state)
        ? prev.filter(s => s !== state)
        : [...prev, state]
    )
  }

  const handleQuickStateTransition = async (event: CalendarEvent, newState: string) => {
    try {
      // First, find the workflow metadata document for this document
      const metadataQuery = groq`*[_type == "workflow.metadata" && documentId == $documentId][0]`
      const metadataDoc = await client.fetch(metadataQuery, { documentId: event.documentId })
      
      if (!metadataDoc) {
        throw new Error('Workflow metadata not found for this document')
      }

      // Update the workflow state in the metadata document using its actual _id
      await client
        .patch(metadataDoc._id)
        .set({state: newState})
        .commit()

      toast.push({
        title: 'State updated',
        description: `${event.title} moved to ${newState}`,
        status: 'success',
      })

    } catch (error) {
      console.error('Failed to update workflow state:', error)
      toast.push({
        title: 'State update failed',
        description: 'Could not update workflow state',
        status: 'error',
      })
    }
  }

  // Get available state transitions for an event
  const getAvailableTransitionsForEvent = (event: CalendarEvent) => {
    const currentState = DEFAULT_CONFIG.states.find(state => state.id === event.workflowState)
    if (!currentState) return []
    
    return currentState.transitions.map(transitionId => 
      DEFAULT_CONFIG.states.find(state => state.id === transitionId)
    ).filter(Boolean)
  }

  // Check if user can transition to a specific state
  const canUserTransitionToState = (event: CalendarEvent, targetState: any) => {
    if (!currentUser || !targetState) return false

    // Check role permissions
    const userRoleCanUpdateState = 
      currentUser.roles?.length && targetState.roles?.length
        ? // If the target state is limited to specific roles, check that the current user has one of those roles
          currentUser.roles.some(userRole => targetState.roles.includes(userRole.name))
        : // No roles specified on the target state, so anyone can update
          targetState.roles?.length !== 0

    // Check assignment requirements
    const userAssignmentCanUpdateState = targetState.requireAssignment
      ? // If the target state requires assigned users, check the current user ID is in the assignees array
        currentUser && event.assignees?.length && event.assignees.includes(currentUser.id)
      : // Otherwise this isn't a problem
        true

    return userRoleCanUpdateState && userAssignmentCanUpdateState
  }

  // Get available transitions filtered by user permissions
  const getAvailableTransitionsForEventWithPermissions = (event: CalendarEvent) => {
    const availableTransitions = getAvailableTransitionsForEvent(event)
    return availableTransitions.filter(transition => 
      canUserTransitionToState(event, transition)
    )
  }

  const handleDrop = (targetDate: Date) => {
    if (draggedEvent) {
      // Create a new date object to avoid mutation
      const newDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
      newDate.setHours(draggedEvent.date.getHours())
      newDate.setMinutes(draggedEvent.date.getMinutes())
      newDate.setSeconds(0)
      newDate.setMilliseconds(0)
      handleReschedule(draggedEvent.documentId, newDate)
      setDraggedEvent(null)
    }
  }

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.date)
      return (
        eventDate.getFullYear() === date.getFullYear() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getDate() === date.getDate()
      )
    })
  }

  const renderMonthView = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay())
    
    const days = []
    
    for (let i = 0; i < 42; i++) {
      // Create a new date for each iteration to avoid mutation
      const currentDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i)
      const dayEvents = getEventsForDate(currentDay)
      const isCurrentMonth = currentDay.getMonth() === month
      const isToday = currentDay.toDateString() === new Date().toDateString()
      
      days.push(
        <Card
          key={i}
          tone={isCurrentMonth ? 'default' : 'transparent'}
          style={{
            minHeight: '120px',
            border: isToday ? `2px solid ${(theme as any)?.sanity?.color?.primary?.base?.bg || '#0070f3'}` : undefined,
            backgroundColor: draggedEvent ? `${(theme as any)?.sanity?.color?.primary?.base?.bg || '#0070f3'}20` : undefined,
          }}
          onDragOver={(e) => {
            e.preventDefault()
          }}
          onDrop={(e) => {
            e.preventDefault()
            if (isCurrentMonth) {
              handleDrop(currentDay)
            }
          }}
        >
          <Box padding={2}>
            <Text size={1} weight={isToday ? 'bold' : 'normal' as any}>
              {currentDay.getDate()}
            </Text>
            {dayEvents.map(event => {
              const availableTransitions = getAvailableTransitionsForEventWithPermissions(event)
              return (
                <Card
                  key={event.id}
                  tone={getWorkflowStateTone(event.workflowState)}
                  marginTop={1}
                  padding={1}
                  style={{
                    cursor: draggedEvent?.id === event.id ? 'grabbing' : 'pointer',
                    opacity: draggedEvent?.id === event.id ? 0.5 : 1,
                    borderLeft: `3px solid ${getWorkflowStateColor(event.workflowState)}`,
                  }}
                  draggable
                  onDragStart={() => handleDragStart(event)}
                  onDragEnd={handleDragEnd}
                  onClick={() => handleEventClick(event)}
                  onContextMenu={(e) => handleContextMenu(e, event)}
                >
                  <Flex align="center" gap={1}>
                    <Text size={0} style={{fontSize: '11px'}}>
                      {event.title}
                    </Text>
                    {event.dependencies.length > 0 && (
                      <LinkIcon style={{fontSize: '8px', opacity: 0.7}} />
                    )}
                  </Flex>
                  <Flex justify="space-between" align="center">
                    <Text size={0} style={{fontSize: '9px', opacity: 0.7, textTransform: 'capitalize'}}>
                      {event.workflowState}
                    </Text>
                    {availableTransitions.length > 0 && (
                      <Button
                        mode="ghost"
                        text="→"
                        onClick={(e) => {
                          e.stopPropagation()
                          const nextState = availableTransitions[0]
                          if (nextState) {
                            handleQuickStateTransition(event, nextState.id)
                          }
                        }}
                        style={{
                          fontSize: '8px',
                          padding: '1px 3px',
                          minWidth: 'auto',
                          height: 'auto',
                        }}
                      />
                    )}
                  </Flex>
                </Card>
              )
            })}
          </Box>
        </Card>
      )
    }
    
    return (
      <Grid columns={7} gap={1}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <Box key={day} padding={2}>
            <Text size={1} weight="bold" align="center">
              {day}
            </Text>
          </Box>
        ))}
        {days}
      </Grid>
    )
  }

  const renderWeekView = () => {
    const startOfWeek = new Date(currentDate)
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
    
    const days = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek)
      day.setDate(day.getDate() + i)
      const dayEvents = getEventsForDate(day)
      const isToday = day.toDateString() === new Date().toDateString()
      
      days.push(
        <Card
          key={i}
          tone="default"
          style={{
            minHeight: '200px',
            border: isToday ? `2px solid ${(theme as any)?.sanity?.color?.primary?.base?.bg || '#0070f3'}` : undefined,
            backgroundColor: draggedEvent ? `${(theme as any)?.sanity?.color?.primary?.base?.bg || '#0070f3'}20` : undefined,
          }}
          onDragOver={(e) => {
            e.preventDefault()
          }}
          onDrop={(e) => {
            e.preventDefault()
            handleDrop(day)
          }}
        >
          <Box padding={3}>
            <Text size={1} weight={isToday ? 'bold' : 'normal' as any}>
              {day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
            {dayEvents.map(event => (
              <Card
                key={event.id}
                tone={getWorkflowStateTone(event.workflowState)}
                marginTop={2}
                padding={2}
                style={{
                  cursor: draggedEvent?.id === event.id ? 'grabbing' : 'pointer',
                  opacity: draggedEvent?.id === event.id ? 0.5 : 1,
                  borderLeft: `3px solid ${getWorkflowStateColor(event.workflowState)}`,
                }}
                draggable
                onDragStart={() => handleDragStart(event)}
                onDragEnd={handleDragEnd}
                onClick={() => handleEventClick(event)}
                onContextMenu={(e) => handleContextMenu(e, event)}
              >
                <Flex align="center" gap={1}>
                  <Text size={1}>{event.title}</Text>
                  {event.dependencies.length > 0 && (
                    <LinkIcon style={{fontSize: '10px', opacity: 0.7}} />
                  )}
                </Flex>
                <Text size={0} muted>
                  {event.date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Text size={0} style={{textTransform: 'capitalize', opacity: 0.7}}>
                  {event.workflowState}
                </Text>
              </Card>
            ))}
          </Box>
        </Card>
      )
    }
    
    return <Grid columns={7} gap={2}>{days}</Grid>
  }

  const renderDayView = () => {
    const dayEvents = getEventsForDate(currentDate)
    const isToday = currentDate.toDateString() === new Date().toDateString()
    
    return (
      <Card
        tone="default"
        style={{
          border: isToday ? `2px solid ${(theme as any)?.sanity?.color?.primary?.base?.bg || '#0070f3'}` : undefined,
        }}
      >
        <Box padding={4}>
                  <Text size={2} weight="bold" style={{marginBottom: '12px'}}>
          {currentDate.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </Text>
          {dayEvents.length === 0 ? (
            <Text muted>No scheduled content for this day</Text>
          ) : (
            dayEvents.map(event => (
              <Card
                key={event.id}
                tone={getWorkflowStateTone(event.workflowState)}
                marginBottom={2}
                padding={3}
                style={{
                  cursor: 'pointer',
                  borderLeft: `3px solid ${getWorkflowStateColor(event.workflowState)}`,
                }}
                onClick={() => handleEventClick(event)}
                onContextMenu={(e) => handleContextMenu(e, event)}
              >
                <Flex justify="space-between" align="center">
                  <Box>
                    <Flex align="center" gap={1}>
                      <Text size={1} weight="medium">{event.title}</Text>
                      {event.dependencies.length > 0 && (
                        <LinkIcon style={{fontSize: '12px', opacity: 0.7}} />
                      )}
                    </Flex>
                    <Text size={0} muted>
                      {event.date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <Text size={0} style={{textTransform: 'capitalize', opacity: 0.7}}>
                      {event.workflowState}
                    </Text>
                  </Box>
                  <Text size={0} style={{textTransform: 'capitalize'}}>
                    {event.status}
                  </Text>
                </Flex>
              </Card>
            ))
          )}
        </Box>
      </Card>
    )
  }

  if (loading) {
    return (
      <Flex align="center" justify="center" padding={5}>
        <Spinner muted />
      </Flex>
    )
  }

  if (error) {
    return (
      <Card tone="critical" padding={4}>
        <Text>Error loading calendar: {String(error)}</Text>
      </Card>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Flex align="center" justify="space-between" padding={3} style={{borderBottom: '1px solid var(--card-border-color)'}}>
        <Flex align="center" gap={3}>
          <CalendarIcon />
          <Text size={2} weight="bold">Publishing Calendar</Text>
          
          {/* Workflow State Filter */}
          {availableWorkflowStates.length > 0 && (
            <Flex gap={1} align="center">
              <Text size={1} muted>Filter:</Text>
              {availableWorkflowStates.map(state => (
                <Button
                  key={state}
                  mode={selectedWorkflowStates.includes(state) ? 'default' : 'ghost'}
                  text={state.charAt(0).toUpperCase() + state.slice(1)}
                  onClick={() => handleWorkflowStateToggle(state)}
                  style={{
                    fontSize: '11px',
                    padding: '2px 6px',
                    backgroundColor: selectedWorkflowStates.includes(state) 
                      ? getWorkflowStateColor(state) 
                      : undefined,
                    color: selectedWorkflowStates.includes(state) ? 'white' : undefined,
                  }}
                />
              ))}
              {selectedWorkflowStates.length > 0 && (
                <Button
                  mode="ghost"
                  text="Clear"
                  onClick={() => setSelectedWorkflowStates([])}
                  style={{fontSize: '11px', padding: '2px 6px'}}
                />
              )}
            </Flex>
          )}
        </Flex>
        
        <Flex align="center" gap={2}>
          {/* View Mode Toggle */}
          <Flex gap={1}>
            {(['month', 'week', 'day'] as ViewMode[]).map(mode => (
              <Button
                key={mode}
                mode={viewMode === mode ? 'default' : 'ghost'}
                text={mode.charAt(0).toUpperCase() + mode.slice(1)}
                onClick={() => setViewMode(mode)}
              />
            ))}
          </Flex>
          
          {/* Date Navigation */}
          <Flex align="center" gap={2}>
            <Button
              icon={ChevronLeftIcon}
              mode="ghost"
              onClick={() => handleDateChange('prev')}
            />
            <Text size={1} weight="medium">
              {viewMode === 'month' && currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              {viewMode === 'week' && `Week of ${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
              {viewMode === 'day' && currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>
            <Button
              icon={ChevronRightIcon}
              mode="ghost"
              onClick={() => handleDateChange('next')}
            />
          </Flex>
        </Flex>
      </Flex>

      {/* Calendar Content */}
      <Box padding={3}>
        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'day' && renderDayView()}
      </Box>

      {/* Quick Edit Modal */}
      {selectedEvent && (
        <QuickEditModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          document={selectedEvent}
          onSave={handleModalSave}
        />
      )}

      {/* Context Menu */}
      <ContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        actions={contextMenu.event ? createCalendarEventActions(
          contextMenu.event,
          {
            onEdit: handleContextMenuEdit,
            onNavigate: handleContextMenuNavigate,
            onStateTransition: (newState: string) => handleQuickStateTransition(contextMenu.event!, newState),
            onUnschedule: handleContextMenuUnschedule,
            availableTransitions: getAvailableTransitionsForEventWithPermissions(contextMenu.event),
          }
        ) : []}
        onClose={handleContextMenuClose}
      />
    </Box>
  )
}