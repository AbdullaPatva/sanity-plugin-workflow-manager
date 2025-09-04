/* eslint-disable react/prop-types */
import {
  DragHandleIcon,
  ClockIcon,
  DocumentIcon,
  ImageIcon,
  VideoIcon,
  CodeIcon,
  CalendarIcon,
  UserIcon,
  CheckmarkIcon,
  ErrorOutlineIcon,
  WarningOutlineIcon,
} from '@sanity/icons'
import {
  Box,
  Card,
  CardTone,
  Flex,
  Stack,
  Text,
  Badge,
  Avatar,
  Tooltip,
  useTheme,
} from '@sanity/ui'
import {useCallback, useEffect, useMemo, useState} from 'react'
import {
  SchemaType,
  useSchema,
} from 'sanity'
import {Preview} from 'sanity'

import {SanityDocumentWithMetadata, State} from '../../types'
import {UserExtended} from '../../lib/compatibility'
import UserDisplay from '../UserDisplay'
import CompleteButton from './CompleteButton'
import {DraftStatus} from './core/DraftStatus'
import {PublishedStatus} from './core/PublishedStatus'
import EditButton from './EditButton'
import Validate from './Validate'
import {ValidationStatus} from './ValidationStatus'

type ValidationStatusType = {
  isValidating: boolean
  validation: any[]
}

// Helper function to get document type icon
const getDocumentTypeIcon = (type: string) => {
  const iconMap: {[key: string]: any} = {
    post: DocumentIcon,
    article: DocumentIcon,
    page: DocumentIcon,
    image: ImageIcon,
    video: VideoIcon,
    audio: DocumentIcon, // Fallback to DocumentIcon for audio
    code: CodeIcon,
    event: CalendarIcon,
    user: UserIcon,
    default: DocumentIcon,
  }
  return iconMap[type] || iconMap.default
}

// Helper function to get document metadata
const getDocumentMetadata = (item: SanityDocumentWithMetadata) => {
  const now = new Date()
  const updatedAt = new Date(item._updatedAt)
  const timeDiff = now.getTime() - updatedAt.getTime()
  const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24))
  
  let lastModified = 'Just now'
  if (daysDiff === 1) {
    lastModified = '1 day ago'
  } else if (daysDiff > 1) {
    lastModified = `${daysDiff} days ago`
  } else {
    const hoursDiff = Math.floor(timeDiff / (1000 * 60 * 60))
    if (hoursDiff > 0) {
      lastModified = `${hoursDiff}h ago`
    } else {
      const minutesDiff = Math.floor(timeDiff / (1000 * 60))
      if (minutesDiff > 0) {
        lastModified = `${minutesDiff}m ago`
      }
    }
  }

  // Estimate word count from title (rough approximation)
  const title = item.title || 'Untitled'
  const wordCount = title.split(' ').length

  return {
    lastModified,
    wordCount,
    isRecent: daysDiff <= 1,
  }
}

// Helper function to get state color
const getStateColor = (state: State | undefined) => {
  if (!state) return 'default'
  
  const colorMap: {[key: string]: 'primary' | 'success' | 'warning' | 'danger' | 'default'} = {
    'draft': 'default',
    'in-review': 'warning',
    'approved': 'success',
    'published': 'primary',
    'archived': 'default',
  }
  
  return colorMap[state.id] || 'default'
}

type DocumentCardProps = {
  isDragDisabled: boolean
  isPatching: boolean
  userRoleCanDrop: boolean
  isDragging: boolean
  item: SanityDocumentWithMetadata
  states: State[]
  toggleInvalidDocumentId: (
    documentId: string,
    action: 'ADD' | 'REMOVE'
  ) => void
  userList: {users: UserExtended[]; loading: boolean; error: Error | null}
  updateAssignees?: (documentId: string, newAssignees: string[]) => void
}

