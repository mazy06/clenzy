import * as React from "react"
import { Tooltip as TooltipPrimitive } from "radix-ui"

import { cn } from '../../utils/cn'

/**
 * Baitly UI — Tooltip (copie de apps/v4/registry/bases/radix/ui — la source de la doc /docs/components/radix).
 * Adaptations locales : imports, propriétés logiques RTL, shim IconPlaceholder.
 */

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  // Adaptation Baitly : le site shadcn monte un TooltipProvider global dans
  // son layout ; ici chaque Tooltip s'auto-enveloppe (comportement des
  // versions shadcn précédentes) — un provider imbriqué est sans effet.
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  )
}

/** `forwardRef` ajoute localement pour React 18 — cf. la note dans `button.tsx`. */
const TooltipTrigger = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Trigger>,
  React.ComponentProps<typeof TooltipPrimitive.Trigger>
>(function TooltipTrigger(props, ref) {
  return <TooltipPrimitive.Trigger ref={ref} data-slot="tooltip-trigger" {...props} />
})

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "cn-tooltip-content z-50 w-fit max-w-xs origin-(--radix-tooltip-content-transform-origin) bg-foreground text-background",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="cn-tooltip-arrow z-50 translate-y-[calc(-50%_-_2px)] bg-foreground fill-foreground" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

/**
 * Racine SANS provider, pour les listes longues.
 *
 * <p>`Tooltip` s'auto-enveloppe d'un `TooltipProvider` : pratique à l'unité,
 * ruineux en liste. Le planning monte jusqu'à cinq infobulles par brique et
 * trois cent quarante briques d'emblée — soit près d'un millier de providers
 * imbriqués, chacun avec son contexte et ses minuteries, tous re-rendus à
 * chaque extension du buffer.</p>
 *
 * <p>Usage : UN `TooltipProvider` autour de la liste, puis `TooltipRoot` par
 * élément. Le comportement est identique — c'est le même composant Radix,
 * privé de son enveloppe redondante.</p>
 */
const TooltipRoot = TooltipPrimitive.Root

export { Tooltip, TooltipRoot, TooltipContent, TooltipProvider, TooltipTrigger }
