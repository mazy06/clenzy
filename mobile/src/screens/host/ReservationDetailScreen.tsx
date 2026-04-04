import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, Linking, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useReservation, useReservationInterventions } from '@/hooks/useReservations';
import { reservationsApi } from '@/api/endpoints/reservationsApi';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Avatar } from '@/components/ui/Avatar';
import { InterventionCard } from '@/components/domain/InterventionCard';
import { ReservationCancelDialog } from '@/screens/host/ReservationCancelDialog';
import { useTheme } from '@/theme';

type IoniconsName = keyof typeof Ionicons.glyphMap;

type RouteParams = { ReservationDetail: { reservationId: number } };

type TabKey = 'infos' | 'paiement' | 'operations' | 'communication';

const TABS: { key: TabKey; label: string; icon: IoniconsName }[] = [
  { key: 'infos', label: 'Infos', icon: 'information-circle-outline' },
  { key: 'paiement', label: 'Paiement', icon: 'card-outline' },
  { key: 'operations', label: 'Operations', icon: 'construct-outline' },
  { key: 'communication', label: 'Messages', icon: 'chatbubble-outline' },
];

/* --- Status config --- */

const STATUS_CONFIG: Record<string, { label: string; color: 'success' | 'warning' | 'error' | 'info' }> = {
  CONFIRMED: { label: 'Confirmee', color: 'success' },
  PENDING: { label: 'En attente', color: 'warning' },
  CANCELLED: { label: 'Annulee', color: 'error' },
  CHECKED_IN: { label: 'En cours', color: 'info' },
  CHECKED_OUT: { label: 'Terminee', color: 'success' },
};

const PAYMENT_STATUS_CONFIG: Record<string, { label: string; color: 'success' | 'warning' | 'error' | 'info' }> = {
  PAID: { label: 'Paye', color: 'success' },
  PENDING: { label: 'En attente', color: 'warning' },
  PROCESSING: { label: 'En cours', color: 'info' },
  FAILED: { label: 'Echoue', color: 'error' },
  REFUNDED: { label: 'Rembourse', color: 'info' },
  PARTIALLY_PAID: { label: 'Partiel', color: 'warning' },
};

const SOURCE_ICONS: Record<string, IoniconsName> = {
  AIRBNB: 'logo-no-smoking',
  BOOKING: 'globe-outline',
  DIRECT: 'person-outline',
  ICAL: 'calendar-outline',
};

/* --- Helpers --- */

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatDateShort(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) +
      ' a ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr?: string): string {
  if (!timeStr) return '--:--';
  return timeStr.substring(0, 5);
}

function nightCount(checkIn: string, checkOut: string): number {
  try {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
  } catch {
    return 0;
  }
}

