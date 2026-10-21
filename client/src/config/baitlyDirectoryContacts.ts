/** Contact presence, never a marketing authorization. A website alone is not an email/phone contact. */
export const directoryContactFilters=['','ANY','EMAIL','PHONE','BOTH','NONE'] as const;
export type DirectoryContactFilter=typeof directoryContactFilters[number];
export function matchesDirectoryContacts(row:{email:string|null;phone:string|null},filter:DirectoryContactFilter){
 const email=!!row.email?.trim(),phone=!!row.phone?.trim();
 switch(filter){case 'ANY':return email||phone;case 'EMAIL':return email;case 'PHONE':return phone;case 'BOTH':return email&&phone;case 'NONE':return !email&&!phone;default:return true;}
}
