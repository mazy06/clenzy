import { Button } from '../../../../components/ui'
import { ButtonGroup } from '../../../../components/ui'
import { Field, FieldLabel } from '../../../../components/ui'
import { Input } from '../../../../components/ui'

export function InputButtonGroup() {
  return (
    <Field>
      <FieldLabel htmlFor="input-button-group">Search</FieldLabel>
      <ButtonGroup>
        <Input id="input-button-group" placeholder="Type to search..." />
        <Button variant="outline">Search</Button>
      </ButtonGroup>
    </Field>
  )
}