function formatCurrency(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} \u20AC`;
}

/* --- Sub-components --- */

function InfoRow({ icon, label, value, onPress, actionIcon, theme }: {
  icon: IoniconsName;
  label: string;
  value: string;
  onPress?: () => void;
  actionIcon?: IoniconsName;
  theme: ReturnType<typeof useTheme>;
}) {
  const content = (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.SPACING.sm,
    }}>
      <View style={{
        width: 32, height: 32, borderRadius: theme.BORDER_RADIUS.sm,
        backgroundColor: `${theme.colors.primary.main}0A`,
        alignItems: 'center', justifyContent: 'center',
        marginRight: theme.SPACING.md,
      }}>
        <Ionicons name={icon} size={16} color={theme.colors.primary.main} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>{label}</Text>
        <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, marginTop: 1 }}>{value}</Text>
      </View>
      {actionIcon && (
        <View style={{
          width: 32, height: 32, borderRadius: theme.BORDER_RADIUS.sm,
          backgroundColor: `${theme.colors.primary.main}0A`,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name={actionIcon} size={16} color={theme.colors.primary.main} />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
        {content}
      </Pressable>
    );
  }

  return content;
}

function PriceRow({ label, amount, bold, color, theme }: {
  label: string;
  amount: number;
  bold?: boolean;
  color?: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.SPACING.xs,
    }}>
      <Text style={{
        ...theme.typography.body2,
        color: theme.colors.text.secondary,
        fontWeight: bold ? '700' : '400',
      }}>
        {label}
      </Text>
      <Text style={{
        ...theme.typography.body2,
        color: color ?? theme.colors.text.primary,
        fontWeight: bold ? '700' : '500',
      }}>
        {formatCurrency(amount)}
      </Text>
    </View>
  );
}

function DetailSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.md }}>
      <View style={{ flexDirection: 'row', gap: theme.SPACING.sm }}>
        <Skeleton width={90} height={26} borderRadius={20} />
        <Skeleton width={90} height={26} borderRadius={20} />
      </View>
      <Skeleton height={20} width="60%" />
      <Skeleton height={120} borderRadius={theme.BORDER_RADIUS.lg} />
      <Skeleton height={100} borderRadius={theme.BORDER_RADIUS.lg} />
      <Skeleton height={80} borderRadius={theme.BORDER_RADIUS.lg} />
      <Skeleton height={80} borderRadius={theme.BORDER_RADIUS.lg} />
    </View>
  );
}

/* --- Tab content components --- */

function TabInfos({ reservation, theme, openPhone, openEmail }: {
  reservation: any;
  theme: ReturnType<typeof useTheme>;
  openPhone: (phone: string) => void;
  openEmail: (email: string) => void;
}) {
  const nights = nightCount(reservation.checkIn, reservation.checkOut);
  const sourceIcon = SOURCE_ICONS[reservation.source ?? ''] ?? 'globe-outline';
  const sourceName = reservation.sourceName || reservation.source || 'Direct';

  return (
    <View>
      {/* Guest info */}
      <SectionHeader title="Voyageur" iconName="person-outline" />
      <Card style={{ marginBottom: theme.SPACING.lg }}>
        {reservation.guestName ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.SPACING.md }}>
            <Avatar name={reservation.guestName} size={48} style={{ marginRight: theme.SPACING.md }} />
            <View style={{ flex: 1 }}>
              <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary }}>
                {reservation.guestName}
              </Text>
              {reservation.guestCount != null && (
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginTop: 2 }}>
                  {reservation.guestCount} voyageur{reservation.guestCount > 1 ? 's' : ''}
                </Text>
              )}
            </View>
          </View>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: theme.SPACING.sm }}>
            <Ionicons name="person-outline" size={24} color={theme.colors.text.disabled} />
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, marginTop: theme.SPACING.xs }}>
              Aucune information voyageur
            </Text>
          </View>
        )}
        {reservation.guestEmail && (
          <InfoRow
            icon="mail-outline"
            label="Email"
            value={reservation.guestEmail}
            onPress={() => openEmail(reservation.guestEmail!)}
            actionIcon="open-outline"
            theme={theme}
          />
        )}
        {reservation.guestPhone && (
          <InfoRow
            icon="call-outline"
            label="Telephone"
            value={reservation.guestPhone}
            onPress={() => openPhone(reservation.guestPhone!)}
            actionIcon="open-outline"
            theme={theme}
          />
        )}
      </Card>

      {/* Dates & stay */}
      <SectionHeader title="Dates & Sejour" iconName="calendar-outline" />
      <Card style={{ marginBottom: theme.SPACING.lg }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: theme.colors.background.surface,
          borderRadius: theme.BORDER_RADIUS.sm,
          padding: theme.SPACING.md,
          marginBottom: theme.SPACING.sm,
        }}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>Arrivee</Text>
            <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginTop: 2 }}>
              {formatDate(reservation.checkIn)}
            </Text>
            <Text style={{ ...theme.typography.caption, color: theme.colors.primary.main, fontWeight: '600', marginTop: 2 }}>
              {formatTime(reservation.checkInTime)}
            </Text>
          </View>
          <View style={{ alignItems: 'center', paddingHorizontal: theme.SPACING.md }}>
            <View style={{
              backgroundColor: `${theme.colors.primary.main}14`,
              borderRadius: theme.BORDER_RADIUS.full,
              paddingHorizontal: 12, paddingVertical: 6,
            }}>
              <Text style={{ ...theme.typography.body2, color: theme.colors.primary.main, fontWeight: '700' }}>
                {nights}N
              </Text>
            </View>
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>Depart</Text>
            <Text style={{ ...theme.typography.h5, color: theme.colors.text.primary, marginTop: 2 }}>
              {formatDate(reservation.checkOut)}
            </Text>
            <Text style={{ ...theme.typography.caption, color: theme.colors.primary.main, fontWeight: '600', marginTop: 2 }}>
              {formatTime(reservation.checkOutTime)}
            </Text>
          </View>
        </View>
      </Card>

      {/* Property */}
      <SectionHeader title="Logement" iconName="home-outline" />
      <Card style={{ marginBottom: theme.SPACING.lg }}>
        <InfoRow
          icon="home-outline"
          label="Propriete"
          value={reservation.propertyName || `Propriete #${reservation.propertyId}`}
          theme={theme}
        />
        <InfoRow
          icon={sourceIcon}
          label="Source"
          value={sourceName}
          theme={theme}
        />
        {reservation.confirmationCode && (
          <InfoRow
            icon="document-text-outline"
            label="Code de confirmation"
            value={reservation.confirmationCode}
            theme={theme}
          />
        )}
      </Card>

      {/* Notes */}
      <SectionHeader title="Notes & demandes speciales" iconName="document-text-outline" />
      <Card style={{ marginBottom: theme.SPACING.lg }}>
        {reservation.notes ? (
          <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, lineHeight: 22 }}>
            {reservation.notes}
          </Text>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: theme.SPACING.sm }}>
            <Ionicons name="document-text-outline" size={20} color={theme.colors.text.disabled} />
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, marginTop: theme.SPACING.xs }}>
              Aucune note
            </Text>
          </View>
        )}
      </Card>
    </View>
  );
}

