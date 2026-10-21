import { expect,it } from 'vitest';
import { ownerCriteria,ownerCriteriaParams,ownerPropertySearchUrl } from './baitlyOwnerCriteria';
it('keeps the selected home criteria through a profile link without copying private data',() => {
  const home={ city:'Rabat',propertyType:'riad',countryCode:'MA',address:'Private address',id:42,ownerId:12,email:'private@example.com' };
  const url=ownerPropertySearchUrl(home,'fr');
  expect(url).toBe('https://baitly.fr/conciergeries?lang=fr&utm_source=baitly-app&utm_medium=property&utm_campaign=owner-matching&city=Rabat&country=MA&propertyType=RIAD');
  expect(url).not.toContain('Private');expect(url).not.toContain('ownerId');expect(url).not.toContain('email');
});
it('round trips targeted requirements, retaining only allowed criteria and attribution',() => {
  const criteria=ownerCriteria('?city=Rabat&country=ma&propertyType=RIAD&service=CLEANING&service=GUESTS&service=INVALID&maxFee=18.50&token=secret');
  expect(criteria).toMatchObject({city:'Rabat',country:'MA',propertyType:'RIAD',services:['CLEANING','GUESTS'],maxFee:'18.50'});
  const params=ownerCriteriaParams(criteria,'ar','?utm_campaign=salon&organizationId=999');
  expect(ownerCriteria(params.toString())).toEqual(criteria);expect(params.get('utm_campaign')).toBe('salon');
  expect(params.has('organizationId')).toBe(false);expect(params.has('token')).toBe(false);
});
it('rejects invalid fees and types in public URL prefill',() => {
  expect(ownerCriteria('?maxFee=101&country=XXx&propertyType=secret&service=INVALID')).toMatchObject({maxFee:'',country:'',propertyType:'APARTMENT',services:[]});
});
