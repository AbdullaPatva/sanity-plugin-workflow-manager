import React from 'react'
import {Button, Grid, Popover, useClickOutside, Flex, Text, Badge, useTheme} from '@sanity/ui'
import {AddIcon} from '@sanity/icons'

import AvatarGroup from './DocumentCard/AvatarGroup'
import {UserExtended} from '../lib/compatibility'
import UserAssignment from './UserAssignment'

type UserDisplayProps = {
  userList: {users: UserExtended[]; loading: boolean; error: Error | null}
  assignees: string[]
  documentId: string
  disabled?: boolean
  updateAssignees?: (documentId: string, newAssignees: string[]) => void
}

export default function UserDisplay(props: UserDisplayProps) {
  const {assignees, userList, documentId, disabled = false, updateAssignees} = props
  const theme = useTheme()

  const [button] = React.useState(null)
  const [popover, setPopover] = React.useState(null)
  const [isOpen, setIsOpen] = React.useState(false)

  const close = React.useCallback(() => setIsOpen(false), [])
  const open = React.useCallback(() => setIsOpen(true), [])

  useClickOutside(close, [button, popover])

  const safeAssignees = Array.isArray(assignees) ? assignees : []
  const assignedUsers = userList.users.filter((u) => safeAssignees.includes(u.id))
  const hasAssignees = assignedUsers.length > 0

  return (
    <Popover
      // @ts-ignore
      ref={setPopover}
      content={<UserAssignment userList={userList} assignees={safeAssignees} documentId={documentId} onAssigneesChange={(newAssignees) => updateAssignees?.(documentId, newAssignees)} />}
      portal
      open={isOpen}
    >
      {!hasAssignees ? (
        <Button
          onClick={open}
          fontSize={1}
          padding={2}
          tabIndex={-1}
          icon={AddIcon}
          text="Assign"
          tone="positive"
          mode="ghost"
          disabled={disabled}
          style={{
            borderRadius: '6px',
            border: `1px dashed ${(theme as any)?.sanity?.color?.primary?.base?.bg || '#0070f3'}`,
            backgroundColor: `${(theme as any)?.sanity?.color?.primary?.base?.bg || '#0070f3'}10`,
          }}
        />
      ) : (
        <Button 
          onClick={open} 
          padding={2} 
          mode="bleed" 
          disabled={disabled}
          style={{
            borderRadius: '6px',
            border: `1px solid ${(theme as any)?.sanity?.color?.border?.default || '#e1e5e9'}`,
            backgroundColor: theme?.sanity?.color?.base?.bg || '#fff',
          }}
        >
          <Flex align="center" gap={2}>
            <AvatarGroup users={assignedUsers} max={3} />
            <Flex align="center" gap={1}>
              <Text size={0} muted>
                {assignedUsers.length} assigned
              </Text>
              <Badge tone="primary" size={0}>
                {assignedUsers.length}
              </Badge>
            </Flex>
          </Flex>
        </Button>
      )}
    </Popover>
  )
}
