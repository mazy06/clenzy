import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '../../utils/cn';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Paper, FormControl, InputLabel, Select, MenuItem, Rating, TextField, Button, Collapse } from '@mui/material';
import StatusChip from '../../components/StatusChip';
import {
  Star as StarIcon,
  Reply as ReplyIcon,
  ExpandMore as ExpandMoreIcon,
} from '../../icons';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { useTranslation } from '../../hooks/useTranslation';
import { airbnbApi } from '../../services/api/airbnbApi';
import type { AirbnbReview } from '../../services/api/airbnbApi';
import { propertiesApi } from '../../services/api/propertiesApi';
import type { Property } from '../../services/api/propertiesApi';

// ─── Style Constants ────────────────────────────────────────────────────────

const CARD_SX = {
  border: '1px solid',
  borderColor: 'var(--line)',
  bgcolor: 'var(--card)',
  boxShadow: 'none',
  borderRadius: '14px',
  p: 2,
} as const;

const RATING_COLORS: Record<string, string> = {
  excellent: 'var(--ok)',
  good: 'var(--accent)',
  average: 'var(--warn)',
  poor: 'var(--err)',
};

function getRatingCategory(rating: number): string {
  if (rating >= 4.5) return 'excellent';
  if (rating >= 3.5) return 'good';
  if (rating >= 2.5) return 'average';
  return 'poor';
}

// ─── Component ──────────────────────────────────────────────────────────────

