import { Linking } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { captureInvitation } from '@/features/network/pendingInvitation';
import { LinkingOptions } from '@react-navigation/native';

const legacyLinkingConfig: LinkingOptions<ReactNavigation.RootParamList> = {
  prefixes: ['clenzy://', 'https://app.clenzy.fr'],
  config: {
    screens: {
      Main: {
        path: '',
        screens: {
          // Manager / Housekeeper / Technician
          Interventions: {
            path: 'interventions',
            screens: {
              InterventionDetail: 'interventions/:interventionId',
            },
          },
          // Host
          Properties: {
            path: 'properties',
            screens: {
              PropertyDetail: 'properties/:propertyId',
            },
          },
          Notifications: 'notifications',
          // Moteur Ménage 4B : écrans pro du ProfileStack (deep links push).
          Profile: {
            path: 'profile',
            screens: {
              MyRates: 'my-rates',
              MyPayouts: 'my-payouts',
              MyIssues: 'my-issues',
            },
          },
          Calendar: 'calendar',
          Reports: 'reports',
          // Appairage Tuya (modele C) — ouvert depuis le guide d'appairage du PMS web.
          Dashboard: {
            path: 'dashboard',
            screens: {
              TuyaPairing: 'pairing/tuya',
            },
          },
        },
      },
      Auth: {
        path: 'auth',
        screens: {
          Login: 'login',
        },
      },
    },
  },
};

const baitlyLinkingConfig: LinkingOptions<ReactNavigation.RootParamList> = {
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    if (url?.startsWith('clenzy://auth/callback')) return null;
    if (url && !useAuthStore.getState().isAuthenticated && captureInvitation(url)) return null;
    return url;
  },
  subscribe(listener) {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (url.startsWith('clenzy://auth/callback')) return;
      if (!useAuthStore.getState().isAuthenticated && captureInvitation(url)) return;
      listener(url);
    });
    return () => subscription.remove();
  },
  prefixes: ['clenzy://', 'https://app.clenzy.fr', 'https://app.baitly.fr'],
  config: { screens: {
    Main: { path: '', screens: {
      Tabs: { path: '', screens: {
        Home: { path: '', screens: {
          Today: 'today', Properties: 'properties', Marketplace: 'marketplace', Tracking: 'requests', Reels: 'reels',
        } },
        MandateSignature: { path: "sign/:token" },
        Provider: { path: 'marketplace/providers/:providerId', parse: { providerId: Number } },
        Quote: { path: 'quote-requests/:requestId', parse: {
          requestId: Number, side: (side: string) => side === 'received' ? 'received' : 'sent',
        } },
        Property: { path: 'properties/:propertyId', parse: { propertyId: Number } },
        Mission: { path: 'interventions/:interventionId', parse: { interventionId: Number } },
        Account: 'account',
        Network: { path: 'network-invitation', parse: { token: String } },
      } },
      Notifications: 'notifications',
    } },
    Auth: { path: 'auth', screens: { Login: 'login' } },
  } },
};

export function getMobileLinkingConfig(useBaitly: boolean, guest = false): LinkingOptions<ReactNavigation.RootParamList> {
  if (useBaitly && guest) return {
    ...baitlyLinkingConfig,
    config: { screens: { Auth: { path: '', screens: {
      Home: { path: '', screens: { Marketplace: 'marketplace', Properties: 'properties', Reels: 'reels', Profile: 'account' } },
      MandateSignature: { path: "sign/:token" },
        Provider: { path: 'marketplace/providers/:providerId', parse: { providerId: Number } },
      Login: { path: 'auth/login' },
    } } } },
  };
  return useBaitly ? baitlyLinkingConfig : legacyLinkingConfig;
}
