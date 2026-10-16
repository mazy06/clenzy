import { useEffect, useState } from 'react';

/** La première grille publie prix et séjours ensemble ; le scroll conserve la grille montée. */
export function useBaitlyPlanningPublication(ready: boolean) {
  const [published, setPublished] = useState(false);
  useEffect(() => {
    if (ready) setPublished(true);
  }, [ready]);
  return published || ready;
}
