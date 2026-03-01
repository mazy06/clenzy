import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/theme';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useProperties } from '@/hooks/useProperties';
import { useReviews, useReviewStats, useRespondToReview } from '@/hooks/useReviews';
import type { GuestReview } from '@/api/endpoints/reviewsApi';
import type { Property } from '@/api/endpoints/propertiesApi';

type IoniconsName = keyof typeof Ionicons.glyphMap;

/* ─── Helpers ─── */

const CHANNEL_LABELS: Record<string, string> = {
  AIRBNB: 'Airbnb',
  BOOKING: 'Booking.com',
  VRBO: 'VRBO',
  GOOGLE_VACATION_RENTALS: 'Google',
  TRIPADVISOR: 'TripAdvisor',
  DIRECT: 'Direct',
  OTHER: 'Autre',
};

const SENTIMENT_CONFIG: Record<string, { label: string; color: string; icon: IoniconsName }> = {
  POSITIVE: { label: 'Positif', color: '#4A9B8E', icon: 'happy-outline' },
  NEUTRAL: { label: 'Neutre', color: '#6B8A9A', icon: 'remove-circle-outline' },
  NEGATIVE: { label: 'Negatif', color: '#C97A7A', icon: 'sad-outline' },
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
}

function renderStars(rating: number, size: number, color: string) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={i <= rating ? 'star' : 'star-outline'} size={size} color={color} />
      ))}
    </View>
  );
}

/* ─── Stats Banner ─── */

function StatsBanner({ propertyId, theme }: { propertyId: number; theme: ReturnType<typeof useTheme> }) {
  const { data: stats, isLoading } = useReviewStats(propertyId);

  if (isLoading) {
    return (
      <View style={{ padding: theme.SPACING.lg }}>
        <Skeleton width="100%" height={80} borderRadius={theme.BORDER_RADIUS.lg} />
      </View>
    );
  }

  if (!stats || stats.totalReviews === 0) return null;

  const avg = stats.averageRating ?? 0;
  const dist = stats.ratingDistribution ?? {};
  const maxCount = Math.max(...Object.values(dist), 1);

  return (
    <View style={{
      marginHorizontal: theme.SPACING.lg,
      marginBottom: theme.SPACING.md,
      padding: theme.SPACING.lg,
      backgroundColor: theme.colors.background.paper,
      borderRadius: theme.BORDER_RADIUS.lg,
      ...theme.shadows.sm,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.lg }}>
        {/* Average rating */}
        <View style={{ alignItems: 'center' }}>
          <Text style={{ ...theme.typography.h1, color: theme.colors.text.primary, fontSize: 36 }}>
            {avg.toFixed(1)}
          </Text>
          {renderStars(Math.round(avg), 16, theme.colors.secondary.main)}
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, marginTop: 4 }}>
            {stats.totalReviews} avis
          </Text>
        </View>

        {/* Distribution bars */}
        <View style={{ flex: 1, gap: 4 }}>
          {[5, 4, 3, 2, 1].map((r) => {
            const count = dist[r] ?? 0;
            const pct = count / maxCount;
            return (
              <View key={r} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, width: 14, textAlign: 'right' }}>{r}</Text>
                <Ionicons name="star" size={10} color={theme.colors.secondary.main} />
                <View style={{ flex: 1, height: 6, backgroundColor: theme.colors.background.surface, borderRadius: 3 }}>
                  <View style={{
                    width: `${Math.max(pct * 100, 2)}%`,
                    height: 6,
                    backgroundColor: r >= 4 ? theme.colors.success.main : r === 3 ? theme.colors.warning.main : theme.colors.error.main,
                    borderRadius: 3,
                  }} />
                </View>
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, width: 24, textAlign: 'right' }}>{count}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/* ─── Review Card ─── */

