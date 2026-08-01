import * as React from "react"

import { cn } from '../../utils/cn'

/**
 * Baitly UI — Input (copie de apps/v4/registry/bases/radix/ui — la source de la doc /docs/components/radix).
 * Adaptations locales : imports, propriétés logiques RTL, shim IconPlaceholder.
 */

/**
 * `forwardRef` est un ajout local : la source shadcn cible React 19, où la ref
 * est une propriété ordinaire. Sous React 18 un composant-fonction ne la reçoit
 * pas, et quatre écrans en ont besoin pour de la mécanique — insérer une
 * variable à la position du curseur, rendre le focus après une action. Sans
 * cela ils seraient restés sur MUI à eux seuls.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  function Input({ className, type, ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          "cn-input w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    )
  }
)

export { Input }