function TabPaiement({ reservation, theme, onSendPaymentLink, isSendingLink }: {
  reservation: any;
  theme: ReturnType<typeof useTheme>;
  onSendPaymentLink: () => void;
  isSendingLink: boolean;
}) {
  const totalPrice = reservation.totalPrice ?? 0;
  const cleaningFee = reservation.cleaningFee ?? 0;
  const touristTax = reservation.touristTaxAmount ?? 0;
  const netPrice = totalPrice - cleaningFee - touristTax;
  const paymentConf = reservation.paymentStatus
    ? (PAYMENT_STATUS_CONFIG[reservation.paymentStatus] ?? { label: reservation.paymentStatus, color: 'info' as const })
    : null;

  // Simulate paid/remaining for display
  const paidAmount = reservation.paymentStatus === 'PAID' ? totalPrice
    : reservation.paymentStatus === 'PARTIALLY_PAID' ? totalPrice * 0.5
    : 0;
  const remaining = totalPrice - paidAmount;

  return (
    <View>
      {/* Payment status */}
      <SectionHeader title="Statut du paiement" iconName="card-outline" />
      <Card style={{ marginBottom: theme.SPACING.lg }}>
        {paymentConf && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.SPACING.md }}>
            <Badge label={paymentConf.label} color={paymentConf.color} dot />
          </View>
        )}

        <View style={{
          backgroundColor: theme.colors.background.surface,
          borderRadius: theme.BORDER_RADIUS.sm,
          padding: theme.SPACING.md,
          marginBottom: theme.SPACING.sm,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.SPACING.sm }}>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>Total</Text>
              <Text style={{ ...theme.typography.h4, color: theme.colors.text.primary, marginTop: 4 }}>
                {formatCurrency(totalPrice)}
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: theme.colors.border.light }} />
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>Paye</Text>
              <Text style={{ ...theme.typography.h4, color: theme.colors.success.main, marginTop: 4 }}>
                {formatCurrency(paidAmount)}
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: theme.colors.border.light }} />
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>Restant</Text>
              <Text style={{ ...theme.typography.h4, color: remaining > 0 ? theme.colors.warning.main : theme.colors.success.main, marginTop: 4 }}>
                {formatCurrency(remaining)}
              </Text>
            </View>
          </View>
        </View>
      </Card>

      {/* Pricing breakdown */}
      {totalPrice > 0 && (
        <>
          <SectionHeader title="Detail tarifaire" iconName="pricetag-outline" />
          <Card style={{ marginBottom: theme.SPACING.lg }}>
            <PriceRow label="Prix total" amount={totalPrice} theme={theme} />
            {cleaningFee > 0 && <PriceRow label="Frais de menage" amount={cleaningFee} theme={theme} />}
            {touristTax > 0 && <PriceRow label="Taxe de sejour" amount={touristTax} theme={theme} />}
            {(cleaningFee > 0 || touristTax > 0) && (
              <>
                <View style={{ height: 1, backgroundColor: theme.colors.border.light, marginVertical: theme.SPACING.sm }} />
                <PriceRow label="Revenu net" amount={netPrice} bold color={theme.colors.success.main} theme={theme} />
              </>
            )}
          </Card>
        </>
      )}

      {/* Payment info */}
      {(reservation.paidAt || reservation.paymentLinkSentAt) && (
        <>
          <SectionHeader title="Historique" iconName="time-outline" />
          <Card style={{ marginBottom: theme.SPACING.lg }}>
            {reservation.paidAt && (
              <InfoRow
                icon="checkmark-circle-outline"
                label="Paye le"
                value={formatDateTime(reservation.paidAt)}
                theme={theme}
              />
            )}
            {reservation.paymentLinkSentAt && (
              <InfoRow
                icon="link-outline"
                label="Lien de paiement envoye"
                value={formatDateTime(reservation.paymentLinkSentAt) +
                  (reservation.paymentLinkEmail ? ` a ${reservation.paymentLinkEmail}` : '')}
                theme={theme}
              />
            )}
          </Card>
        </>
      )}

      {/* Send payment link button */}
      {reservation.paymentStatus !== 'PAID' && remaining > 0 && (
        <Button
          title="Envoyer lien de paiement"
          onPress={onSendPaymentLink}
          loading={isSendingLink}
          variant="outlined"
          fullWidth
          icon={<Ionicons name="link-outline" size={18} color={theme.colors.primary.main} />}
        />
      )}
    </View>
  );
}

