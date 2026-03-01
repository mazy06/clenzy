import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, useWindowDimensions, LayoutAnimation, Platform, UIManager } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useReservations } from '@/hooks/useReservations';
import { useInterventions } from '@/hooks/useInterventions';
import { ReservationCard } from '@/components/domain/ReservationCard';
import { InterventionCard } from '@/components/domain/InterventionCard';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { useTheme } from '@/theme';
import type { Reservation } from '@/api/endpoints/reservationsApi';
import type { Intervention } from '@/api/endpoints/interventionsApi';

const MONTHS_FR = ['Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'];
const DAYS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

// ─── Intervention type → category mapping ──────────────────────────────────

const CLEANING_TYPES = new Set([
  'CLEANING', 'EXPRESS_CLEANING', 'DEEP_CLEANING', 'WINDOW_CLEANING',
  'FLOOR_CLEANING', 'KITCHEN_CLEANING', 'BATHROOM_CLEANING',
]);
const MAINTENANCE_TYPES = new Set([
  'PREVENTIVE_MAINTENANCE', 'EMERGENCY_REPAIR', 'ELECTRICAL_REPAIR',
  'PLUMBING_REPAIR', 'HVAC_REPAIR', 'APPLIANCE_REPAIR',
]);

type InterventionCategory = 'cleaning' | 'maintenance' | 'other';
type FilterType = 'reservation' | 'cleaning' | 'maintenance' | 'other';

function getInterventionCategory(type: string): InterventionCategory {
  if (CLEANING_TYPES.has(type)) return 'cleaning';
  if (MAINTENANCE_TYPES.has(type)) return 'maintenance';
  return 'other';
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function dateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getInterventionDateKey(intervention: Intervention): string | null {
  if (intervention.scheduledDate) return intervention.scheduledDate;
  if (intervention.startTime) {
    try { return new Date(intervention.startTime).toISOString().split('T')[0]; }
    catch { return null; }
  }
  return null;
}

function CalendarSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.md }}>
      <Skeleton width="40%" height={28} />
      <Skeleton height={44} borderRadius={theme.BORDER_RADIUS.lg} />
      <Skeleton height={44} borderRadius={theme.BORDER_RADIUS.lg} />
      <Skeleton height={300} borderRadius={theme.BORDER_RADIUS.lg} />
    </View>
  );
}

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const COMPACT_CELL_HEIGHT = 36;

// ─── Screen ────────────────────────────────────────────────────────────────

