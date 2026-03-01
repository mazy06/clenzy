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
