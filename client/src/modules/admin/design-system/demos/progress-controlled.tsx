import * as React from "react"

import { Progress } from '../../../../components/ui'
import { Slider } from '../../../../components/ui'

export function ProgressControlled() {
  const [value, setValue] = React.useState([50])

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <Progress value={value[0]} />
      <Slider
        value={value}
        onValueChange={setValue}
        min={0}
        max={100}
        step={1}
      />
    </div>
  )
}