export function ReservationCalendarScreen() {
  const theme = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<FilterType>>(new Set());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${getDaysInMonth(year, month)}`;

  // ─── Data fetching ─────────────────────────────────────────────────────

  const { data: resData, isLoading: resLoading, isRefetching: resRefetching, refetch: resRefetch } =
    useReservations({ startDate, endDate, size: '100' });
  const { data: intData, isLoading: intLoading, isRefetching: intRefetching, refetch: intRefetch } =
    useInterventions({ startDate, endDate, size: 100 });

  const reservations = resData?.content ?? [];
  const interventions = intData?.content ?? [];
  const isLoading = resLoading || intLoading;
  const isRefetching = resRefetching || intRefetching;
  const refetch = () => { resRefetch(); intRefetch(); };

  // ─── Color maps from theme ─────────────────────────────────────────────

  const statusColors: Record<string, string> = useMemo(() => ({
    CONFIRMED: theme.colors.success.main,
    PENDING: theme.colors.warning.main,
    CHECKED_IN: theme.colors.info.main,
    CHECKED_OUT: theme.colors.secondary.main,
    CANCELLED: theme.colors.error.main,
  }), [theme]);

  const categoryConfig: Record<InterventionCategory, { color: string; icon: string }> = useMemo(() => ({
    cleaning: { color: theme.colors.success.main, icon: 'sparkles' },
    maintenance: { color: theme.colors.warning.main, icon: 'construct' },
    other: { color: theme.colors.error.main, icon: 'ellipsis-horizontal' },
  }), [theme]);

  const filterConfig: { key: FilterType; label: string; icon: string; color: string }[] = useMemo(() => [
    { key: 'reservation', label: 'Reservations', icon: 'bed-outline', color: theme.colors.primary.main },
    { key: 'cleaning', label: 'Menage', icon: 'sparkles-outline', color: theme.colors.success.main },
    { key: 'maintenance', label: 'Maintenance', icon: 'construct-outline', color: theme.colors.warning.main },
    { key: 'other', label: 'Autre', icon: 'ellipsis-horizontal-outline', color: theme.colors.error.main },
  ], [theme]);

  // ─── Build day maps ────────────────────────────────────────────────────

  const reservationDays = useMemo(() => {
    const map = new Map<string, { statuses: Set<string>; reservations: Reservation[] }>();
    for (const res of reservations) {
      const checkIn = new Date(res.checkIn);
      const checkOut = new Date(res.checkOut);
      for (let d = new Date(checkIn); d <= checkOut; d.setDate(d.getDate() + 1)) {
        const key = dateKey(d);
        if (!map.has(key)) map.set(key, { statuses: new Set(), reservations: [] });
        const entry = map.get(key)!;
        entry.statuses.add(res.status);
        entry.reservations.push(res);
      }
    }
    return map;
  }, [reservations]);

  const interventionDays = useMemo(() => {
    const map = new Map<string, { categories: Set<InterventionCategory>; interventions: Intervention[] }>();
    for (const int of interventions) {
      const key = getInterventionDateKey(int);
      if (!key) continue;
      if (!map.has(key)) map.set(key, { categories: new Set(), interventions: [] });
      const entry = map.get(key)!;
      entry.categories.add(getInterventionCategory(int.type));
      entry.interventions.push(int);
    }
    return map;
  }, [interventions]);

  // ─── Filter logic ──────────────────────────────────────────────────────

  const showReservations = activeFilters.size === 0 || activeFilters.has('reservation');
  const showCleaning = activeFilters.size === 0 || activeFilters.has('cleaning');
  const showMaintenance = activeFilters.size === 0 || activeFilters.has('maintenance');
  const showOther = activeFilters.size === 0 || activeFilters.has('other');

  const selectedReservations = useMemo(() => {
    if (!selectedDay || !showReservations) return [];
    return reservationDays.get(selectedDay)?.reservations ?? [];
  }, [selectedDay, reservationDays, showReservations]);

  const selectedInterventions = useMemo(() => {
    if (!selectedDay) return [];
    const dayInts = interventionDays.get(selectedDay)?.interventions ?? [];
    return dayInts.filter((int) => {
      const cat = getInterventionCategory(int.type);
      if (cat === 'cleaning') return showCleaning;
      if (cat === 'maintenance') return showMaintenance;
      return showOther;
    });
  }, [selectedDay, interventionDays, showCleaning, showMaintenance, showOther]);

  const hasSelectedItems = selectedReservations.length > 0 || selectedInterventions.length > 0;

  // ─── Calendar layout ──────────────────────────────────────────────────

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = getFirstDayOfWeek(year, month);
  const weekCount = Math.ceil((daysInMonth + firstDayOfWeek) / 7);
  const todayKey = dateKey(new Date());

  // Expanded: fill available height / Compact: fixed small cells when a day is selected
  const isCompact = selectedDay !== null;
  const reservedHeight = insets.top + 68 + 72 + 48 + 26 + 90 + 32;
  const expandedCellHeight = Math.max(48, Math.floor((screenHeight - reservedHeight) / weekCount));
  const cellHeight = isCompact ? COMPACT_CELL_HEIGHT : expandedCellHeight;

  const animateLayout = () => LayoutAnimation.configureNext(LayoutAnimation.create(250, 'easeInEaseOut', 'opacity'));

  const prevMonth = () => { animateLayout(); setCurrentDate(new Date(year, month - 1, 1)); setSelectedDay(null); };
  const nextMonth = () => { animateLayout(); setCurrentDate(new Date(year, month + 1, 1)); setSelectedDay(null); };

  const toggleFilter = (filter: FilterType) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filter)) next.delete(filter);
      else next.add(filter);
      return next;
    });
  };

  // ─── Loading ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
        <CalendarSkeleton theme={theme} />
      </SafeAreaView>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary.main} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.SPACING.lg,
          paddingTop: theme.SPACING['2xl'],
          paddingBottom: theme.SPACING.md,
        }}>
          <Text style={{ ...theme.typography.h1, color: theme.colors.text.primary }}>
            Calendrier
          </Text>
          <NotificationBell />
        </View>

        <View style={{ paddingHorizontal: theme.SPACING.lg }}>
          {/* Month navigation */}
          <Card variant="filled" style={{ marginBottom: theme.SPACING.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Pressable
                onPress={prevMonth}
                style={({ pressed }) => ({
                  width: 40, height: 40,
                  borderRadius: theme.BORDER_RADIUS.md,
                  backgroundColor: pressed ? theme.colors.background.default : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                })}
              >
                <Ionicons name="chevron-back" size={20} color={theme.colors.primary.main} />
              </Pressable>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary }}>
                  {MONTHS_FR[month]}
                </Text>
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, marginTop: 2 }}>
                  {year}
                </Text>
              </View>
              <Pressable
                onPress={nextMonth}
                style={({ pressed }) => ({
                  width: 40, height: 40,
                  borderRadius: theme.BORDER_RADIUS.md,
                  backgroundColor: pressed ? theme.colors.background.default : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                })}
              >
                <Ionicons name="chevron-forward" size={20} color={theme.colors.primary.main} />
              </Pressable>
            </View>
          </Card>

          {/* Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: theme.SPACING.md }}>
            <View style={{ flexDirection: 'row', gap: theme.SPACING.sm }}>
              {filterConfig.map((f) => {
                const isActive = activeFilters.has(f.key);
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => toggleFilter(f.key)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: theme.BORDER_RADIUS.full,
                      backgroundColor: isActive ? f.color : theme.colors.background.paper,
                      borderWidth: 1,
                      borderColor: isActive ? f.color : theme.colors.border.main,
                    }}
                  >
                    <Ionicons name={f.icon as any} size={14} color={isActive ? '#FFFFFF' : f.color} />
                    <Text style={{
                      ...theme.typography.caption,
                      fontWeight: '600',
                      color: isActive ? '#FFFFFF' : theme.colors.text.secondary,
                    }}>
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Day of week headers */}
          <View style={{ flexDirection: 'row', marginBottom: theme.SPACING.xs, paddingHorizontal: theme.SPACING.xs }}>
            {DAYS_SHORT.map((d, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{
                  ...theme.typography.caption,
                  color: theme.colors.text.disabled,
                  fontWeight: '700',
                  letterSpacing: 0.5,
                }}>
                  {d}
                </Text>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          <Card style={{ marginBottom: theme.SPACING.lg, paddingVertical: theme.SPACING.xs, paddingHorizontal: theme.SPACING.xs }}>
            {Array.from({ length: weekCount }).map((_, weekIdx) => (
              <View key={weekIdx} style={{ flexDirection: 'row' }}>
                {Array.from({ length: 7 }).map((_, dayIdx) => {
                  const dayNum = weekIdx * 7 + dayIdx - firstDayOfWeek + 1;
                  if (dayNum < 1 || dayNum > daysInMonth) {
                    return <View key={dayIdx} style={{ flex: 1, height: cellHeight }} />;
                  }

                  const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const resInfo = reservationDays.get(key);
                  const intInfo = interventionDays.get(key);
                  const isToday = key === todayKey;
                  const isSelected = key === selectedDay;
                  const isWeekend = dayIdx >= 5;

                  // Visible reservation status bars
                  const statusBars: string[] = [];
                  if (showReservations && resInfo) {
                    for (const status of resInfo.statuses) {
                      if (statusColors[status]) statusBars.push(statusColors[status]);
                    }
                  }

                  // Visible intervention category icons
                  const intIcons: { color: string; icon: string }[] = [];
                  if (intInfo) {
                    for (const cat of intInfo.categories) {
                      if (cat === 'cleaning' && !showCleaning) continue;
                      if (cat === 'maintenance' && !showMaintenance) continue;
                      if (cat === 'other' && !showOther) continue;
                      intIcons.push(categoryConfig[cat]);
                    }
                  }

                  const hasAnyEvent = statusBars.length > 0 || intIcons.length > 0;

                  return (
                    <Pressable
                      key={dayIdx}
                      onPress={() => { animateLayout(); setSelectedDay(isSelected ? null : key); }}
                      style={({ pressed }) => ({
                        flex: 1,
                        height: cellHeight,
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderRadius: theme.BORDER_RADIUS.md,
                        backgroundColor: isSelected
                          ? theme.colors.primary.main
                          : isToday
                            ? `${theme.colors.primary.main}0C`
                            : pressed
                              ? theme.colors.background.surface
                              : 'transparent',
                      })}
                    >
                      <Text style={{
                        ...theme.typography.body2,
                        color: isSelected
                          ? '#FFFFFF'
                          : isToday
                            ? theme.colors.primary.main
                            : isWeekend
                              ? theme.colors.text.secondary
                              : theme.colors.text.primary,
                        fontWeight: isToday || isSelected ? '700' : '400',
                        fontSize: isCompact ? 13 : 14,
                      }}>
                        {dayNum}
                      </Text>

                      {/* Compact mode: single dot if any event */}
                      {isCompact && hasAnyEvent && !isSelected && (
                        <View style={{
                          width: 4, height: 4, borderRadius: 2, marginTop: 2,
                          backgroundColor: statusBars[0] ?? intIcons[0]?.color ?? theme.colors.primary.main,
                        }} />
                      )}
                      {isCompact && hasAnyEvent && isSelected && (
                        <View style={{
                          width: 4, height: 4, borderRadius: 2, marginTop: 2,
                          backgroundColor: 'rgba(255,255,255,0.7)',
                        }} />
                      )}

                      {/* Expanded mode: full status bars + intervention icons */}
                      {!isCompact && statusBars.length > 0 && (
                        <View style={{ flexDirection: 'row', gap: 2, marginTop: 3 }}>
                          {statusBars.map((color, i) => (
                            <View
                              key={i}
                              style={{
                                width: statusBars.length === 1 ? 16 : 8,
                                height: 3,
                                borderRadius: 1.5,
                                backgroundColor: isSelected ? 'rgba(255,255,255,0.7)' : color,
                              }}
                            />
                          ))}
                        </View>
                      )}

                      {!isCompact && intIcons.length > 0 && (
                        <View style={{ flexDirection: 'row', gap: 3, marginTop: statusBars.length > 0 ? 1 : 3 }}>
                          {intIcons.map((cfg, i) => (
                            <Ionicons
                              key={i}
                              name={cfg.icon as any}
                              size={9}
                              color={isSelected ? 'rgba(255,255,255,0.8)' : cfg.color}
                            />
                          ))}
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </Card>

          {/* Selected day content — no SectionHeader (redundant with calendar) */}
          {selectedDay && (
            <>
              {!hasSelectedItems ? (
                <EmptyState
                  iconName="calendar-outline"
                  title="Rien de prevu"
                  description={activeFilters.size > 0
                    ? 'Aucun resultat pour les filtres selectionnes'
                    : 'Aucune reservation ni intervention ce jour'}
                  compact
                />
              ) : (
                <View style={{ marginBottom: theme.SPACING.lg }}>
                  {selectedReservations.map((res) => (
                    <ReservationCard key={`res-${res.id}`} reservation={res} />
                  ))}
                  {selectedInterventions.map((int) => (
                    <InterventionCard key={`int-${int.id}`} intervention={int} />
                  ))}
                </View>
              )}
            </>
          )}

          {/* No selection prompt */}
          {!selectedDay && (
            <View style={{ alignItems: 'center', paddingVertical: theme.SPACING.lg }}>
              <View style={{
                width: 48, height: 48,
                borderRadius: 24,
                backgroundColor: `${theme.colors.primary.main}08`,
                alignItems: 'center', justifyContent: 'center',
                marginBottom: theme.SPACING.md,
              }}>
                <Ionicons name="hand-left-outline" size={22} color={theme.colors.primary.light} />
              </View>
              <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary, textAlign: 'center' }}>
                Selectionnez un jour pour voir les details
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
