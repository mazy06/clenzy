import {cleanup,render} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {baitlyDirectoryActivities} from '../../config/baitlyDirectoryActivities';
import {baitlyDirectoryGlyph,baitlyDirectoryGlyphs} from '../../config/baitlyDirectoryGlyphs';
import {createBaitlyPin} from '../../components/map/baitlyMapPin';
import BaitlyDirectoryService from './BaitlyDirectoryService';

afterEach(cleanup);
it.each(Object.entries(baitlyDirectoryActivities))('uses the same %s symbol in the list and on the map',(service,activities)=>{
 const {container}=render(<BaitlyDirectoryService activity={activities[0]} language="fr"/>);
 const pin=createBaitlyPin({color:'teal',glyph:baitlyDirectoryGlyph(activities[0])});
 expect(container.querySelector('[data-service]')).toHaveAttribute('data-service',service);
 expect(pin.querySelector('svg g')?.innerHTML).toBe(container.querySelector('svg g')?.innerHTML);
});
it('does not label an unknown activity as maintenance',()=>{
 expect(baitlyDirectoryGlyph('unknown')).not.toBe(baitlyDirectoryGlyphs.MAINTENANCE);
});
