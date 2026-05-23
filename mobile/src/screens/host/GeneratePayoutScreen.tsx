/**
 * GeneratePayoutScreen — Generation manuelle d'un reversement proprietaire.
 *
 * Flux :
 *  1. Selection du proprietaire (liste filtrable des users)
 *  2. Selection de la periode (preset : ce mois / mois precedent / trimestre)
 *  3. Confirmation + appel POST /api/accounting/payouts/generate
 *  4. Redirection vers le detail du payout cree
 *
 * Reservee aux admins / managers cote backend (le service les filtre via @PreAuthorize).
 */
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/theme';
import { Skeleton } from '@/components/ui/Skeleton';
import { useGeneratePayout, useGeneratePayoutsBatch } from '@/hooks/usePayouts';
import { usersAdminApi, type UserDto } from '@/api/endpoints/usersAdminApi';

type IoniconsName = keyof typeof Ionicons.glyphMap;

type PeriodKey = 'this-month' | 'last-month' | 'this-quarter' | 'last-quarter' | 'year-to-date';

interface PeriodOption {
  key: PeriodKey;
  label: string;
  sub: string;
  compute: () => { from: string; to: string };
}

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function isoDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

const PERIOD_OPTIONS: PeriodOption[] = [
  {
    key: 'this-month',
    label: 'Ce mois-ci',
    sub: 'Du 1er au dernier jour du mois en cours',
    compute: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: isoDate(from), to: isoDate(to) };
    },
  },
  {
    key: 'last-month',
    label: 'Mois precedent',
    sub: 'Le plus utilise — cloture du mois ecoule',
    compute: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: isoDate(from), to: isoDate(to) };
    },
  },
  {
    key: 'this-quarter',
    label: 'Trimestre en cours',
    sub: 'Du 1er jour du trimestre a aujourd\'hui',
    compute: () => {
      const now = new Date();
      const qStart = Math.floor(now.getMonth() / 3) * 3;
      const from = new Date(now.getFullYear(), qStart, 1);
      return { from: isoDate(from), to: isoDate(now) };
    },
  },
  {
    key: 'last-quarter',
    label: 'Trimestre precedent',
    sub: '3 derniers mois clotures',
    compute: () => {
      const now = new Date();
      const qStart = Math.floor(now.getMonth() / 3) * 3;
      const from = new Date(now.getFullYear(), qStart - 3, 1);
      const to = new Date(now.getFullYear(), qStart, 0);
      return { from: isoDate(from), to: isoDate(to) };
    },
  },
  {
    key: 'year-to-date',
    label: 'Annee en cours',
    sub: 'Du 1er janvier a aujourd\'hui',
    compute: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), 0, 1);
      return { from: isoDate(from), to: isoDate(now) };
    },
  },
];

function formatLongDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

type Mode = 'single' | 'batch';

