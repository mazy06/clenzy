import broom from '@iconify-icons/reicon/broom-duotone';
import hammer from '@iconify-icons/reicon/sledgehammer-duotone';
import shirt from '@iconify-icons/reicon/tshirt-duotone';
import trees from '@iconify-icons/reicon/tree';
import key from '@iconify-icons/reicon/key2-duotone';
import wrench from '@iconify-icons/reicon/setting2';
import shield from '@iconify-icons/reicon/shield-check-duotone';
import bug from '@iconify-icons/reicon/bug-duotone';
import utensils from '@iconify-icons/reicon/fork-knife';
import box from '@iconify-icons/reicon/box-duotone';
import ruler from '@iconify-icons/reicon/ruler-duotone';
import building from '@iconify-icons/reicon/buildings-duotone';
import {createIcon,type IconComponent,type IconData} from '../icons/createIcon';
import type {DirectoryService} from '../services/api/baitlyProfessionalDirectoryApi';
import {baitlyDirectoryActivity} from './baitlyDirectoryActivities';

/** One set of compiled assets for directory rows and their DOM map pins. */
export const baitlyDirectoryGlyphs:Record<DirectoryService,IconData>={
 CLEANING:broom,MAINTENANCE:hammer,LAUNDRY:shirt,EXTERIOR:trees,CONCIERGE:key,
 REPAIRS:wrench,SECURITY:shield,PEST_CONTROL:bug,CATERING:utensils,MOVING:box,PROPERTY_EXPERTS:ruler,
};
export const baitlyDirectoryIcons=Object.fromEntries(Object.entries(baitlyDirectoryGlyphs).map(([service,glyph])=>[service,createIcon(`Directory${service}`,{duotone:glyph})])) as Record<DirectoryService,IconComponent>;
export const baitlyDirectoryFallbackIcon=createIcon('DirectoryBuilding',{duotone:building});
export function baitlyDirectoryGlyph(activity:string,registeredService?:DirectoryService):IconData {
 const service=registeredService??baitlyDirectoryActivity(activity);return service?baitlyDirectoryGlyphs[service]:building;
}
