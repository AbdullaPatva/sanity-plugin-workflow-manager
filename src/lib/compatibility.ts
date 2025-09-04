// Compatibility layer for Sanity v4
// This replaces functionality from sanity-plugin-utils

import React from 'react'
import {useClient, useCurrentUser} from 'sanity'
import {useEffect, useState} from 'react'
import groq from 'groq'

// Types for user management
export interface User {
  id: string
  displayName: string
  email: string
  imageUrl?: string
  roles?: Array<{name: string}>
}

export interface UserExtended extends User {
  familyName: string
  givenName: string
  middleName: string
  projectId: string
  provider: string
  sanityUserId: string
  createdAt: string
  updatedAt: string
  isCurrentUser: boolean
}

// Hook to get project users - fetches all users assigned to the project
export function useProjectUsers(options: {apiVersion: string}) {
  const currentUser = useCurrentUser()
  const client = useClient({apiVersion: options.apiVersion})
  const [users, setUsers] = useState<UserExtended[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchProjectUsers = async () => {
      try {
        setLoading(true)
        setError(null)

        if (!currentUser) {
          setUsers([])
          setLoading(false)
          return
        }

        // Try to fetch project members using Sanity Management API
        try {
          const projectId = (currentUser as any).projectId || 'rihf4zqy'
          
          // Query for all users in the project using GROQ
          // This queries the _sanity_* system documents that contain user information
          const projectUsers = await client.fetch(`
            *[_type == "_sanity_user" && defined(projectId) && projectId == $projectId] {
              _id,
              displayName,
              email,
              imageUrl,
              familyName,
              givenName,
              middleName,
              projectId,
              provider,
              sanityUserId,
              createdAt,
              updatedAt,
              roles
            } | order(displayName asc)
          `, { projectId })

          if (Array.isArray(projectUsers) && projectUsers.length > 0) {
            const formattedUsers: UserExtended[] = projectUsers.map((user: any) => ({
              id: user._id || user.sanityUserId,
              displayName: user.displayName || user.email || 'Unknown User',
              email: user.email || '',
              imageUrl: user.imageUrl || '',
              familyName: user.familyName || '',
              givenName: user.givenName || '',
              middleName: user.middleName || '',
              projectId: user.projectId || projectId,
              provider: user.provider || '',
              sanityUserId: user.sanityUserId || user._id,
              createdAt: user.createdAt || new Date().toISOString(),
              updatedAt: user.updatedAt || new Date().toISOString(),
              isCurrentUser: user._id === currentUser.id || user.sanityUserId === currentUser.id,
              roles: user.roles || []
            }))
            
            setUsers(formattedUsers)
          } else {
            // Fallback: if no project users found, include at least the current user
            const fallbackUsers: UserExtended[] = [
              {
                id: currentUser.id,
                displayName: (currentUser as any).displayName || 'Current User',
                email: (currentUser as any).email || '',
                imageUrl: (currentUser as any).imageUrl || '',
                familyName: (currentUser as any).familyName || '',
                givenName: (currentUser as any).givenName || '',
                middleName: (currentUser as any).middleName || '',
                projectId: (currentUser as any).projectId || projectId,
                provider: (currentUser as any).provider || '',
                sanityUserId: (currentUser as any).sanityUserId || currentUser.id,
                createdAt: (currentUser as any).createdAt || new Date().toISOString(),
                updatedAt: (currentUser as any).updatedAt || new Date().toISOString(),
                isCurrentUser: true,
                roles: currentUser.roles || []
              }
            ]
            setUsers(fallbackUsers)
          }
        } catch (apiError) {
          console.warn('Failed to fetch project users via API, using current user only:', apiError)
          
          // Fallback to current user only if API fails
          const fallbackUsers: UserExtended[] = [
            {
              id: currentUser.id,
              displayName: (currentUser as any).displayName || 'Current User',
              email: (currentUser as any).email || '',
              imageUrl: (currentUser as any).imageUrl || '',
              familyName: (currentUser as any).familyName || '',
              givenName: (currentUser as any).givenName || '',
              middleName: (currentUser as any).middleName || '',
              projectId: (currentUser as any).projectId || 'rihf4zqy',
              provider: (currentUser as any).provider || '',
              sanityUserId: (currentUser as any).sanityUserId || currentUser.id,
              createdAt: (currentUser as any).createdAt || new Date().toISOString(),
              updatedAt: (currentUser as any).updatedAt || new Date().toISOString(),
              isCurrentUser: true,
              roles: currentUser.roles || []
            }
          ]
          setUsers(fallbackUsers)
        }

        setLoading(false)
      } catch (err) {
        console.error('Error fetching project users:', err)
        setError(err as Error)
        setLoading(false)
        setUsers([])
      }
    }

    fetchProjectUsers()
  }, [currentUser, client, options.apiVersion])

  return {users, loading, error} as {users: UserExtended[]; loading: boolean; error: Error | null}
}

