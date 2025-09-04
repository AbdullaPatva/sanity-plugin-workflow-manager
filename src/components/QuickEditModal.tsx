import React, {useState, useEffect} from 'react'
import {
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Stack,
  Text,
  TextInput,
  useToast,
} from '@sanity/ui'
import {CalendarIcon, UserIcon, TrashIcon, CheckmarkIcon, LaunchIcon} from '@sanity/icons'
import {useClient, useCurrentUser} from 'sanity'
import {API_VERSION, DEFAULT_CONFIG} from '../constants'
import {useProjectUsers} from '../lib/compatibility'
import DependencyManager from './DependencyManager'
import groq from 'groq'

interface QuickEditModalProps {
  isOpen: boolean
  onClose: () => void
  document: {
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
  onSave: (updatedDocument: any) => void
}

export default function QuickEditModal({
  isOpen,
  onClose,
  document,
  onSave,
}: QuickEditModalProps) {
  const client = useClient({apiVersion: API_VERSION})
  const toast = useToast()
  const currentUser = useCurrentUser()
  const {users} = useProjectUsers({apiVersion: API_VERSION})
  
  const [title, setTitle] = useState(document.title)
  const [selectedDate, setSelectedDate] = useState<Date>(document.date)
  const [selectedTime, setSelectedTime] = useState<string>(
    document.date.toTimeString().slice(0, 5)
  )
  const [publishStatus, setPublishStatus] = useState<'scheduled' | 'published' | 'cancelled'>(
    document.status
  )
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>(document.assignees)
  const [dependencies, setDependencies] = useState<string[]>(document.dependencies || [])
  const [isLoading, setIsLoading] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Update local state when document prop changes
  useEffect(() => {
    if (document) {
      setTitle(document.title)
      setSelectedDate(document.date)
      setSelectedTime(document.date.toTimeString().slice(0, 5))
      setPublishStatus(document.status)
      setSelectedAssignees(document.assignees)
      setDependencies(document.dependencies || [])
    }
  }, [document])

  const handleSave = async () => {
    if (!title.trim()) {
      toast.push({
        title: 'Title required',
        description: 'Please enter a document title',
        status: 'error',
      })
      return
    }

    setIsLoading(true)
    try {
      // Calculate the new scheduled date
      const [hours, minutes] = selectedTime.split(':').map(Number)
      const newScheduledDate = new Date(selectedDate)
      newScheduledDate.setHours(hours, minutes, 0, 0)

      // Update the workflow metadata
      await client
        .patch(`workflow-metadata.${document.documentId}`)
        .set({
          'publishSchedule.scheduledDate': newScheduledDate.toISOString(),
          'publishSchedule.publishStatus': publishStatus,
          'publishSchedule.dependencies': dependencies,
          assignees: selectedAssignees,
        })
        .commit()

      // Update the document title if it changed
      if (title !== document.title) {
        await client
          .patch(document.documentId)
          .set({title})
          .commit()
      }

      toast.push({
        title: 'Document updated',
        description: 'Changes saved successfully',
        status: 'success',
      })

      onSave({
        ...document,
        title,
        date: newScheduledDate,
        status: publishStatus,
        assignees: selectedAssignees,
      })

      onClose()
    } catch (error) {
      console.error('Failed to update document:', error)
      toast.push({
        title: 'Update failed',
        description: 'Could not save changes',
        status: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to cancel this schedule?')) {
      return
    }

    setIsLoading(true)
    try {
      await client
        .patch(`workflow-metadata.${document.documentId}`)
        .unset(['publishSchedule'])
        .commit()

      toast.push({
        title: 'Schedule cancelled',
        description: 'Document removed from publishing schedule',
        status: 'success',
      })

      onClose()
    } catch (error) {
      console.error('Failed to cancel schedule:', error)
      toast.push({
        title: 'Cancellation failed',
        description: 'Could not cancel the schedule',
        status: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAssigneeToggle = (userId: string) => {
    setSelectedAssignees(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

    const handleNavigateToDocument = () => {
    try {
      // Navigate to the document editor using window.location
      const documentUrl = `/desk/${document.documentType};${document.documentId}`
      window.location.href = documentUrl

      // Close the modal
      onClose()

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

  const handleStateTransition = async (newState: string) => {
    setIsTransitioning(true)
    try {
      // First, find the workflow metadata document for this document
      const metadataQuery = groq`*[_type == "workflow.metadata" && documentId == $documentId][0]`
      const metadataDoc = await client.fetch(metadataQuery, { documentId: document.documentId })
      
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
        description: `Document moved to ${newState}`,
        status: 'success',
      })

      // Update the local document state
      const updatedDocument = {
        ...document,
        workflowState: newState
      }
      onSave(updatedDocument)

    } catch (error) {
      console.error('Failed to update workflow state:', error)
      toast.push({
        title: 'State update failed',
        description: 'Could not update workflow state',
        status: 'error',
      })
    } finally {
      setIsTransitioning(false)
    }
  }

  // Check if user can transition to a specific state
  const canUserTransitionToState = (targetState: any) => {
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
        currentUser && document.assignees?.length && document.assignees.includes(currentUser.id)
      : // Otherwise this isn't a problem
        true

    return userRoleCanUpdateState && userAssignmentCanUpdateState
  }

  // Get available state transitions for current state (filtered by permissions)
  const getAvailableTransitions = () => {
    const currentState = DEFAULT_CONFIG.states.find(state => state.id === document.workflowState)
    if (!currentState) return []
    
    const allTransitions = currentState.transitions.map(transitionId => 
      DEFAULT_CONFIG.states.find(state => state.id === transitionId)
    ).filter(Boolean)

    // Filter by user permissions
    return allTransitions.filter(transition => 
      canUserTransitionToState(transition)
    )
  }

  if (!isOpen) return null

  return (
    <Box
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <Card
        style={{
          width: '90%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        shadow={3}
      >
        <Box padding={4}>
          <Stack space={4}>
            {/* Header */}
            <Flex align="center" justify="space-between">
              <Flex align="center" gap={2}>
                <CalendarIcon />
                <Text size={2} weight="bold">
                  Quick Edit
                </Text>
              </Flex>
              <Button
                mode="ghost"
                text="Close"
                onClick={onClose}
                disabled={isLoading}
              />
            </Flex>

            {/* Document Info */}
            <Card tone="transparent" padding={3}>
              <Stack space={2}>
                <Text size={1} weight="medium" muted>
                  Document Type: {document.documentType}
                </Text>
                <Text size={1} weight="medium" muted>
                  Document ID: {document.documentId.slice(0, 8)}...
                </Text>
                <Text size={1} weight="medium" muted>
                  Workflow State: <span style={{textTransform: 'capitalize', color: 'var(--card-fg-color)'}}>{document.workflowState}</span>
                </Text>
              </Stack>
            </Card>

            {/* Title */}
            <Stack space={2}>
              <Text size={1} weight="medium">
                Document Title
              </Text>
              <TextInput
                value={title}
                onChange={(e) => setTitle(e.currentTarget.value)}
                placeholder="Enter document title"
                disabled={isLoading}
              />
            </Stack>

            {/* Schedule Date & Time */}
            <Grid columns={2} gap={3}>
              <Stack space={2}>
                <Text size={1} weight="medium">
                  Schedule Date
                </Text>
                <TextInput
                  type="date"
                  value={selectedDate.toISOString().split('T')[0]}
                  onChange={(e) => setSelectedDate(new Date(e.currentTarget.value))}
                  disabled={isLoading}
                />
              </Stack>
              <Stack space={2}>
                <Text size={1} weight="medium">
                  Schedule Time
                </Text>
                <TextInput
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.currentTarget.value)}
                  disabled={isLoading}
                />
              </Stack>
            </Grid>

            {/* Publishing Status */}
            <Stack space={2}>
              <Text size={1} weight="medium">
                Publishing Status
              </Text>
              <Flex gap={2}>
                {(['scheduled', 'published', 'cancelled'] as const).map((status) => (
                  <Button
                    key={status}
                    mode={publishStatus === status ? 'default' : 'ghost'}
                    text={status.charAt(0).toUpperCase() + status.slice(1)}
                    onClick={() => setPublishStatus(status)}
                    disabled={isLoading}
                  />
                ))}
              </Flex>
            </Stack>

            {/* Workflow State Transitions */}
            {getAvailableTransitions().length > 0 && (
              <Stack space={2}>
                <Text size={1} weight="medium">
                  Quick State Transitions
                </Text>
                <Text size={0} muted>
                  Current state: <span style={{textTransform: 'capitalize', fontWeight: 'medium'}}>{document.workflowState}</span>
                </Text>
                <Flex gap={2} wrap="wrap">
                  {getAvailableTransitions().map((state) => (
                    <Button
                      key={state?.id}
                      mode="ghost"
                      text={state?.title || state?.id}
                      onClick={() => handleStateTransition(state?.id || '')}
                      disabled={isLoading || isTransitioning}
                      style={{
                        border: `1px solid var(--card-border-color)`,
                        fontSize: '12px',
                        padding: '4px 8px',
                      }}
                    />
                  ))}
                </Flex>
              </Stack>
            )}

            {/* Assignees */}
            <Stack space={2}>
              <Flex align="center" gap={2}>
                <UserIcon />
                <Text size={1} weight="medium">
                  Assignees
                </Text>
              </Flex>
              <Grid columns={2} gap={2}>
                {users.map((user) => (
                  <Card
                    key={user.id}
                    tone={selectedAssignees.includes(user.id) ? 'primary' : 'transparent'}
                    padding={2}
                    style={{
                      cursor: 'pointer',
                      border: selectedAssignees.includes(user.id) 
                        ? '2px solid var(--card-border-color)' 
                        : '1px solid var(--card-border-color)',
                    }}
                    onClick={() => handleAssigneeToggle(user.id)}
                  >
                    <Flex align="center" gap={2}>
                      {selectedAssignees.includes(user.id) && (
                        <CheckmarkIcon style={{color: 'var(--card-border-color)'}} />
                      )}
                      <Text size={1}>
                        {user.displayName || user.email}
                      </Text>
                    </Flex>
                  </Card>
                ))}
              </Grid>
            </Stack>

            {/* Dependencies */}
            <DependencyManager
              documentId={document.documentId}
              currentDependencies={dependencies}
              onDependenciesChange={setDependencies}
              disabled={isLoading}
            />

            {/* Actions */}
            <Flex gap={2} justify="space-between">
              <Button
                mode="ghost"
                tone="critical"
                icon={TrashIcon}
                text="Cancel Schedule"
                onClick={handleDelete}
                disabled={isLoading}
              />
              <Flex gap={2}>
                <Button
                  mode="ghost"
                  icon={LaunchIcon}
                  text="Open in Editor"
                  onClick={handleNavigateToDocument}
                  disabled={isLoading}
                />
                <Button
                  mode="ghost"
                  text="Cancel"
                  onClick={onClose}
                  disabled={isLoading}
                />
                <Button
                  mode="default"
                  text="Save Changes"
                  onClick={handleSave}
                  disabled={isLoading}
                />
              </Flex>
            </Flex>
          </Stack>
        </Box>
      </Card>
    </Box>
  )
}