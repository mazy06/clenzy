import { Button } from '../../../../components/ui'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../../components/ui'

export default function TooltipDemo() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline">Hover</Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Add to library</p>
      </TooltipContent>
    </Tooltip>
  )
}
