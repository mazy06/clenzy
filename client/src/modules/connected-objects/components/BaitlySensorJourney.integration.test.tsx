import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AddDeviceWizard from './AddDeviceWizard';
import BaitlySensorControls from './BaitlySensorControls';
import { useDeleteDevice } from '../useDeleteDevice';

const fixture = vi.hoisted(() => ({
  configured: true, simulators: true, simulation: true, revoked: false, online: false, last: null as string | null,
  create: vi.fn(), register: vi.fn(), attach: vi.fn(), legacyCreate: vi.fn(), simulate: vi.fn(), revoke: vi.fn(), remove: vi.fn(),
  credentials: vi.fn(), mqttIdentity: vi.fn(),
}));
vi.mock('../../../services/api/baitlyIotApi', async importOriginal => ({
  ...await importOriginal<typeof import('../../../services/api/baitlyIotApi')>(),
  baitlyIotApi: {
    configuration: async () => ({ configured: fixture.configured, simulatorsEnabled: fixture.simulators,
      ingestionUrl: 'https://iot.example.com' }),
    create: (...args: unknown[]) => fixture.create(...args),
    register: (...args: unknown[]) => fixture.register(...args),
    mqttIdentity: (...args: unknown[]) => fixture.mqttIdentity(...args),
    attach: (...args: unknown[]) => fixture.attach(...args),
    state: async () => ({ simulation: fixture.simulation, revoked: fixture.revoked, online: fixture.online,
      lastReceivedAt: fixture.last, lastMeasuredAt: fixture.last, awaitingFirstMeasurement: fixture.last == null,
      reportingIntervalSeconds: 60, externalDeviceId: 'b7d5efb8-2a94-4a78-b782-99d8ad2b3284',
      mqttIdentity: fixture.simulation ? null : 'c'.repeat(64) }),
    simulate: (...args: unknown[]) => fixture.simulate(...args),
    revoke: (...args: unknown[]) => fixture.revoke(...args),
    delete: (...args: unknown[]) => fixture.remove(...args),
    credentials: (...args: unknown[]) => fixture.credentials(...args),
  },
}));
vi.mock('../../../services/api/propertiesApi', () => ({ propertiesApi: {
  getAll: async () => [{ id: 11, name: 'Riad Amina', timezone: 'Africa/Casablanca' }],
  getById: async () => ({ id: 11, name: 'Riad Amina', timezone: 'Africa/Casablanca' }),
} }));
vi.mock('../../../services/api/noiseApi', () => ({ noiseDevicesApi: {
  getStatus: async () => ({ online: fixture.online }), create: (...args: unknown[]) => fixture.legacyCreate(...args),
} }));
vi.mock('./TuyaDevicePicker', () => ({ default: () => null }));
vi.mock('./NetatmoDevicePicker', () => ({ default: () => null }));

const clients: QueryClient[] = [];
function setup(element: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
}
function Journey() {
  const [id, setId] = useState<number | null>(null);
  const { remove } = useDeleteDevice();
  return id == null ? <AddDeviceWizard open defaultKind="noise" defaultPropertyId={11}
    onAdded={device => setId(device?.id ?? null)} onClose={() => undefined} />
    : <><BaitlySensorControls key={id} deviceId={id} timeZone="Africa/Casablanca" />
      <button onClick={() => { void remove({ kind: 'noise', id, provider: 'BAITLY' }).then(() => setId(null)); }}>Retirer du logement</button></>;
}

beforeEach(() => {
  fixture.configured = true; fixture.simulators = true; fixture.simulation = true;
  fixture.revoked = false; fixture.online = false; fixture.last = null;
  fixture.register.mockResolvedValue({ id: 66, externalDeviceId: 'b7d5efb8-2a94-4a78-b782-99d8ad2b3284',
    token: 'one-time-device-key', mqttIdentity: 'c'.repeat(64), ingestionUrl: 'https://iot.example.com' });
  fixture.mqttIdentity.mockResolvedValue({ mqttIdentity: 'd'.repeat(64) });
  fixture.create.mockResolvedValue({ id: 99 });
  fixture.attach.mockResolvedValue({ id: 88 });
  fixture.legacyCreate.mockResolvedValue({ id: 77 });
  fixture.simulate.mockImplementation(async () => { fixture.online = true; fixture.last = '2026-10-16T12:00:00Z'; return { duplicate: false }; });
  fixture.revoke.mockImplementation(async () => { fixture.revoked = true; fixture.online = false; });
  fixture.remove.mockResolvedValue(undefined);
  fixture.credentials.mockResolvedValue({ token: 'test-device-key-only' });
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.resetAllMocks(); });

