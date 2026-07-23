import { ArrowUpRightIcon } from "lucide-react"

import { Badge } from '../../../../components/ui'

export function BadgeAsLink() {
  return (
    <Badge asChild>
      <a href="#link">
        Open Link <ArrowUpRightIcon data-icon="inline-end" />
      </a>
    </Badge>
  )
}
