import { apiClient } from '@/api/apiClient';
import { isSignatureToken, managementApi } from '../api';
jest.mock('@/api/apiClient', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
const token = '11111111-2222-3333-4444-555555555555';
afterEach(() => jest.clearAllMocks());
it('bounds the capability token before building any endpoint', () => {
  expect(isSignatureToken(token)).toBe(true);
  expect(() => managementApi.view('../other')).toThrow();
  expect(() => managementApi.documentUrl(`${token}?other=secret`)).toThrow();
  expect(apiClient.get).not.toHaveBeenCalled();
});
it('uses the public signature API without attaching account credentials', () => {
  managementApi.sign(token, '  Owner Name  ');
  expect(apiClient.post).toHaveBeenCalledWith(`/public/contract-signature/${token}/sign`,
    { signerName: 'Owner Name', consent: true }, { skipAuth: true });
});
