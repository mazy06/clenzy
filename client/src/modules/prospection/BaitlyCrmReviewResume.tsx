import {useQuery} from '@tanstack/react-query';
import {ClipboardList} from '../../icons/glyphs';
import BaitlyCrmIconAction from './BaitlyCrmIconAction';
import {useAuth} from '../../hooks/useAuth';
import {useTranslation} from '../../hooks/useTranslation';
import {baitlyCrmLocationReviewApi} from '../../services/api/baitlyCrmLocationReviewApi';
export const locationReviewKey=(org:number,actor?:number|string)=>['prospects',org,'location-review',actor] as const;
export const reviewCopy={
 fr:{resume:'Reprendre la localisation',summary:'Bilan de localisation',remaining:'à traiter',confirmed:'validés',skipped:'passés',notFound:'sans correspondance',saved:'Progression sauvegardée',error:'Progression non enregistrée. Réessayez avant de passer au suivant.'},
 en:{resume:'Resume location review',summary:'Location review summary',remaining:'remaining',confirmed:'confirmed',skipped:'skipped',notFound:'no match',saved:'Progress saved',error:'Progress could not be saved. Retry before moving on.'},
 ar:{resume:'استئناف تحديد المواقع',summary:'ملخص تحديد المواقع',remaining:'متبقية',confirmed:'مؤكدة',skipped:'تم تجاوزها',notFound:'دون مطابقة',saved:'تم حفظ التقدم',error:'تعذر حفظ التقدم. أعد المحاولة قبل المتابعة.'},
};
export default function BaitlyCrmReviewResume({org,onOpen}:{org:number;onOpen:()=>void}){
 const {user}=useAuth();const {currentLanguage}=useTranslation();const m=reviewCopy[currentLanguage==='ar'?'ar':currentLanguage==='en'?'en':'fr'];
 const progress=useQuery({queryKey:locationReviewKey(org,user?.id),queryFn:baitlyCrmLocationReviewApi.progress,refetchOnWindowFocus:true,retry:false});
 if(!progress.data?.items.length)return null;
 return <BaitlyCrmIconAction action="review" label={progress.data.remaining?`${m.resume} (${progress.data.remaining})`:m.summary} icon={<ClipboardList size={16}/>} onClick={onOpen}/>;
}
