import { ArrowUpIcon } from "../../../../icons/glyphs"

import { Button } from '../../../../components/ui'

export default function ButtonRounded() {
  return (
    <div className="flex flex-col gap-8">
      <Button variant="outline" size="icon" className="rounded-full">
        <ArrowUpIcon />
      </Button>
    </div>
  )
}
