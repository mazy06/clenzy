import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PropertyInterventionsTab from '../PropertyInterventionsTab';
import PropertyPhotosTab from '../PropertyPhotosTab';
import PropertyComplianceTab from '../PropertyComplianceTab';
import PropertyInventoryTab from '../PropertyInventoryTab';
import LaundryItemsSection from '../inventory/LaundryItemsSection';
import CheckInInstructionsForm from '../../channels/CheckInInstructionsForm';
import ReviewList from '../../channels/reviews/ReviewList';
import { propertyPhotosApi } from '../../../services/api/propertyPhotosApi';
import { propertyLicensesApi, type PropertyLicense } from '../../../services/api/propertyLicensesApi';
import { airbnbApi, type CheckInInstructions } from '../../../services/api/airbnbApi';
import { reviewsApi, type GuestReview } from '../../../services/api/reviewsApi';
import propertyInventoryApi from '../../../services/api/propertyInventoryApi';

vi.mock('../../../components/Money', () => ({ Money: ({ value }: { value: number }) => <>{value} €</> }));
vi.mock('../../../hooks/useNotification', () => ({ useNotification: () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }) }));
vi.mock('../FrRegulatoryProfileCard', () => ({ default: () => null }));
vi.mock('../../../services/api/propertyPhotosApi', () => ({ propertyPhotosApi: { list: vi.fn(), getPhotoUrl: (id: number, photo: number) => `/test/${id}/${photo}.jpg`, upload: vi.fn(), delete: vi.fn() } }));
vi.mock('../../../services/api/propertyLicensesApi', () => ({ propertyLicensesApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() } }));
vi.mock('../../../services/api/airbnbApi', () => ({ airbnbApi: { getCheckInInstructions: vi.fn(), updateCheckInInstructions: vi.fn(), getSmartLockCode: vi.fn() } }));
vi.mock('../../../services/api/reviewsApi', () => ({ reviewsApi: { list: vi.fn(), getStats: vi.fn(), draftReply: vi.fn(), respond: vi.fn() } }));
vi.mock('../../../services/api/propertyInventoryApi', () => ({ default: { getItems: vi.fn(), getLaundryItems: vi.fn(), getCatalog: vi.fn(), getQuotes: vi.fn() } }));

function Location() { const location = useLocation(); return <output aria-label="Route">{location.pathname}{location.search}</output>; }
function mount(ui: React.ReactNode, route = '/properties/76?tab=inventory') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[route]}>{ui}<Location /></MemoryRouter></QueryClientProvider>);
}
const instructions = { propertyId: 76, accessCode: '1234', wifiName: 'Test WiFi', wifiPassword: 'test-password', parkingInfo: 'Parking 2', arrivalInstructions: 'Entrée cour', departureInstructions: null, houseRules: null, emergencyContact: null, additionalNotes: null } as CheckInInstructions;
const reviews: GuestReview[] = [
  { id: 1, propertyId: 76, guestName: 'Alice Test', rating: 5, reviewText: 'Très bon séjour.', hostResponseDraft: 'Merci Alice pour votre avis.', channelName: 'Booking', reviewDate: '2026-10-01' },
  { id: 2, propertyId: 76, guestName: 'Sam Test', rating: 4, reviewText: 'Bon emplacement.', channelName: 'Airbnb', reviewDate: '2026-09-25' },
];
const license: PropertyLicense = { id: 4, propertyId: 76, licenseType: 'TOURISM_REGISTRATION', licenseNumber: 'TEST-76', issuedBy: 'Commune test', issuedAt: '2026-01-01', expiresAt: '2099-01-01', renewalLeadDays: 60, documentRef: 'JUSTIFICATIF-TEST', notes: 'Note de contrôle', formatVerdict: 'VALID', expiringSoon: false };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(airbnbApi.getCheckInInstructions).mockResolvedValue(instructions);
  vi.mocked(airbnbApi.getSmartLockCode).mockResolvedValue({ hasSmartLock: false, code: '' });
  vi.mocked(airbnbApi.updateCheckInInstructions).mockImplementation(async (_id, form) => ({ ...instructions, ...form }));
  vi.mocked(propertyPhotosApi.list).mockResolvedValue([
    { id: 1, propertyId: 76, originalFilename: 'Salon.jpg', sortOrder: 0, contentType: 'image/jpeg', fileSize: 100, caption: null, source: null, createdAt: '' },
    { id: 2, propertyId: 76, originalFilename: 'Chambre.jpg', sortOrder: 1, contentType: 'image/jpeg', fileSize: 100, caption: null, source: null, createdAt: '' },
  ]);
  vi.mocked(reviewsApi.list).mockResolvedValue({ content: reviews, totalElements: 12 });
  vi.mocked(reviewsApi.getStats).mockResolvedValue({ propertyId: 76, averageRating: 4.7, totalReviews: 12 });
  vi.mocked(propertyLicensesApi.list).mockResolvedValue([license]);
  vi.mocked(propertyInventoryApi.getItems).mockResolvedValue([]);
  vi.mocked(propertyInventoryApi.getLaundryItems).mockResolvedValue([]);
  vi.mocked(propertyInventoryApi.getCatalog).mockResolvedValue([]);
  vi.mocked(propertyInventoryApi.getQuotes).mockResolvedValue([]);
});
afterEach(cleanup);