function TabOperations({ reservation, theme }: {
  reservation: any;
  theme: ReturnType<typeof useTheme>;
}) {
  const navigation = useNavigation<any>();
  // Check-in / Check-out status
  const isCheckedIn = reservation.status === 'CHECKED_IN' || reservation.status === 'CHECKED_OUT';
  const isCheckedOut = reservation.status === 'CHECKED_OUT';

  // Fetch all linked interventions
  const { data: interventions, isLoading: interventionsLoading } = useReservationInterventions(reservation.id);

  return (
    <View>
      {/* Check-in/out status */}
      <SectionHeader title="Check-in / Check-out" iconName="log-in-outline" />
      <Card style={{ marginBottom: theme.SPACING.lg }}>
        <View style={{ flexDirection: 'row', gap: theme.SPACING.md }}>
          <View style={{
            flex: 1, alignItems: 'center',
            backgroundColor: isCheckedIn ? `${theme.colors.success.main}0A` : theme.colors.background.surface,
            borderRadius: theme.BORDER_RADIUS.sm,
            padding: theme.SPACING.md,
          }}>
            <Ionicons
              name={isCheckedIn ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={isCheckedIn ? theme.colors.success.main : theme.colors.text.disabled}
            />
            <Text style={{
              ...theme.typography.body2,
              color: isCheckedIn ? theme.colors.success.main : theme.colors.text.disabled,
              fontWeight: '600', marginTop: 4,
            }}>
              Check-in
            </Text>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginTop: 2 }}>
              {formatTime(reservation.checkInTime)}
            </Text>
          </View>

          <View style={{
            flex: 1, alignItems: 'center',
            backgroundColor: isCheckedOut ? `${theme.colors.success.main}0A` : theme.colors.background.surface,
            borderRadius: theme.BORDER_RADIUS.sm,
            padding: theme.SPACING.md,
          }}>
            <Ionicons
              name={isCheckedOut ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={isCheckedOut ? theme.colors.success.main : theme.colors.text.disabled}
            />
            <Text style={{
              ...theme.typography.body2,
              color: isCheckedOut ? theme.colors.success.main : theme.colors.text.disabled,
              fontWeight: '600', marginTop: 4,
            }}>
              Check-out
            </Text>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginTop: 2 }}>
              {formatTime(reservation.checkOutTime)}
            </Text>
          </View>
        </View>
      </Card>

      {/* Linked interventions */}
      <SectionHeader title="Interventions liees" iconName="construct-outline" />
      {interventionsLoading ? (
        <Card style={{ marginBottom: theme.SPACING.lg, padding: theme.SPACING.lg, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={theme.colors.primary.main} />
        </Card>
      ) : interventions && interventions.length > 0 ? (
        <View style={{ marginBottom: theme.SPACING.lg, gap: theme.SPACING.sm }}>
          {interventions.map((intervention) => (
            <InterventionCard
              key={intervention.id}
              intervention={intervention}
              onPress={() => navigation.navigate('InterventionDetail', { interventionId: intervention.id })}
            />
          ))}
        </View>
      ) : (
        <Card style={{ marginBottom: theme.SPACING.lg }}>
          <EmptyState
            compact
            iconName="construct-outline"
            title="Aucune intervention"
            description="Les interventions de menage et maintenance liees a cette reservation apparaitront ici."
          />
        </Card>
      )}
    </View>
  );
}

