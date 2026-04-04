import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useProperty } from '@/hooks/useProperties';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/theme';

type IoniconsName = keyof typeof Ionicons.glyphMap;
type RouteParams = { PropertyInstructions: { propertyId: number } };

/* ─── Copiable field ─── */

function CopyableField({ label, value, theme }: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [value]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ flex: 1, marginRight: theme.SPACING.sm }}>
        <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, marginBottom: 2 }}>{label}</Text>
        <Text style={{ ...theme.typography.h4, color: theme.colors.text.primary, fontFamily: 'monospace' }}>{value}</Text>
      </View>
      <Pressable
        onPress={handleCopy}
        hitSlop={8}
        style={{
          width: 36, height: 36, borderRadius: theme.BORDER_RADIUS.md,
          backgroundColor: copied ? `${theme.colors.success.main}14` : `${theme.colors.primary.main}0C`,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ionicons
          name={copied ? 'checkmark' : 'copy-outline'}
          size={18}
          color={copied ? theme.colors.success.main : theme.colors.primary.main}
        />
      </Pressable>
    </View>
  );
}

/* ─── Instruction section card ─── */

function InstructionSection({ icon, iconColor, label, children, theme }: {
  icon: IoniconsName;
  iconColor: string;
  label: string;
  children: React.ReactNode;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Card style={{ marginBottom: theme.SPACING.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm, marginBottom: theme.SPACING.md }}>
        <View style={{
          width: 34, height: 34, borderRadius: theme.BORDER_RADIUS.md,
          backgroundColor: `${iconColor}0C`,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name={icon} size={17} color={iconColor} />
        </View>
        <Text style={{ ...theme.typography.body1, color: theme.colors.text.primary, fontWeight: '600' }}>
          {label}
        </Text>
      </View>
      {children}
    </Card>
  );
}

/* ─── Multiline text display ─── */

function MultilineText({ value, placeholder, theme }: {
  value?: string;
  placeholder?: string;
  theme: ReturnType<typeof useTheme>;
}) {
  if (!value) {
    return (
      <Text style={{ ...theme.typography.body2, color: theme.colors.text.disabled, fontStyle: 'italic' }}>
        {placeholder ?? 'Non renseigne'}
      </Text>
    );
  }

  return (
    <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, lineHeight: 22 }}>
      {value}
    </Text>
  );
}

/* ─── Main Screen ─── */

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
          <Skeleton height={120} borderRadius={theme.BORDER_RADIUS.lg} />
          <Skeleton height={80} borderRadius={theme.BORDER_RADIUS.lg} />
          <Skeleton height={80} borderRadius={theme.BORDER_RADIUS.lg} />
          <Skeleton height={60} borderRadius={theme.BORDER_RADIUS.lg} />
          <Skeleton height={100} borderRadius={theme.BORDER_RADIUS.lg} />
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

  const instructions = property.checkInInstructions;

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
        {/* ── Horaires ── */}
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

        {/* ── Acces (code d'acces) ── */}
        <InstructionSection
          icon="key-outline"
          iconColor={theme.colors.primary.main}
          label="Acces"
          theme={theme}
        >
          {instructions?.accessCode ? (
            <CopyableField label="Code d'acces" value={instructions.accessCode} theme={theme} />
          ) : (
            <MultilineText placeholder="Aucun code d'acces renseigne" theme={theme} />
          )}
        </InstructionSection>

        {/* ── WiFi ── */}
        <InstructionSection
          icon="wifi-outline"
          iconColor={theme.colors.info.main}
          label="WiFi"
          theme={theme}
        >
          {instructions?.wifiName || instructions?.wifiPassword ? (
            <View style={{ gap: theme.SPACING.md }}>
              {instructions.wifiName ? (
                <CopyableField label="Nom du reseau" value={instructions.wifiName} theme={theme} />
              ) : (
                <View>
                  <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, marginBottom: 2 }}>Nom du reseau</Text>
                  <Text style={{ ...theme.typography.body2, color: theme.colors.text.disabled, fontStyle: 'italic' }}>Non renseigne</Text>
                </View>
              )}
              {instructions.wifiName && instructions.wifiPassword && (
                <View style={{ height: 1, backgroundColor: theme.colors.border.light }} />
              )}
              {instructions.wifiPassword ? (
                <CopyableField label="Mot de passe" value={instructions.wifiPassword} theme={theme} />
              ) : (
                <View>
                  <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, marginBottom: 2 }}>Mot de passe</Text>
                  <Text style={{ ...theme.typography.body2, color: theme.colors.text.disabled, fontStyle: 'italic' }}>Non renseigne</Text>
                </View>
              )}
            </View>
          ) : (
            <MultilineText placeholder="Aucune information WiFi renseignee" theme={theme} />
          )}
        </InstructionSection>

        {/* ── Parking ── */}
        <InstructionSection
          icon="car-outline"
          iconColor={theme.colors.warning.main}
          label="Parking"
          theme={theme}
        >
          <MultilineText value={instructions?.parkingInfo} placeholder="Aucune information de parking" theme={theme} />
        </InstructionSection>

        {/* ── Consignes d'arrivee ── */}
        <InstructionSection
          icon="enter-outline"
          iconColor={theme.colors.success.main}
          label="Consignes d'arrivee"
          theme={theme}
        >
          <MultilineText
            value={instructions?.arrivalInstructions ?? property.accessInstructions}
            placeholder="Aucune consigne d'arrivee"
            theme={theme}
          />
        </InstructionSection>

        {/* ── Consignes de depart ── */}
        <InstructionSection
          icon="exit-outline"
          iconColor={theme.colors.error.main}
          label="Consignes de depart"
          theme={theme}
        >
          <MultilineText value={instructions?.departureInstructions} placeholder="Aucune consigne de depart" theme={theme} />
        </InstructionSection>

        {/* ── Reglement interieur ── */}
        <InstructionSection
          icon="document-text-outline"
          iconColor={theme.colors.secondary.main}
          label="Reglement interieur"
          theme={theme}
        >
          <MultilineText value={instructions?.houseRules ?? property.specialRequirements} placeholder="Aucun reglement interieur" theme={theme} />
        </InstructionSection>

        {/* ── Contact d'urgence ── */}
        <InstructionSection
          icon="call-outline"
          iconColor={theme.colors.error.main}
          label="Contact d'urgence"
          theme={theme}
        >
          {instructions?.emergencyContact || property.emergencyContact || property.emergencyPhone ? (
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
                {(instructions?.emergencyContact || property.emergencyContact) && (
                  <Text style={{ ...theme.typography.body1, color: theme.colors.text.primary }}>
                    {instructions?.emergencyContact ?? property.emergencyContact}
                  </Text>
                )}
                {property.emergencyPhone && (
                  <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginTop: 2 }}>
                    {property.emergencyPhone}
                  </Text>
                )}
              </View>
            </View>
          ) : (
            <MultilineText placeholder="Aucun contact d'urgence renseigne" theme={theme} />
          )}
        </InstructionSection>
      </ScrollView>
    </SafeAreaView>
  );
}