async function chooseInternal(origin: 'simulation' | 'attach' | 'register' = 'simulation') {
  fireEvent.change(await screen.findByLabelText('Mode de connexion'), { target: { value: 'internal' } });
  await screen.findByRole('option', { name: 'Nouvel appareil à enregistrer' });
  if (origin === 'simulation') await screen.findByRole('option', { name: 'Simulateur, sans matériel' });
  fireEvent.change(screen.getByLabelText('Appareil à rattacher'), { target: { value: origin } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continuer' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
}

describe('unified device attachment journey', () => {
  it('creates, sends a measurement, revokes and removes a test sensor', async () => {
    setup(<Journey />);
    await chooseInternal();
    fireEvent.change(screen.getByLabelText('Nom de l’objet'), { target: { value: 'Bruit salon test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter le simulateur' }));
    expect(await screen.findByText('Simulateur', { selector: '[data-slot="badge"]' })).toBeVisible();
    expect(fixture.create).toHaveBeenCalledWith(expect.objectContaining({ propertyId: 11, name: 'Bruit salon test' }));
    fireEvent.change(screen.getByLabelText('Niveau sonore en dB(A)'), { target: { value: '72.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer une mesure de test' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Mesure de test enregistrée.');
    expect(fixture.simulate).toHaveBeenCalledWith(99, expect.objectContaining({ laeqDbA: 72.5, eventId: expect.any(String), measuredAt: expect.any(String) }));
    fireEvent.click(screen.getByRole('button', { name: 'Révoquer la connexion' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la révocation' }));
    expect(await screen.findByText('Révoqué')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Envoyer une mesure de test' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retirer du logement' }));
    await waitFor(() => expect(fixture.remove).toHaveBeenCalledWith(99));
    expect(await screen.findByRole('heading', { name: 'Ajouter un objet connecté' })).toBeVisible();
  });

  it('keeps the form and request identity after a network failure', async () => {
    fixture.create.mockRejectedValueOnce({ status: 502, message: 'Service indisponible' });
    const created = vi.fn();
    setup(<AddDeviceWizard open defaultKind="noise" defaultPropertyId={11} onAdded={created} onClose={() => undefined} />);
    await chooseInternal();
    fireEvent.change(screen.getByLabelText('Nom de l’objet'), { target: { value: 'Salon' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter le simulateur' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Service indisponible');
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter le simulateur' }));
    await waitFor(() => expect(created).toHaveBeenCalledWith({ id: 99, kind: 'noise', propertyId: 11 }));
    expect(fixture.create.mock.calls[0][0].requestId).toEqual(fixture.create.mock.calls[1][0].requestId);
  });

  it('does not create when the service is not configured', async () => {
    fixture.configured = false;
    setup(<AddDeviceWizard open defaultKind="noise" defaultPropertyId={11} onAdded={vi.fn()} onClose={() => undefined} />);
    fireEvent.change(await screen.findByLabelText('Mode de connexion'), { target: { value: 'internal' } });
    expect(await screen.findByText(/Le service de connexion Baitly n’est pas configuré/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeDisabled();
    expect(fixture.create).not.toHaveBeenCalled();
  });

  it('attaches a registered commercial device without provisioning a simulator', async () => {
    const created = vi.fn();
    setup(<AddDeviceWizard open defaultKind="noise" defaultPropertyId={11} defaultRoomName="Salon" onAdded={created} onClose={() => undefined} />);
    await chooseInternal('attach');
    fireEvent.change(screen.getByLabelText('Nom de l’objet'), { target: { value: 'Sonomètre du salon' } });
    expect(screen.getByRole('button', { name: 'Rattacher l’objet' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Identifiant de l’appareil enregistré'), { target: { value: 'not-an-id' } });
    expect(screen.getByRole('button', { name: 'Rattacher l’objet' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Identifiant de l’appareil enregistré'), { target: { value: 'b7d5efb8-2a94-4a78-b782-99d8ad2b3284' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rattacher l’objet' }));
    await waitFor(() => expect(created).toHaveBeenCalledWith({ id: 88, kind: 'noise', propertyId: 11 }));
    expect(fixture.attach).toHaveBeenCalledWith({ propertyId: 11, name: 'Sonomètre du salon', roomName: 'Salon', externalDeviceId: 'b7d5efb8-2a94-4a78-b782-99d8ad2b3284' });
    expect(fixture.create).not.toHaveBeenCalled();
  });

  it('preserves manufacturer connectors without treating the internal service as a brand', async () => {
    setup(<AddDeviceWizard open defaultKind="noise" defaultPropertyId={11} onAdded={vi.fn()} onClose={() => undefined} />);
    const brands = await screen.findByLabelText('Marque ou service connecté');
    expect(brands).not.toHaveTextContent('Baitly');
    fireEvent.change(brands, { target: { value: 'MINUT' } });
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Modèle exact'), { target: { value: 'minut-m3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    fireEvent.change(screen.getByLabelText('Nom de l’objet'), { target: { value: 'Minut salon' } });
    expect(screen.getByRole('button', { name: 'Rattacher l’objet' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Identifiant dans le compte fabricant'), { target: { value: 'minut-account-device' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rattacher l’objet' }));
    await waitFor(() => expect(fixture.legacyCreate).toHaveBeenCalledWith(expect.objectContaining({ deviceType: 'MINUT', propertyId: 11 })));
    expect(fixture.attach).not.toHaveBeenCalled();
  });

  it('does not advertise unsupported internal device types as available', async () => {
    setup(<AddDeviceWizard open defaultKind="motion" defaultPropertyId={11} onAdded={vi.fn()} onClose={() => undefined} />);
    expect(await screen.findByRole('option', { name: 'Connexion au service Baitly' })).toBeDisabled();
    expect(screen.getByText(/prend actuellement en charge les mesures de bruit/)).toBeVisible();
  });

  it('blocks unknown models and never treats a scanned ecosystem as a compatible device', async () => {
    setup(<AddDeviceWizard open defaultKind="noise" defaultPropertyId={11} onAdded={vi.fn()} onClose={() => undefined} />);
    fireEvent.change(await screen.findByLabelText('Marque ou service connecté'), { target: { value: 'MINUT' } });
    fireEvent.change(screen.getByLabelText('Modèle exact'), { target: { value: 'unknown' } });
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeDisabled();
    fireEvent.click(screen.getByText('Identifier avec un QR code'));
    fireEvent.change(screen.getByLabelText('Ou coller le contenu du QR code'), { target: { value: 'https://m.smart321.com/test-fixture' } });
    fireEvent.click(screen.getByRole('button', { name: 'Identifier le format' }));
    expect(screen.getByLabelText('Marque ou service connecté')).toHaveValue('TUYA');
    expect(screen.getByLabelText('Modèle exact')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeDisabled();
    expect(screen.getByLabelText('Ou coller le contenu du QR code')).toHaveValue('');
    expect(fixture.legacyCreate).not.toHaveBeenCalled();
    expect(fixture.attach).not.toHaveBeenCalled();
    expect(fixture.create).not.toHaveBeenCalled();
  });

  it('clears a previously selected model when scanning a different or unsupported device', async () => {
    setup(<AddDeviceWizard open defaultKind="noise" defaultPropertyId={11} onAdded={vi.fn()} onClose={() => undefined} />);
    fireEvent.change(await screen.findByLabelText('Marque ou service connecté'), { target: { value: 'MINUT' } });
    fireEvent.change(screen.getByLabelText('Modèle exact'), { target: { value: 'minut-m3' } });
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeEnabled();
    fireEvent.click(screen.getByText('Identifier avec un QR code'));
    fireEvent.change(screen.getByLabelText('Ou coller le contenu du QR code'), { target: { value: 'MT:Y.K9042C00KA0648G00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Identifier le format' }));
    expect(screen.getByLabelText('Marque ou service connecté')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeDisabled();
    expect(screen.getByText(/Matter seul nécessite un contrôleur/)).toBeVisible();
  });

  it('registers a new physical device, shows its secret once and reports it when closed', async () => {
    const created = vi.fn();
    const closed = vi.fn();
    setup(<AddDeviceWizard open defaultKind="noise" defaultPropertyId={11} onAdded={created} onClose={closed} />);
    await chooseInternal('register');
    fireEvent.change(screen.getByLabelText('Nom de l’objet'), { target: { value: 'Capteur entrée' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer l’appareil' }));
    expect(await screen.findByRole('heading', { name: 'Appareil enregistré' })).toBeVisible();
    expect(screen.getByLabelText('Clé de connexion (HTTPS)')).toHaveValue('one-time-device-key');
    expect(screen.getByLabelText('Clé de connexion (HTTPS)')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Identité MQTT (nom du certificat)')).toHaveValue('c'.repeat(64));
    expect(screen.getByLabelText('Adresse d’envoi des mesures')).toHaveValue('https://iot.example.com');
    expect(fixture.register).toHaveBeenCalledWith(expect.objectContaining({ propertyId: 11, name: 'Capteur entrée', requestId: expect.any(String) }));
    expect(created).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'J’ai copié les informations' }));
    expect(created).toHaveBeenCalledWith({ id: 66, kind: 'noise', propertyId: 11 });
    expect(closed).toHaveBeenCalled();
    expect(fixture.create).not.toHaveBeenCalled();
  });

  it('hides the simulator when the environment disables it', async () => {
    fixture.simulators = false;
    setup(<AddDeviceWizard open defaultKind="noise" defaultPropertyId={11} onAdded={vi.fn()} onClose={() => undefined} />);
    fireEvent.change(await screen.findByLabelText('Mode de connexion'), { target: { value: 'internal' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continuer' })).toBeEnabled());
    expect(screen.queryByRole('option', { name: 'Simulateur, sans matériel' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Nouvel appareil à enregistrer' })).toBeInTheDocument();
  });

  it('rotates a physical device key only after confirmation and shows it in memory', async () => {
    fixture.simulation = false;
    setup(<BaitlySensorControls deviceId={99} timeZone="Europe/Paris" />);
    expect(await screen.findByText('En attente de la première mesure', { selector: '[data-slot="badge"]' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Envoyer une mesure de test' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Paramètres de connexion de l’appareil'));
    fireEvent.click(screen.getByRole('button', { name: 'Générer une nouvelle clé' }));
    expect(fixture.credentials).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));
    expect(await screen.findByLabelText('Clé de connexion')).toHaveValue('test-device-key-only');
    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle identité MQTT' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));
    expect(await screen.findByText('d'.repeat(64))).toBeVisible();
  });

  it('never reports a successful measurement when ingestion fails', async () => {
    fixture.simulate.mockRejectedValue({ message: 'Mesure refusée' });
    setup(<BaitlySensorControls deviceId={99} timeZone="Europe/Paris" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Envoyer une mesure de test' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Mesure refusée');
    expect(screen.queryByText('Mesure de test enregistrée.')).not.toBeInTheDocument();
  });

  it('discards the external simulator key when its disclosure is closed', async () => {
    setup(<BaitlySensorControls deviceId={99} timeZone="Europe/Paris" />);
    fireEvent.click(await screen.findByText('Utiliser le simulateur Python'));
    fireEvent.click(screen.getByRole('button', { name: 'Générer une clé pour le simulateur' }));
    expect(await screen.findByLabelText('Clé de connexion')).toHaveValue('test-device-key-only');
    const disclosure = screen.getByText('Utiliser le simulateur Python').closest('details')!;
    disclosure.open = false;
    fireEvent(disclosure, new Event('toggle'));
    await waitFor(() => expect(screen.queryByLabelText('Clé de connexion')).not.toBeInTheDocument());
  });
});