export function DocumentCard(props: DocumentCardProps) {
  const {
    isDragDisabled,
    isPatching,
    userRoleCanDrop,
    isDragging,
    item,
    states,
    toggleInvalidDocumentId,
    userList,
    updateAssignees,
  } = props
  const {assignees = [], documentId} = item._metadata ?? {}
  const schema = useSchema()
  const state = states.find((s) => s.id === item._metadata?.state)
  const theme = useTheme()
  const isDarkMode = theme.sanity.color.dark
  const defaultCardTone = isDarkMode ? `transparent` : `default`

  // Get document metadata and icons
  const metadata = getDocumentMetadata(item)
  const DocumentTypeIcon = getDocumentTypeIcon(item._type)
  const stateColor = getStateColor(state)

  // Validation only runs if the state requests it
  // Because it's not performant to run it on many documents simultaneously
  // So we fake it here, and maybe set it inside <Validate />
  const [optimisticValidation, setOptimisticValidation] =
    useState<ValidationStatusType>({
      isValidating: state?.requireValidation ?? false,
      validation: [],
    })

  const {isValidating, validation} = optimisticValidation

  const handleValidation = useCallback((updates: ValidationStatusType) => {
    setOptimisticValidation(updates)
  }, [])

  const cardTone = useMemo(() => {
    let tone: CardTone = defaultCardTone

    if (!userRoleCanDrop) return isDarkMode ? `default` : `transparent`
    if (!documentId) return tone
    if (isPatching) tone = isDarkMode ? `default` : `transparent`
    if (isDragging) tone = `positive`

    if (state?.requireValidation && !isValidating && validation.length > 0) {
      if (validation.some((v) => v.level === 'error')) {
        tone = `critical`
      } else {
        tone = `caution`
      }
    }

    return tone
  }, [
    defaultCardTone,
    userRoleCanDrop,
    isPatching,
    isDarkMode,
    documentId,
    isDragging,
    isValidating,
    validation,
    state?.requireValidation,
  ])

  // Update validation status
  // Cannot be done in the above memo because it would set state during render
  useEffect(() => {
    if (!isValidating && validation.length > 0) {
      if (validation.some((v) => v.level === 'error')) {
        toggleInvalidDocumentId(documentId, 'ADD')
      } else {
        toggleInvalidDocumentId(documentId, 'REMOVE')
      }
    } else {
      toggleInvalidDocumentId(documentId, 'REMOVE')
    }
  }, [documentId, isValidating, toggleInvalidDocumentId, validation])

  const hasError = useMemo(
    () => (isValidating ? false : validation.some((v) => v.level === 'error')),
    [isValidating, validation]
  )

  const isLastState = useMemo(
    () => states[states.length - 1].id === item._metadata?.state,
    [states, item._metadata.state]
  )

  return (
    <>
      {state?.requireValidation ? (
        <Validate
          documentId={documentId}
          type={item._type}
          onChange={handleValidation}
        />
      ) : null}
      <Box paddingBottom={3} paddingX={3}>
        <Card 
          radius={3} 
          shadow={isDragging ? 3 : 1} 
          tone={cardTone}
          style={{
            transition: 'all 0.2s ease',
            transform: isDragging ? 'scale(1.02)' : 'scale(1)',
            border: isDragging ? `2px solid ${(theme as any)?.sanity?.color?.primary?.base?.bg || '#0070f3'}` : '1px solid transparent',
          }}
        >
          <Stack space={0}>
            {/* Header with document type and drag handle */}
            <Card
              borderBottom
              radius={0}
              padding={3}
              tone={cardTone}
              style={{pointerEvents: 'none'}}
            >
              <Flex align="center" justify="space-between" gap={2}>
                <Flex align="center" gap={2} flex={1}>
                  <Box style={{color: (theme as any)?.sanity?.color?.primary?.base?.bg || '#0070f3'}}>
                    <DocumentTypeIcon style={{fontSize: '16px'}} />
                  </Box>
                  <Box flex={1}>
                    <Text size={1} weight="medium" style={{color: theme?.sanity?.color?.base?.fg || '#000'}}>
                      {item._type.toUpperCase()}
                    </Text>
                  </Box>
                </Flex>
                <Box style={{flexShrink: 0}}>
                  {hasError || isDragDisabled || isPatching ? null : (
                    <Tooltip content="Drag to reorder">
                      <Box style={{cursor: 'grab', color: theme?.sanity?.color?.base?.fg || '#000'}}>
                        <DragHandleIcon />
                      </Box>
                    </Tooltip>
                  )}
                </Box>
              </Flex>
            </Card>

            {/* Document preview */}
            <Card padding={3} tone="inherit" radius={0}>
              <Preview
                layout="default"
                skipVisibilityCheck
                value={item}
                schemaType={schema.get(item._type) as SchemaType}
              />
            </Card>

            {/* Metadata section */}
            <Card padding={2} tone="inherit" radius={0} borderTop>
              <Stack space={2}>
                <Flex align="center" justify="space-between" gap={2}>
                  <Flex align="center" gap={2}>
                    <Badge tone={stateColor as any} size={0}>
                      {state?.title || 'Unknown'}
                    </Badge>
                    {metadata.isRecent && (
                      <Badge tone="primary" size={0}>
                        Recent
                      </Badge>
                    )}
                  </Flex>
                  <Flex align="center" gap={1}>
                    <ClockIcon style={{fontSize: '12px', color: theme?.sanity?.color?.base?.fg || '#666'}} />
                    <Text size={0} muted>
                      {metadata.lastModified}
                    </Text>
                  </Flex>
                </Flex>

                {/* User assignments with avatars */}
                <Box>
                  {documentId && (
                    <UserDisplay
                      userList={userList}
                      assignees={assignees}
                      documentId={documentId}
                      disabled={!userRoleCanDrop}
                      updateAssignees={updateAssignees}
                    />
                  )}
                </Box>
              </Stack>
            </Card>

            {/* Action bar */}
            <Card padding={2} tone="inherit" radius={0} borderTop>
              <Flex align="center" justify="space-between" gap={2}>
                <Flex align="center" gap={1}>
                  {validation.length > 0 ? (
                    <ValidationStatus validation={validation} />
                  ) : null}
                  <DraftStatus document={item} />
                  <PublishedStatus document={item} />
                </Flex>
                
                <Flex align="center" gap={1}>
                  <EditButton
                    id={item._id}
                    type={item._type}
                    disabled={!userRoleCanDrop}
                  />
                  {isLastState && states.length <= 3 ? (
                    <CompleteButton
                      documentId={documentId}
                      disabled={!userRoleCanDrop}
                    />
                  ) : null}
                </Flex>
              </Flex>
              
              {isLastState && states.length > 3 ? (
                <Stack paddingTop={2}>
                  <CompleteButton
                    documentId={documentId}
                    disabled={!userRoleCanDrop}
                  />
                </Stack>
              ) : null}
            </Card>
          </Stack>
        </Card>
      </Box>
    </>
  )
}
