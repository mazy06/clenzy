import type {DirectoryService} from '../services/api/baitlyProfessionalDirectoryApi';

/** Registered NAF Rev. 2 activity, never a verification of services actually offered.
 * Keep aligned with BaitlyProfessionalSearchFilters.SERVICES on the server. */
export const baitlyDirectoryActivities:Record<DirectoryService,readonly string[]> = {
  CLEANING: ["81.21Z","81.22Z","81.29B"],
  MAINTENANCE: ["43.21A","43.22A","43.22B","43.32A","43.32B","43.39Z","43.11Z","43.12A","43.12B","43.13Z","43.21B","43.29A","43.29B","43.31Z","43.32C","43.33Z","43.34Z","43.91A","43.91B","43.99A","43.99B","43.99C","43.99D","43.99E"],
  LAUNDRY: ["96.01A","96.01B"],
  EXTERIOR: ["81.30Z"],
  CONCIERGE: ["81.10Z","68.32A"],
  REPAIRS: ["95.11Z","95.12Z","95.21Z","95.22Z","95.23Z","95.24Z","95.25Z","95.29Z"],
  SECURITY: ["80.10Z","80.20Z","80.30Z"],
  PEST_CONTROL: ["81.29A"],
  CATERING: ["56.10A","56.10B","56.10C","56.21Z","56.29A","56.29B","56.30Z"],
  MOVING: ["49.42Z","52.10B"],
  PROPERTY_EXPERTS: ["71.12B","71.20B","74.10Z","77.29Z"],
};
export function baitlyDirectoryActivity(activity:string):DirectoryService|undefined {
  const normalized=activity.trim().toUpperCase();
  return (Object.keys(baitlyDirectoryActivities) as DirectoryService[]).find(service=>baitlyDirectoryActivities[service].includes(normalized));
}
