import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Inscription from '../Inscription';

Object.defineProperty(window.navigator, 'languages', { value: ['fr-FR'], configurable: true });
Object.defineProperty(window.navigator, 'language', { value: 'fr-FR', configurable: true });
const { post, get } = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock('../../../services/apiClient', () => ({ default: { post, get }, ApiError: Error }));
vi.mock('../../../components/BaitlyMarkLogo', () => ({ default: () => <span>Baitly</span> }));
vi.mock('@stripe/stripe-js', () => ({ loadStripe: vi.fn(() => Promise.resolve({})) }));
vi.mock('@stripe/react-stripe-js', () => ({
  EmbeddedCheckoutProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  EmbeddedCheckout: () => <div data-testid="stripe-checkout">Stripe Checkout</div>,
}));
const quote = {
  phases: [14210, 12789, 11368, 9947].map((totalCents, index) => ({ totalCents, currency: 'EUR', properties: 5, subscriptionMonth: [1, 4, 7, 13][index] })),
  firstInvoiceExcludingTaxCents: 14210, promoCode: null,
};
function view(query = '') { return render(<MemoryRouter initialEntries={[`/inscription?email=jean@test.invalid&fullName=Jean+Test&propertyCount=5${query}`]}><Inscription /></MemoryRouter>); }
const submit = () => screen.getByRole('button', { name: /Continuer vers le paiement/i });
async function ready() {
  fireEvent.click(screen.getByRole('checkbox', { name: /conditions générales d'utilisation/i }));
  await waitFor(() => expect(submit()).toBeEnabled());
}
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear(); get.mockResolvedValue(quote);
  post.mockResolvedValue({ clientSecret: 'cs_test_secret', sessionId: 'cs_test', monthlyPriceCents: 14210, stripePriceAmount: 14210, currency: 'EUR' });
});

describe('Inscription mensuelle Baitly', () => {
  it('affiche les montants HT du serveur et supprime les anciennes périodes annuelles', async () => {
    view('&billingPeriod=ANNUAL'); await ready();
    expect(screen.getAllByText(/142,10/).length).toBeGreaterThan(0);
    expect(screen.getByText(/127,89/)).toBeInTheDocument();
    expect(screen.queryByText('Annuel')).not.toBeInTheDocument();
    expect(screen.queryByText('2 ans')).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(expect.stringContaining('/public/inscription/quote?plan=essential&country=FR&properties=5'), { skipAuth: true });
  });
  it('envoie une demande mensuelle avec son identifiant et le pays, sans prix ni mot de passe client', async () => {
    view(); await ready(); fireEvent.click(submit()); await screen.findByTestId('stripe-checkout');
    const payload = post.mock.calls[0][1];
    expect(payload).toMatchObject({ forfait: 'essential', billingPeriod: 'MONTHLY', billingCountry: 'FR', propertyCount: 5, acceptedTerms: true, newsletterOptIn: false });
    expect(payload.requestId).toMatch(/^[a-f0-9-]{36}$/);
    expect(payload.password).toBeUndefined(); expect(payload.amount).toBeUndefined();
    expect(screen.getByText('Première échéance HT')).toBeInTheDocument();
  });
  it('attend un devis valide avant de permettre le paiement', async () => {
    get.mockRejectedValue(new Error('Pays sur devis')); view();
    fireEvent.click(screen.getByRole('checkbox', { name: /conditions générales d'utilisation/i }));
    await screen.findByText('Pays sur devis'); expect(submit()).toBeDisabled(); expect(post).not.toHaveBeenCalled();
  });
  it('refait le devis après changement de pays et bloque une promotion refusée', async () => {
    view(); await ready();
    get.mockRejectedValue(new Error('Devise du code promotionnel incompatible'));
    fireEvent.change(screen.getByLabelText('Pays de facturation'), { target: { value: 'MA' } });
    expect(submit()).toBeDisabled(); await screen.findByText('Devise du code promotionnel incompatible');
    expect(get.mock.calls.at(-1)?.[0]).toContain('country=MA'); expect(post).not.toHaveBeenCalled();
  });
  it('garde le même identifiant quand une requête réseau doit être réessayée', async () => {
    post.mockRejectedValueOnce(new Error('Connexion interrompue')); view(); await ready(); fireEvent.click(submit());
    await screen.findByText('Connexion interrompue'); fireEvent.click(submit()); await screen.findByTestId('stripe-checkout');
    expect(post.mock.calls[1][1].requestId).toEqual(post.mock.calls[0][1].requestId);
  });
  it('ne transforme pas une erreur fiscale 409 en fausse erreur de compte existant', async () => {
    post.mockRejectedValue(Object.assign(new Error('Finaliser Stripe Tax'), { status: 409 })); view(); await ready(); fireEvent.click(submit());
    await screen.findByText('Finaliser Stripe Tax'); expect(screen.queryByTestId('stripe-checkout')).not.toBeInTheDocument();
  });
  it('préserve les conditions, la confidentialité et le consentement newsletter distinct', async () => {
    view(); expect(submit()).toBeDisabled();
    expect(screen.getByRole('link', { name: /conditions générales d'utilisation/i })).toHaveAttribute('href', '/cgu');
    expect(screen.getByRole('link', { name: /politique de confidentialité/i })).toHaveAttribute('href', '/confidentialite');
    fireEvent.click(screen.getByRole('checkbox', { name: /newsletter Baitly/i })); await ready(); fireEvent.click(submit());
    await screen.findByTestId('stripe-checkout'); expect(post.mock.calls[0][1].newsletterOptIn).toBe(true);
  });
  it('conserve le type de société et bloque la soumission sans raison sociale', async () => {
    view(); fireEvent.click(screen.getByText('Conciergerie'));
    fireEvent.click(screen.getByRole('checkbox', { name: /conditions générales d'utilisation/i }));
    await screen.findByText(/127,89/); expect(submit()).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Nom de la societe/i), { target: { value: 'Conciergerie Test' } });
    await waitFor(() => expect(submit()).toBeEnabled()); fireEvent.click(submit()); await screen.findByTestId('stripe-checkout');
    expect(post.mock.calls[0][1]).toMatchObject({ companyName: 'Conciergerie Test', organizationType: 'CONCIERGE' });
  });
  it('reprend le même Checkout après rechargement sans stocker le secret Stripe', async () => {
    const first = view();await ready();fireEvent.click(submit());await screen.findByTestId('stripe-checkout');
    const id = post.mock.calls[0][1].requestId;
    expect(sessionStorage.getItem('baitly_signup_attempt')).not.toContain('cs_test_secret');
    first.unmount();view();await ready();fireEvent.click(submit());await screen.findByTestId('stripe-checkout');
    expect(post.mock.calls[1][1].requestId).toBe(id);
  });

});
