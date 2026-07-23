import { Button } from '../../../../components/ui'
import { Kbd } from '../../../../components/ui'

export default function KbdButton() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Button variant="outline" size="sm" className="pe-2">
        Accept <Kbd>⏎</Kbd>
      </Button>
      <Button variant="outline" size="sm" className="pe-2">
        Cancel <Kbd>Esc</Kbd>
      </Button>
    </div>
  )
}
