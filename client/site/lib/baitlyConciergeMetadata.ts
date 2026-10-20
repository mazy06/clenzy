import { BAITLY_CONCIERGES } from './messages/baitlyConcierges';
import type { SiteLanguage } from './siteLanguage';
import { recruitmentMessages } from '../../src/i18n/baitlyRecruitmentMessages';
import { campaignMessages } from '../../src/i18n/baitlyCampaignMessages';

/** Profile availability is checked live; never index a build-time assumption of publication. */
export function conciergeMetadata(path: string,language: SiteLanguage) {
  if(path==='/campagnes/reponse')return {title:`${campaignMessages(language).responseTitle} | Baitly`,description:campaignMessages(language).responsePrivacy,index:false};
  if(path.startsWith('/recrutement/')){
    const m=recruitmentMessages(language);
    return {title:`${m.title} | Baitly`,description:m.apply,index:false};
  }
  if(path !== '/conciergeries' && !path.startsWith('/conciergeries/')) return undefined;
  const m=BAITLY_CONCIERGES[language];
  return { title:`${m.directory} | Baitly`,description:m.intro,index:path === '/conciergeries' };
}
