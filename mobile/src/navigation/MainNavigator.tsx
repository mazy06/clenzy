import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '@/store/authStore';
import { HostNavigator } from './HostNavigator';
import { ManagerNavigator } from './ManagerNavigator';
import { HousekeeperNavigator } from './HousekeeperNavigator';
import { TechnicianNavigator } from './TechnicianNavigator';
import { NotificationsScreen } from '@/screens/host/NotificationsScreen';

export type MainStackParamList = {
  Tabs: undefined;
  Notifications: undefined;
};

const Stack = createNativeStackNavigator<MainStackParamList>();

export function MainNavigator() {
  const {
    isSuperAdmin,
    isSuperManager,
    isSupervisor,
    isHost,
    isHousekeeper,
    isTechnician,
  } = useAuthStore();

  // Pick the role-specific tab navigator
  let RoleNavigator: React.ComponentType = HostNavigator;
  if (isSuperAdmin() || isSuperManager() || isSupervisor()) {
    RoleNavigator = ManagerNavigator;
  } else if (isHousekeeper()) {
    RoleNavigator = HousekeeperNavigator;
  } else if (isTechnician()) {
    RoleNavigator = TechnicianNavigator;
  } else if (isHost()) {
    RoleNavigator = HostNavigator;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={RoleNavigator} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}
