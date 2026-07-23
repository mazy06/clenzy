import { IconGitBranch } from "@tabler/icons-react"

import { Button } from '../../../../components/ui'

export default function ButtonWithIcon() {
  return (
    <Button variant="outline" size="sm">
      <IconGitBranch /> New Branch
    </Button>
  )
}
