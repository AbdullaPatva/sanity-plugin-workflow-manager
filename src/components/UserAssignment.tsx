import React from 'react'
import {useToast} from '@sanity/ui'
import {UserSelectMenu} from '../lib/compatibility'
import {useClient} from 'sanity'

import {UserExtended} from '../lib/compatibility'
import {API_VERSION} from '../constants'

type UserAssignmentProps = {
  userList: {users: UserExtended[]; loading: boolean; error: Error | null}
  assignees: string[]
  documentId: string
  onAssigneesChange?: (newAssignees: string[]) => void
}

export default function UserAssignment(props: UserAssignmentProps) {
  const {assignees, userList, documentId, onAssigneesChange} = props
  const client = useClient({apiVersion: API_VERSION})
  const toast = useToast()
  
  // Prevent multiple rapid operations on the same user
  const [processingUsers, setProcessingUsers] = React.useState<Set<string>>(new Set())
  
  // Ensure assignees is always an array, never null
  const safeAssignees = Array.isArray(assignees) ? assignees : []

  const addAssignee = React.useCallback(
    (userId: string) => {
      // Prevent duplicate operations
      if (processingUsers.has(userId)) {
        return
      }
      
      const user = userList.users.find((u) => u.id === userId)

      if (!userId || !user) {
        return toast.push({
          status: 'error',
          title: 'Could not find User',
        })
      }

      // Check if user is already assigned to prevent duplicate operations
      if (safeAssignees.includes(userId)) {
        return toast.push({
          status: 'warning',
          title: 'User already assigned',
          description: `${user.displayName} is already assigned to this document`,
        })
      }
      
      // Mark user as processing
      setProcessingUsers(prev => new Set(prev).add(userId))
      
      // Optimistic update - add user to assignees immediately
      const newAssignees = [...safeAssignees, userId]
      onAssigneesChange?.(newAssignees)
      
      return client
        .patch(`workflow-metadata.${documentId}`)
        .setIfMissing({assignees: []})
        .insert(`after`, `assignees[-1]`, [userId])
        .commit()
        .then(() => {
          // Remove from processing set
          setProcessingUsers(prev => {
            const newSet = new Set(prev)
            newSet.delete(userId)
            return newSet
          })
          return toast.push({
            title: `Added ${user.displayName} to assignees`,
            status: 'success',
          })
        })
        .catch((err) => {
          // Remove from processing set on error
          setProcessingUsers(prev => {
            const newSet = new Set(prev)
            newSet.delete(userId)
            return newSet
          })
          // Revert optimistic update on error
          onAssigneesChange?.(safeAssignees)
          return toast.push({
            title: `Failed to add assignee`,
            description: userId,
            status: 'error',
          })
        })
    },
    [documentId, client, toast, userList, safeAssignees, processingUsers]
  )

  const removeAssignee = React.useCallback(
    (userId: string) => {
      // Prevent duplicate operations
      if (processingUsers.has(userId)) {
        return
      }
      
      const user = userList.users.find((u) => u.id === userId)

      if (!userId || !user) {
        return toast.push({
          status: 'error',
          title: 'Could not find User',
        })
      }

      // Check if user is actually assigned to prevent unnecessary operations
      if (!safeAssignees.includes(userId)) {
        return toast.push({
          status: 'warning',
          title: 'User not assigned',
          description: `${user.displayName} is not assigned to this document`,
        })
      }
      
      // Mark user as processing
      setProcessingUsers(prev => new Set(prev).add(userId))
      
      // Optimistic update - remove user from assignees immediately
      const newAssignees = safeAssignees.filter(id => id !== userId)
      onAssigneesChange?.(newAssignees)
      
      return client
        .patch(`workflow-metadata.${documentId}`)
        .unset([`assignees[@ == "${userId}"]`])
        .commit()
        .then(() => {
          // Remove from processing set
          setProcessingUsers(prev => {
            const newSet = new Set(prev)
            newSet.delete(userId)
            return newSet
          })
          return toast.push({
            title: `Removed ${user.displayName} from assignees`,
            status: 'success',
          })
        })
        .catch((err) => {
          // Remove from processing set on error
          setProcessingUsers(prev => {
            const newSet = new Set(prev)
            newSet.delete(userId)
            return newSet
          })
          // Revert optimistic update on error
          onAssigneesChange?.(safeAssignees)
          return toast.push({
            title: `Failed to remove assignee`,
            description: documentId,
            status: 'error',
          })
        })
    },
    [client, toast, documentId, userList, safeAssignees, processingUsers]
  )

  const clearAssignees = React.useCallback(() => {
    return client
      .patch(`workflow-metadata.${documentId}`)
      .unset([`assignees`])
      .commit()
      .then(() => {
        return toast.push({
          title: `Cleared assignees`,
          status: 'success',
        })
      })
      .catch((err) => {
        console.error(err)

        return toast.push({
          title: `Failed to clear assignees`,
          description: documentId,
          status: 'error',
        })
      })
  }, [client, toast, documentId])

  return (
    <UserSelectMenu
      style={{maxHeight: 300}}
      value={safeAssignees}
      users={userList.users}
      onAdd={addAssignee}
      onClear={clearAssignees}
      onRemove={removeAssignee}
      processingUsers={Array.from(processingUsers)}
    />
  )
}
