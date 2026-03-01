import { useCallback } from 'react';
import { View, Text, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useProperties } from '@/hooks/useProperties';
import { PropertyCard } from '@/components/domain/PropertyCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { useTheme } from '@/theme';
import type { Property } from '@/api/endpoints/propertiesApi';

type PropertiesStackNav = NativeStackNavigationProp<{
  PropertyList: undefined;
  PropertyDetail: { propertyId: number };
}>;

function PropertyListSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.md }}>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} height={96} borderRadius={theme.BORDER_RADIUS.lg} />
      ))}
    </View>
  );
}

export function PropertyListScreen() {
  const theme = useTheme();
  const navigation = useNavigation<PropertiesStackNav>();
  const { data, isLoading, isRefetching, refetch, error, isError } = useProperties();
  const properties = data?.content ?? [];

  const handlePress = useCallback(
    (property: Property) => {
      navigation.navigate('PropertyDetail', { propertyId: property.id });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: Property }) => (
      <PropertyCard property={item} onPress={() => handlePress(item)} />
    ),
    [handlePress],
  );

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <View style={{ paddingHorizontal: theme.SPACING.lg, paddingTop: theme.SPACING['2xl'] }}>
          <Text style={{ ...theme.typography.h1, color: theme.colors.text.primary }}>Proprietes</Text>
        </View>
        <PropertyListSkeleton theme={theme} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: theme.SPACING.lg, paddingTop: theme.SPACING['2xl'], paddingBottom: theme.SPACING.md }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...theme.typography.h1, color: theme.colors.text.primary }}>Proprietes</Text>
          <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginTop: 4 }}>
            {properties.length} bien{properties.length !== 1 ? 's' : ''} enregistre{properties.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <NotificationBell />
      </View>

      <FlashList
        data={properties}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingBottom: theme.SPACING['5xl'] }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />}
        ListEmptyComponent={
          isError ? (
            <EmptyState
              iconName="warning-outline"
              title="Erreur de chargement"
              description={error instanceof Error ? error.message : 'Impossible de charger les proprietes'}
              actionLabel="Reessayer"
              onAction={refetch}
            />
          ) : (
            <EmptyState
              iconName="home-outline"
              title="Aucune propriete"
              description="Ajoutez votre premier bien depuis le site web"
            />
          )
        }
      />
    </SafeAreaView>
  );
}
