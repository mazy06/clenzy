import { Button } from '../../../../components/ui'
import { Field } from '../../../../components/ui'
import { Input } from '../../../../components/ui'

export function InputInline() {
  return (
    <Field orientation="horizontal">
      <Input type="search" placeholder="Search..." />
      <Button>Search</Button>
    </Field>
  )
}
