import {useTranslation} from '../../hooks/useTranslation';
import {prospectionMessages} from '../../i18n/baitlyProspectionMessages';
import {contactKind,type BaitlyCrmContact} from './baitlyCrmWorkspace';

export default function BaitlyCrmInsights({contacts}:{contacts:BaitlyCrmContact[]}){
  const {currentLanguage}=useTranslation();const m=prospectionMessages(currentLanguage);
  const qualifications=(['TO_QUALIFY','QUALIFIED','UNQUALIFIED'] as const).map((key,index)=>({label:m[key],count:contacts.filter(c=>(c.crm?.qualification??'TO_QUALIFY')===key).length,color:['#579bfc','#51b7ac','#cb4964'][index]}));
  const kinds=(['owner','concierge','provider'] as const).map((key,index)=>({label:m[key],count:contacts.filter(c=>contactKind(c)===key).length,color:['#579bfc','#9d70d2','#51b7ac'][index]}));
  const regions=new Map<string,number[]>();contacts.forEach(contact=>{const key=contact.crm?.region||contact.city||m.missing;const counts=regions.get(key)??[0,0,0];counts[['owner','concierge','provider'].indexOf(contactKind(contact))]++;regions.set(key,counts);});
  const ordered=[...regions].sort((a,b)=>b[1].reduce((x,y)=>x+y,0)-a[1].reduce((x,y)=>x+y,0));const max=Math.max(1,...ordered.map(([,counts])=>counts.reduce((x,y)=>x+y,0)));
  function donut(title:string,items:typeof kinds){let start=0;const stops=items.map(item=>{const end=start+(contacts.length?item.count/contacts.length*100:0);const stop=`${item.color} ${start}% ${end}%`;start=end;return stop;});return <section className="bcrm-chart"><h2>{title}</h2>{contacts.length?<div className="bcrm-chart-body"><div className="bcrm-donut" aria-hidden style={{background:`conic-gradient(${stops.join(',')})`}}/><ul>{items.map(item=><li key={item.label}><i style={{background:item.color}}/>{item.label} : {item.count} ({Math.round(item.count/contacts.length*100)} %)</li>)}</ul></div>:<p>{m.noChart}</p>}</section>;}
  return <div className="bcrm-insights">{donut(m.qualificationChart,qualifications)}{donut(m.typeChart,kinds)}<section className="bcrm-chart"><h2>{m.regionChart}</h2>{!ordered.length&&<p>{m.noChart}</p>}{ordered.map(([region,counts])=><div className="bcrm-region-row" key={region}><div><span>{region}</span><strong>{counts.reduce((x,y)=>x+y,0)}</strong></div><div className="bcrm-region-bar" aria-label={kinds.map((kind,index)=>`${kind.label}: ${counts[index]}`).join(', ')}>{counts.map((count,index)=><span key={index} style={{width:`${count/max*100}%`,background:kinds[index].color}} />)}</div></div>)}</section></div>;
}
