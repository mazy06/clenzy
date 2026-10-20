import {useMutation,useQueryClient} from '@tanstack/react-query';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,Button} from '../../components/ui';
import {useTranslation} from '../../hooks/useTranslation';
import {prospectsApi} from '../../services/api/prospectsApi';
import {prospectsKeys} from '../../hooks/useProspects';
import {crmDeletionMessages} from '../../i18n/baitlyCrmDeletionMessages';
import type {BaitlyCrmContact} from './baitlyCrmWorkspace';

export default function BaitlyCrmDeleteContacts({targets,onDeleted,onCancel}:{targets:Pick<BaitlyCrmContact,'id'|'name'>[];onDeleted:(ids:number[])=>void;onCancel:()=>void}){
  const {currentLanguage}=useTranslation();const m=crmDeletionMessages(currentLanguage);const client=useQueryClient();
  const remove=useMutation({mutationFn:()=>prospectsApi.deleteMany(targets.map(contact=>contact.id)),retry:false,onSuccess:async()=>{
    await client.invalidateQueries({queryKey:prospectsKeys.all});onDeleted(targets.map(contact=>contact.id));
  }});
  return <AlertDialog open onOpenChange={open=>{if(!open&&!remove.isPending)onCancel();}}><AlertDialogContent size="sm">
    <AlertDialogHeader><AlertDialogTitle>{m.title(targets.length)}</AlertDialogTitle><AlertDialogDescription>{m.description}</AlertDialogDescription></AlertDialogHeader>
    <p className="bcrm-delete-names">{targets.slice(0,3).map(contact=>contact.name).join(', ')}{targets.length>3?'…':''}</p>
    {remove.isError&&<p role="alert" className="text-sm text-destructive">{m.error}</p>}
    <AlertDialogFooter><AlertDialogCancel disabled={remove.isPending}>{m.cancel}</AlertDialogCancel><Button className="bcrm-confirm-delete" type="button" variant="destructive" disabled={remove.isPending} onClick={()=>remove.mutate()}>{remove.isPending?m.busy:m.remove}</Button></AlertDialogFooter>
  </AlertDialogContent></AlertDialog>;
}
