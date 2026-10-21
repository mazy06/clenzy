import {buildApiUrl} from '../../config/api';
import {getAccessToken} from '../../keycloak';
import {addProtocol,type RequestTransformFunction} from 'maplibre-gl';
import {BaitlyDirectoryTileCache} from './baitlyDirectoryTileCache';

const cache=new BaitlyDirectoryTileCache();
let registered=false;
const prefix=()=>buildApiUrl('/professional-directory/map-index/tiles/');

/** Keep session credentials on the first-party directory route only, never on basemap/CDN requests. */
export const directoryTileRequest:RequestTransformFunction=(url)=>{
 if(!url.startsWith(prefix()))return {url};
 if(!registered){
  addProtocol('baitly-directory',async(params,controller)=>{
   const original=decodeURIComponent(params.url.slice('baitly-directory://'.length));
   if(!original.startsWith(prefix()))throw new Error('Invalid Baitly tile URL');
   const token=getAccessToken();
   const data=await cache.load(original,controller.signal,token??null,async signal=>{
    const response=await fetch(original,{signal,credentials:'include',headers:token?{Authorization:`Bearer ${token}`}:{}});
    if(!response.ok)throw new Error(`Baitly tile HTTP ${response.status}`);
    return response.arrayBuffer();
   });
   return {data};
  });
  registered=true;
 }
 const token=getAccessToken();
 return {url:`baitly-directory://${encodeURIComponent(url)}`,credentials:'include',headers:token?{Authorization:`Bearer ${token}`}:{}};
};
