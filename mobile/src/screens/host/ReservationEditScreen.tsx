import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useReservation } from '@/hooks/useReservations';
import { reservationsApi, ReservationUpdatePayload } from '@/api/endpoints/reservationsApi';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTheme } from '@/theme';

type RouteParams = { ReservationEdit: { reservationId: number } };

function formatDateForInput(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toISOString().split('T')[0];
  } catch {
    return dateStr;
  }
}

function formatTimeForInput(timeStr?: string): string {
  if (!timeStr) return '';
  return timeStr.substring(0, 5);
}

export function ReservationEditScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'ReservationEdit'>>();
  const { reservationId } = route.params;
  const queryClient = useQueryClient();

  const { data: reservation, isLoading, isError } = useReservation(reservationId);

  /* --- Form state --- */
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [notes, setNotes] = useState('');

  /* Populate form when reservation loads */
  useEffect(() => {
    if (!reservation) return;
    setGuestName(reservation.guestName ?? '');
    setGuestEmail(reservation.guestEmail ?? '');
    setGuestPhone(reservation.guestPhone ?? '');
    setCheckIn(formatDateForInput(reservation.checkIn));
    setCheckInTime(formatTimeForInput(reservation.checkInTime));
    setCheckOut(formatDateForInput(reservation.checkOut));
    setCheckOutTime(formatTimeForInput(reservation.checkOutTime));
    setGuestCount(reservation.guestCount != null ? String(reservation.guestCount) : '');
    setTotalPrice(reservation.totalPrice != null ? String(reservation.totalPrice) : '');
    setNotes(reservation.notes ?? '');
  }, [reservation]);

  const updateMutation = useMutation({
    mutationFn: (payload: ReservationUpdatePayload) => reservationsApi.update(reservationId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      Alert.alert('Succes', 'La reservation a ete mise a jour.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: (err: any) => {
      Alert.alert('Erreur', err?.message || 'Impossible de mettre a jour la reservation.');
    },
  });

  const handleSave = useCallback(() => {
    if (!checkIn || !checkOut) {
      Alert.alert('Erreur', 'Les dates d\'arrivee et de depart sont obligatoires.');
      return;
    }

    const payload: ReservationUpdatePayload = {
      guestName: guestName.trim() || undefined,
      guestEmail: guestEmail.trim() || undefined,
      guestPhone: guestPhone.trim() || undefined,
      checkIn,
      checkOut,
      checkInTime: checkInTime || undefined,
      checkOutTime: checkOutTime || undefined,
      guestCount: guestCount ? parseInt(guestCount, 10) : undefined,
      totalPrice: totalPrice ? parseFloat(totalPrice) : undefined,
      notes: notes.trim() || undefined,
    };

    updateMutation.mutate(payload);
  }, [guestName, guestEmail, guestPhone, checkIn, checkInTime, checkOut, checkOutTime, guestCount, totalPrice, notes, updateMutation]);

  /* --- Loading --- */
  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.md }}>
          <Skeleton height={20} width="40%" />
          <Skeleton height={48} borderRadius={theme.BORDER_RADIUS.md} />
          <Skeleton height={48} borderRadius={theme.BORDER_RADIUS.md} />
          <Skeleton height={48} borderRadius={theme.BORDER_RADIUS.md} />
          <Skeleton height={48} borderRadius={theme.BORDER_RADIUS.md} />
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
          actionLabel="Retour"
          onAction={() => navigation.goBack()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
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
            Modifier la reservation
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Guest info */}
          <SectionHeader title="Voyageur" iconName="person-outline" />
          <Card style={{ marginBottom: theme.SPACING.lg, gap: theme.SPACING.md }}>
            <Input
              label="Nom du voyageur"
              value={guestName}
              onChangeText={setGuestName}
              placeholder="Nom complet"
              autoCapitalize="words"
            />
            <Input
              label="Email"
              value={guestEmail}
              onChangeText={setGuestEmail}
              placeholder="email@exemple.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Input
              label="Telephone"
              value={guestPhone}
              onChangeText={setGuestPhone}
              placeholder="+33 6 12 34 56 78"
              keyboardType="phone-pad"
            />
          </Card>

          {/* Dates */}
          <SectionHeader title="Dates" iconName="calendar-outline" />
          <Card style={{ marginBottom: theme.SPACING.lg, gap: theme.SPACING.md }}>
            <View style={{ flexDirection: 'row', gap: theme.SPACING.md }}>
              <Input
                label="Date d'arrivee"
                value={checkIn}
                onChangeText={setCheckIn}
                placeholder="AAAA-MM-JJ"
                containerStyle={{ flex: 1 }}
              />
              <Input
                label="Heure"
                value={checkInTime}
                onChangeText={setCheckInTime}
                placeholder="HH:MM"
                containerStyle={{ flex: 0.5 }}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: theme.SPACING.md }}>
              <Input
                label="Date de depart"
                value={checkOut}
                onChangeText={setCheckOut}
                placeholder="AAAA-MM-JJ"
                containerStyle={{ flex: 1 }}
              />
              <Input
                label="Heure"
                value={checkOutTime}
                onChangeText={setCheckOutTime}
                placeholder="HH:MM"
                containerStyle={{ flex: 0.5 }}
              />
            </View>
          </Card>

          {/* Details */}
          <SectionHeader title="Details" iconName="information-circle-outline" />
          <Card style={{ marginBottom: theme.SPACING.lg, gap: theme.SPACING.md }}>
            <Input
              label="Nombre de voyageurs"
              value={guestCount}
              onChangeText={setGuestCount}
              placeholder="2"
              keyboardType="number-pad"
            />
            <Input
              label="Montant total (EUR)"
              value={totalPrice}
              onChangeText={setTotalPrice}
              placeholder="150.00"
              keyboardType="decimal-pad"
            />
            <Input
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="Notes supplementaires..."
              multiline
              numberOfLines={4}
              containerStyle={{ minHeight: 100 }}
            />
          </Card>
        </ScrollView>

        {/* Bottom action bar */}
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          backgroundColor: theme.colors.background.paper,
          borderTopWidth: 1, borderTopColor: theme.colors.border.light,
          paddingHorizontal: theme.SPACING.lg,
          paddingTop: theme.SPACING.md,
          paddingBottom: theme.SPACING['2xl'],
          flexDirection: 'row',
          gap: theme.SPACING.sm,
          ...theme.shadows.lg,
        }}>
          <Button
            title="Annuler"
            variant="outlined"
            size="medium"
            onPress={() => navigation.goBack()}
            style={{ flex: 1 }}
          />
          <Button
            title="Enregistrer"
            variant="contained"
            size="medium"
            onPress={handleSave}
            loading={updateMutation.isPending}
            style={{ flex: 1 }}
            icon={<Ionicons name="checkmark-outline" size={18} color="#fff" />}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
