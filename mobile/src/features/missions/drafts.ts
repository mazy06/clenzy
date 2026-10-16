import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
export interface DraftPhoto { uri: string; phase: 'before' | 'after'; step?: string; room?: string }
export interface MissionDraft { notes: string; steps: string[]; photos: DraftPhoto[]; savedAt: string }
const INDEX = 'baitly_mission_draft_index';
const DIRECTORY = `${FileSystem.documentDirectory}baitly-mission-drafts/`;
let flight: Promise<unknown> = Promise.resolve();
function key(scope: readonly unknown[], id: number) {
  return `baitly_draft_${scope.slice(1).map(v => String(v).replace(/[^a-zA-Z0-9._-]/g, '_')).join('_')}_${id}`;
}
export async function readMissionDraft(scope: readonly unknown[], id: number): Promise<MissionDraft | null> {
  const value = await SecureStore.getItemAsync(key(scope, id));
  if (!value) return null;
  try {
    const draft = JSON.parse(value) as MissionDraft;
    if (!draft || typeof draft.notes !== 'string' || typeof draft.savedAt !== 'string'
      || !Array.isArray(draft.steps) || !draft.steps.every(step => typeof step === 'string')
      || !Array.isArray(draft.photos) || !draft.photos.every(photo => photo && typeof photo.uri === 'string'
        && photo.uri.startsWith(DIRECTORY) && (photo.phase === 'before' || photo.phase === 'after')
        && (photo.step === undefined || (typeof photo.step === 'string' && /^[a-zA-Z_]{1,40}$/.test(photo.step)))
        && (photo.room === undefined || (typeof photo.room === 'string' && /^[a-zA-Z_0-9]{1,40}$/.test(photo.room))))) return null;
    return draft;
  } catch { return null; }
}
export function saveMissionDraft(scope: readonly unknown[], id: number, draft: MissionDraft) {
  const draftKey = key(scope, id);
  const operation = flight.catch(() => {}).then(async () => {
    const index: string[] = JSON.parse(await SecureStore.getItemAsync(INDEX) || '[]');
    if (!index.includes(draftKey)) await SecureStore.setItemAsync(INDEX, JSON.stringify([...index, draftKey]));
    await SecureStore.setItemAsync(draftKey, JSON.stringify(draft));
  });
  flight = operation;
  return operation;
}
export async function retainDraftPhoto(uri: string): Promise<string> {
  await FileSystem.makeDirectoryAsync(DIRECTORY, { intermediates: true });
  const target = `${DIRECTORY}${Crypto.randomUUID()}.jpg`;
  await FileSystem.copyAsync({ from: uri, to: target });
  return target;
}
export async function removeDraftPhoto(uri: string) {
  if (uri.startsWith(DIRECTORY)) await FileSystem.deleteAsync(uri, { idempotent: true });
}
export async function clearMissionDraft(scope: readonly unknown[], id: number) {
  await flight.catch(() => {});
  const draft = await readMissionDraft(scope, id);
  for (const photo of draft?.photos ?? []) await removeDraftPhoto(photo.uri);
  await SecureStore.deleteItemAsync(key(scope, id));
}
export async function clearAllMissionDrafts() {
  await flight.catch(() => {});
  const index: string[] = JSON.parse(await SecureStore.getItemAsync(INDEX) || '[]');
  await Promise.all(index.map(k => SecureStore.deleteItemAsync(k)));
  await SecureStore.deleteItemAsync(INDEX);
  await FileSystem.deleteAsync(DIRECTORY, { idempotent: true });
}
