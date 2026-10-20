import { useEffect, useState } from 'react';
import { parseApiDate } from '../../utils/formatUtils';

/** Le serveur stocke le créneau en UTC, même sans suffixe de fuseau. */
export function useInterventionStartTime(scheduledDate: string | null | undefined): boolean {
  const start = scheduledDate ? parseApiDate(scheduledDate).getTime() : NaN;
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const refresh = () => setNow(Date.now());
    refresh();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      const remaining = start - Date.now();
      if (remaining > 0) timer = setTimeout(() => { refresh(); arm(); }, Math.min(remaining, 2_147_483_647));
    };
    arm();
    window.addEventListener('focus', refresh);
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [start]);

  return Number.isFinite(start) && now < start;
}
