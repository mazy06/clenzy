import {signalBaitlyProspectionReady} from './baitlyDeferredStartup';

type ProspectionStage='view-resolved'|'map-created'|'basemap-visible'|'professionals-visible'|'list-available';
/** Fixed, first-load timings available in DevTools, without company or account data. */
export function markBaitlyProspection(stage:ProspectionStage):void {
 try {
  const name=`baitly:prospection:${stage}`;
  if(performance.getEntriesByName(name,'mark').length)return;
  performance.mark(name);
  performance.measure(`baitly:prospection:until-${stage}`,{start:0,end:name});
  if(performance.getEntriesByName('baitly:boot:user-ready','mark').length)
   performance.measure(`baitly:prospection:authenticated-to-${stage}`,{start:'baitly:boot:user-ready',end:name});
 }catch{/* Measurement must never delay the page. */}
}

/** Wait until React's data commit has had a chance to paint before background work. */
export function releaseBaitlyProspectionStartup():()=>void {
 let second=0;
 const first=requestAnimationFrame(()=>{second=requestAnimationFrame(signalBaitlyProspectionReady);});
 return ()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);};
}