describe('Onglets logement : navigation et actions raccordées', () => {
  it('sépare les annulations des interventions à réaliser et ouvre le bon dossier', () => {
    mount(<PropertyInterventionsTab propertyId="76" interventions={[
      { id: '11', type: 'CLEANING', status: 'CANCELLED', scheduledDate: '2026-10-08', description: 'Ménage annulé' },
      { id: '12', type: 'MAINTENANCE', status: 'PENDING', scheduledDate: '2026-10-09', description: 'Réparer la poignée', assignedTo: 'Équipe test' },
    ]} />);
    expect(screen.getByText('À réaliser').closest('.bui-stat-figure')).toHaveTextContent('1');
    fireEvent.click(screen.getByRole('radio', { name: 'Liste' }));
    expect(screen.getByText('Réparer la poignée')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /08\/10\/2026/ }));
    expect(screen.getByText('Ménage annulé')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Voir le détail/ }));
    expect(screen.getByLabelText('Route')).toHaveTextContent('/interventions/11');
  });

  it('la sélection photo change uniquement le grand aperçu et respecte la lecture seule', async () => {
    const { container } = mount(<PropertyPhotosTab propertyId={76} canEdit={false} />);
    fireEvent.click(await screen.findByRole('button', { name: /2. Chambre/ }));
    expect(container.querySelector('figure img')).toHaveAttribute('src', '/test/76/2.jpg');
    expect(screen.queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument();
    expect(propertyPhotosApi.delete).not.toHaveBeenCalled();
    expect(propertyPhotosApi.upload).not.toHaveBeenCalled();
  });

  it('ne supprime une photo qu’après confirmation sur la sélection courante', async () => {
    mount(<PropertyPhotosTab propertyId={76} canEdit />);
    fireEvent.click(await screen.findByRole('button', { name: /2. Chambre/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(propertyPhotosApi.delete).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => expect(propertyPhotosApi.delete).toHaveBeenCalledWith(76, 2));
    await waitFor(() => expect(screen.queryByRole('button', { name: /2. Chambre/ })).not.toBeInTheDocument());
  });

  it('affiche une erreur de chargement photo sans la confondre avec une galerie vide', async () => {
    vi.mocked(propertyPhotosApi.list).mockRejectedValueOnce(new Error('offline'));
    mount(<PropertyPhotosTab propertyId={76} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger');
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('button', { name: /1. Salon/ })).toBeVisible();
  });

  it('conserve les instructions saisies entre rubriques et enregistre un seul payload complet', async () => {
    mount(<CheckInInstructionsForm propertyId={76} />);
    fireEvent.change(await screen.findByLabelText('Nom du WiFi'), { target: { value: 'WiFi modifié' } });
    fireEvent.click(screen.getByRole('button', { name: /Stationnement/ }));
    fireEvent.change(screen.getByLabelText('Informations parking'), { target: { value: 'Place 42' } });
    expect(airbnbApi.updateCheckInInstructions).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^Accès/ }));
    expect(screen.getByLabelText('Nom du WiFi')).toHaveValue('WiFi modifié');
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(airbnbApi.updateCheckInInstructions).toHaveBeenCalledWith(76, expect.objectContaining({ wifiName: 'WiFi modifié', parkingInfo: 'Place 42', arrivalInstructions: 'Entrée cour' })));
    expect(airbnbApi.updateCheckInInstructions).toHaveBeenCalledTimes(1);
  });

  it('bloque la saisie sur une panne de chargement mais permet la première configuration après un 404', async () => {
    vi.mocked(airbnbApi.getCheckInInstructions).mockRejectedValueOnce({ status: 500 }).mockRejectedValueOnce({ status: 404 });
    mount(<CheckInInstructionsForm propertyId={76} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger');
    expect(screen.queryByLabelText('Nom du WiFi')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByLabelText('Nom du WiFi')).toHaveValue('');
    expect(airbnbApi.updateCheckInInstructions).not.toHaveBeenCalled();
  });

  it('reprend un brouillon existant sans génération et conserve la saisie en changeant d’avis', async () => {
    vi.mocked(reviewsApi.respond).mockResolvedValue({ ...reviews[0], hostResponse: 'Réponse personnalisée' });
    mount(<ReviewList propertyId={76} showStats />);
    fireEvent.click(await screen.findByRole('button', { name: /Reprendre le brouillon/ }));
    expect(reviewsApi.draftReply).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Répondre' }), { target: { value: 'Réponse personnalisée' } });
    fireEvent.click(screen.getByRole('button', { name: /Sam Test/ }));
    fireEvent.click(screen.getByRole('button', { name: /Alice Test/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Répondre' }));
    expect(screen.getByRole('textbox', { name: 'Répondre' })).toHaveValue('Réponse personnalisée');
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    await waitFor(() => expect(reviewsApi.respond).toHaveBeenCalledWith(1, 'Réponse personnalisée'));
    expect(await screen.findByText('Votre réponse')).toBeVisible();
    expect(screen.getByText('4.7')).toBeVisible();
  });

  it('charge les avis suivants depuis le backend et garde le total du logement', async () => {
    mount(<ReviewList propertyId={76} showStats />);
    fireEvent.click(await screen.findByRole('link', { name: 'Go to next page' }));
    await waitFor(() => expect(reviewsApi.list).toHaveBeenLastCalledWith({ propertyId: 76, page: 1, size: 8 }));
  });

  it('présente les justificatifs et ne confond pas validité de format avec conformité vérifiée', async () => {
    mount(<PropertyComplianceTab propertyId={76} canEdit />);
    expect(await screen.findByText('JUSTIFICATIF-TEST')).toBeVisible();
    expect(screen.getByText('Note de contrôle')).toBeVisible();
    expect(screen.getAllByRole('button', { name: /validité à vérifier/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(propertyLicensesApi.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByText('Supprimer cette licence du logement ?')).not.toBeInTheDocument();
  });

  it('conserve les liens directs vers le linge et les devis dans l’inventaire', async () => {
    mount(<PropertyInventoryTab propertyId={76} canEdit={false} />, '/properties/76?tab=inventory&subtab=laundry');
    const nav = screen.getByRole('navigation', { name: 'Inventaire du logement' });
    expect(within(nav).getByRole('button', { name: /Linge/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(nav).getByRole('button', { name: /Devis/ }));
    await waitFor(() => expect(screen.getByLabelText('Route')).toHaveTextContent('subtab=quotes'));
    expect(await screen.findByText(/Aucun devis/)).toBeVisible();
  });

  it('enregistre une quantité de linge entière à la fin de la saisie et rétablit la valeur sur erreur', async () => {
    const update = vi.fn().mockRejectedValue(new Error('offline'));
    const item = { id: 22, propertyId: 76, itemKey: 'fitted-sheet', label: 'Drap housse', quantityPerStay: 1 };
    mount(<LaundryItemsSection items={[item]} catalog={[{ key: 'fitted-sheet', label: item.label, price: 3.2, enabled: true }]} canEdit onAdd={vi.fn()} onDelete={vi.fn()} onUpdate={update} />);
    const input = screen.getByRole('spinbutton', { name: /Drap housse/ });
    fireEvent.change(input, { target: { value: '12' } });
    expect(update).not.toHaveBeenCalled();
    fireEvent.blur(input);
    await waitFor(() => expect(update).toHaveBeenCalledWith({ id: 22, quantityPerStay: 12 }));
    await waitFor(() => expect(input).toHaveValue(1));
    expect(screen.getByRole('alert')).toBeVisible();
    expect(input).toBeEnabled();
  });
});
