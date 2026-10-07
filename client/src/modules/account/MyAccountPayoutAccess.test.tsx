import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MyAccountPage from './MyAccountPage';

const auth = vi.hoisted(() => ({ role: 'TECHNICIAN' }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 42, organizationId: 9, username: 'Beneficiaire', permissions: [] }, hasAnyRole: (roles: string[]) => roles.includes(auth.role) }) }));
vi.mock('../../hooks/useOnboarding', () => ({ useOnboarding: () => ({ completeStep: vi.fn() }) }));
vi.mock('../../components/PageHeader', () => ({ default: () => null }));
vi.mock('../../components/PageTabs', () => ({ default: () => null }));
vi.mock('../accounting/components/MyPayoutTransfers', () => ({ default: () => <div>Journal personnel accessible</div> }));
vi.mock('../settings/AccountSecuritySection', () => ({ default: () => null }));
vi.mock('../settings/NotificationPreferencesCard', () => ({ default: () => null }));
vi.mock('../settings/MarketingPreferencesCard', () => ({ default: () => null }));
vi.mock('../settings/MyProPayoutsSettings', () => ({ default: () => null }));
vi.mock('../service-requests/AssignmentContactForm', () => ({ default: () => null }));
vi.mock('./MyProviderServices', () => ({ default: () => null }));
vi.mock('./ProviderTermsCard', () => ({ default: () => null }));
vi.mock('./ProviderDocumentsCard', () => ({ default: () => null }));
vi.mock('./MyCoverageZoneCard', () => ({ default: () => null }));
vi.mock('./MyCompanyCard', () => ({ default: () => null }));
afterEach(cleanup);
function mount() { return render(<MemoryRouter initialEntries={['/account?tab=my-transfers']}><MyAccountPage /></MemoryRouter>); }
describe('Accès personnel aux versements sans permission de paramétrage', () => {
  it.each(['HOST', 'PROPERTY_OWNER', 'HOUSEKEEPER', 'TECHNICIAN', 'SUPERVISOR', 'LAUNDRY', 'EXTERIOR_TECH'])('ouvre le journal pour %s sans settings:view', async (role) => {
    auth.role = role; mount(); expect(await screen.findByText('Journal personnel accessible')).toBeVisible();
  });
  it('ne propose pas de compte bénéficiaire au staff plateforme par défaut', () => {
    auth.role = 'SUPER_ADMIN'; mount(); expect(screen.queryByText('Journal personnel accessible')).not.toBeInTheDocument();
  });
});
