import { LinkingOptions } from '@react-navigation/native';

export const linkingConfig: LinkingOptions<ReactNavigation.RootParamList> = {
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
