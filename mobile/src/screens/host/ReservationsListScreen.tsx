import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/theme';
import { Chip } from '@/components/ui/Chip';
import { ReservationCard } from '@/components/domain/ReservationCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useReservations } from '@/hooks/useReservations';
import type { Reservation } from '@/api/endpoints/reservationsApi';

type FilterKey = 'all' | 'upcoming' | 'active' | 'past';

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'Toutes' },
  { key: 'upcoming', label: 'A venir' },
  { key: 'active', label: 'En cours' },
  { key: 'past', label: 'Passees' },
];

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function ReservationsListSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.md }}>
      <Skeleton width="50%" height={28} />
      <View style={{ flexDirection: 'row', gap: theme.SPACING.sm }}>
        <Skeleton width={70} height={34} borderRadius={20} />
        <Skeleton width={70} height={34} borderRadius={20} />
        <Skeleton width={70} height={34} borderRadius={20} />
        <Skeleton width={70} height={34} borderRadius={20} />
      </View>
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} height={130} borderRadius={theme.BORDER_RADIUS.lg} />
      ))}
    </View>
  );
}

export function ReservationsListScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState<FilterKey>('all');

  // Fetch reservations for a wide range
  const startOfYear = `${new Date().getFullYear()}-01-01`;
  const endOfNextYear = `${new Date().getFullYear() + 1}-12-31`;

  const { data, isLoading, isRefetching, refetch } = useReservations({
    startDate: startOfYear,
    endDate: endOfNextYear,
    size: '500',
  });

  const allReservations: Reservation[] = data?.content ?? [];
  const today = todayStr();

  const filtered = useMemo(() => {
    let list = [...allReservations];

    switch (filter) {
      case 'upcoming':
        list = list.filter((r) => r.checkIn > today && r.status !== 'CANCELLED');
        break;
      case 'active':
        list = list.filter(
          (r) => r.checkIn <= today && r.checkOut >= today && r.status !== 'CANCELLED',
        );
        break;
      case 'past':
        list = list.filter((r) => r.checkOut < today);
        break;
    }

    // Sort: upcoming first (by checkIn asc), then past (by checkIn desc)
    list.sort((a, b) => {
      if (filter === 'past') return b.checkIn.localeCompare(a.checkIn);
      return a.checkIn.localeCompare(b.checkIn);
    });

    return list;
  }, [allReservations, filter, today]);

  // Stats
  const stats = useMemo(() => {
    const upcoming = allReservations.filter(
      (r) => r.checkIn > today && r.status !== 'CANCELLED',
    ).length;
    const active = allReservations.filter(
      (r) => r.checkIn <= today && r.checkOut >= today && r.status !== 'CANCELLED',
    ).length;
    const total = allReservations.length;
    const revenue = allReservations
      .filter((r) => r.status !== 'CANCELLED')
      .reduce((sum, r) => sum + (r.totalPrice ?? 0), 0);
    return { upcoming, active, total, revenue };
  }, [allReservations, today]);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <ReservationsListSkeleton theme={theme} />
      </SafeAreaView>
    );
  }

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
          <Ionicons name="arrow-back" size={20} color={theme.colors.text.primary} />
        </Pressable>
        <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary, flex: 1 }}>
          Reservations
        </Text>
      </View>

      {/* Stats row */}
      <View style={{
        flexDirection: 'row',
        paddingHorizontal: theme.SPACING.lg,
        gap: theme.SPACING.sm,
        marginBottom: theme.SPACING.md,
      }}>
        <View style={{
          flex: 1,
          backgroundColor: theme.colors.background.paper,
          borderRadius: theme.BORDER_RADIUS.lg,
          padding: theme.SPACING.md,
          alignItems: 'center',
          ...theme.shadows.sm,
        }}>
          <Text style={{ ...theme.typography.h3, color: theme.colors.primary.main }}>{stats.total}</Text>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>Total</Text>
        </View>
        <View style={{
          flex: 1,
          backgroundColor: theme.colors.background.paper,
          borderRadius: theme.BORDER_RADIUS.lg,
          padding: theme.SPACING.md,
          alignItems: 'center',
          ...theme.shadows.sm,
        }}>
          <Text style={{ ...theme.typography.h3, color: theme.colors.info.main }}>{stats.active}</Text>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>En cours</Text>
        </View>
        <View style={{
          flex: 1,
          backgroundColor: theme.colors.background.paper,
          borderRadius: theme.BORDER_RADIUS.lg,
          padding: theme.SPACING.md,
          alignItems: 'center',
          ...theme.shadows.sm,
        }}>
          <Text style={{ ...theme.typography.h3, color: theme.colors.success.main }}>{stats.upcoming}</Text>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>A venir</Text>
        </View>
        <View style={{
          flex: 1,
          backgroundColor: theme.colors.background.paper,
          borderRadius: theme.BORDER_RADIUS.lg,
          padding: theme.SPACING.md,
          alignItems: 'center',
          ...theme.shadows.sm,
        }}>
          <Text style={{ ...theme.typography.h3, color: theme.colors.success.main, fontSize: 16 }}>
            {stats.revenue > 0 ? `${Math.round(stats.revenue)}€` : '—'}
          </Text>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>Revenus</Text>
        </View>
      </View>

      {/* Filter chips */}
      <View style={{
        flexDirection: 'row',
        paddingHorizontal: theme.SPACING.lg,
        gap: theme.SPACING.sm,
        marginBottom: theme.SPACING.md,
      }}>
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            selected={filter === f.key}
            onPress={() => setFilter(f.key)}
          />
        ))}
      </View>

      {/* List */}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.SPACING.lg,
          paddingBottom: 120,
        }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />
        }
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader
          title={`${filtered.length} reservation${filtered.length > 1 ? 's' : ''}`}
          iconName="calendar-outline"
        />

        {filtered.length === 0 ? (
          <EmptyState
            iconName="calendar-outline"
            title="Aucune reservation"
            description={
              filter === 'upcoming'
                ? 'Aucune reservation a venir'
                : filter === 'active'
                  ? 'Aucune reservation en cours'
                  : filter === 'past'
                    ? 'Aucune reservation passee'
                    : 'Aucune reservation trouvee'
            }
            compact
          />
        ) : (
          filtered.map((reservation) => (
            <ReservationCard key={reservation.id} reservation={reservation} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
