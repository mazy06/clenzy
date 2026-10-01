// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders as render, screen, fireEvent, waitFor } from '../../../test/renderWithProviders';
import ReviewReplyDialog from '../../../components/baitly/ReviewReplyDialog';
import { reviewsApi } from '../../../services/api/reviewsApi';

vi.mock('../../../hooks/useAi', () => ({ useAiKeyStatus: () => ({ data: [] }) }));
vi.mock('../../../services/api/reviewsApi', () => ({ reviewsApi: {
  getById: vi.fn(), respond: vi.fn(), draftReply: vi.fn(),
} }));
vi.mock('../../../services/api/actionItemsApi', () => ({ refreshActionQueue: vi.fn().mockResolvedValue(undefined) }));
const review = { id: 12, propertyId: 1, guestName: 'Camille', rating: 4,
  reviewText: 'Un séjour agréable.', hostResponseDraft: 'Merci pour votre retour.' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(reviewsApi.getById).mockResolvedValue(review);
  vi.mocked(reviewsApi.respond).mockResolvedValue(review);
});

describe('Réponse à un avis depuis HITL', () => {
  it('attend une insertion puis une publication explicites', async () => {
    const onPublished = vi.fn();
    render(<ReviewReplyDialog reviewId={12} onClose={() => {}} onPublished={onPublished} />);
    const insert = await screen.findByRole('button', { name: 'Insérer dans ma réponse' });
    const reply = screen.getByRole('textbox', { name: 'Votre réponse' });
    expect(reply).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Publier la réponse' })).toBeDisabled();
    fireEvent.click(insert);
    expect(reply).toHaveValue(review.hostResponseDraft);
    expect(reviewsApi.respond).not.toHaveBeenCalled();
    fireEvent.change(reply, { target: { value: 'Merci Camille, à bientôt !' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publier la réponse' }));
    await waitFor(() => expect(onPublished).toHaveBeenCalledOnce());
    expect(reviewsApi.respond).toHaveBeenCalledWith(12, 'Merci Camille, à bientôt !');
  });

  it('permet de réessayer la lecture sans publier à l’aveugle', async () => {
    vi.mocked(reviewsApi.getById).mockRejectedValueOnce(new Error('Unavailable'));
    render(<ReviewReplyDialog reviewId={12} onClose={() => {}} />);
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Publier la réponse' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await screen.findByText(review.reviewText);
    expect(reviewsApi.respond).not.toHaveBeenCalled();
  });
});
