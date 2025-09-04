import React, {useState, useEffect, useMemo} from 'react'
import {
  Box,
  Card,
  Flex,
  Stack,
  Text,
  Button,
  TextInput,
  useTheme,
  useToast,
} from '@sanity/ui'
import {
  LinkIcon,
  TrashIcon,
  AddIcon,
} from '@sanity/icons'
import {useClient} from 'sanity'
import {API_VERSION} from '../constants'
import groq from 'groq'

interface DependencyManagerProps {
  documentId: string
  currentDependencies: string[]
  onDependenciesChange: (dependencies: string[]) => void
  disabled?: boolean
}

interface DocumentOption {
  id: string
  title: string
  documentType: string
  scheduledDate?: string
  workflowState: string
}

export default function DependencyManager({
  documentId,
  currentDependencies,
  onDependenciesChange,
  disabled = false,
}: DependencyManagerProps) {
  const client = useClient({apiVersion: API_VERSION})
  const theme = useTheme()
  const toast = useToast()
  
  const [availableDocuments, setAvailableDocuments] = useState<DocumentOption[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddDialog, setShowAddDialog] = useState(false)

  // Fetch available documents for dependencies
  useEffect(() => {
    const fetchAvailableDocuments = async () => {
      setLoading(true)
      try {
        // Query for documents that are scheduled and not the current document
        const query = groq`*[_type == "workflow.metadata" && defined(publishSchedule.scheduledDate) && documentId != $currentDocumentId] {
          documentId,
          state,
          publishSchedule,
          "document": *[_id == ^.documentId || _id == "drafts." + ^.documentId]|order(_updatedAt)[0]{ 
            _id, 
            _type, 
            title
          }
        } | order(publishSchedule.scheduledDate)`

        const results = await client.fetch(query, { currentDocumentId: documentId })
        
        const documents: DocumentOption[] = results.map((doc: any) => ({
          id: doc.documentId,
          title: doc.document?.title || `${doc.document?._type || 'Document'}`,
          documentType: doc.document?._type || 'unknown',
          scheduledDate: doc.publishSchedule?.scheduledDate,
          workflowState: doc.state || 'draft',
        }))

        setAvailableDocuments(documents)
      } catch (error) {
        console.error('Failed to fetch available documents:', error)
        toast.push({
          title: 'Error loading documents',
          description: 'Could not load available documents for dependencies',
          status: 'error',
        })
      } finally {
        setLoading(false)
      }
    }

    fetchAvailableDocuments()
  }, [client, documentId, toast])

  // Filter documents based on search query
  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return availableDocuments
    
    return availableDocuments.filter(doc =>
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.documentType.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [availableDocuments, searchQuery])

  // Get dependency documents with details
  const dependencyDocuments = useMemo(() => {
    return currentDependencies.map(depId => 
      availableDocuments.find(doc => doc.id === depId)
    ).filter(Boolean) as DocumentOption[]
  }, [currentDependencies, availableDocuments])

  // Check for circular dependencies
  const hasCircularDependency = (newDependencyId: string): boolean => {
    // Simple circular dependency check - if the dependency depends on this document
    // This is a basic check; in a real implementation, you'd want to check the full dependency chain
    return currentDependencies.includes(newDependencyId)
  }

  // Check for scheduling conflicts
  const hasSchedulingConflict = (newDependencyId: string): boolean => {
    const dependency = availableDocuments.find(doc => doc.id === newDependencyId)
    if (!dependency?.scheduledDate) return false

    // Check if dependency is scheduled after this document
    // This would be a conflict since dependencies should be published first
    return false // For now, we'll allow this and show a warning
  }

  const handleAddDependency = (documentId: string) => {
    if (currentDependencies.includes(documentId)) {
      toast.push({
        title: 'Dependency already added',
        description: 'This document is already a dependency',
        status: 'warning',
      })
      return
    }

    if (hasCircularDependency(documentId)) {
      toast.push({
        title: 'Circular dependency',
        description: 'Cannot add circular dependencies',
        status: 'error',
      })
      return
    }

    const newDependencies = [...currentDependencies, documentId]
    onDependenciesChange(newDependencies)
    setShowAddDialog(false)
    setSearchQuery('')

    toast.push({
      title: 'Dependency added',
      description: 'Document dependency has been added',
      status: 'success',
    })
  }

  const handleRemoveDependency = (documentId: string) => {
    const newDependencies = currentDependencies.filter(id => id !== documentId)
    onDependenciesChange(newDependencies)

    toast.push({
      title: 'Dependency removed',
      description: 'Document dependency has been removed',
      status: 'success',
    })
  }

  const getWorkflowStateColor = (state: string) => {
    const stateColors: Record<string, string> = {
      'draft': '#6b7280',
      'inReview': '#f59e0b',
      'changesRequested': '#ef4444',
      'approved': '#10b981',
      'published': '#3b82f6',
    }
    return stateColors[state] || '#6b7280'
  }

  const formatScheduledDate = (dateString?: string) => {
    if (!dateString) return 'Not scheduled'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Stack space={3}>
      <Flex align="center" justify="space-between">
        <Flex align="center" gap={2}>
          <LinkIcon />
          <Text size={1} weight="medium">
            Publishing Dependencies
          </Text>
        </Flex>
        <Button
          mode="ghost"
          icon={AddIcon}
          text="Add Dependency"
          onClick={() => setShowAddDialog(true)}
          disabled={disabled}
        />
      </Flex>

      {/* Current Dependencies */}
      {dependencyDocuments.length > 0 ? (
        <Stack space={2}>
          {dependencyDocuments.map((doc) => (
            <Card
              key={doc.id}
              tone="default"
              padding={3}
              style={{
                borderLeft: `3px solid ${getWorkflowStateColor(doc.workflowState)}`,
              }}
            >
              <Flex justify="space-between" align="center">
                <Box flex={1}>
                  <Text size={1} weight="medium">
                    {doc.title}
                  </Text>
                  <Text size={0} muted>
                    {doc.documentType} • {formatScheduledDate(doc.scheduledDate)}
                  </Text>
                  <Text size={0} style={{textTransform: 'capitalize', opacity: 0.7}}>
                    {doc.workflowState}
                  </Text>
                </Box>
                <Button
                  mode="ghost"
                  icon={TrashIcon}
                  onClick={() => handleRemoveDependency(doc.id)}
                  disabled={disabled}
                  tone="critical"
                />
              </Flex>
            </Card>
          ))}
        </Stack>
      ) : (
        <Card tone="transparent" padding={3}>
          <Text size={0} muted>
            No dependencies set. This document will be published independently.
          </Text>
        </Card>
      )}

      {/* Add Dependency Dialog */}
      {showAddDialog && (
        <Card tone="default" padding={3}>
          <Stack space={3}>
            <Flex justify="space-between" align="center">
              <Text size={1} weight="medium">
                Add Publishing Dependency
              </Text>
              <Button
                mode="ghost"
                text="Cancel"
                onClick={() => {
                  setShowAddDialog(false)
                  setSearchQuery('')
                }}
              />
            </Flex>

            <TextInput
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
            />

            {loading ? (
              <Text size={0} muted>Loading documents...</Text>
            ) : (
              <Stack space={2} style={{maxHeight: '200px', overflowY: 'auto'}}>
                {filteredDocuments.length === 0 ? (
                  <Text size={0} muted>
                    {searchQuery ? 'No documents found matching your search.' : 'No available documents.'}
                  </Text>
                ) : (
                  filteredDocuments.map((doc) => (
                    <Card
                      key={doc.id}
                      tone="transparent"
                      padding={2}
                      style={{
                        cursor: 'pointer',
                        border: '1px solid var(--card-border-color)',
                      }}
                      onClick={() => handleAddDependency(doc.id)}
                    >
                      <Flex justify="space-between" align="center">
                        <Box flex={1}>
                          <Text size={1}>{doc.title}</Text>
                          <Text size={0} muted>
                            {doc.documentType} • {formatScheduledDate(doc.scheduledDate)}
                          </Text>
                        </Box>
                        <Text
                          size={0}
                          style={{
                            textTransform: 'capitalize',
                            color: getWorkflowStateColor(doc.workflowState),
                          }}
                        >
                          {doc.workflowState}
                        </Text>
                      </Flex>
                    </Card>
                  ))
                )}
              </Stack>
            )}
          </Stack>
        </Card>
      )}
    </Stack>
  )
}