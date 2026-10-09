import { describe, it, expect, vi, beforeEach } from 'vitest';
import { conversationApi } from '../conversationApi';
import apiClient from '../../apiClient';

// Le apiClient réel dépend de Keycloak/fetch : stub déterministe.
vi.mock('../../apiClient', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);

describe('conversationApi — copilote IA', () => {
  beforeEach(() => vi.clearAllMocks());

  it('suggestReply appelle l’endpoint de la conversation, sans corps', async () => {
    mockedPost.mockResolvedValue({ response: 'Bonjour', tone: 'friendly', language: 'fr', alternatives: ['Salut'] });

    const result = await conversationApi.suggestReply(42);

    expect(mockedPost).toHaveBeenCalledWith('/conversations/42/suggest-reply');
    expect(result.alternatives).toEqual(['Salut']);
  });

  it('getAnalysis lit le sentiment et l’urgence', async () => {
    mockedGet.mockResolvedValue({ sentiment: 'NEGATIVE', score: -0.6, urgent: true });

    const result = await conversationApi.getAnalysis(7);

    expect(mockedGet).toHaveBeenCalledWith('/conversations/7/analysis');
    expect(result.urgent).toBe(true);
  });

  it('translateLastInbound passe la langue cible en paramètre de requête', async () => {
    mockedPost.mockResolvedValue({ targetLanguage: 'fr', translatedText: 'Bonjour' });

    const result = await conversationApi.translateLastInbound(9, 'fr');

    expect(mockedPost).toHaveBeenCalledWith('/conversations/9/translate', undefined, { params: { target: 'fr' } });
    expect(result.translatedText).toBe('Bonjour');
  });
});
