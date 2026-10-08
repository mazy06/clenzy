import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import fr from './public/locales/fr.json';
import ar from './public/locales/ar.json';
import { OrbitDiagram } from './src/modules/supervision/renderers/OrbitDiagram';
import { AgentPortrait } from './src/modules/supervision/renderers/AgentPortrait';
import { SupervisionTethers } from './src/modules/supervision/components/SupervisionTethers';
import { AGENT_IDS } from './src/modules/supervision/constants';
import type { AgentId, PortfolioPendingAction } from './src/modules/supervision/types';
import './src/theme/signature/tokens.css';
import './src/theme/base.css';
import './src/theme/baitly-ui.css';
const i18n = createInstance();
await i18n.init({ lng:'fr', resources:{fr:{translation:fr},ar:{translation:ar}}, interpolation:{escapeValue:false} });
const speechExamples: Record<AgentId, [string, string, string][]> = {
  com: [['GUIDE_SEND', 'Envoyer le livret d’accueil', 'إرسال دليل الترحيب'], ['CONVERSATION_TAKEOVER', 'Répondre au voyageur', 'الرد على الضيف']],
  rev: [['PRICE_DROP', 'Ajuster le tarif des nuits disponibles', 'تعديل أسعار الليالي المتاحة'], ['PROMO_DEACTIVATE', 'Terminer la promotion du week-end', 'إنهاء عرض نهاية الأسبوع']],
  ops: [['CLEANING_REQUEST', 'Planifier le ménage après le départ', 'جدولة التنظيف بعد المغادرة'], ['REASSIGN_CLEANING', 'Trouver un prestataire disponible', 'البحث عن مقدم خدمة متاح']],
  fin: [['PAYMENT_REMINDER', 'Relancer le solde du séjour', 'التذكير بسداد المبلغ المتبقي'], ['DEPOSIT_REFUND', 'Restituer le dépôt de garantie', 'إعادة مبلغ التأمين']],
  rep: [['REVIEW_DRAFT_REPLY', 'Répondre au dernier avis voyageur', 'الرد على آخر تقييم للضيف'], ['REVIEW_REQUEST_SEND', 'Inviter le voyageur à laisser un avis', 'دعوة الضيف لكتابة تقييم']],
  sync: [['ICAL_RETRY', 'Relancer la synchronisation du calendrier', 'إعادة مزامنة التقويم'], ['PARITY_REPUBLISH', 'Vérifier les tarifs sur les canaux', 'التحقق من الأسعار على القنوات']],
  cmp: [['POLICE_DECLARE', 'Préparer la fiche voyageur', 'إعداد استمارة الضيف'], ['TAX_MARK_FILED', 'Vérifier la déclaration de taxe de séjour', 'التحقق من تصريح ضريبة الإقامة']],
  gst: [['LATE_CHECKOUT_APPROVAL', 'Examiner une demande de départ tardif', 'مراجعة طلب مغادرة متأخرة'], ['UPSELL_OFFER', 'Proposer une expérience au voyageur', 'اقتراح تجربة للضيف']],
  own: [['OWNER_STATEMENT_SEND', 'Envoyer le relevé mensuel au propriétaire', 'إرسال الكشف الشهري للمالك'], ['OWNER_PAYOUT', 'Préparer le reversement propriétaire', 'إعداد التحويل إلى المالك']],
  gro: [['CHANNEL_PUBLISH', 'Publier le logement sur un nouveau canal', 'نشر العقار على قناة جديدة'], ['SITE_TRANSLATION_DRAFT', 'Préparer la traduction de l’annonce', 'إعداد ترجمة الإعلان']],
};
function Review() {
  const [selected,setSelected]=useState<AgentId>('gro');
  const [head,setHead]=useState<AgentId|null>(null);
  const [paused,setPaused]=useState(false);
  const [dark,setDark]=useState(false);
  const [rtl,setRtl]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';},[dark]);
  useEffect(()=>{i18n.changeLanguage(rtl?'ar':'fr');},[rtl]);
  const pending = useMemo<PortfolioPendingAction[]>(() => AGENT_IDS.flatMap(id => speechExamples[id].map(([type, titleFr, titleAr], index) => ({
    id: `review-${id}-${index}`, agentId: id, applyActionType: type,
    title: rtl ? titleAr : titleFr, motif: '', reasoning: '',
    propertyId: 'review-property', propertyName: rtl ? 'رياض أطلس' : 'Riad Atlas',
    createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + (index + 2) * 3_600_000).toISOString(),
  }))), [rtl]);
  const agents=AGENT_IDS.map(id=>({id,status:'wait' as const,autonomy:'notify' as const,task:null,pendingCount:2}));
  return <I18nextProvider i18n={i18n}><div dir={rtl?'rtl':'ltr'} style={{padding:16,color:'var(--bui-foreground)',background:'var(--bui-background)',minHeight:'100vh'}}>
    <nav style={{display:'flex',gap:16,flexWrap:'wrap'}}><button onClick={()=>setPaused(!paused)}>{paused?'Reprendre':'Pause'}</button><button onClick={()=>setDark(!dark)}>Thème</button><button onClick={()=>setRtl(!rtl)}>Arabe / français</button></nav>
    <div ref={root} className="review-layout" style={{position:'relative',display:'grid',gridTemplateColumns:'minmax(0,1fr) 240px',gap:24,height:680,maxWidth:1200,margin:'0 auto'}}>
      <OrbitDiagram agents={agents} pendingItems={pending} selected={selected} onSelect={setSelected} flowEnabled={!paused} onHeadAgentSettled={setHead}/>
      <aside style={{paddingTop:130}}><article data-pending-action="1" data-agent-id={selected} style={{border:'1px solid var(--bui-border)',padding:20,borderRadius:16,background:'var(--bui-card)'}}>Action de l’agent {selected}<div style={{width:180,height:180,marginTop:20}}><AgentPortrait agentId={selected} receiving={!paused&&head===selected}/></div></article></aside>
      <SupervisionTethers rootRef={root} headAgent={head} revision={selected}/>
    </div><style>{'@media(max-width:650px){.review-layout{grid-template-columns:minmax(0,1fr)!important;height:auto!important}.review-layout>aside{padding-top:0!important}.review-layout [data-supervision-constellation]{min-height:360px}}'}</style>
  </div></I18nextProvider>
}
createRoot(document.getElementById('root')!).render(<Review/>);
