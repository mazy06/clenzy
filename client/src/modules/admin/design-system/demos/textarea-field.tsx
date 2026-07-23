import {
  Field,
  FieldDescription,
  FieldLabel,
} from '../../../../components/ui'
import { Textarea } from '../../../../components/ui'

export function TextareaField() {
  return (
    <Field>
      <FieldLabel htmlFor="textarea-message">Message</FieldLabel>
      <FieldDescription>Enter your message below.</FieldDescription>
      <Textarea id="textarea-message" placeholder="Type your message here." />
    </Field>
  )
}
