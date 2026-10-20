import {expect,it} from 'vitest';
import {directoryCoverageMarkers} from './baitlyDirectoryCoverageMarkers';
import type {DirectoryMapCluster,ReferencedProfessional} from '../../services/api/baitlyProfessionalDirectoryApi';
const row={id:1,name:'Entreprise chargée',activity:'81.21Z',latitude:48,longitude:2} as ReferencedProfessional;
const group:DirectoryMapCluster={key:'2:3',count:50000,latitude:45,longitude:5,west:4,south:44,east:6,north:46,representativeId:9000};
it('shows the full source count in an unloaded region without fabricating business records',()=>{
 const markers=directoryCoverageMarkers([row],[group],undefined,count=>`${count} entreprises`);
 expect(markers).toHaveLength(1);expect(markers[0]).toMatchObject({clusterCount:50000,lat:45,lng:5,type:'directory_cluster'});
 expect(markers[0].clusterBounds).toEqual([4,44,6,46]);
});
it('keeps a selected loaded company visible independently of source groups',()=>{
 const markers=directoryCoverageMarkers([row],[group],1,String);
 expect(markers).toHaveLength(2);expect(markers.find(marker=>marker.id===-1)?.name).toBe(row.name);
});
it('uses the company pin only when the singleton identity is loaded',()=>{
 const singleton={...group,count:1,representativeId:1};
 expect(directoryCoverageMarkers([row],[singleton],undefined,String)[0].id).toBe(-1);
 expect(directoryCoverageMarkers([],[singleton],undefined,String)[0].clusterCount).toBe(1);
});
