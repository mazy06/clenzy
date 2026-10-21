import React, { useMemo, useState } from 'react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import { Packshot } from '../../../components/baitly/FirstUseStage';
import { STAGE_IMAGES } from '../../../components/baitly/stageImages';
import { Archive, ArchiveRestore, TriangleAlert } from '../../../icons/glyphs';
import ConversationAvatar from './ConversationAvatar';
import HeaderSearchField from '../../../components/HeaderSearchField';
import { useTranslation } from '../../../hooks/useTranslation';
import { type UnifiedConversation, formatConvTime, conversationRawId } from './unified';
import { groupByBucket, type InboxBucket } from './messagingModel';
import './baitly-conversation-list.css';

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

const BUCKET_FALLBACK: Record<InboxBucket, string> = {
  today: 'Aujourd’hui',
  yesterday: 'Hier',
  week: 'Cette semaine',
  older: 'Plus ancien',
};

/**
 * Rangée compacte : avatar, titre, aperçu, date et non-lus.
 * Le contexte reste disponible au survol et dans le fil ouvert.
 *
 * <p>Une conversation NON LUE se lit à trois signes cumulés — nom en gras,
 * aperçu en couleur pleine, compteur — pour qu'elle ressorte d'un coup d'œil
 * dans une liste dense. La sélection se marque par la SURFACE
 * ({@code bg-primary-soft}) et non par un liseré latéral : les bandes latérales
 * de plus d'un pixel sont bannies par le contrat de design du projet.</p>
 *
 * <p>La rangée est un vrai bouton (clavier, lecteur d'écran) ; l'action
 * d'archivage est un second bouton superposé, jamais imbriqué dans le premier.</p>
 */
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
  const unread = item.unreadCount > 0;
  const body = (
    <>
      <ConversationAvatar
        name={item.name}
        channel={item.channel}
        group={item.kind === 'internal' && item.thread?.threadId != null}
        size={38}
      />
      <span className="baitly-inbox-copy">
        <span className="baitly-inbox-title-line">
          <span dir="auto" className="baitly-inbox-name" title={item.name}>{item.name}</span>
          <span className="baitly-inbox-date">{formatConvTime(item.lastAt)}</span>
        </span>
        <span className="baitly-inbox-preview-line">
          <span dir="auto" className="baitly-inbox-preview" title={item.context}>{item.preview === '—' ? item.context : item.preview}</span>
          {unread && <Badge className="baitly-inbox-unread">{item.unreadCount > 99 ? '99+' : item.unreadCount}</Badge>}
        </span>
      </span>
    </>
  );

  return (
    <li
      data-highlight-id={conversationRawId(item) || undefined}
      data-unread={unread || undefined}
      data-active={active || undefined}
      data-kind={item.kind}
      className="baitly-inbox-row group/row"
    >
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          aria-current={active || undefined}
          className="baitly-inbox-open"
        >
          {body}
        </button>
      ) : (
        <div className="baitly-inbox-open">{body}</div>
      )}

      {/* Archiver : superposé à la place du compteur, visible au survol ou au focus. */}
      {onArchive && archiveTitle && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="baitly-inbox-row-action">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={archiveTitle}
                className="cursor-pointer text-muted-foreground hover:text-foreground"
                onClick={onArchive}
              >
                <Archive className="size-3.5" aria-hidden />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{archiveTitle}</TooltipContent>
        </Tooltip>
      )}

      {/* Rouvrir / Restaurer — toujours visible (vue Archivés) */}
      {onRestore && restoreTitle && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="baitly-inbox-row-action" data-restore="true">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={restoreTitle}
                className="cursor-pointer text-muted-foreground hover:text-foreground"
                onClick={onRestore}
              >
                <ArchiveRestore className="size-3.5" aria-hidden />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{restoreTitle}</TooltipContent>
        </Tooltip>
      )}
    </li>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-3" aria-hidden>
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-2.5 w-1/3" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    </div>
  );
}

