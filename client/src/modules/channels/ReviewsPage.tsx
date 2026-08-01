import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '../../utils/cn';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import {
  Spinner,
  Button,
  Textarea,
  Collapsible,
  CollapsibleContent,
  Field,
  FieldLabel,
  NativeSelect,
  NativeSelectOption,
} from '../../components/ui';
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

// `border-solid` est obligatoire : sans preflight Tailwind, `border` seul donne une
// largeur mais un style `none` — bordure invisible.
const CARD_CLASS =
  'border border-solid border-[var(--line)] bg-[var(--card)] shadow-none rounded-[14px] p-3';

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

const RATING_STARS = [0, 1, 2, 3, 4];

/**
 * Notation en LECTURE SEULE, 5 etoiles au pas de 0,5 (le `precision={0.5}`
 * d'origine arrondissait pareil). Deux calques superposes : le calque plein est
 * rogne a la largeur correspondant a la note — seule facon d'obtenir une demi
 * etoile sans disposer d'un glyphe « demi-etoile » dedie.
 */
function ReadOnlyRating({ value, size = 14 }: { value: number; size?: number }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span role="img" aria-label={`${rounded}/5`} className="relative inline-flex leading-none">
      <span aria-hidden className="inline-flex text-[var(--line-2)]">
        {RATING_STARS.map((i) => (
          <StarIcon key={i} size={size} strokeWidth={1.5} className="shrink-0" />
        ))}
      </span>
      <span
        aria-hidden
        className="absolute inset-y-0 start-0 inline-flex overflow-hidden text-[var(--warn)]"
        // Largeur calculee a l'execution : une classe Tailwind ne peut pas
        // naitre d'une variable, d'ou le style inline.
        style={{ width: `${(rounded / 5) * 100}%` }}
      >
        {RATING_STARS.map((i) => (
          <StarIcon key={i} size={size} strokeWidth={1.5} fill="currentColor" className="shrink-0" />
        ))}
      </span>
    </span>
  );
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
        <div className={cn(CARD_CLASS, 'flex-1 min-w-[120px] text-center p-[9px]')}>
          <p className="cn-text-body1 text-[10.5px] text-[var(--faint)] uppercase font-bold tracking-[0.06em]">
            {t('channels.reviews.avgRating')}
          </p>
          <div className="flex items-center justify-center gap-0.5 mt-0.5">
            <StarIcon size={'1.25rem'} strokeWidth={1.75} color='var(--warn)' />
            <p className="cn-text-body1 font-[family-name:var(--font-display)] tabular-nums text-[1.375rem] font-semibold text-[var(--ink)]">
              {avgRating > 0 ? avgRating.toFixed(1) : '—'}
            </p>
          </div>
        </div>
        <div className={cn(CARD_CLASS, 'flex-1 min-w-[120px] text-center p-[9px]')}>
          <p className="cn-text-body1 text-[10.5px] text-[var(--faint)] uppercase font-bold tracking-[0.06em]">
            {t('channels.reviews.totalReviews')}
          </p>
          <p className="cn-text-body1 font-[family-name:var(--font-display)] tabular-nums text-[1.375rem] font-semibold mt-0.5 text-[var(--ink)]">{reviews.length}</p>
        </div>
        {Object.entries(reviewsByRating).map(([cat, count]) => (
          <div key={cat} className={cn(CARD_CLASS, 'flex-1 min-w-[100px] text-center p-[9px]')}>
            <p className="cn-text-body1 text-[10.5px] text-[var(--faint)] uppercase font-bold tracking-[0.06em]">
              {t(`channels.reviews.${cat}`)}
            </p>
            <p className="cn-text-body1 tabular-nums text-[1.25rem] font-semibold mt-[3px]" style={{ fontFamily: 'var(--font-display)', color: RATING_COLORS[cat] }}>{count}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="mb-2">
        {/* Largeur figee : le `w-full` du kit etirerait le champ sur toute la page. */}
        <Field className="w-[200px]">
          <FieldLabel htmlFor="reviews-property-filter">{t('channels.reviews.filterByProperty')}</FieldLabel>
          <NativeSelect
            id="reviews-property-filter"
            size="sm"
            className="w-full"
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <NativeSelectOption value="">{t('common.all')}</NativeSelectOption>
            {properties.map((p) => (
              <NativeSelectOption key={p.id} value={p.id}>{p.name}</NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
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
    <div className={cn(CARD_CLASS, 'p-[9px]')}>
      <div className="flex justify-between items-start mb-1">
        <div>
          <div className="flex items-center gap-1 mb-0.5">
            <p className="cn-text-body1 text-[0.8125rem] font-bold">{review.guestName}</p>
            <ReadOnlyRating value={review.rating} />
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
          <Collapsible open={isReplying}>
            <CollapsibleContent>
              <div className="flex flex-col gap-1 mt-0.5">
                {/* Le champ n'a jamais porte de libelle visible : on lui donne un
                    nom accessible, sinon il ne s'annonce plus du tout. */}
                <Textarea
                  rows={2}
                  value={replyText}
                  onChange={(e) => onChangeReply(e.target.value)}
                  placeholder={t('channels.reviews.replyPlaceholder')}
                  aria-label={t('channels.reviews.reply')}
                  className="w-full text-[0.8125rem] min-h-[2lh]"
                />
                <div className="flex gap-0.5 justify-end">
                  {/* Barre d'action de carte, tres dense : taille xs du kit plutot
                      que sm — le sx d'origine rapetissait deja la typo. */}
                  <Button size="xs" variant="outline" onClick={onCancelReply}>
                    {t('common.cancel')}
                  </Button>
                  <Button
                    size="xs"
                    onClick={onSubmitReply}
                    disabled={replyLoading || !replyText.trim()}
                  >
                    {replyLoading ? <Spinner className="size-3" /> : t('channels.reviews.sendReply')}
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
          {!isReplying && (
            <Button
              size="xs"
              variant="ghost"
              onClick={onStartReply}
              className="mt-0.5"
            >
              <ReplyIcon size={'0.75rem'} strokeWidth={1.75} />
              {t('channels.reviews.reply')}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

export default ReviewsPage;
