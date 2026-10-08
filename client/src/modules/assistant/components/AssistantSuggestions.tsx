import { ArrowForward } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';

// These keys are also consumed by the sidebar assistant launcher.
export const ASSISTANT_SUGGESTION_KEYS = ['reservations', 'occupancy', 'arrivals', 'guestMessage', 'compare'] as const;
export const ASSISTANT_SUGGESTION_POOL = [
  ...ASSISTANT_SUGGESTION_KEYS, 'revenue', 'pricing', 'gaps', 'cleaning', 'unpaid',
  'maintenance', 'checkouts', 'topProperty', 'channels', 'lastMinute',
] as const;

const STARTERS = [
  { key: 'arrivals', image: '/images/hitl/calendar.webp' },
  { key: 'revenue', image: '/images/dashboard-kpis/revenue.webp' },
  { key: 'operations', image: '/images/dashboard-operations/cleanings.webp' },
  { key: 'message', image: '/images/dashboard-actions/messages.webp' },
] as const;

export function AssistantSuggestions({ onPick, disabled = false }: { onPick: (prompt: string) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="baitly-assistant-suggestions">
      {STARTERS.map(({ key, image }) => (
        <button type="button" key={key} disabled={disabled} onClick={() => onPick(t('assistant.starters.' + key + '.prompt'))}>
          <img src={image} alt="" width={48} height={48} draggable={false} />
          <span>
            <strong>{t('assistant.starters.' + key + '.title')}</strong>
            <small>{t('assistant.starters.' + key + '.description')}</small>
          </span>
          <ArrowForward size={17} className="rtl:rotate-180" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
