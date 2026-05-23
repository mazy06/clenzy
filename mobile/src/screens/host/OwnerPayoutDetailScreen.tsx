/**
 * OwnerPayoutDetailScreen — Detail d'un reversement proprietaire.
 *
 * Actions selon le statut :
 *  - PENDING → Approuver (admin)
 *  - APPROVED → Executer (admin)
 *  - FAILED → Reessayer (admin)
 *  - PAID → consultation seule
 *
 * Affiche le breakdown financier : revenu brut, commission Clenzy, frais, net.
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTheme } from '@/theme';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  usePayout,
  useApprovePayout,
  useExecutePayout,
  useRetryPayout,
  useOwnerPayoutConfig,
  useMarkPayoutAsPaid,
} from '@/hooks/usePayouts';
import {
  PAYOUT_STATUS_META,
  PAYOUT_METHOD_LABELS,
  type OwnerPayoutDto,
} from '@/api/endpoints/payoutsApi';

type IoniconsName = keyof typeof Ionicons.glyphMap;

type RouteParams = { OwnerPayoutDetail: { id: number } };

function formatAmount(amount: number): string {
  return amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function DetailRow({
  label,
  value,
  highlighted,
  theme,
}: {
  label: string;
  value: string;
  highlighted?: boolean;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      paddingVertical: theme.SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
    }}>
      <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>
        {label}
      </Text>
      <Text style={{
        ...theme.typography.body1,
        color: highlighted ? theme.colors.primary.main : theme.colors.text.primary,
        fontWeight: highlighted ? '700' : '500',
        fontVariant: ['tabular-nums'],
      }}>
        {value}
      </Text>
    </View>
  );
}

function ActionButton({
  label,
  icon,
  color,
  onPress,
  loading,
  theme,
}: {
  label: string;
  icon: IoniconsName;
  color: string;
  onPress: () => void;
  loading?: boolean;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => ({
        backgroundColor: color,
        opacity: loading || pressed ? 0.7 : 1,
        paddingVertical: theme.SPACING.md,
        borderRadius: theme.BORDER_RADIUS.md,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
      })}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" size="small" />
      ) : (
        <>
          <Ionicons name={icon} size={18} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15 }}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function OwnerPayoutDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'OwnerPayoutDetail'>>();
  const { id } = route.params;

  const { data: payout, isLoading, refetch } = usePayout(id);
  const { data: ownerConfig } = useOwnerPayoutConfig(payout?.ownerId, !!payout?.ownerId);
  const approveMutation = useApprovePayout();
  const executeMutation = useExecutePayout();
  const retryMutation = useRetryPayout();
  const markAsPaidMutation = useMarkPayoutAsPaid();
  const [actionError, setActionError] = useState<string | null>(null);
  const [showMarkPaidForm, setShowMarkPaidForm] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');

  const handleApprove = () => {
    Alert.alert(
      'Approuver ce reversement',
      'Confirmer l\'approbation ? Le reversement passera au statut APPROUVE et pourra ensuite etre execute.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Approuver',
          style: 'default',
          onPress: async () => {
            setActionError(null);
            try {
              await approveMutation.mutateAsync(id);
              await refetch();
            } catch (e) {
              setActionError(e instanceof Error ? e.message : 'Erreur lors de l\'approbation');
            }
          },
        },
      ],
    );
  };

  const handleExecute = () => {
    Alert.alert(
      'Executer le versement',
      'Le virement va etre declenche immediatement vers le rail configure (Wise / SEPA / Stripe Connect). Confirmer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Executer',
          style: 'default',
          onPress: async () => {
            setActionError(null);
            try {
              await executeMutation.mutateAsync(id);
              await refetch();
            } catch (e) {
              setActionError(e instanceof Error ? e.message : 'Erreur lors de l\'execution');
            }
          },
        },
      ],
    );
  };

  const handleRetry = () => {
    setActionError(null);
    retryMutation.mutateAsync(id)
      .then(() => refetch())
      .catch((e) => setActionError(e instanceof Error ? e.message : 'Erreur lors de la nouvelle tentative'));
  };

  const handleMarkPaidSubmit = async () => {
    const ref = paymentReference.trim();
    if (ref.length < 3) {
      setActionError('La reference doit contenir au moins 3 caracteres');
      return;
    }
    setActionError(null);
    try {
      await markAsPaidMutation.mutateAsync({ id, request: { paymentReference: ref } });
      setShowMarkPaidForm(false);
      setPaymentReference('');
      await refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erreur lors du marquage');
    }
  };

  if (isLoading || !payout) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <ScreenHeader theme={theme} title="Reversement" onBack={() => navigation.goBack()} />
        <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.md }}>
          <Skeleton height={140} borderRadius={theme.BORDER_RADIUS.lg} />
          <Skeleton height={240} borderRadius={theme.BORDER_RADIUS.lg} />
          <Skeleton height={50} borderRadius={theme.BORDER_RADIUS.md} />
        </View>
      </SafeAreaView>
    );
  }

  const statusMeta = PAYOUT_STATUS_META[payout.status];
  const methodLabel = payout.payoutMethod ? PAYOUT_METHOD_LABELS[payout.payoutMethod] : 'Non defini';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <ScreenHeader theme={theme} title="Reversement" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ padding: theme.SPACING.lg, paddingBottom: theme.SPACING['2xl'] }}>
        {/* Status + amount card */}
        <View style={{
          backgroundColor: theme.colors.background.paper,
          borderRadius: theme.BORDER_RADIUS.lg,
          padding: theme.SPACING.lg,
          marginBottom: theme.SPACING.md,
          ...theme.shadows.sm,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.SPACING.sm }}>
            <Ionicons name={statusMeta.icon as IoniconsName} size={18} color={statusMeta.color} />
            <Text style={{ ...theme.typography.caption, color: statusMeta.color, marginLeft: 6, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {statusMeta.label}
            </Text>
          </View>
          <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>
            Net a verser
          </Text>
          <Text style={{
            ...theme.typography.h1,
            color: statusMeta.color,
            fontVariant: ['tabular-nums'],
            marginTop: 4,
          }}>
            {formatAmount(payout.netAmount)} €
          </Text>
          <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginTop: 8 }}>
            Pour {payout.ownerName ?? `Proprietaire #${payout.ownerId}`}
          </Text>
        </View>

        {/* Breakdown */}
        <View style={{
          backgroundColor: theme.colors.background.paper,
          borderRadius: theme.BORDER_RADIUS.lg,
          padding: theme.SPACING.lg,
          marginBottom: theme.SPACING.md,
          ...theme.shadows.sm,
        }}>
          <Text style={{
            ...theme.typography.caption,
            color: theme.colors.text.secondary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: theme.SPACING.sm,
          }}>
            Detail financier
          </Text>
          <DetailRow theme={theme} label="Periode" value={`${formatDate(payout.periodStart)} → ${formatDate(payout.periodEnd)}`} />
          <DetailRow theme={theme} label="Revenu brut" value={`${formatAmount(payout.grossRevenue)} €`} />
          <DetailRow
            theme={theme}
            label={`Commission Clenzy (${(payout.commissionRate * 100).toFixed(1)}%)`}
            value={`- ${formatAmount(payout.commissionAmount)} €`}
          />
          {payout.expenses > 0 && (
            <DetailRow theme={theme} label="Frais deduits" value={`- ${formatAmount(payout.expenses)} €`} />
          )}
          <DetailRow theme={theme} label="Net a verser" value={`${formatAmount(payout.netAmount)} €`} highlighted />
        </View>

        {/* Method + transaction info */}
        <View style={{
          backgroundColor: theme.colors.background.paper,
          borderRadius: theme.BORDER_RADIUS.lg,
          padding: theme.SPACING.lg,
          marginBottom: theme.SPACING.md,
          ...theme.shadows.sm,
        }}>
          <Text style={{
            ...theme.typography.caption,
            color: theme.colors.text.secondary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: theme.SPACING.sm,
          }}>
            Methode de versement
          </Text>
          <DetailRow theme={theme} label="Rail" value={methodLabel} />
          <DetailRow theme={theme} label="Type" value={payout.generationType === 'AUTOMATIC' ? 'Automatique' : payout.generationType === 'SCHEDULED' ? 'Planifie' : 'Manuel'} />
          {payout.paymentReference && (
            <DetailRow theme={theme} label="Reference" value={payout.paymentReference} />
          )}
          {payout.stripeTransferId && (
            <DetailRow theme={theme} label="Transfert Stripe" value={payout.stripeTransferId} />
          )}
          {payout.paidAt && (
            <DetailRow theme={theme} label="Verse le" value={formatDateTime(payout.paidAt)} />
          )}
          <DetailRow theme={theme} label="Cree le" value={formatDateTime(payout.createdAt)} />
        </View>

        {/* Owner bank coordinates card (uniquement si dispo) */}
        {ownerConfig && (ownerConfig.maskedIban || ownerConfig.bankAccountHolder || ownerConfig.wiseConfigured) && (
          <View style={{
            backgroundColor: theme.colors.background.paper,
            borderRadius: theme.BORDER_RADIUS.lg,
            padding: theme.SPACING.lg,
            marginBottom: theme.SPACING.md,
            ...theme.shadows.sm,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.SPACING.sm }}>
              <Text style={{
                ...theme.typography.caption,
                color: theme.colors.text.secondary,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                flex: 1,
              }}>
                Coordonnees du proprietaire
              </Text>
              {ownerConfig.verified && (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="shield-checkmark" size={14} color="#059669" />
                  <Text style={{ ...theme.typography.caption, color: '#059669', marginLeft: 4, fontWeight: '600', fontSize: 11 }}>
                    Verifie
                  </Text>
                </View>
              )}
            </View>

            {ownerConfig.bankAccountHolder && (
              <DetailRow theme={theme} label="Titulaire" value={ownerConfig.bankAccountHolder} />
            )}
            {ownerConfig.maskedIban && (
              <DetailRow theme={theme} label="IBAN" value={ownerConfig.maskedIban} />
            )}
            {ownerConfig.bic && (
              <DetailRow theme={theme} label="BIC" value={ownerConfig.bic} />
            )}
            {ownerConfig.wiseConfigured && (
              <DetailRow theme={theme} label="Wise" value="Recipient configure" />
            )}
            {ownerConfig.openBankingProvider && (
              <DetailRow
                theme={theme}
                label="Open Banking"
                value={`${ownerConfig.openBankingProvider}${ownerConfig.openBankingConsentActive ? ' · actif' : ' · expire'}`}
              />
            )}

            {/* Banner consent expire bientot / expire */}
            {ownerConfig.openBankingConsentExpiresAt && !ownerConfig.openBankingConsentActive && (
              <View style={{
                marginTop: theme.SPACING.sm,
                padding: theme.SPACING.sm,
                backgroundColor: '#FBF3E5',
                borderRadius: theme.BORDER_RADIUS.sm,
                borderLeftWidth: 3,
                borderLeftColor: '#D4A574',
              }}>
                <Text style={{ ...theme.typography.caption, color: '#B58853', fontWeight: '600' }}>
                  Consentement Open Banking expire
                </Text>
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginTop: 2 }}>
                  Le proprietaire doit le renouveler pour pouvoir recevoir des virements automatiques.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Failure card if applicable */}
        {payout.failureReason && (
          <View style={{
            backgroundColor: '#FEF2F2',
            borderRadius: theme.BORDER_RADIUS.lg,
            padding: theme.SPACING.md,
            marginBottom: theme.SPACING.md,
            borderLeftWidth: 3,
            borderLeftColor: '#EF4444',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Ionicons name="alert-circle" size={16} color="#EF4444" />
              <Text style={{ ...theme.typography.caption, color: '#EF4444', fontWeight: '700', marginLeft: 6, textTransform: 'uppercase' }}>
                Erreur
              </Text>
            </View>
            <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary }}>
              {payout.failureReason}
            </Text>
            {payout.retryCount > 0 && (
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginTop: 4 }}>
                {payout.retryCount} tentative(s) effectuee(s)
              </Text>
            )}
          </View>
        )}

        {/* Action error */}
        {actionError && (
          <View style={{
            backgroundColor: '#FEF2F2',
            borderRadius: theme.BORDER_RADIUS.md,
            padding: theme.SPACING.md,
            marginBottom: theme.SPACING.md,
          }}>
            <Text style={{ ...theme.typography.body2, color: '#EF4444' }}>{actionError}</Text>
          </View>
        )}

        {/* Notes */}
        {payout.notes && (
          <View style={{
            backgroundColor: theme.colors.background.paper,
            borderRadius: theme.BORDER_RADIUS.lg,
            padding: theme.SPACING.lg,
            marginBottom: theme.SPACING.md,
            ...theme.shadows.sm,
          }}>
            <Text style={{
              ...theme.typography.caption,
              color: theme.colors.text.secondary,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 6,
            }}>
              Notes
            </Text>
            <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary }}>
              {payout.notes}
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={{ gap: theme.SPACING.sm, marginTop: theme.SPACING.sm }}>
          {payout.status === 'PENDING' && (
            <ActionButton
              theme={theme}
              label="Approuver"
              icon="checkmark-circle-outline"
              color="#3B82F6"
              onPress={handleApprove}
              loading={approveMutation.isPending}
            />
          )}
          {payout.status === 'APPROVED' && (
            <ActionButton
              theme={theme}
              label="Executer le versement"
              icon="paper-plane-outline"
              color="#059669"
              onPress={handleExecute}
              loading={executeMutation.isPending}
            />
          )}
          {payout.status === 'FAILED' && (
            <ActionButton
              theme={theme}
              label="Reessayer"
              icon="refresh-outline"
              color="#D97706"
              onPress={handleRetry}
              loading={retryMutation.isPending}
            />
          )}

          {/* Manual mark as paid — disponible pour PENDING et APPROVED */}
          {(payout.status === 'PENDING' || payout.status === 'APPROVED') && !showMarkPaidForm && (
            <Pressable
              onPress={() => setShowMarkPaidForm(true)}
              style={({ pressed }) => ({
                backgroundColor: 'transparent',
                paddingVertical: theme.SPACING.md,
                borderRadius: theme.BORDER_RADIUS.md,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 6,
                borderWidth: 1,
                borderColor: theme.colors.border.main,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name="receipt-outline" size={16} color={theme.colors.text.primary} />
              <Text style={{ color: theme.colors.text.primary, fontWeight: '500', fontSize: 14 }}>
                Marquer comme paye manuellement
              </Text>
            </Pressable>
          )}

          {/* Envoyer releve email — toujours disponible (rapport pour le proprietaire) */}
          <Pressable
            onPress={() => navigation.navigate('SendOwnerStatement', {
              ownerId: payout.ownerId,
              ownerName: payout.ownerName ?? undefined,
              ownerEmail: ownerConfig?.bankAccountHolder ?? undefined, // fallback display only
            })}
            style={({ pressed }) => ({
              backgroundColor: 'transparent',
              paddingVertical: theme.SPACING.md,
              borderRadius: theme.BORDER_RADIUS.md,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 6,
              borderWidth: 1,
              borderColor: theme.colors.border.main,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="mail-outline" size={16} color={theme.colors.text.primary} />
            <Text style={{ color: theme.colors.text.primary, fontWeight: '500', fontSize: 14 }}>
              Envoyer un releve au proprietaire
            </Text>
          </Pressable>

          {/* Mark as paid form (inline) */}
          {showMarkPaidForm && (
            <View style={{
              backgroundColor: theme.colors.background.paper,
              borderRadius: theme.BORDER_RADIUS.md,
              padding: theme.SPACING.md,
              gap: theme.SPACING.sm,
              ...theme.shadows.sm,
            }}>
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
                Reference du virement (ex: numero d'ordre SEPA, hash transaction Wise…)
              </Text>
              <TextInput
                value={paymentReference}
                onChangeText={setPaymentReference}
                placeholder="Ex: SEPA-2026-05-VIR-042"
                placeholderTextColor={theme.colors.text.disabled}
                style={{
                  borderWidth: 1,
                  borderColor: theme.colors.border.main,
                  borderRadius: theme.BORDER_RADIUS.sm,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 14,
                  color: theme.colors.text.primary,
                  backgroundColor: theme.colors.background.default,
                }}
                autoCorrect={false}
                autoCapitalize="characters"
              />
              <View style={{ flexDirection: 'row', gap: theme.SPACING.sm }}>
                <Pressable
                  onPress={() => { setShowMarkPaidForm(false); setPaymentReference(''); setActionError(null); }}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: theme.BORDER_RADIUS.sm,
                    borderWidth: 1,
                    borderColor: theme.colors.border.main,
                    alignItems: 'center',
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ color: theme.colors.text.primary, fontWeight: '500' }}>Annuler</Text>
                </Pressable>
                <Pressable
                  onPress={handleMarkPaidSubmit}
                  disabled={markAsPaidMutation.isPending || paymentReference.trim().length < 3}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: theme.BORDER_RADIUS.sm,
                    backgroundColor: paymentReference.trim().length < 3
                      ? theme.colors.text.disabled
                      : '#059669',
                    alignItems: 'center',
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  {markAsPaidMutation.isPending ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Confirmer</Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ScreenHeader({ theme, title, onBack }: { theme: ReturnType<typeof useTheme>; title: string; onBack: () => void }) {
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.SPACING.lg,
      paddingTop: theme.SPACING.lg,
      paddingBottom: theme.SPACING.md,
    }}>
      <Pressable
        onPress={onBack}
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
        <Ionicons name="arrow-back" size={20} color={theme.colors.text.primary} />
      </Pressable>
      <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary, flex: 1 }}>
        {title}
      </Text>
    </View>
  );
}
