import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import WorkOrderDetailLayout, { type WorkOrderViewModel } from '../WorkOrderDetailLayout';

vi.mock('../../../components/Money', () => ({ Money: ({ value }: { value: number }) => <>{value} €</> }));
afterEach(cleanup);
const base: WorkOrderViewModel = {
  type: 'CLEANING', status: 'PENDING', statusLabel: 'En attente',
  property: { name: 'Maison de test', address: '1 rue de Test', city: 'Lyon', postalCode: '69000', country: 'France', bedroomCount: 2 },
};

describe('Fiche Baitly : contexte et étapes de mission', () => {
  it('préserve les accès, les tâches, les notes et les actions de la fiche', () => {
    const open = vi.fn();
    render(<WorkOrderDetailLayout vm={{ ...base,
      access: { code: 'TEST-123', arrival: 'Entrée cour', parking: 'Place test' },
      accessNotes: 'Clés au gardien', specialInstructions: 'Vérifier les fenêtres', description: 'Nettoyer le salon',
      tasks: [{ label: 'Vitres', quantity: 2, unitPrice: 12.5 }, { label: 'Sols', quantity: 1, unitPrice: 15 }],
      requestor: { name: 'Demandeur Test', email: 'test@example.invalid' },
      assignee: { name: 'Équipe de test', type: 'team' },
      extraTimeRows: [{ icon: null, label: 'Fin prévue', value: 'Demain à 14 h' }],
    }} heroAction={<button onClick={open}>Démarrer la mission</button>}
      detailsSection={<div>Devis conservés</div>} asideSection={<div>Décision bénéficiaire</div>}
      extraSection={<div>Compte rendu de réalisation</div>} />);
    for (const value of ['TEST-123', 'Entrée cour', 'Place test', 'Clés au gardien', 'Vérifier les fenêtres', 'Nettoyer le salon', 'Demain à 14 h', 'Devis conservés', 'Décision bénéficiaire', 'Compte rendu de réalisation']) {
      expect(screen.getByText(value)).toBeVisible();
    }
    expect(screen.getByText('40 €')).toBeVisible();
    // L'itinéraire ouvre le choix de l'app GPS (menu) au lieu d'un lien Google Maps imposé.
    expect(screen.getByRole('button', { name: 'Itinéraire' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la mission' }));
    expect(open).toHaveBeenCalledOnce();
  });

  it('ne présente jamais une annulation comme une mission terminée', () => {
    render(<WorkOrderDetailLayout vm={{ ...base, status: 'CANCELLED', statusLabel: 'Annulée' }} />);
    expect(screen.getByRole('button', { name: 'Annulée' })).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Avancement de la mission' })).not.toBeInTheDocument();
    expect(screen.queryByText('Terminé')).not.toBeInTheDocument();
  });

  it('indique l’étape courante sans inventer un pourcentage de réalisation', () => {
    render(<WorkOrderDetailLayout vm={{ ...base, status: 'IN_PROGRESS', statusLabel: 'En cours' }} />);
    const steps = screen.getByRole('list', { name: 'Avancement de la mission' });
    expect(within(steps).getByText('En cours').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(within(steps).getByText('Terminé').closest('li')).not.toHaveAttribute('aria-current');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('conserve les photos du signalement et distingue un devis soumis d’un devis accepté', () => {
    render(<WorkOrderDetailLayout vm={{ ...base,
      assignee: { name: 'Test Intervenant', avatarUrl: 'https://example.invalid/avatar.jpg' },
      assignment: 'QUOTE_SUBMITTED',
      sourceIssue: { id: 9, title: 'Fuite test', description: 'Sous l’évier', severity: 'HIGH', photoUrls: ['https://example.invalid/issue.jpg'] },
    }} />);
    expect(screen.getByRole('button', { name: 'Devis soumis' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Devis accepté' })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Photo du signalement 1' })).toHaveAttribute('src', 'https://example.invalid/issue.jpg');
  });
});
