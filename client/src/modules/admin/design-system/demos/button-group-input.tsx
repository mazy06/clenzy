import { SearchIcon } from "lucide-react"

import { Button } from '../../../../components/ui'
import { ButtonGroup } from '../../../../components/ui'
import { Input } from '../../../../components/ui'

export default function ButtonGroupInput() {
  return (
    <ButtonGroup>
      <Input placeholder="Search..." />
      <Button variant="outline" aria-label="Search">
        <SearchIcon />
      </Button>
    </ButtonGroup>
  )
}
