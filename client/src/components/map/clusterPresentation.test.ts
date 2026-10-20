import {expect,it} from 'vitest';
import {clusterCountLabel,clusterDiameter,selectVisibleMapFeatures,MAP_VISIBLE_SYMBOL_LIMIT} from './clusterPresentation';

it.each([[2,'2'],[19,'10+'],[26,'25+'],[80,'50+'],[144,'100+'],[292,'250+'],[625,'500+'],[1566,'1k+'],[2809,'2.5k+'],[25993,'25k+']])('formats %s with its own lower count bracket', (count,label)=>{
 expect(clusterCountLabel(count as number)).toBe(label);
});
it('increases circle diameter across sparse and dense groups with a readable maximum',()=>{
 const sizes=[2,25,250,2500,25000,250000].map(clusterDiameter);
 expect(sizes).toEqual([...sizes].sort((a,b)=>a-b));expect(new Set(sizes).size).toBe(6);
 expect(clusterDiameter(2)).toBeGreaterThanOrEqual(32);
 expect(clusterDiameter(1_000_000)).toBeLessThanOrEqual(64);
});
it('limits displayed symbols across the viewport without changing cluster membership counts',()=>{
 const features=Array.from({length:1000},(_,index)=>({geometry:{coordinates:[index%12,Math.floor(index/12)%8]},properties:{cluster_id:index,point_count:index+1000}}));
 const selected=selectVisibleMapFeatures(features,{west:0,south:0,east:12,north:8});
 expect(selected).toHaveLength(MAP_VISIBLE_SYMBOL_LIMIT);
 expect(new Set(selected.map(feature=>`${feature.geometry.coordinates}`)).size).toBe(96);
 expect(selected.every(feature=>features.includes(feature))).toBe(true);
 expect(selected.every(feature=>feature.properties.point_count>=1000)).toBe(true);
 expect(selectVisibleMapFeatures([...features].reverse(),{west:0,south:0,east:12,north:8})).toEqual(selected);
});
