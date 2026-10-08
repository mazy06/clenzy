import React, { useMemo, useState } from 'react';
import {
  Button,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import { Delete, History as HistoryIcon } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import type { ConversationSummary } from '../../../services/api/assistantApi';

interface ConversationSidebarProps {
  conversations: ConversationSummary[];
  activeConversationId: number | null;
  loading: boolean;
  onSelect: (conversationId: number) => void;
  onNew: () => void;
  onArchive: (conversationId: number) => Promise<void>;
}

/** Conversations grouped by recency, with separate selection and archive actions. */
export const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  conversations,
  activeConversationId,
  loading,
  onSelect,
  onNew,
  onArchive,
}) => {
  const { t } = useTranslation();
  const grouped = useMemo(() => groupByPeriod(conversations), [conversations]);

  return (
    <div className="baitly-assistant-history">
      <h3 className="m-0 mb-4 flex shrink-0 items-center gap-2 text-sm font-semibold">
        <HistoryIcon className="size-3.5" /> {t('assistant.history.title')}
      </h3>

      <div className="-me-1 min-h-0 flex-1 overflow-y-auto pe-1 [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar]:w-1.5">
        {loading && conversations.length === 0 && <SkeletonList />}

        {!loading && conversations.length === 0 && (
          <div className="px-2 py-6 text-center text-xs text-muted-foreground">
            <p>{t('assistant.history.empty')}</p>
            <p className="mt-1 text-muted-foreground">{t('assistant.history.emptyHint')}</p>
          </div>
        )}

        {grouped.map((group) => (
          <div className="mb-3 flex flex-col gap-1" key={group.labelKey}>
            <p className="px-2.5 text-xs font-medium text-muted-foreground">
              {t(`assistant.history.${group.labelKey}`)}
            </p>
            {group.items.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                active={conversation.id === activeConversationId}
                onSelect={onSelect}
                onArchive={onArchive}
              />
            ))}
          </div>
        ))}
      </div>

      <Button size="xs" variant="outline" className="mt-3 min-h-11 w-full shrink-0 cursor-pointer text-[var(--bui-supervision-ink)]" onClick={onNew}>
        {t('assistant.newConversation')}
      </Button>
    </div>
  );
};

// ─── Item ────────────────────────────────────────────────────────────────────

interface ConversationItemProps {
  conversation: ConversationSummary;
  active: boolean;
  onSelect: (id: number) => void;
  onArchive: (id: number) => Promise<void>;
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  active,
  onSelect,
  onArchive,
}) => {
  const { t } = useTranslation();
  const [archiving, setArchiving] = useState(false);
  const title = conversation.title?.trim() || t('assistant.history.untitled');

  const handleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (archiving) return;
    setArchiving(true);
    try {
      await onArchive(conversation.id);
    } catch (err) {
      // Le hook restaure la liste — rien de plus à faire ici.
      // eslint-disable-next-line no-console
      console.warn('Archive failed:', err);
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div
      className="baitly-assistant-history-item"
      data-active={active || undefined}
    >
      <button type="button" className="baitly-assistant-history-select" onClick={() => onSelect(conversation.id)} aria-current={active ? 'true' : undefined}>
        <span className="block truncate">{title}</span>
      </button>

      <Tooltip delayDuration={400}>
        <TooltipTrigger asChild>
          {/* Le span porte la ref que Radix pose sur son enfant : Button est une
              fonction, il n'en transmet pas. */}
          <span className="inline-flex">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={handleArchive}
              disabled={archiving}
              className="size-9 cursor-pointer text-muted-foreground hover:bg-destructive-soft hover:text-destructive-ink"
              aria-label={t('assistant.history.archive', { title })}
            >
              <Delete size={13} strokeWidth={1.75} />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="left">{t('assistant.history.archive', { title })}</TooltipContent>
      </Tooltip>
    </div>
  );
};

// ─── Squelette de chargement ─────────────────────────────────────────────────

const SkeletonList: React.FC = () => (
  <div className="flex flex-col gap-1">
    {[80, 65, 75].map((width) => (
      <div className="px-2.5 py-2" key={width}>
        <Skeleton className="h-3 rounded" style={{ width: `${width}%` }} />
      </div>
    ))}
  </div>
);

// ─── Groupement par période ──────────────────────────────────────────────────

interface ConversationGroup {
  /** Clé i18n sous {@code assistant.history} (today, yesterday, …). */
  labelKey: string;
  items: ConversationSummary[];
}

/**
 * Groupe les conversations par période. Ordre stable, items déjà triés
 * par {@code updatedAt} décroissant en amont.
 */
function groupByPeriod(conversations: ConversationSummary[]): ConversationGroup[] {
  if (conversations.length === 0) return [];

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const groups: Record<string, ConversationSummary[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    thisMonth: [],
    older: [],
  };

  for (const c of conversations) {
    const updatedAt = new Date(c.updatedAt);
    if (updatedAt >= startOfToday) groups.today.push(c);
    else if (updatedAt >= startOfYesterday) groups.yesterday.push(c);
    else if (updatedAt >= startOfWeek) groups.thisWeek.push(c);
    else if (updatedAt >= startOfMonth) groups.thisMonth.push(c);
    else groups.older.push(c);
  }

  // Filtre les groupes vides, préserve l'ordre défini ci-dessus.
  return Object.entries(groups)
    .flatMap(([labelKey, items]) => (items.length > 0 ? [{ labelKey, items }] : []));
}
