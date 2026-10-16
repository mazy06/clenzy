const mockPrompt = jest.fn();
const mockMakeUrl = jest.fn().mockResolvedValue('url');
const mockExchange = jest.fn();
const mockConstructor = jest.fn();
jest.mock('expo-crypto', () => ({ randomUUID: () => 'unique-state' }));
jest.mock('expo-auth-session', () => ({
  AuthRequest: class { codeVerifier = 'secret-verifier'; constructor(config: unknown) { mockConstructor(config); }
    makeAuthUrlAsync = mockMakeUrl; promptAsync = mockPrompt; },
  CodeChallengeMethod: { S256: 'S256' }, ResponseType: { Code: 'code' },
  fetchDiscoveryAsync: jest.fn().mockResolvedValue({ tokenEndpoint: 'token' }),
  exchangeCodeAsync: (...args: unknown[]) => mockExchange(...args),
}));
jest.mock('@/config/api', () => ({ KEYCLOAK_CONFIG: { issuer: 'https://auth.test/realms/clenzy',
  clientId: 'clenzy-mobile', redirectUrl: 'clenzy://auth/callback', scopes: ['openid', 'profile', 'email'] } }));
import { baitlyOAuth } from '../baitlyOAuth';
beforeEach(() => { jest.clearAllMocks(); mockExchange.mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' }); });
it('uses S256 and exchanges the verifier with the validated authorization code', async () => {
  mockPrompt.mockResolvedValue({ type: 'success', params: { state: 'unique-state', code: 'auth-code' } });
  await baitlyOAuth();
  expect(mockConstructor).toHaveBeenCalledWith(expect.objectContaining({ usePKCE: true, state: 'unique-state', codeChallengeMethod: 'S256' }));
  expect(mockExchange).toHaveBeenCalledWith(expect.objectContaining({ code: 'auth-code', extraParams: { code_verifier: 'secret-verifier' } }), expect.anything());
});
it('rejects a forged state before exchanging any token', async () => {
  mockPrompt.mockResolvedValue({ type: 'success', params: { state: 'wrong', code: 'auth-code' } });
  await expect(baitlyOAuth()).rejects.toThrow('oauthRejected');
  expect(mockExchange).not.toHaveBeenCalled();
});
it('rejects an expired session', async () => {
  const now = jest.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValueOnce(600001);
  mockPrompt.mockResolvedValue({ type: 'success', params: { state: 'unique-state', code: 'auth-code' } });
  await expect(baitlyOAuth()).rejects.toThrow('oauthRejected');
  expect(mockExchange).not.toHaveBeenCalled(); now.mockRestore();
});
it('cancellation does not exchange credentials', async () => {
  mockPrompt.mockResolvedValue({ type: 'cancel' }); expect(await baitlyOAuth()).toBeNull(); expect(mockExchange).not.toHaveBeenCalled();
});