/**
 * Volet gauche de la liste agrégée : filtres avec leurs effectifs, puis les
 * conversations regroupées par ancienneté.
 *
 * <p>« Archivés » bascule la source de données (prop {@code items}) ; les autres
 * filtres agissent sur la liste déjà chargée, donc leurs effectifs sont exacts
 * sans requête de plus. La recherche vit dans le champ UNIQUE du header.</p>
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

  const counts = useMemo(
    () => ({
      all: items.length,
      unread: items.filter((item) => item.unreadCount > 0).length,
      guests: items.filter((item) => item.kind === 'channel').length,
      forms: items.filter((item) => item.kind === 'form').length,
    }),
    [items],
  );

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

  const groups = useMemo(() => groupByBucket(filtered), [filtered]);

  // Les effectifs ne s'affichent que là où ils DISENT quelque chose à faire
  // (non lus, formulaires à traiter) : « Tous 12 » répète le sous-titre de
  // l'écran, et quatre pastilles chiffrées ne tiennent pas sur 320 px.
  const tabs: Array<{ value: InboxFilter; label: string; count?: number; hidden?: boolean }> = [
    { value: 'all', label: t('messagingHub.filters.all', 'Tous') },
    { value: 'unread', label: t('messagingHub.filters.unread', 'Non lus'), count: counts.unread },
    { value: 'guests', label: t('messagingHub.filters.guests', 'Voyageurs') },
    { value: 'forms', label: t('messagingHub.filters.forms', 'Formulaires'), count: counts.forms, hidden: !showFormsFilter },
  ];

  const searchLabel = isArchivedView
    ? t('messagingHub.searchArchivedPlaceholder', 'Rechercher dans les archives…')
    : t('messagingHub.searchPlaceholder', 'Rechercher une conversation…');

  const empty = search.trim()
    ? { image: STAGE_IMAGES.providerSearch, title: t('messagingHub.noSearchResults', 'Aucun résultat'), hint: t('messagingHub.empty.searchHint', 'Essayez un autre nom, un logement ou un mot du message.') }
    : isArchivedView
      ? { image: STAGE_IMAGES.approval, title: t('messagingHub.noArchived', 'Aucun élément archivé'), hint: t('messagingHub.empty.archivedHint', 'Les conversations archivées apparaissent ici.') }
      : filter === 'forms'
        ? { image: STAGE_IMAGES.travelerForm, title: t('messagingHub.noForms', 'Aucun formulaire reçu'), hint: t('messagingHub.empty.formsHint', 'Les demandes de devis et de support arrivent ici.') }
        : filter === 'unread'
          ? { image: STAGE_IMAGES.inbox, title: t('messagingHub.empty.unreadTitle', 'Vous êtes à jour'), hint: t('messagingHub.empty.unreadHint', 'Aucun message en attente de lecture.') }
          : { image: STAGE_IMAGES.inbox, title: t('messagingHub.noConversations', 'Aucune conversation'), hint: '' };

  return (
    <div className="baitly-inbox-list">
      <HeaderSearchField value={search} onChange={setSearch} placeholder={searchLabel} />

      {/* Filtres : une ligne qui défile plutôt qu'un retour à la ligne — la
          hauteur de l'en-tête ne doit pas bouger selon le nombre de filtres
          visibles, qui dépend du rôle. */}
      <div className="baitly-inbox-heading">
        <h2>{t('messagingHub.conversationsTitle', 'Conversations')}</h2>
        <span className="baitly-inbox-total">{isLoading ? '…' : filtered.length}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="baitly-inbox-archives"
              aria-label={t('messagingHub.filters.archived', 'Archivés')}
              aria-pressed={isArchivedView}
              onClick={() => onFilterChange(isArchivedView ? 'all' : 'archived')}
            >
              <Archive size={16} aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent>{t('messagingHub.filters.archived', 'Archivés')}</TooltipContent>
        </Tooltip>
      </div>
      <div
        role="tablist"
        aria-label={t('messagingHub.filtersLabel', 'Filtrer la boîte')}
        className="baitly-inbox-filters"
        onKeyDown={(event) => {
          const rtl = document.documentElement.dir === 'rtl';
          const step = event.key === 'ArrowRight' ? (rtl ? -1 : 1) : event.key === 'ArrowLeft' ? (rtl ? 1 : -1) : 0;
          if (!step && event.key !== 'Home' && event.key !== 'End') return;
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
          const current = buttons.indexOf(event.target as HTMLButtonElement);
          if (current < 0) return;
          event.preventDefault();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + step + buttons.length) % buttons.length;
          buttons[next].focus();
          buttons[next].click();
        }}
      >
        {tabs.flatMap((tab) => {
          if (tab.hidden) return [];
          const active = filter === tab.value;
          return [
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active || (isArchivedView && tab.value === 'all') ? 0 : -1}
              onClick={() => onFilterChange(tab.value)}
              className="baitly-inbox-filter"
              data-filter={tab.value}
            >
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className="baitly-inbox-filter-count">
                  {tab.count}
                </span>
              )}
            </button>,
          ];
        })}
      </div>

      <div className="baitly-inbox-scroll">
        {isLoading ? (
          <div role="status" aria-label={t('messagingHub.loading', 'Chargement…')}>
            {Array.from({ length: 6 }, (_, i) => <RowSkeleton key={i} />)}
          </div>
        ) : error ? (
          <Alert variant="destructive" className="m-2 text-xs">
            <TriangleAlert />
            <AlertDescription>{t('messagingHub.errorLoading', 'Impossible de charger les conversations.')}</AlertDescription>
          </Alert>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <Packshot src={empty.image} size="lg" />
            <p className="m-0 mt-1 text-sm font-medium text-foreground">{empty.title}</p>
            {empty.hint && <p className="m-0 text-xs text-muted-foreground">{empty.hint}</p>}
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.bucket} aria-label={t(`messagingHub.groups.${group.bucket}`, BUCKET_FALLBACK[group.bucket])}>
              <h3 className="baitly-inbox-group">
                {t(`messagingHub.groups.${group.bucket}`, BUCKET_FALLBACK[group.bucket])}
              </h3>
              <ul className="m-0 p-0">
                {group.items.map((item) =>
                  isArchivedView ? (
                    <ConversationRow
                      key={item.key}
                      item={item}
                      active={item.key === selectedKey}
                      // Seuls les formulaires archivés ont un détail consultable —
                      // les conversations archivées se rouvrent avant consultation.
                      onSelect={item.kind !== 'channel' ? () => onSelect(item) : undefined}
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
                )}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
