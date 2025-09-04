import React, {useEffect, useRef, useState} from 'react'
import {
  Box,
  Card,
  Flex,
  Stack,
  Text,
  Button,
  useTheme,
} from '@sanity/ui'
import {
  EditIcon,
  LaunchIcon,
  ArrowRightIcon,
  TrashIcon,
  CalendarIcon,
} from '@sanity/icons'

interface ContextMenuAction {
  id: string
  label: string
  icon?: React.ComponentType<any>
  onClick: () => void
  disabled?: boolean
  tone?: 'default' | 'primary' | 'positive' | 'caution' | 'critical'
}

interface ContextMenuProps {
  isOpen: boolean
  position: { x: number; y: number }
  actions: ContextMenuAction[]
  onClose: () => void
}

export default function ContextMenu({
  isOpen,
  position,
  actions,
  onClose,
}: ContextMenuProps) {
  const theme = useTheme()
  const menuRef = useRef<HTMLDivElement>(null)
  const [adjustedPosition, setAdjustedPosition] = useState(position)

  // Handle click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  // Adjust position to keep menu within viewport
  useEffect(() => {
    if (!isOpen || !menuRef.current) return

    const menu = menuRef.current
    const rect = menu.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let newX = position.x
    let newY = position.y

    // Adjust horizontal position
    if (newX + rect.width > viewportWidth) {
      newX = viewportWidth - rect.width - 10
    }
    if (newX < 10) {
      newX = 10
    }

    // Adjust vertical position
    if (newY + rect.height > viewportHeight) {
      newY = viewportHeight - rect.height - 10
    }
    if (newY < 10) {
      newY = 10
    }

    setAdjustedPosition({ x: newX, y: newY })
  }, [isOpen, position])

  if (!isOpen) return null

  return (
    <Box
      ref={menuRef}
      style={{
        position: 'fixed',
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        zIndex: 1000,
        minWidth: '200px',
      }}
    >
      <Card
        tone="default"
        shadow={3}
        style={{
          border: `1px solid ${(theme as any)?.sanity?.color?.card?.border?.base || '#e1e5e9'}`,
          borderRadius: '6px',
          overflow: 'hidden',
        }}
      >
        <Stack space={0}>
          {actions.map((action, index) => (
            <Button
              key={action.id}
              mode="ghost"
              tone={action.tone || 'default'}
              text={action.label}
              icon={action.icon}
              onClick={() => {
                action.onClick()
                onClose()
              }}
              disabled={action.disabled}
              style={{
                borderRadius: 0,
                justifyContent: 'flex-start',
                padding: '8px 12px',
                fontSize: '14px',
                fontWeight: 'normal',
                borderBottom: index < actions.length - 1 
                  ? `1px solid ${(theme as any)?.sanity?.color?.card?.border?.base || '#e1e5e9'}` 
                  : 'none',
              }}
            />
          ))}
        </Stack>
      </Card>
    </Box>
  )
}

// Helper function to create context menu actions for calendar events
export function createCalendarEventActions(
  event: any,
  handlers: {
    onEdit: () => void
    onNavigate: () => void
    onStateTransition: (newState: string) => void
    onUnschedule: () => void
    availableTransitions: any[]
  }
): ContextMenuAction[] {
  const actions: ContextMenuAction[] = [
    {
      id: 'edit',
      label: 'Quick Edit',
      icon: EditIcon,
      onClick: handlers.onEdit,
    },
    {
      id: 'navigate',
      label: 'Open in Editor',
      icon: LaunchIcon,
      onClick: handlers.onNavigate,
    },
  ]

  // Add state transition actions
  if (handlers.availableTransitions.length > 0) {
    actions.push({
      id: 'separator',
      label: '─',
      onClick: () => {},
      disabled: true,
    })

    handlers.availableTransitions.forEach((transition) => {
      actions.push({
        id: `transition-${transition.id}`,
        label: `Move to ${transition.title}`,
        icon: ArrowRightIcon,
        onClick: () => handlers.onStateTransition(transition.id),
        tone: transition.color === 'success' ? 'positive' : 
              transition.color === 'warning' ? 'caution' : 
              transition.color === 'critical' ? 'critical' : 'default',
      })
    })
  }

  // Add unschedule action
  actions.push({
    id: 'separator-2',
    label: '─',
    onClick: () => {},
    disabled: true,
  })

  actions.push({
    id: 'unschedule',
    label: 'Unschedule',
    icon: TrashIcon,
    onClick: handlers.onUnschedule,
    tone: 'critical',
  })

  return actions
}