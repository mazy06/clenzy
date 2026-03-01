import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useProperty } from '@/hooks/useProperties';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/theme';

type RouteParams = { PropertyInstructions: { propertyId: number } };

export function PropertyInstructionsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'PropertyInstructions'>>();
  const { propertyId } = route.params;

  const { data: property, isLoading, isRefetching, refetch, isError } = useProperty(propertyId);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: theme.SPACING.lg, paddingVertical: theme.SPACING.md,
          borderBottomWidth: 1, borderBottomColor: theme.colors.border.light,
          backgroundColor: theme.colors.background.paper,
        }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={{ marginRight: theme.SPACING.md }}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.text.primary} />
          </Pressable>
          <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary }}>Instructions voyageurs</Text>
        </View>
        <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.md }}>
          <Skeleton height={60} borderRadius={theme.BORDER_RADIUS.lg} />
          <Skeleton height={100} borderRadius={theme.BORDER_RADIUS.lg} />
          <Skeleton height={80} borderRadius={theme.BORDER_RADIUS.lg} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !property) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <EmptyState iconName="warning-outline" title="Erreur" actionLabel="Retour" onAction={() => navigation.goBack()} />
      </SafeAreaView>
    );
  }

  const hasContent = property.accessInstructions || property.specialRequirements || property.emergencyContact || property.emergencyPhone;

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
        <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary, flex: 1 }}>Instructions voyageurs</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: theme.SPACING.lg, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />}
      >
        {/* Check-in / Check-out */}
        <Card style={{ marginBottom: theme.SPACING.lg }}>
          <Text style={{ ...theme.typography.overline, color: theme.colors.text.disabled, marginBottom: theme.SPACING.md }}>HORAIRES</Text>
          <View style={{ flexDirection: 'row', gap: theme.SPACING.md }}>
            <View style={{
              flex: 1, alignItems: 'center',
              paddingVertical: theme.SPACING.lg,
              backgroundColor: `${theme.colors.success.main}06`,
              borderRadius: theme.BORDER_RADIUS.md,
            }}>
              <View style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: `${theme.colors.success.main}12`,
                alignItems: 'center', justifyContent: 'center',
                marginBottom: theme.SPACING.sm,
              }}>
                <Ionicons name="log-in-outline" size={22} color={theme.colors.success.main} />
              </View>
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginBottom: 4 }}>Check-in</Text>
              <Text style={{ ...theme.typography.h2, color: theme.colors.success.main }}>
                {property.defaultCheckInTime ?? '15:00'}
              </Text>
            </View>
            <View style={{
              flex: 1, alignItems: 'center',
              paddingVertical: theme.SPACING.lg,
              backgroundColor: `${theme.colors.error.main}06`,
              borderRadius: theme.BORDER_RADIUS.md,
            }}>
              <View style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: `${theme.colors.error.main}12`,
                alignItems: 'center', justifyContent: 'center',
                marginBottom: theme.SPACING.sm,
              }}>
                <Ionicons name="log-out-outline" size={22} color={theme.colors.error.main} />
              </View>
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginBottom: 4 }}>Check-out</Text>
              <Text style={{ ...theme.typography.h2, color: theme.colors.error.main }}>
                {property.defaultCheckOutTime ?? '11:00'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Access instructions */}
        {property.accessInstructions ? (
          <Card style={{ marginBottom: theme.SPACING.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm, marginBottom: theme.SPACING.md }}>
              <View style={{
                width: 32, height: 32, borderRadius: theme.BORDER_RADIUS.sm,
                backgroundColor: `${theme.colors.primary.main}0C`,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="key-outline" size={16} color={theme.colors.primary.main} />
              </View>
              <Text style={{ ...theme.typography.body1, color: theme.colors.text.primary, fontWeight: '600' }}>
                Instructions d'acces
              </Text>
            </View>
            <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, lineHeight: 22 }}>
              {property.accessInstructions}
            </Text>
          </Card>
        ) : null}

        {/* Special requirements */}
        {property.specialRequirements ? (
          <Card style={{ marginBottom: theme.SPACING.lg }}>
            <View style={{
              padding: theme.SPACING.md,
              backgroundColor: `${theme.colors.warning.main}06`,
              borderRadius: theme.BORDER_RADIUS.md,
              borderLeftWidth: 3, borderLeftColor: theme.colors.warning.main,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Ionicons name="alert-circle-outline" size={16} color={theme.colors.warning.main} />
                <Text style={{ ...theme.typography.body1, color: theme.colors.warning.dark, fontWeight: '700' }}>
                  Exigences particulieres
                </Text>
              </View>
              <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, lineHeight: 22 }}>
                {property.specialRequirements}
              </Text>
            </View>
          </Card>
        ) : null}

        {/* Emergency contact */}
        {(property.emergencyContact || property.emergencyPhone) ? (
          <Card style={{ marginBottom: theme.SPACING.lg }}>
            <View style={{
              padding: theme.SPACING.md,
              backgroundColor: `${theme.colors.error.main}06`,
              borderRadius: theme.BORDER_RADIUS.md,
              flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.md,
            }}>
              <View style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: `${theme.colors.error.main}12`,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="call-outline" size={20} color={theme.colors.error.main} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...theme.typography.caption, color: theme.colors.error.main, fontWeight: '700', marginBottom: 4 }}>Contact urgence</Text>
                {property.emergencyContact && (
                  <Text style={{ ...theme.typography.body1, color: theme.colors.text.primary }}>{property.emergencyContact}</Text>
                )}
                {property.emergencyPhone && (
                  <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginTop: 2 }}>{property.emergencyPhone}</Text>
                )}
              </View>
            </View>
          </Card>
        ) : null}

        {/* No content */}
        {!hasContent && (
          <EmptyState
            iconName="book-outline"
            title="Aucune instruction"
            description="Pas d'instruction voyageur renseignee pour cette propriete"
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
