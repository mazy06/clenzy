import { AspectRatio as AspectRatioPrimitive } from "radix-ui"

/**
 * Baitly UI — AspectRatio (copie de apps/v4/registry/bases/radix/ui — la source de la doc /docs/components/radix).
 * Adaptations locales : imports, propriétés logiques RTL, shim IconPlaceholder.
 */

function AspectRatio({
  ...props
}: React.ComponentProps<typeof AspectRatioPrimitive.Root>) {
  return <AspectRatioPrimitive.Root data-slot="aspect-ratio" {...props} />
}

export { AspectRatio }
