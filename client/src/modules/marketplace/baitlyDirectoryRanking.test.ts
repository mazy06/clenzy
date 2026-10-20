import {expect,it} from 'vitest';
import {rankDirectoryRows} from './baitlyDirectoryRanking';
import type {ReferencedProfessional} from '../../services/api/baitlyProfessionalDirectoryApi';
const bounds={west:0,south:44,east:4,north:48};
const row=(id:number,name:string,latitude:number,extra:Partial<ReferencedProfessional>={}):ReferencedProfessional=>({id,name,latitude,longitude:2,phone:null,email:null,...extra} as ReferencedProfessional);
it('prioritizes the visible area then spherical proximity, with a deterministic ID tie-breaker',()=>{
 const rows=[row(4,'Outside',60),row(3,'Near',46),row(2,'Far',47),row(1,'Near',46)];
 expect(rankDirectoryRows(rows,bounds,'PROXIMITY').map(r=>r.id)).toEqual([1,3,2,4]);
 expect(rows.map(r=>r.id)).toEqual([4,3,2,1]);
});
it('ranks two contact channels, one channel, then none; a website alone does not count',()=>{
 const rows=[row(1,'Website',46,{website:'https://example.com'}),row(2,'Email',47,{email:'a@example.com'}),row(3,'Both',47,{email:'b@example.com',phone:'123'})];
 expect(rankDirectoryRows(rows,bounds,'CONTACTS').map(r=>r.id)).toEqual([3,2,1]);
 expect(rankDirectoryRows(rows,bounds,'NAME').map(r=>r.id)).toEqual([3,2,1]);
});
it('handles a viewport that crosses the date line',()=>{
 const rows=[row(1,'Near',0,{longitude:-179}),row(2,'Far',0,{longitude:0})];
 expect(rankDirectoryRows(rows,{west:170,east:-170,south:-1,north:1},'PROXIMITY').map(r=>r.id)).toEqual([1,2]);
});