export function GeneratePayoutScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();

  const [mode, setMode] = useState<Mode>('single');
  const [ownerSearch, setOwnerSearch] = useState('');
  const [selectedOwner, setSelectedOwner] = useState<UserDto | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('last-month');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Owners = utilisateurs de l'organisation. On filtre par role OWNER cote frontend
  // (le backend renvoie tous les users — un filtre serveur serait mieux mais l'usage est admin).
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => usersAdminApi.getAll(),
  });
  const owners: UserDto[] = useMemo(() => {
    const all = usersData?.content ?? [];
    // Conserver tous les utilisateurs (le backend filtre cote API) — l'admin choisit.
    // Filtrage rapide cote client par nom/email.
    const query = ownerSearch.trim().toLowerCase();
    if (!query) return all;
    return all.filter((u) =>
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query),
    );
  }, [usersData, ownerSearch]);

  const period = PERIOD_OPTIONS.find((p) => p.key === selectedPeriod) ?? PERIOD_OPTIONS[1];
  const periodDates = useMemo(() => period.compute(), [period]);

  const generateMutation = useGeneratePayout();
  const generateBatchMutation = useGeneratePayoutsBatch();

  const handleSubmit = () => {
    if (mode === 'single') {
      if (!selectedOwner) {
        setError('Selectionnez un proprietaire');
        return;
      }
      Alert.alert(
        'Generer ce reversement ?',
        `Proprietaire : ${selectedOwner.firstName} ${selectedOwner.lastName}\n` +
        `Periode : ${formatLongDate(periodDates.from)} → ${formatLongDate(periodDates.to)}\n\n` +
        'Le montant net sera calcule automatiquement depuis les reservations payees de la periode.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Generer',
            style: 'default',
            onPress: async () => {
              setError(null);
              setSubmitting(true);
              try {
                const payout = await generateMutation.mutateAsync({
                  ownerId: selectedOwner.id,
                  from: periodDates.from,
                  to: periodDates.to,
                });
                setSubmitting(false);
                navigation.replace('OwnerPayoutDetail', { id: payout.id });
              } catch (e) {
                setSubmitting(false);
                setError(e instanceof Error ? e.message : 'Erreur lors de la generation');
              }
            },
          },
        ],
      );
    } else {
      // BATCH mode
      Alert.alert(
        'Generer tous les reversements ?',
        `Periode : ${formatLongDate(periodDates.from)} → ${formatLongDate(periodDates.to)}\n\n` +
        'Un reversement PENDING sera cree pour chaque proprietaire ayant des reservations payees sur la periode. ' +
        'Les proprietaires deja servis sur cette periode seront ignores (idempotent).',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Generer tout',
            style: 'default',
            onPress: async () => {
              setError(null);
              setSubmitting(true);
              try {
                const payouts = await generateBatchMutation.mutateAsync({
                  from: periodDates.from,
                  to: periodDates.to,
                });
                setSubmitting(false);
                Alert.alert(
                  'Reversements generes',
                  `${payouts.length} reversement${payouts.length > 1 ? 's' : ''} disponible${payouts.length > 1 ? 's' : ''} dans la liste.`,
                  [{ text: 'OK', onPress: () => navigation.goBack() }],
                );
              } catch (e) {
                setSubmitting(false);
                setError(e instanceof Error ? e.message : 'Erreur lors de la generation batch');
              }
            },
          },
        ],
      );
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.SPACING.lg,
        paddingTop: theme.SPACING.lg,
        paddingBottom: theme.SPACING.md,
      }}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={{
            width: 36,
            height: 36,
            borderRadius: theme.BORDER_RADIUS.md,
            backgroundColor: theme.colors.background.paper,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: theme.SPACING.md,
          }}
        >
          <Ionicons name="close" size={20} color={theme.colors.text.primary} />
        </Pressable>
        <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary, flex: 1 }}>
          Nouveau reversement
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingBottom: theme.SPACING['2xl'] }}>
        {/* Mode toggle */}
        <View style={{
          flexDirection: 'row',
          backgroundColor: theme.colors.background.paper,
          borderRadius: theme.BORDER_RADIUS.md,
          padding: 4,
          marginBottom: theme.SPACING.lg,
          ...theme.shadows.sm,
        }}>
          {([
            { key: 'single' as Mode, label: 'Un proprietaire', icon: 'person-outline' as IoniconsName },
            { key: 'batch' as Mode, label: 'Tous (fin de mois)', icon: 'people-outline' as IoniconsName },
          ]).map((opt) => {
            const active = mode === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setMode(opt.key)}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingVertical: 10,
                  borderRadius: theme.BORDER_RADIUS.sm,
                  backgroundColor: active ? theme.colors.primary.main : 'transparent',
                }}
              >
                <Ionicons
                  name={opt.icon}
                  size={14}
                  color={active ? theme.colors.primary.contrastText : theme.colors.text.secondary}
                />
                <Text style={{
                  ...theme.typography.caption,
                  color: active ? theme.colors.primary.contrastText : theme.colors.text.secondary,
                  fontWeight: '600',
                }}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Banner batch mode explainer */}
        {mode === 'batch' && (
          <View style={{
            backgroundColor: '#E6F3F0',
            borderRadius: theme.BORDER_RADIUS.md,
            padding: theme.SPACING.md,
            marginBottom: theme.SPACING.lg,
            borderLeftWidth: 3,
            borderLeftColor: '#4A9B8E',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Ionicons name="flash-outline" size={16} color="#3A8579" />
              <Text style={{
                ...theme.typography.caption,
                color: '#3A8579',
                fontWeight: '700',
                marginLeft: 6,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
                Generation batch
              </Text>
            </View>
            <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, lineHeight: 18 }}>
              Cree un reversement PENDING pour <Text style={{ fontWeight: '700' }}>tous les proprietaires</Text> de l'organisation qui ont des reservations payees sur la periode selectionnee.
            </Text>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginTop: 4, fontSize: 11 }}>
              Idempotent : les proprietaires deja servis sur la periode sont ignores.
            </Text>
          </View>
        )}

        {/* Step 1: Proprietaire — uniquement en mode single */}
        {mode === 'single' && (
        <View style={{ marginBottom: theme.SPACING.lg }}>
          <Text style={{
            ...theme.typography.caption,
            color: theme.colors.text.secondary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: theme.SPACING.sm,
          }}>
            1. Proprietaire
          </Text>

          {/* Search */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.colors.background.paper,
            borderRadius: theme.BORDER_RADIUS.md,
            paddingHorizontal: theme.SPACING.md,
            marginBottom: theme.SPACING.sm,
            ...theme.shadows.sm,
          }}>
            <Ionicons name="search-outline" size={16} color={theme.colors.text.secondary} />
            <TextInput
              value={ownerSearch}
              onChangeText={setOwnerSearch}
              placeholder="Rechercher par nom ou email"
              placeholderTextColor={theme.colors.text.disabled}
              style={{
                flex: 1,
                paddingVertical: 12,
                paddingHorizontal: 10,
                fontSize: 14,
                color: theme.colors.text.primary,
              }}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {ownerSearch.length > 0 && (
              <Pressable onPress={() => setOwnerSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={theme.colors.text.disabled} />
              </Pressable>
            )}
          </View>

          {/* Owner list */}
          {usersLoading ? (
            <View style={{ gap: theme.SPACING.sm }}>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} height={60} borderRadius={theme.BORDER_RADIUS.md} />
              ))}
            </View>
          ) : owners.length === 0 ? (
            <View style={{
              padding: theme.SPACING.lg,
              backgroundColor: theme.colors.background.paper,
              borderRadius: theme.BORDER_RADIUS.md,
              alignItems: 'center',
            }}>
              <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>
                Aucun proprietaire trouve
              </Text>
            </View>
          ) : (
            <View style={{ gap: 1, backgroundColor: theme.colors.border.light, borderRadius: theme.BORDER_RADIUS.md, overflow: 'hidden' }}>
              {owners.map((owner) => {
                const selected = selectedOwner?.id === owner.id;
                return (
                  <Pressable
                    key={owner.id}
                    onPress={() => setSelectedOwner(owner)}
                    style={({ pressed }) => ({
                      backgroundColor: selected ? theme.colors.primary.main : (pressed ? theme.colors.background.surface : theme.colors.background.paper),
                      paddingVertical: theme.SPACING.md,
                      paddingHorizontal: theme.SPACING.md,
                      flexDirection: 'row',
                      alignItems: 'center',
                    })}
                  >
                    <View style={{
                      width: 36, height: 36, borderRadius: 18,
                      backgroundColor: selected ? '#FFFFFF22' : theme.colors.background.surface,
                      alignItems: 'center', justifyContent: 'center',
                      marginRight: theme.SPACING.md,
                    }}>
                      <Text style={{
                        fontWeight: '700',
                        color: selected ? theme.colors.primary.contrastText : theme.colors.text.primary,
                      }}>
                        {(owner.firstName?.[0] ?? '') + (owner.lastName?.[0] ?? '')}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        ...theme.typography.body1,
                        color: selected ? theme.colors.primary.contrastText : theme.colors.text.primary,
                        fontWeight: '600',
                      }}>
                        {owner.firstName} {owner.lastName}
                      </Text>
                      <Text style={{
                        ...theme.typography.caption,
                        color: selected ? theme.colors.primary.contrastText : theme.colors.text.secondary,
                        opacity: selected ? 0.8 : 1,
                        marginTop: 1,
                      }}>
                        {owner.email}
                      </Text>
                    </View>
                    {selected && (
                      <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary.contrastText} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        )}

        {/* Step 2: Periode (numerotee 1 en mode batch) */}
        <View style={{ marginBottom: theme.SPACING.lg }}>
          <Text style={{
            ...theme.typography.caption,
            color: theme.colors.text.secondary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: theme.SPACING.sm,
          }}>
            {mode === 'single' ? '2. Periode' : '1. Periode'}
          </Text>

          <View style={{ gap: theme.SPACING.sm }}>
            {PERIOD_OPTIONS.map((opt) => {
              const selected = selectedPeriod === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setSelectedPeriod(opt.key)}
                  style={({ pressed }) => ({
                    backgroundColor: selected ? theme.colors.primary.main : (pressed ? theme.colors.background.surface : theme.colors.background.paper),
                    borderRadius: theme.BORDER_RADIUS.md,
                    paddingHorizontal: theme.SPACING.md,
                    paddingVertical: theme.SPACING.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                    ...theme.shadows.sm,
                  })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      ...theme.typography.body1,
                      color: selected ? theme.colors.primary.contrastText : theme.colors.text.primary,
                      fontWeight: '600',
                    }}>
                      {opt.label}
                    </Text>
                    <Text style={{
                      ...theme.typography.caption,
                      color: selected ? theme.colors.primary.contrastText : theme.colors.text.secondary,
                      opacity: selected ? 0.85 : 1,
                      marginTop: 2,
                    }}>
                      {opt.sub}
                    </Text>
                  </View>
                  {selected && (
                    <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary.contrastText} />
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Period preview */}
          <View style={{
            marginTop: theme.SPACING.sm,
            padding: theme.SPACING.md,
            backgroundColor: '#EBF4F8',
            borderRadius: theme.BORDER_RADIUS.md,
            borderLeftWidth: 3,
            borderLeftColor: '#7BA3C2',
          }}>
            <Text style={{ ...theme.typography.caption, color: '#5A87A0', fontWeight: '700', marginBottom: 2 }}>
              PERIODE SELECTIONNEE
            </Text>
            <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, fontVariant: ['tabular-nums'] }}>
              {formatLongDate(periodDates.from)} → {formatLongDate(periodDates.to)}
            </Text>
          </View>
        </View>

        {/* Error */}
        {error && (
          <View style={{
            backgroundColor: '#FEF2F2',
            borderRadius: theme.BORDER_RADIUS.md,
            padding: theme.SPACING.md,
            marginBottom: theme.SPACING.md,
          }}>
            <Text style={{ ...theme.typography.body2, color: '#EF4444' }}>{error}</Text>
          </View>
        )}

        {/* Submit */}
        <Pressable
          onPress={handleSubmit}
          disabled={(mode === 'single' && !selectedOwner) || submitting}
          style={({ pressed }) => ({
            backgroundColor: (mode === 'single' && !selectedOwner) || submitting
              ? theme.colors.text.disabled
              : theme.colors.primary.main,
            opacity: pressed ? 0.85 : 1,
            paddingVertical: theme.SPACING.md,
            borderRadius: theme.BORDER_RADIUS.md,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8,
          })}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons
                name={mode === 'batch' ? 'flash-outline' : 'add-circle-outline'}
                size={20}
                color="#FFFFFF"
              />
              <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>
                {mode === 'batch' ? 'Generer tous les reversements' : 'Generer le reversement'}
              </Text>
            </>
          )}
        </Pressable>

        <Text style={{
          ...theme.typography.caption,
          color: theme.colors.text.secondary,
          textAlign: 'center',
          marginTop: theme.SPACING.sm,
          paddingHorizontal: theme.SPACING.md,
          lineHeight: 16,
        }}>
          {mode === 'batch'
            ? 'Tous les reversements seront crees en statut PENDING. Approuvez puis executez-les depuis la liste.'
            : "Le reversement sera cree en statut PENDING. Vous pourrez l'approuver puis l'executer ensuite."}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
