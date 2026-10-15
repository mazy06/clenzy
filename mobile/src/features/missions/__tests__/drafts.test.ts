jest.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///app/', deleteAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'photo-id' }));
import * as SecureStore from 'expo-secure-store';
import { readMissionDraft } from '../drafts';
beforeEach(() => { jest.clearAllMocks(); });
it('rejects corrupt or unexpected encrypted draft data', async () => {
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('{"notes":null}');
  expect(await readMissionDraft(['baitly-mobile-v1', 'A', 1], 9)).toBeNull();
});
it('does not restore arbitrary file paths as pending media', async () => {
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify({ notes: 'Done', steps: [], savedAt: 'now',
    photos: [{ uri: 'file:///private/other-file', phase: 'after' }] }));
  expect(await readMissionDraft(['baitly-mobile-v1', 'A', 1], 9)).toBeNull();
});
it('reads separate draft keys for two accounts', async () => {
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
  await readMissionDraft(['baitly-mobile-v1', 'A', 1], 9); await readMissionDraft(['baitly-mobile-v1', 'B', 1], 9);
  expect(SecureStore.getItemAsync).toHaveBeenNthCalledWith(1, 'baitly_draft_A_1_9');
  expect(SecureStore.getItemAsync).toHaveBeenNthCalledWith(2, 'baitly_draft_B_1_9');
});
