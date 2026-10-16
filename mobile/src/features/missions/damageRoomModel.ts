export function damageRoomType(room: string): string | undefined {
  const text=room.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  if (/^(bedroom|chambre)/.test(text)) return 'bedroom';
  if (/^(bathroom|salle de bain)/.test(text)) return 'bathroom';
  if (/^(living|salon|sejour)/.test(text)) return 'living';
  if (/^(kitchen|cuisine)/.test(text)) return 'kitchen';
  return undefined;
}
export function inventoryMatchesRoom(item: { room?: string }, selected: string) {
  const actual=item.room?damageRoomType(item.room):undefined;
  // Keep unassigned property inventory visible rather than inventing its location.
  return !!selected && (!actual || actual===damageRoomType(selected));
}
export function catalogMatchesRoom(item: { key: string; sheet: string; room: string }, selected: string) {
  const room=damageRoomType(selected);if(!room)return false;
  if(['lighting','climate','safety-access','tools','accessibility-pets','decor'].includes(item.sheet))return true;
  if(['kitchen-sink','kitchen-tap'].includes(item.key))return room==='kitchen';
  if(['dining-chair','folding-chair','bar-stool','stool','bench','dining-table','round-table','extendable-table'].includes(item.key))return room==='living'||room==='kitchen';
  if(item.sheet==='laundry-cleaning')return ['kitchen','bathroom'].includes(room)||/vacuum|broom|mop/.test(item.key);
  if(item.sheet==='electronics')return ['bedroom','living'].includes(room)||/router|smart-speaker|bluetooth-speaker/.test(item.key);
  if(item.sheet==='baby')return ['bedroom','living'].includes(room);
  return damageRoomType(item.room)===room;
}
