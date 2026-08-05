import React, { useMemo, useState } from 'react';
import { cn } from '../../../utils/cn';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Spinner,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import { TriangleAlert } from 'lucide-react';
import GuestAvatar from '../../../components/baitly/GuestAvatar';
import {
  Search as SearchIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
  Restore as RestoreIcon,
} from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import {
  type UnifiedConversation,
  getChannelBadge,
  formatConvTime,
  conversationRawId,
} from './unified';

/** Filtres de la liste agrégée — « archived » bascule la source de données. */
export type InboxFilter = 'all' | 'unread' | 'guests' | 'forms' | 'archived';

interface ConversationListProps {
  items: UnifiedConversation[];
  isLoading: boolean;
  error?: unknown;
  filter: InboxFilter;
  onFilterChange: (filter: InboxFilter) => void;
  /** Masque la pilule « Formulaires » (rôle sans accès admin). */
  showFormsFilter: boolean;
  selectedKey: string | null;
  onSelect: (item: UnifiedConversation) => void;
  onArchive: (item: UnifiedConversation) => void;
  /** Rouvrir (conversation) / Restaurer (formulaire) — vue Archivés. */
  onRestore: (item: UnifiedConversation) => void;
}

/**
 * Rangée de conversation — grammaire de la projection : avatar, nom + pastille
 * de flux, aperçu, heure et compteur de non-lus.
 *
 * <p>La sélection se marque par la SURFACE ({@code bg-primary-soft}) et non par
 * un liseré latéral : les bandes latérales de plus d'un pixel sont bannies par
 * le contrat de design du projet.</p>
 */
function ConversationRow({
  item,
  active,
  onSelect,
  onArchive,
  archiveTitle,
  onRestore,
  restoreTitle,
  isFirst,
}: {
  item: UnifiedConversation;
  active: boolean;
  /** Absent = rangée non sélectionnable (conversation archivée, lecture seule). */
  onSelect?: () => void;
  onArchive?: () => void;
  archiveTitle?: string;
  /** Présent en vue Archivés : action Rouvrir / Restaurer toujours visible. */
  onRestore?: () => void;
  restoreTitle?: string;
  isFirst: boolean;
}) {
  const badge = getChannelBadge(item.channel);
  return (
    <div
      onClick={onSelect}
      data-highlight-id={conversationRawId(item) || undefined}
      className={cn(
        'group/row relative flex items-center gap-2.5 p-3 text-start transition-colors duration-150 motion-reduce:transition-none',
        !isFirst && 'border-t border-border',
        onSelect ? 'cursor-pointer' : 'cursor-default',
        active ? 'bg-primary-soft/50' : onSelect && 'hover:bg-accent',
      )}
    >
      {/* Avatar + pastille du flux (email, SMS, WhatsApp, OTA, interne…) */}
      <span className="relative shrink-0">
        <GuestAvatar name={item.name} size={32} />
        <span
          className="absolute -bottom-0.5 -end-0.5 flex size-4 items-center justify-center rounded-full border-2 border-card text-white"
          style={{ backgroundColor: badge.color }}
          title={badge.label}
        >
          <badge.Icon size={8} strokeWidth={2.5} />
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-foreground">{item.name}</span>
        </span>
        <span className="block truncate text-2xs text-primary">{item.context}</span>
        <span className="block truncate text-xs text-muted-foreground">{item.preview}</span>
      </span>

      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-2xs tabular-nums text-faint">{formatConvTime(item.lastAt)}</span>

        {/* Non-lus / actions : au survol, l'action prend la place du compteur —
            deux informations pour un seul emplacement, jamais les deux ensemble. */}
        {onArchive && archiveTitle ? (
          <>
            {item.unreadCount > 0 && (
              <Badge className="px-1.5 py-0 text-2xs group-hover/row:hidden">{item.unreadCount}</Badge>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn('hidden group-hover/row:inline-flex', item.unreadCount === 0 && 'h-[18px]')}>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={archiveTitle}
                    className="cursor-pointer text-muted-foreground hover:text-primary"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      onArchive();
                    }}
                  >
                    <ArchiveIcon size={13} strokeWidth={1.75} />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{archiveTitle}</TooltipContent>
            </Tooltip>
          </>
        ) : (
          item.unreadCount > 0 && <Badge className="px-1.5 py-0 text-2xs">{item.unreadCount}</Badge>
        )}

        {/* Rouvrir / Restaurer — toujours visible (vue Archivés) */}
        {onRestore && restoreTitle && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={restoreTitle}
                  className="cursor-pointer text-muted-foreground hover:text-primary"
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    onRestore();
                  }}
                >
                  {item.kind === 'form' ? (
                    <RestoreIcon size={14} strokeWidth={1.75} />
                  ) : (
                    <UnarchiveIcon size={14} strokeWidth={1.75} />
                  )}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{restoreTitle}</TooltipContent>
          </Tooltip>
        )}
      </span>
    </div>
  );
}