function TabCommunication({ reservation, theme }: {
  reservation: any;
  theme: ReturnType<typeof useTheme>;
}) {
  const navigation = useNavigation<any>();

  return (
    <View>
      <SectionHeader title="Communication" iconName="chatbubble-outline" />

      {/* Quick actions */}
      <Card style={{ marginBottom: theme.SPACING.lg }}>
        <View style={{ gap: theme.SPACING.sm }}>
          {reservation.guestEmail && (
            <Pressable
              onPress={() => Linking.openURL(`mailto:${reservation.guestEmail}`)}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center',
                padding: theme.SPACING.md,
                borderRadius: theme.BORDER_RADIUS.sm,
                backgroundColor: pressed ? theme.colors.background.surface : `${theme.colors.primary.main}06`,
              })}
            >
              <View style={{
                width: 40, height: 40, borderRadius: theme.BORDER_RADIUS.md,
                backgroundColor: `${theme.colors.primary.main}14`,
                alignItems: 'center', justifyContent: 'center',
                marginRight: theme.SPACING.md,
              }}>
                <Ionicons name="mail-outline" size={20} color={theme.colors.primary.main} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, fontWeight: '600' }}>
                  Envoyer un email
                </Text>
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
                  {reservation.guestEmail}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.text.disabled} />
            </Pressable>
          )}

          {reservation.guestPhone && (
            <Pressable
              onPress={() => Linking.openURL(`sms:${reservation.guestPhone}`)}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center',
                padding: theme.SPACING.md,
                borderRadius: theme.BORDER_RADIUS.sm,
                backgroundColor: pressed ? theme.colors.background.surface : `${theme.colors.success.main}06`,
              })}
            >
              <View style={{
                width: 40, height: 40, borderRadius: theme.BORDER_RADIUS.md,
                backgroundColor: `${theme.colors.success.main}14`,
                alignItems: 'center', justifyContent: 'center',
                marginRight: theme.SPACING.md,
              }}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={theme.colors.success.main} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, fontWeight: '600' }}>
                  Envoyer un SMS
                </Text>
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
                  {reservation.guestPhone}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.text.disabled} />
            </Pressable>
          )}

          {reservation.guestPhone && (
            <Pressable
              onPress={() => Linking.openURL(`https://wa.me/${reservation.guestPhone!.replace(/[^0-9]/g, '')}`)}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center',
                padding: theme.SPACING.md,
                borderRadius: theme.BORDER_RADIUS.sm,
                backgroundColor: pressed ? theme.colors.background.surface : `${theme.colors.success.main}06`,
              })}
            >
              <View style={{
                width: 40, height: 40, borderRadius: theme.BORDER_RADIUS.md,
                backgroundColor: '#25D36614',
                alignItems: 'center', justifyContent: 'center',
                marginRight: theme.SPACING.md,
              }}>
                <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, fontWeight: '600' }}>
                  WhatsApp
                </Text>
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
                  {reservation.guestPhone}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.text.disabled} />
            </Pressable>
          )}

          {!reservation.guestEmail && !reservation.guestPhone && (
            <EmptyState
              compact
              iconName="chatbubble-outline"
              title="Aucun contact"
              description="Les coordonnees du voyageur ne sont pas disponibles."
            />
          )}
        </View>
      </Card>

      {/* Message history preview */}
      <SectionHeader title="Historique des messages" iconName="time-outline" />
      <Card style={{ marginBottom: theme.SPACING.lg }}>
        <EmptyState
          compact
          iconName="chatbubbles-outline"
          title="Aucun message"
          description="L'historique des messages avec le voyageur apparaitra ici."
        />
      </Card>
    </View>
  );
}

