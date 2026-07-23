import Link from './_shims/next-link'

import { Button } from '../../../../components/ui'

export default function ButtonAsChild() {
  return (
    <Button asChild>
      <Link href="/login">Login</Link>
    </Button>
  )
}
