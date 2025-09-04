import {useEffect} from 'react'
import {useValidationStatus} from 'sanity'

type ValidateProps = {
  documentId: string
  type: string
  onChange: (validation: any) => void
}

// Document validation is siloed into its own component
// Because it's not performant to run on a lot of documents
export default function Validate(props: ValidateProps) {
  const {documentId, type, onChange} = props
  const {isValidating, validation = []} = useValidationStatus(documentId, type)

  useEffect(() => {
    onChange({isValidating, validation})
  }, [onChange, isValidating, validation])

  return null
}