/* --- Main Screen --- */

export function ReservationDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'ReservationDetail'>>();
  const { reservationId } = route.params;
  const queryClient = useQueryClient();

  const { data: reservation, isLoading, isError, error, isRefetching, refetch } = useReservation(reservationId);

  const [activeTab, setActiveTab] = useState<TabKey>('infos');
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const sendPaymentLinkMutation = useMutation({
    mutationFn: (email?: string) => reservationsApi.sendPaymentLink(reservationId, email),
    onSuccess: () => {
      Alert.alert('Succes', 'Le lien de paiement a ete envoye.');
      queryClient.invalidateQueries({ queryKey: ['reservations', 'detail', reservationId] });
    },
    onError: (err: any) => {
      Alert.alert('Erreur', err?.message || 'Impossible d\'envoyer le lien de paiement.');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => reservationsApi.cancel(reservationId, reason),
    onSuccess: () => {
      Alert.alert('Succes', 'La reservation a ete annulee.');
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      navigation.goBack();
    },
    onError: (err: any) => {
      Alert.alert('Erreur', err?.message || 'Impossible d\'annuler la reservation.');
    },
  });

  const openPhone = useCallback((phone: string) => {
    Linking.openURL(`tel:${phone}`);
  }, []);

  const openEmail = useCallback((email: string) => {
    Linking.openURL(`mailto:${email}`);
  }, []);

  const handleSendPaymentLink = useCallback(() => {
    const guestEmail = reservation?.guestEmail;

    if (guestEmail) {
      // Guest has email — confirm and send
      Alert.alert(
        'Envoyer le lien de paiement',
        `Le lien sera envoye a ${guestEmail}.`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Envoyer', onPress: () => sendPaymentLinkMutation.mutate(guestEmail) },
          {
            text: 'Autre email',
            onPress: () => {
              Alert.prompt(
                'Email du destinataire',
                'Saisissez l\'adresse email pour recevoir le lien de paiement.',
                (email) => {
                  if (email?.trim()) sendPaymentLinkMutation.mutate(email.trim());
                },
                'plain-text',
                guestEmail,
                'email-address',
              );
            },
          },
        ],
      );
    } else {
      // No guest email — prompt for email
      Alert.prompt(
        'Email du destinataire',
        'Aucun email voyageur configure. Saisissez l\'adresse email pour recevoir le lien de paiement.',
        (email) => {
          if (email?.trim()) sendPaymentLinkMutation.mutate(email.trim());
        },
        'plain-text',
        '',
        'email-address',
      );
    }
  }, [sendPaymentLinkMutation, reservation?.guestEmail]);

  const handleCancelConfirm = useCallback((reason: string) => {
    setShowCancelDialog(false);
    cancelMutation.mutate(reason);
  }, [cancelMutation]);

  /* --- Loading --- */

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={{
            position: 'absolute', top: theme.SPACING.lg, left: theme.SPACING.lg, zIndex: 10,
            width: 36, height: 36, borderRadius: theme.BORDER_RADIUS.md,
            backgroundColor: theme.colors.background.paper,
            alignItems: 'center', justifyContent: 'center',
            ...theme.shadows.md,
          }}
        >
          <Ionicons name="chevron-back" size={20} color={theme.colors.text.primary} />
        </Pressable>
        <View style={{ marginTop: 56 }}>
          <DetailSkeleton theme={theme} />
        </View>
      </SafeAreaView>
    );
  }

  /* --- Error --- */

  if (isError || !reservation) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <EmptyState
          iconName="warning-outline"
          title="Reservation introuvable"
          description={error ? (error instanceof Error ? error.message : JSON.stringify(error)) : undefined}
          actionLabel="Retour"
          onAction={() => navigation.goBack()}
        />
      </SafeAreaView>
    );
  }

  /* --- Data --- */

  const statusConf = STATUS_CONFIG[reservation.status] ?? { label: reservation.status, color: 'info' as const };
  const isCancelled = reservation.status === 'CANCELLED';

  /* --- Render --- */

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />}
      >
        {/* Header bar */}
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
            <Ionicons name="arrow-back" size={20} color={theme.colors.text.primary} />
          </Pressable>
          <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary, flex: 1 }}>
            Reservation
          </Text>
        </View>

        <View style={{ paddingHorizontal: theme.SPACING.lg }}>

          {/* Status + Source badges */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.sm, marginBottom: theme.SPACING.lg, flexWrap: 'wrap' }}>
            <Badge label={statusConf.label} color={statusConf.color} dot />
            <Badge
              label={reservation.sourceName || reservation.source || 'Direct'}
              color="neutral"
              variant="outlined"
            />
            {reservation.confirmationCode && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                paddingHorizontal: 8, paddingVertical: 3,
                borderRadius: theme.BORDER_RADIUS.sm,
                backgroundColor: `${theme.colors.primary.main}0A`,
              }}>
                <Ionicons name="document-text-outline" size={12} color={theme.colors.primary.main} />
                <Text style={{ ...theme.typography.caption, color: theme.colors.primary.main, fontWeight: '600' }}>
                  {reservation.confirmationCode}
                </Text>
              </View>
            )}
          </View>

          {/* Tabs */}
          <View style={{
            flexDirection: 'row',
            backgroundColor: theme.colors.background.paper,
            borderRadius: theme.BORDER_RADIUS.lg,
            padding: 4,
            marginBottom: theme.SPACING.lg,
            ...theme.shadows.xs,
          }}>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    paddingVertical: 10,
                    borderRadius: theme.BORDER_RADIUS.md,
                    backgroundColor: isActive ? theme.colors.primary.main : 'transparent',
                  }}
                >
                  <Ionicons
                    name={tab.icon}
                    size={14}
                    color={isActive ? theme.colors.primary.contrastText : theme.colors.text.disabled}
                  />
                  <Text style={{
                    ...theme.typography.caption,
                    fontWeight: isActive ? '700' : '500',
                    color: isActive ? theme.colors.primary.contrastText : theme.colors.text.disabled,
                  }}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Tab content */}
          {activeTab === 'infos' && (
            <TabInfos reservation={reservation} theme={theme} openPhone={openPhone} openEmail={openEmail} />
          )}
          {activeTab === 'paiement' && (
            <TabPaiement
              reservation={reservation}
              theme={theme}
              onSendPaymentLink={handleSendPaymentLink}
              isSendingLink={sendPaymentLinkMutation.isPending}
            />
          )}
          {activeTab === 'operations' && (
            <TabOperations reservation={reservation} theme={theme} />
          )}
          {activeTab === 'communication' && (
            <TabCommunication reservation={reservation} theme={theme} />
          )}

        </View>
      </ScrollView>

      {/* Bottom action bar */}
      {!isCancelled && (
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: theme.colors.background.paper,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border.light,
          paddingHorizontal: theme.SPACING.lg,
          paddingTop: theme.SPACING.md,
          paddingBottom: theme.SPACING['2xl'],
          flexDirection: 'row',
          gap: theme.SPACING.sm,
          ...theme.shadows.lg,
        }}>
          <Button
            title="Modifier"
            variant="outlined"
            size="medium"
            onPress={() => navigation.navigate('ReservationEdit', { reservationId })}
            style={{ flex: 1 }}
            icon={<Ionicons name="create-outline" size={16} color={theme.colors.primary.main} />}
          />
          <Button
            title="Annuler"
            variant="soft"
            size="medium"
            color="error"
            onPress={() => setShowCancelDialog(true)}
            loading={cancelMutation.isPending}
            style={{ flex: 1 }}
            icon={<Ionicons name="close-circle-outline" size={16} color={theme.colors.error.main} />}
          />
        </View>
      )}

      {/* Cancel dialog */}
      <ReservationCancelDialog
        visible={showCancelDialog}
        onCancel={() => setShowCancelDialog(false)}
        onConfirm={handleCancelConfirm}
        isLoading={cancelMutation.isPending}
      />
    </SafeAreaView>
  );
}
