import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Rating,
  TextField,
  Button,
  Chip,
  Collapse,
} from '@mui/material';
import {
  Star as StarIcon,
  Reply as ReplyIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import { SPACING } from '../../theme/spacing';
import { airbnbApi } from '../../services/api/airbnbApi';
import type { AirbnbReview } from '../../services/api/airbnbApi';
import { propertiesApi } from '../../services/api/propertiesApi';
import type { Property } from '../../services/api/propertiesApi';

// ─── Style Constants ────────────────────────────────────────────────────────

const CARD_SX = {
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: 'none',
  borderRadius: 1.5,
  p: 2,
} as const;

const RATING_COLORS: Record<string, string> = {
  excellent: '#4A9B8E',
  good: '#6B8A9A',
  average: '#D4A574',
  poor: '#d32f2f',
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
    <Box sx={{ p: SPACING.PAGE_PADDING }}>
      <PageHeader
        title={t('channels.reviews.title')}
        subtitle={t('channels.reviews.subtitle')}
        backPath="/channels"
        showBackButton
      />

      {error && <Alert severity="error" sx={{ mb: 1.5, fontSize: '0.8125rem' }}>{error}</Alert>}

      {/* Stats bar */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
        <Paper sx={{ ...CARD_SX, flex: 1, minWidth: 120, textAlign: 'center', p: 1.5 }}>
          <Typography sx={{ fontSize: '0.5625rem', color: 'text.secondary', textTransform: 'uppercase', fontWeight: 500 }}>
            {t('channels.reviews.avgRating')}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mt: 0.5 }}>
            <StarIcon sx={{ fontSize: '1.25rem', color: '#D4A574' }} />
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 700 }}>
              {avgRating > 0 ? avgRating.toFixed(1) : '—'}
            </Typography>
          </Box>
        </Paper>
        <Paper sx={{ ...CARD_SX, flex: 1, minWidth: 120, textAlign: 'center', p: 1.5 }}>
          <Typography sx={{ fontSize: '0.5625rem', color: 'text.secondary', textTransform: 'uppercase', fontWeight: 500 }}>
            {t('channels.reviews.totalReviews')}
          </Typography>
          <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, mt: 0.5 }}>{reviews.length}</Typography>
        </Paper>
        {Object.entries(reviewsByRating).map(([cat, count]) => (
          <Paper key={cat} sx={{ ...CARD_SX, flex: 1, minWidth: 100, textAlign: 'center', p: 1.5, borderLeft: `3px solid ${RATING_COLORS[cat]}` }}>
            <Typography sx={{ fontSize: '0.5625rem', color: 'text.secondary', textTransform: 'uppercase', fontWeight: 500 }}>
              {t(`channels.reviews.${cat}`)}
            </Typography>
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, mt: 0.5, color: RATING_COLORS[cat] }}>{count}</Typography>
          </Paper>
        ))}
      </Box>

      {/* Filter */}
      <Box sx={{ mb: 1.5 }}>
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
      </Box>

      {/* Reviews list */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : reviews.length === 0 ? (
        <Paper sx={{ ...CARD_SX, textAlign: 'center', py: 4 }}>
          <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
            {t('channels.reviews.noReviews')}
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
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
        </Box>
      )}
    </Box>
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
    <Paper sx={{ border: '1px solid', borderColor: 'divider', boxShadow: 'none', borderRadius: 1.5, p: 1.5, borderLeft: `3px solid ${color}` }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.75 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700 }}>{review.guestName}</Typography>
            <Rating value={review.rating} readOnly size="small" precision={0.5} sx={{ fontSize: '0.875rem' }} />
            <Chip
              label={review.source}
              size="small"
              sx={{ fontSize: '0.5625rem', height: 18 }}
              color={review.source === 'airbnb' ? 'error' : 'default'}
              variant="outlined"
            />
          </Box>
          <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
            {review.propertyName} · {new Date(review.createdAt).toLocaleDateString('fr-FR')}
          </Typography>
        </Box>
      </Box>

      <Typography sx={{ fontSize: '0.8125rem', mb: 0.75, lineHeight: 1.5 }}>
        {review.comment}
      </Typography>

      {/* Host reply */}
      {review.hostReply && (
        <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1, mb: 0.75 }}>
          <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary', fontWeight: 600, mb: 0.25, textTransform: 'uppercase' }}>
            {t('channels.reviews.yourReply')}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem' }}>{review.hostReply}</Typography>
        </Box>
      )}

      {/* Reply form */}
      {!review.hostReply && (
        <>
          <Collapse in={isReplying}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 0.5 }}>
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
              <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
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
                  {replyLoading ? <CircularProgress size={12} /> : t('channels.reviews.sendReply')}
                </Button>
              </Box>
            </Box>
          </Collapse>
          {!isReplying && (
            <Button
              size="small"
              startIcon={<ReplyIcon sx={{ fontSize: '0.75rem' }} />}
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
