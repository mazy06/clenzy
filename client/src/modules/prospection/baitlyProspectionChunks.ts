/** Shared loaders let the selected map load in parallel with its lightweight page shell. */
export const loadBaitlyCrmWorkspace=()=>import('./BaitlyCrmLegacyWorkspace').then(module=>({default:module.BaitlyCrmWorkspace}));
export const loadBaitlyContactMap=()=>import('./BaitlyCrmMap');
