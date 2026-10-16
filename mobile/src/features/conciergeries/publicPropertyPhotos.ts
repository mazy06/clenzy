import { baitlyDemoPhoto } from '@/features/marketplace/baitlyDemoPhotos';
import type { PublicProperty } from './publicProfiles';

const demoPhotoIds: Record<string, number> = { cleaning: -1, pool: -2, garden: -3, maintenance: -4, laundry: -5 };
export function publicPropertyPhotos(property: PublicProperty, demo: boolean): (string | number)[] {
  return demo ? property.photos.map(key => baitlyDemoPhoto(demoPhotoIds[key])).filter(Boolean) : property.photos;
}