const ReviewsPage: React.FC = () => {
  const { t } = useTranslation();
  const [reviews, setReviews] = useState<AirbnbReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | ''>('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);

  // Fetch reviews
  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = selectedPropertyId ? { propertyId: selectedPropertyId as number } : undefined;
      const data = await airbnbApi.getReviews(params);
      setReviews(data);
    } catch {
      setError(t('channels.reviews.errorLoading'));
    } finally {
      setLoading(false);
    }
  }, [selectedPropertyId, t]);

  // Fetch properties
  useEffect(() => {
    propertiesApi.getAll().then(setProperties).catch(() => {});
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // Reply to review
  const handleReply = useCallback(async (reviewId: number) => {
    if (!replyText.trim()) return;
    setReplyLoading(true);
    try {
      const updated = await airbnbApi.replyToReview(reviewId, { reply: replyText });
      setReviews((prev) => prev.map((r) => (r.id === reviewId ? updated : r)));
      setReplyingTo(null);
      setReplyText('');
    } catch {
      // Error handling
    } finally {
      setReplyLoading(false);
    }
  }, [replyText]);

  // Stats
  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;
  const reviewsByRating = reviews.reduce((acc, r) => {
    const cat = getRatingCategory(r.rating);
    acc[cat] = (acc[cat] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    // SPACING.PAGE_PADDING = 2 pas de theme, et theme.spacing vaut 6 → 12 px.
    <div className="p-3">
      <PageHeader
        title={t('channels.reviews.title')}
        subtitle={t('channels.reviews.subtitle')}
        iconBadge={<StarIcon />}
        backPath="/channels"
        showBackButton
      />

      {error && <Alert variant="destructive" className="mb-2 text-[0.8125rem]">
        <TriangleAlert />
        <AlertDescription>{error}</AlertDescription>
      </Alert>}

      {/* Stats bar */}
      <div className="flex gap-2 mb-2 flex-wrap">
        <Paper sx={{ ...CARD_SX, flex: 1, minWidth: 120, textAlign: 'center', p: 1.5 }}>
          <p className="cn-text-body1 text-[10.5px] text-[var(--faint)] uppercase font-bold tracking-[0.06em]">
            {t('channels.reviews.avgRating')}
          </p>
          <div className="flex items-center justify-center gap-0.5 mt-0.5">
            <StarIcon size={'1.25rem'} strokeWidth={1.75} color='var(--warn)' />
            <p className="cn-text-body1 font-[var(--font-display)] tabular-nums text-[1.375rem] font-semibold text-[var(--ink)]">
              {avgRating > 0 ? avgRating.toFixed(1) : '—'}
            </p>
          </div>
        </Paper>
        <Paper sx={{ ...CARD_SX, flex: 1, minWidth: 120, textAlign: 'center', p: 1.5 }}>
          <p className="cn-text-body1 text-[10.5px] text-[var(--faint)] uppercase font-bold tracking-[0.06em]">
            {t('channels.reviews.totalReviews')}
          </p>
          <p className="cn-text-body1 font-[var(--font-display)] tabular-nums text-[1.375rem] font-semibold mt-0.5 text-[var(--ink)]">{reviews.length}</p>
        </Paper>
        {Object.entries(reviewsByRating).map(([cat, count]) => (
          <Paper key={cat} sx={{ ...CARD_SX, flex: 1, minWidth: 100, textAlign: 'center', p: 1.5 }}>
            <p className="cn-text-body1 text-[10.5px] text-[var(--faint)] uppercase font-bold tracking-[0.06em]">
              {t(`channels.reviews.${cat}`)}
            </p>
            <p className="cn-text-body1 tabular-nums text-[1.25rem] font-semibold mt-[3px]" style={{ fontFamily: 'var(--font-display)', color: RATING_COLORS[cat] }}>{count}</p>
          </Paper>
        ))}
      </div>

      {/* Filter */}
      <div className="mb-2">
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel sx={{ fontSize: '0.8125rem' }}>{t('channels.reviews.filterByProperty')}</InputLabel>
          <Select
            value={selectedPropertyId}
            label={t('channels.reviews.filterByProperty')}
            onChange={(e) => setSelectedPropertyId(e.target.value as number | '')}
            sx={{ fontSize: '0.8125rem' }}
          >
            <MenuItem value="">{t('common.all')}</MenuItem>
            {properties.map((p) => (
              <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </div>

      {/* Reviews list */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Spinner className="size-7" />
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={<StarIcon />}
          title={t('channels.reviews.noReviews')}
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              isReplying={replyingTo === review.id}
              replyText={replyText}
              replyLoading={replyLoading}
              onStartReply={() => { setReplyingTo(review.id); setReplyText(''); }}
              onCancelReply={() => setReplyingTo(null)}
              onChangeReply={setReplyText}
              onSubmitReply={() => handleReply(review.id)}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Review Card ────────────────────────────────────────────────────────────

function ReviewCard({
  review,
  isReplying,
  replyText,
  replyLoading,
  onStartReply,
  onCancelReply,
  onChangeReply,
  onSubmitReply,
  t,
}: {
  review: AirbnbReview;
  isReplying: boolean;
  replyText: string;
  replyLoading: boolean;
  onStartReply: () => void;
  onCancelReply: () => void;
  onChangeReply: (text: string) => void;
  onSubmitReply: () => void;
  t: (key: string) => string;
}) {
  const category = getRatingCategory(review.rating);
  const color = RATING_COLORS[category];

  return (
    <Paper sx={{ ...CARD_SX, p: 1.5 }}>
      <div className="flex justify-between items-start mb-1">
        <div>
          <div className="flex items-center gap-1 mb-0.5">
            <p className="cn-text-body1 text-[0.8125rem] font-bold">{review.guestName}</p>
            <Rating value={review.rating} readOnly size="small" precision={0.5} sx={{ fontSize: '0.875rem' }} />
            <StatusChip
              label={review.source}
              size="sm"
              tone={review.source === 'airbnb' ? 'err' : 'neutral'}
              className="text-[0.5625rem]"
            />
          </div>
          <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground">
            {review.propertyName} · {new Date(review.createdAt).toLocaleDateString('fr-FR')}
          </p>
        </div>
      </div>

      <p className="cn-text-body1 text-[0.8125rem] mb-1 leading-[1.5]">
        {review.comment}
      </p>

      {/* Host reply */}
      {review.hostReply && (
        <div className="bg-[var(--field)] rounded-[8px] p-1.5 mb-1">
          <p className="cn-text-body1 text-[10.5px] text-[var(--faint)] font-bold mb-0.5 uppercase tracking-[0.06em]">
            {t('channels.reviews.yourReply')}
          </p>
          <p className="cn-text-body1 text-[0.75rem]">{review.hostReply}</p>
        </div>
      )}

      {/* Reply form */}
      {!review.hostReply && (
        <>
          <Collapse in={isReplying}>
            <div className="flex flex-col gap-1 mt-0.5">
              <TextField
                multiline
                rows={2}
                value={replyText}
                onChange={(e) => onChangeReply(e.target.value)}
                placeholder={t('channels.reviews.replyPlaceholder')}
                fullWidth
                size="small"
                sx={{ '& .MuiInputBase-input': { fontSize: '0.8125rem' } }}
              />
              <div className="flex gap-0.5 justify-end">
                <Button size="small" variant="outlined" onClick={onCancelReply} sx={{ fontSize: '0.6875rem' }}>
                  {t('common.cancel')}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={onSubmitReply}
                  disabled={replyLoading || !replyText.trim()}
                  sx={{ fontSize: '0.6875rem' }}
                >
                  {replyLoading ? <Spinner className="size-3" /> : t('channels.reviews.sendReply')}
                </Button>
              </div>
            </div>
          </Collapse>
          {!isReplying && (
            <Button
              size="small"
              startIcon={<ReplyIcon size={'0.75rem'} strokeWidth={1.75} />}
              onClick={onStartReply}
              sx={{ fontSize: '0.6875rem', mt: 0.25 }}
            >
              {t('channels.reviews.reply')}
            </Button>
          )}
        </>
      )}
    </Paper>
  );
}

export default ReviewsPage;
