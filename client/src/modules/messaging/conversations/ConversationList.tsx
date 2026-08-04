import React, { useMemo, useState } from 'react';
import { cn } from '../../../utils/cn';
import { Alert, AlertDescription } from '../../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Input, Spinner, Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';
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
  avatarColor,
  initials,
  formatConvTime,
  conversationRawId,
} from './unified';

/** Filtres de la liste agrégée (.mg-subtab) — « archived » bascule la source. */
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

/** Élément .mg-conv : avatar 44 r13 + pastille flux 18px, nom/heure/contexte/aperçu. */
function ConversationRow({
  item,
  active,
  onSelect,
  onArchive,
  archiveTitle,
  onRestore,
  restoreTitle,
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
}) {
  const badge = getChannelBadge(item.channel);
  return (
    // gap: 1.5 = 9px (theme.spacing vaut 6 dans ce projet). Le survol de la rangee
    // revele l'action Archiver et masque la pastille non-lus : selecteurs descendants.
    <div
      onClick={onSelect}
      data-highlight-id={conversationRawId(item) || undefined}
      className={cn(
        'relative flex gap-[9px] px-4 py-[13px] border-b border-solid border-[var(--line)] [transition:background_.12s]',
        'hover:[&_.mg-archive]:opacity-100 hover:[&_.mg-archive]:pointer-events-auto hover:[&_.mg-unread]:opacity-0',
        onSelect ? 'cursor-pointer' : 'cursor-default',
        active
          ? "bg-[var(--accent-soft)] before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-[var(--accent)]"
          : cn('bg-transparent', onSelect && 'hover:bg-[var(--bg)]'),
      )}
    >
      {/* Avatar initiales + pastille canal coin bas-droit */}
      <div className="w-[44px] h-[44px] rounded-[13px] shrink-0 flex items-center justify-center font-semibold text-[15px] text-[#fff] relative" style={{ fontFamily: 'var(--font-display)', backgroundColor: avatarColor(item.name) }}>
        {initials(item.name)}
        <div className="absolute w-[18px] h-[18px] rounded-[7px] border-[2px] border-solid border-[var(--card)] flex items-center justify-center text-[#fff]" style={{ bottom: -3, right: -3, backgroundColor: badge.color }}>
          <badge.Icon size={10} strokeWidth={2.5} />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-[13.5px] font-semibold text-[var(--ink)] whitespace-nowrap overflow-hidden text-ellipsis">
            {item.name}
          </span>
          <span className="ms-auto text-[10.5px] text-[var(--faint)] shrink-0 tabular-nums">
            {formatConvTime(item.lastAt)}
          </span>
        </div>
        <p className="cn-text-body1 text-[11px] text-[var(--accent)] font-semibold m-[2px 0 3px]">
          {item.context}
        </p>
        <p className="cn-text-body1 text-[12px] text-[var(--muted)] whitespace-nowrap overflow-hidden text-ellipsis">
          {item.preview}
        </p>
      </div>

      {/* Badge non-lus (masqué au hover au profit de l'action archiver) */}
      {!onRestore && item.unreadCount > 0 && (
        <div className="mg-unread absolute end-[16px] bottom-[16px] min-w-[18px] h-[18px] rounded-[9px] bg-[var(--accent)] text-[#fff] text-[10px] font-bold flex items-center justify-center px-[5px]" style={{ transition: 'opacity .12s' }}>
          {item.unreadCount}
        </div>
      )}

      {/* Archiver — visible au hover */}
      {onArchive && archiveTitle && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="mg-archive absolute end-[12px] bottom-[12px] w-[26px] h-[26px] rounded-[8px] border border-solid border-[var(--line-2)] bg-[var(--card)] text-[var(--muted)] flex items-center justify-center cursor-pointer p-0 opacity-0 pointer-events-none hover:text-[var(--accent)] hover:border-[var(--accent)]" style={{ transition: 'opacity .12s, color .14s, border-color .14s' }} aria-label={archiveTitle} onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                onArchive();
              }}>
              <ArchiveIcon size={13} strokeWidth={1.75} />
            </button>
          </TooltipTrigger>
          <TooltipContent>{archiveTitle}</TooltipContent>
        </Tooltip>
      )}

      {/* Rouvrir / Restaurer — toujours visible (vue Archivés) */}
      {onRestore && restoreTitle && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="self-center shrink-0 w-[30px] h-[30px] rounded-[8px] border border-solid border-[var(--line-2)] bg-[var(--card)] text-[var(--muted)] flex items-center justify-center cursor-pointer p-0 hover:text-[var(--accent)] hover:border-[var(--accent)]" style={{ transition: 'color .14s, border-color .14s' }} aria-label={restoreTitle} onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                onRestore();
              }}>
              {item.kind === 'form' ? (
                <RestoreIcon size={14} strokeWidth={1.75} />
              ) : (
                <UnarchiveIcon size={14} strokeWidth={1.75} />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>{restoreTitle}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

/**
 * Volet gauche 340px de la liste agrégée : recherche (.mg-search), pilules
 * Tous / Non lus / Voyageurs / Formulaires / Archivés (.mg-subtab) et liste
 * (.mg-conv). « Archivés » bascule la source de données (prop `items`) ; les
 * autres pilules filtrent la liste agrégée.
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

  return (
    <>
      {/* En-tête liste : recherche + pilules */}
      <div className="p-[14px 16px] flex flex-col gap-[8.25px]" style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="flex items-center gap-[6.75px] h-[38px] px-[13px] bg-[var(--field)] border border-solid border-[var(--field-line)] rounded-[11px] text-[var(--faint)]">
          <SearchIcon size={15} strokeWidth={1.75} />
          {/* Champ NU : la boite de recherche (fond, liseré, hauteur) est le div
              parent — le gabarit du kit est donc entierement neutralise ici. */}
          <Input
            aria-label={
              isArchivedView
                ? t('messagingHub.searchArchivedPlaceholder', 'Rechercher dans les archives…')
                : t('messagingHub.searchPlaceholder', 'Rechercher une conversation…')
            }
            placeholder={
              isArchivedView
                ? t('messagingHub.searchArchivedPlaceholder', 'Rechercher dans les archives…')
                : t('messagingHub.searchPlaceholder', 'Rechercher une conversation…')
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            // `md:text-[12.5px]` est indispensable : le gabarit pose `md:text-sm`,
            // qui gagnerait sur une taille sans variante des 768 px.
            className="flex-1 h-auto rounded-none border-0 bg-transparent p-0 text-[12.5px] md:text-[12.5px] text-[var(--body)] shadow-none focus-visible:border-0 focus-visible:ring-0"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {subTabs
            .flatMap((tab) => {
              if (tab.hidden) return [];
              const active = filter === tab.value;
              return [
                <button className={cn('text-[12px] font-semibold p-[6px 13px] rounded-[8px] cursor-pointer', active ? 'text-[#fff]' : 'text-[var(--muted)]', active ? 'bg-[var(--accent)]' : 'bg-[var(--field)]')} style={{ fontFamily: 'inherit', border: 0, transition: 'background .14s, color .14s' }} key={tab.value} onClick={() => onFilterChange(tab.value)}>
                  {tab.label}
                </button>,
              ];
            })}
        </div>
      </div>

      {/* Conversations + formulaires */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner className="size-[22px]" />
          </div>
        ) : error ? (
          <Alert variant="destructive" className="m-2 text-[0.8125rem]">
            <TriangleAlert />
            <AlertDescription>{t('messagingHub.errorLoading', 'Impossible de charger les conversations.')}</AlertDescription>
          </Alert>
        ) : filtered.length === 0 ? (
          <p className="cn-text-body1 px-3 py-6 text-center text-[12.5px] text-[var(--muted)]">
            {search.trim()
              ? t('messagingHub.noSearchResults', 'Aucun résultat')
              : isArchivedView
                ? t('messagingHub.noArchived', 'Aucun élément archivé')
                : filter === 'forms'
                  ? t('messagingHub.noForms', 'Aucun formulaire reçu')
                  : t('messagingHub.noConversations', 'Aucune conversation')}
          </p>
        ) : (
          filtered.map((item) =>
            isArchivedView ? (
              <ConversationRow
                key={item.key}
                item={item}
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
    </>
  );
}
