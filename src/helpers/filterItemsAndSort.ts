import {SanityDocumentWithMetadata} from '../types'

export function filterItemsAndSort(
  items: SanityDocumentWithMetadata[] | undefined | null,
  stateId: string,
  selectedUsers: string[] = [],
  selectedSchemaTypes: null | string[] = []
): SanityDocumentWithMetadata[] {
  // Safety check: if items is not an array, return empty array
  if (!Array.isArray(items) || !items.length) {
    return []
  }

  return (
    items
      // Only items that have existing documents
      .filter((item) => item?._id)
      // Only items of this state
      .filter((item) => item?._metadata?.state === stateId)
      // Only items with selected users, if the document has any assigned users
      .filter((item) => {
        // If no users are selected in the filter, show all documents
        if (!selectedUsers.length) {
          return true
        }
        
        // If users are selected in the filter, only show documents that:
        // 1. Have assignees AND at least one assignee is in the selected users
        const hasAssignees = item._metadata?.assignees?.length > 0
        if (hasAssignees) {
          return item._metadata?.assignees?.some((assignee) =>
            selectedUsers.includes(assignee)
          )
        } else {
          // Don't show unassigned documents when users are filtered
          return false
        }
      })
      // Only items of selected schema types, if any are selected
      .filter((item) => {
        if (!selectedSchemaTypes) {
          return true
        }

        return selectedSchemaTypes.length
          ? selectedSchemaTypes.includes(item._type)
          : false
      })
      // Sort by metadata orderRank, a string field
      .sort((a, b) => {
        const aOrderRank = a._metadata?.orderRank || '0'
        const bOrderRank = b._metadata?.orderRank || '0'

        return aOrderRank.localeCompare(bOrderRank)
      })
  )
}
