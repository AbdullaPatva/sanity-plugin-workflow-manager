import {CalendarIcon} from '@sanity/icons'
import {useState} from 'react'
import {DocumentActionProps, useClient} from 'sanity'
import {Box, Button, Card, Flex, Stack, Text, TextInput} from '@sanity/ui'
import {useWorkflowContext} from '../components/WorkflowContext'
import {API_VERSION} from '../constants'

export function ScheduleWorkflow(props: DocumentActionProps) {
  const {id} = props
  const {metadata, loading, error} = useWorkflowContext(id)
  const [isDialogOpen, setDialogOpen] = useState(false)

  if (error) {
    console.error(error)
  }

  if (!metadata) {
    return null
  }

  const hasSchedule = (metadata as any).publishSchedule?.scheduledDate
  const scheduleDate = hasSchedule ? new Date((metadata as any).publishSchedule.scheduledDate) : null

  return {
    icon: CalendarIcon,
    type: 'dialog',
    disabled: !metadata || loading || error,
    label: hasSchedule ? 'Reschedule' : 'Schedule',
    title: metadata ? null : `Document is not in Workflow`,
    dialog: isDialogOpen && {
      type: 'popover',
      onClose: () => {
        setDialogOpen(false)
      },
      content: (
        <ScheduleDialog
          documentId={id}
          currentSchedule={scheduleDate}
          onClose={() => setDialogOpen(false)}
        />
      ),
    },
    onHandle: () => {
      setDialogOpen(true)
    },
  }
}

type ScheduleDialogProps = {
  documentId: string
  currentSchedule: Date | null
  onClose: () => void
}

function ScheduleDialog({documentId, currentSchedule, onClose}: ScheduleDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(currentSchedule)
  const [selectedTime, setSelectedTime] = useState<string>(
    currentSchedule ? currentSchedule.toTimeString().slice(0, 5) : '09:00'
  )

  // Move useClient to top level of component
  const client = useClient({apiVersion: API_VERSION})

  const handleSave = async () => {
    if (!selectedDate) return

    const [hours, minutes] = selectedTime.split(':').map(Number)
    const scheduledDate = new Date(selectedDate)
    scheduledDate.setHours(hours, minutes, 0, 0)

    try {
      await client
        .patch(`workflow-metadata.${documentId}`)
        .set({
          'publishSchedule.scheduledDate': scheduledDate.toISOString(),
          'publishSchedule.publishStatus': 'scheduled',
        })
        .commit()

      onClose()
    } catch (error) {
      console.error('Failed to schedule:', error)
    }
  }

  const handleCancel = async () => {
    try {
      await client
        .patch(`workflow-metadata.${documentId}`)
        .unset(['publishSchedule'])
        .commit()

      onClose()
    } catch (error) {
      console.error('Failed to cancel schedule:', error)
    }
  }

  return (
    <Box padding={4} style={{minWidth: '320px'}}>
      <Stack space={4}>
        <Text size={2} weight="bold">
          {currentSchedule ? 'Reschedule Publishing' : 'Schedule Publishing'}
        </Text>
        
        <Stack space={3}>
          <Box>
            <Text size={1} weight="medium" style={{marginBottom: '8px'}}>
              Date
            </Text>
            <TextInput
              type="date"
              value={selectedDate ? selectedDate.toISOString().split('T')[0] : ''}
              onChange={(e) => setSelectedDate(e.currentTarget.value ? new Date(e.currentTarget.value) : null)}
            />
          </Box>

          <Box>
            <Text size={1} weight="medium" style={{marginBottom: '8px'}}>
              Time
            </Text>
            <TextInput
              type="time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.currentTarget.value)}
            />
          </Box>
        </Stack>

        {currentSchedule && (
          <Card tone="default" padding={3}>
            <Text size={1} weight="medium" style={{marginBottom: '4px'}}>
              Current Schedule:
            </Text>
            <Text size={1}>
              {currentSchedule.toLocaleDateString()} at {currentSchedule.toLocaleTimeString()}
            </Text>
          </Card>
        )}

        <Flex gap={2} justify="flex-end">
          {currentSchedule && (
            <Button
              mode="ghost"
              text="Cancel Schedule"
              onClick={handleCancel}
            />
          )}
          <Button
            mode="default"
            text={currentSchedule ? 'Update Schedule' : 'Schedule'}
            disabled={!selectedDate}
            onClick={handleSave}
          />
        </Flex>
      </Stack>
    </Box>
  )
}