// Hook for listening to queries with real-time updates
export function useListeningQuery<T>(
  query: string,
  options: {
    params?: Record<string, any>
    initialValue: T
  }
) {
  const client = useClient()
  const [data, setData] = useState<T>(options.initialValue)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let subscription: any = null
    let isMounted = true

    const setupRealtimeQuery = async () => {
      try {
        setLoading(true)
        setError(null)

        // Initial fetch
        const initialResult = await client.fetch(query, options.params || {})
        if (isMounted) {
          setData(initialResult)
          setLoading(false)
        }

        // Set up real-time subscription using Sanity's listen API
        subscription = client
          .listen(query, options.params || {}, {
            includeResult: true,
            visibility: 'query'
          })
          .subscribe({
            next: (update) => {
              if (isMounted && (update as any).result !== undefined) {
                // For real-time updates, we need to refetch the full query result
                // because individual document updates don't give us the full filtered/ordered result
                client.fetch(query, options.params || {}).then((freshResult) => {
                  if (isMounted) {
                    setData(freshResult)
                  }
                }).catch((err) => {
                  console.error('Error refetching after real-time update:', err)
                })
              }
            },
            error: (err) => {
              console.error('Real-time query error:', err)
              if (isMounted) {
                setError(err)
              }
            }
          })

      } catch (err) {
        console.error('Query setup error:', err)
        if (isMounted) {
          setError(err as Error)
          setLoading(false)
        }
      }
    }

    setupRealtimeQuery()

    return () => {
      isMounted = false
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [client, query, JSON.stringify(options.params)])

  return {data, loading, error}
}

// User select menu component (simplified)
export function UserSelectMenu(props: {
  users: UserExtended[]
  value: string[]
  placeholder?: string
  userList?: UserExtended[]
  onAdd?: (id: string) => void
  onRemove?: (id: string) => void
  onClear?: () => void
  processingUsers?: string[]
  labels?: {
    addMe: string
    removeMe: string
    clear: string
  }
  style?: React.CSSProperties
}) {
  const handleUserToggle = (userId: string) => {
    // Prevent operations on users that are currently being processed
    if (props.processingUsers?.includes(userId)) {
      return
    }
    
    const isSelected = props.value.includes(userId)
    if (isSelected) {
      // Only call onRemove, let it handle the state update
      props.onRemove?.(userId)
    } else {
      // Only call onAdd, let it handle the state update
      props.onAdd?.(userId)
    }
  }

  return React.createElement('div', {
    style: {
      border: '1px solid #e1e3e6',
      borderRadius: '6px',
      padding: '12px',
      minHeight: '120px',
      backgroundColor: '#fafafa',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      ...props.style
    }
  },
    React.createElement('div', {
      style: { 
        marginBottom: '12px', 
        fontWeight: '600',
        fontSize: '14px',
        color: '#1f2937'
      }
    }, 'Assign Users'),
    props.users.length === 0 
      ? React.createElement('div', {
          style: { 
            color: '#6b7280', 
            fontStyle: 'italic',
            fontSize: '13px',
            padding: '16px',
            textAlign: 'center',
            border: '1px dashed #d1d5db',
            borderRadius: '4px',
            backgroundColor: '#f9fafb'
          }
        }, 'No users available')
      : props.users.map(user => 
          React.createElement('label', {
            key: user.id,
            style: {
              display: 'flex',
              alignItems: 'center',
              padding: '8px 12px',
              cursor: props.processingUsers?.includes(user.id) ? 'not-allowed' : 'pointer',
              backgroundColor: props.processingUsers?.includes(user.id) 
                ? '#f3f4f6' 
                : props.value.includes(user.id) 
                  ? '#dbeafe' 
                  : '#ffffff',
              borderRadius: '4px',
              marginBottom: '4px',
              border: props.processingUsers?.includes(user.id)
                ? '1px solid #9ca3af'
                : props.value.includes(user.id) 
                  ? '1px solid #3b82f6' 
                  : '1px solid #e5e7eb',
              transition: 'all 0.15s ease',
              fontSize: '13px',
              opacity: props.processingUsers?.includes(user.id) ? 0.6 : 1
            },
            onMouseEnter: (e: any) => {
              if (!props.value.includes(user.id)) {
                e.target.style.backgroundColor = '#f3f4f6'
              }
            },
            onMouseLeave: (e: any) => {
              if (!props.value.includes(user.id)) {
                e.target.style.backgroundColor = '#ffffff'
              }
            },
            onClick: () => handleUserToggle(user.id)
          }, 
            React.createElement('input', {
              type: 'checkbox',
              checked: props.value.includes(user.id),
              readOnly: true,
              style: { 
                marginRight: '10px',
                accentColor: '#3b82f6',
                transform: 'scale(1.1)'
              }
            }),
            React.createElement('div', {
              style: {
                display: 'flex',
                flexDirection: 'column',
                flex: 1
              }
            },
              React.createElement('div', {
                style: {
                  fontWeight: '500',
                  color: '#111827'
                }
              }, user.displayName || user.email || user.id),
              user.email && user.email !== user.displayName ? React.createElement('div', {
                style: {
                  fontSize: '11px',
                  color: '#6b7280',
                  marginTop: '2px'
                }
              }, user.email) : null
            )
          )
        )
  )
}

// Feedback component (simplified)
export function Feedback(props: {
  children?: React.ReactNode
  title?: string
  tone?: string
  description?: string
}) {
  return React.createElement('div', {
    style: {
      padding: '8px',
      border: '1px solid #ccc',
      borderRadius: '4px',
      backgroundColor: props.tone === 'critical' ? '#fee' : props.tone === 'caution' ? '#fef' : '#efe'
    }
  }, props.title || props.children)
} 