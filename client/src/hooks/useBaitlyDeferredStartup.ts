import {useEffect,useState} from 'react';
import {needsBaitlyDeferredStartup,scheduleBaitlyDeferredStartup} from '../services/baitlyDeferredStartup';

/** Nonessential shell features yield to the first useful page render. */
export function useBaitlyDeferredStartup():boolean {
 const [ready,setReady]=useState(()=>!needsBaitlyDeferredStartup());
 useEffect(()=>ready?undefined:scheduleBaitlyDeferredStartup(()=>setReady(true)),[ready]);
 return ready;
}
