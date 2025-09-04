import {CalendarIcon} from '@sanity/icons'
import {Badge} from '@sanity/ui'
import {useWorkflowContext} from '../components/WorkflowContext'

export function ScheduleBadge(documentId: string) {
  const {metadata, loading, error} = useWorkflowContext(documentId)

  if (loading || error || !(metadata as any)?.publishSchedule?.scheduledDate) {
    return null
  }

  const scheduleDate = new Date((metadata as any).publishSchedule.scheduledDate)
  const now = new Date()
  const isOverdue = scheduleDate < now && (metadata as any).publishSchedule.publishStatus === 'scheduled'
  const isToday = scheduleDate.toDateString() === now.toDateString()

  return {
    label: isToday 
      ? `Today ${scheduleDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
      : isOverdue
      ? `Overdue ${scheduleDate.toLocaleDateString()}`
      : scheduleDate.toLocaleDateString(),
    icon: CalendarIcon,
    tone: isOverdue ? 'critical' : isToday ? 'caution' : 'primary',
    title: `Scheduled for ${scheduleDate.toLocaleString()}`,
  }
}