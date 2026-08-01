import * as React from "react"

import { cn } from '../../utils/cn'

/**
 * Baitly UI — Stepper. Seul primitif de cette campagne qui n'a PAS d'equivalent
 * shadcn : il est ecrit ici parce que sept ecrans en dependaient via MUI et que
 * les laisser seuls sur @mui/material aurait retenu toute la dependance.
 *
 * <h3>Ce qui est repris de MuiStepper, et ce qui ne l'est pas</h3>
 * Repris : la pastille numerotee, la coche a l'etape franchie, le connecteur
 * qui se teinte jusqu'a l'etape courante, l'orientation horizontale ou
 * verticale, et l'API `activeStep` (index a base 0).
 * Non repris : le mode `alternativeLabel` et les etapes `optional` de MUI, que
 * l'application n'utilisait nulle part.
 *
 * L'etat est porte par `aria-current="step"` sur l'etape active, et les etapes
 * franchies par `data-state="done"` — un lecteur d'ecran annonce donc la
 * progression, ce que la version MUI ne faisait pas ici.
 */

type Orientation = "horizontal" | "vertical"

const StepperContext = React.createContext<{ activeStep: number; orientation: Orientation }>({
  activeStep: 0,
  orientation: "horizontal",
})

function Stepper({
  activeStep = 0,
  orientation = "horizontal",
  className,
  children,
  ...props
}: React.ComponentProps<"ol"> & { activeStep?: number; orientation?: Orientation }) {
  const valeur = React.useMemo(() => ({ activeStep, orientation }), [activeStep, orientation])
  return (
    <StepperContext.Provider value={valeur}>
      <ol
        data-slot="stepper"
        data-orientation={orientation}
        className={cn(
          "flex",
          orientation === "horizontal" ? "flex-row items-center" : "flex-col",
          className,
        )}
        {...props}
      >
        {React.Children.map(children, (enfant, i) =>
          React.isValidElement(enfant) ? React.cloneElement(enfant as React.ReactElement<StepProps>, { index: i }) : enfant,
        )}
      </ol>
    </StepperContext.Provider>
  )
}

interface StepProps extends Omit<React.ComponentProps<"li">, "children"> {
  /** Injecte par <Stepper> — ne pas passer a la main. */
  index?: number
  children?: React.ReactNode
}

function Step({ index = 0, className, children, ...props }: StepProps) {
  const { activeStep, orientation } = React.useContext(StepperContext)
  const etat = index < activeStep ? "done" : index === activeStep ? "active" : "todo"
  return (
    <li
      data-slot="step"
      data-state={etat}
      aria-current={etat === "active" ? "step" : undefined}
      className={cn(
        "flex min-w-0",
        orientation === "horizontal" ? "flex-1 flex-row items-center gap-2" : "flex-col",
        // Le connecteur est porte par l'etape, pas par un noeud dedie : ainsi
        // la derniere n'en a pas, sans que l'appelant ait a le savoir.
        orientation === "horizontal"
          ? "after:mx-2 after:h-px after:flex-1 after:content-[''] last:after:hidden"
          : "after:my-1 after:ms-[11px] after:h-4 after:w-px after:content-[''] last:after:hidden",
        etat === "todo" ? "after:bg-[var(--line)]" : "after:bg-[var(--accent)]",
        className,
      )}
      {...props}
    >
      {React.Children.map(children, (enfant) =>
        React.isValidElement(enfant) ? React.cloneElement(enfant as React.ReactElement<{ index?: number }>, { index }) : enfant,
      )}
    </li>
  )
}

function StepLabel({
  index = 0,
  className,
  children,
  ...props
}: React.ComponentProps<"span"> & { index?: number }) {
  const { activeStep } = React.useContext(StepperContext)
  const done = index < activeStep
  const active = index === activeStep

  return (
    <span
      data-slot="step-label"
      className={cn("flex min-w-0 items-center gap-1.5", className)}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "inline-flex size-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition-colors",
          done && "bg-[var(--accent)] text-[var(--on-accent)]",
          active && "bg-[var(--accent)] text-[var(--on-accent)]",
          !done && !active && "bg-[var(--field)] text-[var(--faint)]",
        )}
      >
        {done ? (
          <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth={2.4}>
            <path d="M3.5 8.5l3 3 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          index + 1
        )}
      </span>
      <span
        className={cn(
          "truncate text-[0.72rem] font-semibold whitespace-nowrap",
          active ? "text-[var(--ink)]" : done ? "text-[var(--body)]" : "text-[var(--faint)]",
        )}
      >
        {children}
      </span>
    </span>
  )
}

export { Stepper, Step, StepLabel }
