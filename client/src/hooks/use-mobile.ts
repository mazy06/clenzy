import * as React from "react"

const MOBILE_BREAKPOINT = 768

/**
 * `true` sous le palier donné.
 *
 * Adaptation locale : le palier est paramétrable. La navigation Baitly bascule
 * en feuille latérale sous `lg` (1024) et non sous `md` (768) — un rail
 * d'icônes sur tablette reposerait entièrement sur des infobulles au survol,
 * qui n'existent pas au doigt. Le défaut reste 768 pour tout autre usage.
 */
export function useIsMobile(breakpoint: number = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < breakpoint)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < breakpoint)
    return () => mql.removeEventListener("change", onChange)
  }, [breakpoint])

  return !!isMobile
}
