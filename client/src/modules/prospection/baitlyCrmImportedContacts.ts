import type {DirectoryImportResult} from '../../services/api/baitlyProfessionalDirectoryApi';

/** Similar identities need review first; only confirmed import identities enter the location queue. */
export function importedCrmContactIds(results:DirectoryImportResult[]):number[]{
 return [...new Set(results.filter(item=>(item.status==='CREATED'||item.status==='EXISTING')&&
  item.id!==null&&Number.isSafeInteger(item.id)&&item.id>0).map(item=>item.id!))];
}