/**
 * Volet gauche de la liste agrégée : recherche, filtres Tous / Non lus /
 * Voyageurs / Formulaires / Archivés, puis les rangées.
 *
 * <p>« Archivés » bascule la source de données (prop {@code items}) ; les autres
 * filtres agissent sur la liste déjà chargée.</p>
 */
export default function ConversationList({
  items,
  isLoading,
  error,
  filter,
  onFilterChange,
  showFormsFilter,
  selectedKey,
  onSelect,
  onArchive,
  onRestore,
}: ConversationListProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const isArchivedView = filter === 'archived';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === 'unread' && item.unreadCount === 0) return false;
      if (filter === 'guests' && item.kind !== 'channel') return false;
      if (filter === 'forms' && item.kind !== 'form') return false;
      if (!q) return true;
      return [item.name, item.context, item.preview].join(' ').toLowerCase().includes(q);
    });
  }, [items, filter, search]);

  const subTabs: Array<{ value: InboxFilter; label: string; hidden?: boolean }> = [
    { value: 'all', label: t('messagingHub.filters.all', 'Tous') },
    { value: 'unread', label: t('messagingHub.filters.unread', 'Non lus') },
    { value: 'guests', label: t('messagingHub.filters.guests', 'Voyageurs') },
    { value: 'forms', label: t('messagingHub.filters.forms', 'Formulaires'), hidden: !showFormsFilter },
    { value: 'archived', label: t('messagingHub.filters.archived', 'Archivés') },
  ];

  const searchLabel = isArchivedView
    ? t('messagingHub.searchArchivedPlaceholder', 'Rechercher dans les archives…')
    : t('messagingHub.searchPlaceholder', 'Rechercher une conversation…');

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
      {/* En-tête : recherche + filtres */}
      <div className="flex shrink-0 flex-col gap-2 border-b border-border p-3">
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon size={15} strokeWidth={1.75} />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={searchLabel}
            placeholder={searchLabel}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>

        {/* Une ligne qui défile plutôt qu'un retour à la ligne : la hauteur de
            l'en-tête ne doit pas bouger selon le nombre de filtres visibles,
            qui dépend du rôle. */}
        <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {subTabs.flatMap((tab) => {
            if (tab.hidden) return [];
            const active = filter === tab.value;
            return [
              <Button
                key={tab.value}
                size="xs"
                variant={active ? 'default' : 'outline'}
                className="shrink-0 cursor-pointer rounded-full"
                onClick={() => onFilterChange(tab.value)}
              >
                {tab.label}
              </Button>,
            ];
          })}
        </div>
      </div>

      {/* Conversations + formulaires */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner className="size-5" />
          </div>
        ) : error ? (
          <Alert variant="destructive" className="m-2 text-xs">
            <TriangleAlert />
            <AlertDescription>
              {t('messagingHub.errorLoading', 'Impossible de charger les conversations.')}
            </AlertDescription>
          </Alert>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            {search.trim()
              ? t('messagingHub.noSearchResults', 'Aucun résultat')
              : isArchivedView
                ? t('messagingHub.noArchived', 'Aucun élément archivé')
                : filter === 'forms'
                  ? t('messagingHub.noForms', 'Aucun formulaire reçu')
                  : t('messagingHub.noConversations', 'Aucune conversation')}
          </p>
        ) : (
          filtered.map((item, index) =>
            isArchivedView ? (
              <ConversationRow
                key={item.key}
                item={item}
                isFirst={index === 0}
                active={item.key === selectedKey}
                // Seuls les formulaires archivés ont un détail consultable —
                // les conversations archivées se rouvrent avant consultation.
                onSelect={item.kind === 'form' ? () => onSelect(item) : undefined}
                onRestore={() => onRestore(item)}
                restoreTitle={
                  item.kind === 'form'
                    ? t('messagingHub.restoreForm', 'Restaurer le formulaire')
                    : t('messagingHub.reopenConversation', 'Rouvrir la conversation')
                }
              />
            ) : (
              <ConversationRow
                key={item.key}
                item={item}
                isFirst={index === 0}
                active={item.key === selectedKey}
                onSelect={() => onSelect(item)}
                onArchive={() => onArchive(item)}
                archiveTitle={
                  item.kind === 'form'
                    ? t('messagingHub.archiveForm', 'Archiver le formulaire')
                    : t('messagingHub.archiveConversation', 'Archiver la conversation')
                }
              />
            ),
          )
        )}
      </div>
    </div>
  );
}
