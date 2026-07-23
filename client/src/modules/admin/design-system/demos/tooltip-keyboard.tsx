import { SaveIcon } from "lucide-react"

import { Button } from '../../../../components/ui'
import { Kbd } from '../../../../components/ui'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../../components/ui'

export function TooltipKeyboard() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="icon-sm">
          <SaveIcon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        Save Changes <Kbd>S</Kbd>
      </TooltipContent>
    </Tooltip>
  )
}
