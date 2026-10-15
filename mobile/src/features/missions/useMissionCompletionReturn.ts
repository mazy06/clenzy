import { useEffect } from 'react';
import type { MobileMission } from './api';
/** Return only after an acknowledged submission and completion of local work. */
export function useMissionCompletionReturn(receipt: MobileMission | undefined, busy: boolean, onHome: () => void) {
  useEffect(()=>{
    if(!receipt||busy||!['AWAITING_VALIDATION','COMPLETED'].includes(receipt.status))return;
    const timer=setTimeout(onHome,1800);return()=>clearTimeout(timer);
  },[receipt,busy,onHome]);
}