function ReviewCard({ review, theme, onRespond }: {
  review: GuestReview;
  theme: ReturnType<typeof useTheme>;
  onRespond: (id: number, response: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [responding, setResponding] = useState(false);
  const [responseText, setResponseText] = useState('');
  const sentimentCfg = review.sentimentLabel ? SENTIMENT_CONFIG[review.sentimentLabel] : null;

  const handleSubmitResponse = () => {
    if (!responseText.trim()) return;
    onRespond(review.id, responseText.trim());
    setResponseText('');
    setResponding(false);
  };

  return (
    <View style={{
      marginHorizontal: theme.SPACING.lg,
      marginBottom: theme.SPACING.md,
      backgroundColor: theme.colors.background.paper,
      borderRadius: theme.BORDER_RADIUS.lg,
      ...theme.shadows.sm,
      overflow: 'hidden',
      borderLeftWidth: 3,
      borderLeftColor: review.rating >= 4 ? theme.colors.success.main
        : review.rating === 3 ? theme.colors.warning.main
        : theme.colors.error.main,
    }}>
      <Pressable onPress={() => setExpanded(!expanded)} style={{ padding: theme.SPACING.md }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Text style={{ ...theme.typography.body2, fontWeight: '600', color: theme.colors.text.primary }}>
                {review.guestName || 'Voyageur'}
              </Text>
              <View style={{
                paddingHorizontal: 6, paddingVertical: 2,
                borderRadius: theme.BORDER_RADIUS.sm,
                backgroundColor: `${theme.colors.info.main}12`,
              }}>
                <Text style={{ fontSize: 10, color: theme.colors.info.main, fontWeight: '600' }}>
                  {CHANNEL_LABELS[review.channelName] ?? review.channelName}
                </Text>
              </View>
            </View>
            {renderStars(review.rating, 14, theme.colors.secondary.main)}
          </View>

          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
              {formatDate(review.reviewDate)}
            </Text>
            {sentimentCfg && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name={sentimentCfg.icon} size={12} color={sentimentCfg.color} />
                <Text style={{ fontSize: 10, color: sentimentCfg.color }}>{sentimentCfg.label}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Review text (truncated or full) */}
        <Text
          style={{ ...theme.typography.body2, color: theme.colors.text.secondary, marginTop: 8 }}
          numberOfLines={expanded ? undefined : 3}
        >
          {review.reviewText || '(Pas de texte)'}
        </Text>

        {/* Tags */}
        {review.tags && review.tags.length > 0 && expanded && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
            {review.tags.map((tag) => (
              <View key={tag} style={{
                paddingHorizontal: 8, paddingVertical: 3,
                borderRadius: theme.BORDER_RADIUS.full,
                backgroundColor: theme.colors.background.surface,
              }}>
                <Text style={{ fontSize: 10, color: theme.colors.text.secondary }}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Host response */}
        {review.hostResponse && expanded && (
          <View style={{
            marginTop: 10,
            padding: theme.SPACING.sm,
            backgroundColor: `${theme.colors.primary.main}08`,
            borderRadius: theme.BORDER_RADIUS.md,
            borderLeftWidth: 2,
            borderLeftColor: theme.colors.primary.main,
          }}>
            <Text style={{ ...theme.typography.caption, fontWeight: '600', color: theme.colors.primary.main, marginBottom: 4 }}>
              Votre reponse
            </Text>
            <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>
              {review.hostResponse}
            </Text>
          </View>
        )}

        {/* Respond button */}
        {expanded && !review.hostResponse && !responding && (
          <Pressable
            onPress={() => setResponding(true)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              marginTop: 10, paddingVertical: 8,
            }}
          >
            <Ionicons name="chatbubble-outline" size={16} color={theme.colors.primary.main} />
            <Text style={{ ...theme.typography.body2, color: theme.colors.primary.main, fontWeight: '500' }}>
              Repondre
            </Text>
          </Pressable>
        )}

        {/* Response form */}
        {responding && (
          <View style={{ marginTop: 10, gap: 8 }}>
            <TextInput
              value={responseText}
              onChangeText={setResponseText}
              placeholder="Ecrire votre reponse..."
              placeholderTextColor={theme.colors.text.disabled}
              multiline
              style={{
                ...theme.typography.body2,
                color: theme.colors.text.primary,
                backgroundColor: theme.colors.background.surface,
                borderRadius: theme.BORDER_RADIUS.md,
                padding: theme.SPACING.sm,
                minHeight: 80,
                textAlignVertical: 'top',
              }}
            />
            <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
              <Pressable
                onPress={() => { setResponding(false); setResponseText(''); }}
                style={{ paddingVertical: 8, paddingHorizontal: 16 }}
              >
                <Text style={{ ...theme.typography.body2, color: theme.colors.text.disabled }}>Annuler</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmitResponse}
                disabled={!responseText.trim()}
                style={{
                  paddingVertical: 8, paddingHorizontal: 16,
                  backgroundColor: responseText.trim() ? theme.colors.primary.main : theme.colors.border.main,
                  borderRadius: theme.BORDER_RADIUS.md,
                }}
              >
                <Text style={{ ...theme.typography.body2, color: '#fff', fontWeight: '600' }}>Envoyer</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Expand indicator */}
        {!expanded && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 6 }}>
            <Ionicons name="chevron-down" size={16} color={theme.colors.text.disabled} />
          </View>
        )}
      </Pressable>
    </View>
  );
}

/* ─── Main Screen ─── */

export function ReviewsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { data: properties } = useProperties();
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [filterRating, setFilterRating] = useState<number | null>(null);

  const effectivePropertyId = selectedPropertyId ?? properties?.content?.[0]?.id;
  const { data: reviewsPage, isLoading, refetch } = useReviews(effectivePropertyId ?? undefined);
  const respondMutation = useRespondToReview();

  const reviews = reviewsPage?.content ?? [];

  // Filter by rating if selected
  const filteredReviews = filterRating
    ? reviews.filter((r) => r.rating === filterRating)
    : reviews;

  // Count reviews without host response
  const unansweredCount = reviews.filter((r) => !r.hostResponse).length;

  const handleRespond = useCallback((id: number, response: string) => {
    respondMutation.mutate(
      { id, response },
      {
        onSuccess: () => {
          Alert.alert('Succes', 'Reponse envoyee avec succes.');
        },
        onError: () => {
          Alert.alert('Erreur', 'Impossible d\'envoyer la reponse.');
        },
      },
    );
  }, [respondMutation]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: theme.SPACING.lg, paddingVertical: theme.SPACING.md,
        borderBottomWidth: 1, borderBottomColor: theme.colors.border.light,
        backgroundColor: theme.colors.background.paper,
        gap: theme.SPACING.md,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.text.primary} />
        </Pressable>
        <Ionicons name="star" size={22} color={theme.colors.secondary.main} />
        <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary, flex: 1 }}>
          Avis voyageurs
        </Text>
        {unansweredCount > 0 && (
          <View style={{
            minWidth: 24, height: 24, borderRadius: 12,
            backgroundColor: theme.colors.error.main,
            alignItems: 'center', justifyContent: 'center',
            paddingHorizontal: 6,
          }}>
            <Text style={{ fontSize: 12, color: '#fff', fontWeight: '700' }}>{unansweredCount}</Text>
          </View>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => refetch()} tintColor={theme.colors.primary.main} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Property selector */}
        {properties?.content && properties.content.length > 1 && (
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: theme.SPACING.lg, paddingVertical: theme.SPACING.md, gap: 8 }}
          >
            <Pressable
              onPress={() => setSelectedPropertyId(null)}
              style={{
                paddingHorizontal: 14, paddingVertical: 8,
                borderRadius: theme.BORDER_RADIUS.full,
                backgroundColor: !selectedPropertyId ? theme.colors.primary.main : theme.colors.background.surface,
              }}
            >
              <Text style={{
                ...theme.typography.caption, fontWeight: '600',
                color: !selectedPropertyId ? '#fff' : theme.colors.text.secondary,
              }}>Toutes</Text>
            </Pressable>
            {properties.content.map((p: Property) => (
              <Pressable
                key={p.id}
                onPress={() => setSelectedPropertyId(p.id)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 8,
                  borderRadius: theme.BORDER_RADIUS.full,
                  backgroundColor: selectedPropertyId === p.id ? theme.colors.primary.main : theme.colors.background.surface,
                }}
              >
                <Text style={{
                  ...theme.typography.caption, fontWeight: '600',
                  color: selectedPropertyId === p.id ? '#fff' : theme.colors.text.secondary,
                }} numberOfLines={1}>{p.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Stats banner */}
        {effectivePropertyId && <StatsBanner propertyId={effectivePropertyId} theme={theme} />}

        {/* Rating filter */}
        <View style={{
          flexDirection: 'row',
          paddingHorizontal: theme.SPACING.lg,
          marginBottom: theme.SPACING.md,
          gap: 6,
        }}>
          {[null, 5, 4, 3, 2, 1].map((r) => (
            <Pressable
              key={r ?? 'all'}
              onPress={() => setFilterRating(r)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 3,
                paddingHorizontal: 10, paddingVertical: 6,
                borderRadius: theme.BORDER_RADIUS.full,
                backgroundColor: filterRating === r ? theme.colors.primary.main : theme.colors.background.surface,
              }}
            >
              {r !== null && <Ionicons name="star" size={12} color={filterRating === r ? '#fff' : theme.colors.secondary.main} />}
              <Text style={{
                fontSize: 12, fontWeight: '600',
                color: filterRating === r ? '#fff' : theme.colors.text.secondary,
              }}>{r ?? 'Tous'}</Text>
            </Pressable>
          ))}
        </View>

        {/* Loading state */}
        {isLoading && (
          <View style={{ gap: 12, paddingHorizontal: theme.SPACING.lg }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} width="100%" height={100} borderRadius={theme.BORDER_RADIUS.lg} />
            ))}
          </View>
        )}

        {/* Review list */}
        {!isLoading && filteredReviews.length === 0 && (
          <EmptyState
            iconName="star-outline"
            title="Aucun avis"
            description={filterRating ? `Aucun avis avec ${filterRating} etoile(s)` : 'Les avis de vos voyageurs apparaitront ici'}
          />
        )}

        {!isLoading && filteredReviews.map((review) => (
          <ReviewCard key={review.id} review={review} theme={theme} onRespond={handleRespond} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
