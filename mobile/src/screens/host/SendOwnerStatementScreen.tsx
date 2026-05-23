/**
 * SendOwnerStatementScreen — Envoi de releve email a un proprietaire.
 *
 * Differenciateur Clenzy : permet a une conciergerie de transmettre en 1 clic
 * un rapport mensuel professionnel a chaque proprietaire (avec tableau detaille
 * des reversements verses sur la periode demandee).
 *
 * Flux :
 *   1. Selection de la periode (presets identiques a GeneratePayoutScreen)
 *   2. Preview email (sans envoi) + confirmation
 *   3. Envoi via POST /api/accounting/owners/{ownerId}/send-statement
 *   4. Confirmation toast + retour
 */
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTheme } from '@/theme';
import { useSendOwnerStatement } from '@/hooks/usePayouts';

type RouteParams = { SendOwnerStatement: { ownerId: number; ownerName?: string; ownerEmail?: string } };

type PeriodKey = 'this-month' | 'last-month' | 'this-quarter' | 'last-quarter' | 'year-to-date';

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function isoDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

const PERIODS: Array<{ key: PeriodKey; label: string; sub: string; compute: () => { from: string; to: string } }> = [
  {
    key: 'last-month',
    label: 'Mois precedent',
    sub: 'Le plus utilise — releve mensuel standard',
    compute: () => {
      const n = new Date();
      const from = new Date(n.getFullYear(), n.getMonth() - 1, 1);
      const to = new Date(n.getFullYear(), n.getMonth(), 0);
      return { from: isoDate(from), to: isoDate(to) };
    },
  },
  {
    key: 'this-month',
    label: 'Ce mois-ci',
    sub: 'Releve intermediaire',
    compute: () => {
      const n = new Date();
      const from = new Date(n.getFullYear(), n.getMonth(), 1);
      const to = new Date(n.getFullYear(), n.getMonth() + 1, 0);
      return { from: isoDate(from), to: isoDate(to) };
    },
  },
  {
    key: 'last-quarter',
    label: 'Trimestre precedent',
    sub: '3 derniers mois clotures',
    compute: () => {
      const n = new Date();
      const qStart = Math.floor(n.getMonth() / 3) * 3;
      const from = new Date(n.getFullYear(), qStart - 3, 1);
      const to = new Date(n.getFullYear(), qStart, 0);
      return { from: isoDate(from), to: isoDate(to) };
    },
  },
  {
    key: 'this-quarter',
    label: 'Trimestre en cours',
    sub: 'A date',
    compute: () => {
      const n = new Date();
      const qStart = Math.floor(n.getMonth() / 3) * 3;
      const from = new Date(n.getFullYear(), qStart, 1);
      return { from: isoDate(from), to: isoDate(n) };
    },
  },
  {
    key: 'year-to-date',
    label: 'Annee en cours',
    sub: 'Releve fiscal — du 1er janvier a aujourd\'hui',
    compute: () => {
      const n = new Date();
      const from = new Date(n.getFullYear(), 0, 1);
      return { from: isoDate(from), to: isoDate(n) };
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

export function SendOwnerStatementScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'SendOwnerStatement'>>();
  const { ownerId, ownerName, ownerEmail } = route.params;

  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('last-month');
  const [error, setError] = useState<string | null>(null);

  const period = PERIODS.find((p) => p.key === selectedPeriod) ?? PERIODS[0];
  const periodDates = useMemo(() => period.compute(), [period]);

  const sendMutation = useSendOwnerStatement();
  const isSending = sendMutation.isPending;

  const handleSend = () => {
    Alert.alert(
      'Envoyer le releve ?',
      `Destinataire : ${ownerName ?? `proprietaire #${ownerId}`}${ownerEmail ? `\n${ownerEmail}` : ''}\n` +
      `Periode : ${formatLongDate(periodDates.from)} → ${formatLongDate(periodDates.to)}\n\n` +
      "Un email HTML detaillant les reversements VERSES sera envoye immediatement.",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Envoyer',
          style: 'default',
          onPress: async () => {
            setError(null);
            try {
              const res = await sendMutation.mutateAsync({
                ownerId,
                from: periodDates.from,
                to: periodDates.to,
              });
              Alert.alert(
                'Releve envoye',
                `${res.payoutsCount} reversement${res.payoutsCount > 1 ? 's' : ''} (${res.totalPaid.toFixed(2)} €) envoyes a ${res.emailSentTo}.`,
                [{ text: 'OK', onPress: () => navigation.goBack() }],
              );
            } catch (e) {
              setError(e instanceof Error ? e.message : "Erreur lors de l'envoi du releve");
            }
          },
        },
      ],
    );
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
            width: 36, height: 36, borderRadius: theme.BORDER_RADIUS.md,
            backgroundColor: theme.colors.background.paper,
            alignItems: 'center', justifyContent: 'center',
            marginRight: theme.SPACING.md,
          }}
        >
          <Ionicons name="close" size={20} color={theme.colors.text.primary} />
        </Pressable>
        <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary, flex: 1 }}>
          Envoyer un releve
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingBottom: theme.SPACING['2xl'] }}>
        {/* Destinataire card */}
        <View style={{
          backgroundColor: theme.colors.background.paper,
          borderRadius: theme.BORDER_RADIUS.lg,
          padding: theme.SPACING.lg,
          marginBottom: theme.SPACING.lg,
          ...theme.shadows.sm,
        }}>
          <Text style={{
            ...theme.typography.caption,
            color: theme.colors.text.secondary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: theme.SPACING.xs,
          }}>
            Destinataire
          </Text>
          <Text style={{ ...theme.typography.h4, color: theme.colors.text.primary }}>
            {ownerName ?? `Proprietaire #${ownerId}`}
          </Text>
          {ownerEmail && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Ionicons name="mail-outline" size={14} color={theme.colors.text.secondary} />
              <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginLeft: 6 }}>
                {ownerEmail}
              </Text>
            </View>
          )}
        </View>

        {/* Periode */}
        <Text style={{
          ...theme.typography.caption,
          color: theme.colors.text.secondary,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: theme.SPACING.sm,
        }}>
          Periode du releve
        </Text>

        <View style={{ gap: theme.SPACING.sm, marginBottom: theme.SPACING.md }}>
          {PERIODS.map((opt) => {
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
          marginBottom: theme.SPACING.lg,
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

        {/* Info card */}
        <View style={{
          marginBottom: theme.SPACING.lg,
          padding: theme.SPACING.md,
          backgroundColor: '#E6F3F0',
          borderRadius: theme.BORDER_RADIUS.md,
          borderLeftWidth: 3,
          borderLeftColor: '#4A9B8E',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Ionicons name="information-circle-outline" size={16} color="#3A8579" />
            <Text style={{ ...theme.typography.caption, color: '#3A8579', fontWeight: '700', marginLeft: 6, textTransform: 'uppercase' }}>
              Contenu de l'email
            </Text>
          </View>
          <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, lineHeight: 18 }}>
            Tableau detaille des reversements <Text style={{ fontWeight: '700' }}>VERSES</Text> sur la periode (brut, commission, frais, net) + total cumule.
          </Text>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, fontSize: 11, marginTop: 4 }}>
            Les reversements en attente ou non payes ne sont pas inclus.
          </Text>
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
          onPress={handleSend}
          disabled={isSending}
          style={({ pressed }) => ({
            backgroundColor: isSending ? theme.colors.text.disabled : theme.colors.primary.main,
            opacity: pressed ? 0.85 : 1,
            paddingVertical: theme.SPACING.md,
            borderRadius: theme.BORDER_RADIUS.md,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8,
          })}
        >
          {isSending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name="paper-plane-outline" size={20} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>
                Envoyer le releve
              </Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
