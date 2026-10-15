import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../hooks/useTranslation';
import apiClient from '../../../services/apiClient';
import { Alert, AlertDescription, Button, Input, Checkbox } from '../../../components/ui';

/** Explicit publication metadata; private guest photos are never copied automatically. */
export function BaitlyReviewPublication({id}:{id:number}) {
  const {t}=useTranslation();
  const [name,setName]=useState(''),[avatar,setAvatar]=useState('');
  const [published,setPublished]=useState(false),[consent,setConsent]=useState(false);
  const [loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[failed,setFailed]=useState(false),[saved,setSaved]=useState(false);
  const flight=useRef(false);
  useEffect(()=>{let active=true;setLoaded(false);setSaved(false);setConsent(false);setFailed(false);
    apiClient.get<{name:string|null;avatarUrl:string|null;published:boolean|null}>(`/mobile/public-profile/reviews/${id}/identity`).then(value=>{
      if(active){setName(value.name??'');setAvatar(value.avatarUrl??'');setPublished(value.published===true);setLoaded(true);}
    }).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};},[id]);
  async function save(){if(flight.current)return;flight.current=true;setBusy(true);setFailed(false);setSaved(false);
    try{await apiClient.put(`/mobile/public-profile/reviews/${id}/identity`,{name:name.trim(),avatarUrl:avatar.trim(),published,authorConsent:consent});setSaved(true);}
    catch{setFailed(true);}finally{flight.current=false;setBusy(false);}}
  return <details className="mt-3 border-t border-border pt-3">
    <summary className="cursor-pointer text-sm font-medium focus-visible:outline focus-visible:outline-2">{t('baitlyPublicReview.title','Publication dans Baitly')}</summary>
    <div className="mt-3 flex flex-col gap-3">
      {failed?<Alert><AlertDescription>{t('baitlyPublicReview.failed','Publication indisponible ou accès refusé.')}</AlertDescription></Alert>:null}
      {loaded?<>
        <label className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={published} onCheckedChange={value=>setPublished(value===true)} disabled={busy}/>{t('baitlyPublicReview.visible','Avis visible sur la fiche publique du logement')}</label>
        <label className="flex flex-col gap-1 text-sm">{t('baitlyPublicReview.name','Nom public (facultatif)')}<Input value={name} onChange={event=>setName(event.target.value)} maxLength={100} disabled={busy}/></label>
        <label className="flex flex-col gap-1 text-sm">{t('baitlyPublicReview.photo','URL HTTPS de la photo publique (facultative)')}<Input type="url" value={avatar} onChange={event=>setAvatar(event.target.value)} maxLength={2048} disabled={busy}/></label>
        <label className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={consent} onCheckedChange={value=>setConsent(value===true)} disabled={busy}/>{t('baitlyPublicReview.consent','L’auteur a autorisé la publication de ce nom et de cette photo.')}</label>
        <Button variant="outline" size="sm" className="cursor-pointer self-start" disabled={busy||Boolean(name.trim()||avatar.trim())&&!consent} onClick={()=>{void save();}}>{t('common.save','Enregistrer')}</Button>
        {saved?<p role="status" className="text-sm text-success-ink">{t('baitlyPublicReview.saved','Publication enregistrée.')}</p>:null}
      </>:null}
    </div>
  </details>;
}
