import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useProperty, usePropertyChannels } from '@/hooks/useProperties';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/theme';

type RouteParams = { PropertyChannels: { propertyId: number } };

export function PropertyChannelsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'PropertyChannels'>>();
  const { propertyId } = route.params;

  const { data: property } = useProperty(propertyId);
  const { data: channels, isLoading, isRefetching, refetch } = usePropertyChannels(propertyId);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: theme.SPACING.lg, paddingVertical: theme.SPACING.md,
        borderBottomWidth: 1, borderBottomColor: theme.colors.border.light,
        backgroundColor: theme.colors.background.paper,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={{ marginRight: theme.SPACING.md }}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.text.primary} />
        </Pressable>
        <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary, flex: 1 }}>Channels & Integrations</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: theme.SPACING.lg, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />}
      >
        {isLoading ? (
          <View style={{ gap: theme.SPACING.md }}>
            <Skeleton height={80} borderRadius={theme.BORDER_RADIUS.lg} />
            <Skeleton height={80} borderRadius={theme.BORDER_RADIUS.lg} />
          </View>
        ) : (
          <>
            {/* Airbnb */}
            <Card style={{ marginBottom: theme.SPACING.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.SPACING.lg }}>
                <View style={{
                  width: 48, height: 48, borderRadius: theme.BORDER_RADIUS.lg,
                  backgroundColor: '#FF585D10', alignItems: 'center', justifyContent: 'center',
                  marginRight: theme.SPACING.md,
                }}>
                  <Ionicons name="logo-no-smoking" size={24} color="#FF585D" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...theme.typography.h4, color: theme.colors.text.primary }}>Airbnb</Text>
                  <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginTop: 2 }}>
                    Synchronisation des reservations
                  </Text>
                </View>
                <Badge
                  label={channels?.airbnb?.linked ? (channels.airbnb.syncEnabled ? 'Actif' : 'Pause') : 'Non lie'}
                  color={channels?.airbnb?.linked ? (channels.airbnb.syncEnabled ? 'success' : 'warning') : 'neutral'}
                  dot
                />
              </View>

              {/* Details */}
              <View style={{ gap: theme.SPACING.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
                  <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>Statut connexion</Text>
                  <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, fontWeight: '600' }}>
                    {channels?.airbnb?.linked ? 'Connecte' : 'Non connecte'}
                  </Text>
                </View>
                <View style={{ height: 1, backgroundColor: theme.colors.border.light }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
                  <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>Synchronisation</Text>
                  <Text style={{ ...theme.typography.body2, color: channels?.airbnb?.syncEnabled ? theme.colors.success.main : theme.colors.text.disabled, fontWeight: '600' }}>
                    {channels?.airbnb?.syncEnabled ? 'Active' : 'Desactive'}
                  </Text>
                </View>
                <View style={{ height: 1, backgroundColor: theme.colors.border.light }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
                  <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>Derniere sync</Text>
                  <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, fontWeight: '600' }}>
                    {channels?.airbnb?.lastSyncAt
                      ? new Date(channels.airbnb.lastSyncAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                      : 'Jamais'}
                  </Text>
                </View>
              </View>

              {/* Airbnb URL */}
              {property?.airbnbUrl && (
                <View style={{
                  marginTop: theme.SPACING.md, paddingTop: theme.SPACING.md,
                  borderTopWidth: 1, borderTopColor: theme.colors.border.light,
                }}>
                  <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, marginBottom: 4 }}>URL de l'annonce</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="link-outline" size={14} color={theme.colors.primary.main} />
                    <Text style={{ ...theme.typography.body2, color: theme.colors.primary.main, flex: 1 }} numberOfLines={2}>
                      {property.airbnbUrl}
                    </Text>
                  </View>
                </View>
              )}

              {property?.airbnbListingId && (
                <View style={{ marginTop: theme.SPACING.sm }}>
                  <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>Listing ID: {property.airbnbListingId}</Text>
                </View>
              )}
            </Card>

            {/* Contrat maintenance */}
            <Card style={{ marginBottom: theme.SPACING.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{
                  width: 48, height: 48, borderRadius: theme.BORDER_RADIUS.lg,
                  backgroundColor: `${theme.colors.neutral.main}08`, alignItems: 'center', justifyContent: 'center',
                  marginRight: theme.SPACING.md,
                }}>
                  <Ionicons name="document-text-outline" size={24} color={theme.colors.neutral.main} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...theme.typography.h4, color: theme.colors.text.primary }}>Contrat maintenance</Text>
                  <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginTop: 2 }}>
                    {property?.maintenanceContract ? 'Contrat de maintenance actif' : 'Aucun contrat de maintenance'}
                  </Text>
                </View>
                <Badge
                  label={property?.maintenanceContract ? 'Actif' : 'Non'}
                  color={property?.maintenanceContract ? 'success' : 'neutral'}
                  dot
                />
              </View>
            </Card>

            {/* Autres channels placeholder */}
            <Card variant="outlined" style={{ opacity: 0.5 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{
                  width: 48, height: 48, borderRadius: theme.BORDER_RADIUS.lg,
                  backgroundColor: `${theme.colors.info.main}08`, alignItems: 'center', justifyContent: 'center',
                  marginRight: theme.SPACING.md,
                }}>
                  <Ionicons name="globe-outline" size={24} color={theme.colors.info.main} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...theme.typography.h4, color: theme.colors.text.primary }}>Booking.com, VRBO...</Text>
                  <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginTop: 2 }}>
                    Bientot disponible
                  </Text>
                </View>
                <Badge label="Bientot" color="info" />
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
