import * as React from "react"

import { cn } from '../../utils/cn'

/**
 * Baitly UI — Textarea (copie de apps/v4/registry/bases/radix/ui — la source de la doc /docs/components/radix).
 * Adaptations locales : imports, propriétés logiques RTL, shim IconPlaceholder.
 */

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "cn-textarea flex field-sizing-content min-h-16 w-full outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
