import React, { useMemo, useState } from 'react';
import {
  Button,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import { cn } from '../../../utils/cn';
import { Add, Delete, Message as MessageIcon } from '../../../icons';
import type { ConversationSummary } from '../../../services/api/assistantApi';

interface ConversationSidebarProps {
  conversations: ConversationSummary[];
  activeConversationId: number | null;
  loading: boolean;
  onSelect: (conversationId: number) => void;
  onNew: () => void;
  onArchive: (conversationId: number) => Promise<void>;
}

/**
 * Sidebar gauche du chat assistant — liste les conversations utilisateur
 * triees par {@code updatedAt} desc.
 *
 * <p>Pattern « Signature » : groupes en overlines 10.5px `--faint`, item actif
 * accent-soft, hover `--hover`, delete revele au survol.</p>
 *
 * <p>Etats :</p>
 * <ul>
 *   <li>loading : skeleton subtil (3 items grises)</li>
 *   <li>empty : message + CTA "Lance une question"</li>
 *   <li>archive en cours : optimistic remove dans la liste, restore si KO</li>
 * </ul>
 */
export const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  conversations,
  activeConversationId,
  loading,
  onSelect,
  onNew,
  onArchive,
}) => {
  const grouped = useMemo(() => groupByPeriod(conversations), [conversations]);

  return (
    <div className="w-full min-[900px]:w-[280px] shrink-0 flex flex-col py-[9px]">
      <div className="px-2 pb-1.5">
        {/* Soft accent (réf .s-btn--soft) : fond accent-soft + texte accent */}
        <Button
          fullWidth
          onClick={onNew}
          startIcon={<Add size={15} strokeWidth={2} />}
          sx={{
            justifyContent: 'flex-start',
            color: 'var(--accent)',
            fontSize: '12.5px',
            fontWeight: 600,
            textTransform: 'none',
            py: 0.875,
            px: 1.25,
            borderRadius: '11px',
            border: 'none',
            bgcolor: 'var(--accent-soft)',
            '&:hover': {
              bgcolor: 'color-mix(in srgb, var(--accent-soft) 80%, var(--accent) 14%)',
              border: 'none',
            },
          }}
        >
          Nouvelle conversation
        </Button>
      </div>

      {/* Scrollbar discrete : borderRadius 3 = 3 x shape.borderRadius (8px) = 24px */}
      <div className="flex-1 overflow-y-auto px-[4.5px] [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-thumb]:bg-[var(--line-2)] [&::-webkit-scrollbar-thumb]:rounded-[24px]">
        {loading && conversations.length === 0 && <SkeletonList />}

        {!loading && conversations.length === 0 && (
          <div className="px-2 py-4 text-center text-[var(--muted)] text-[12.5px] leading-[1.5]">
            <MessageIcon
              size={20}
              strokeWidth={1.5}
              style={{ opacity: 0.4, marginBottom: 8 }}
            />
            <div>Aucune conversation.</div>
            <div style={{ color: 'var(--faint)', marginTop: 2 }}>
              Lance ta premiere question.
            </div>
          </div>
        )}

        {grouped.map((group) => (
          <div className="mb-2" key={group.label}>
            <p className="cn-text-body1 block px-2 pt-1.5 pb-0.5 text-[10.5px] tracking-[.06em] uppercase font-bold text-[var(--faint)]">
              {group.label}
            </p>
            {group.items.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                active={conv.id === activeConversationId}
                onSelect={onSelect}
                onArchive={onArchive}
              />
            ))}
          </div>
        ))}
      </div>
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
  const [hovered, setHovered] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const title = conversation.title?.trim() || 'Sans titre';

  const handleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (archiving) return;
    setArchiving(true);
    try {
      await onArchive(conversation.id);
    } catch (err) {
      // Le hook restore la liste — pas besoin de faire plus ici
      // eslint-disable-next-line no-console
      console.warn('Archive failed:', err);
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div
      onClick={() => onSelect(conversation.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'flex items-center gap-[3px] px-[7.5px] py-[4.5px] mx-[3px] rounded-[9px] cursor-pointer',
        'transition-colors duration-[120ms] motion-reduce:transition-none',
        active ? 'bg-[var(--accent-soft)]' : 'bg-transparent hover:bg-[var(--hover)]',
      )}
    >
      <div className="flex-1 min-w-0">
        <Typography
          sx={{
            fontSize: '12.5px',
            fontWeight: active ? 600 : 500,
            color: active ? 'var(--accent)' : 'var(--body)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.35,
          }}
        >
          {title}
        </Typography>
      </div>

      <Tooltip title="Archiver" placement="right" enterDelay={400}>
        <IconButton
          size="small"
          onClick={handleArchive}
          disabled={archiving}
          sx={{
            opacity: hovered ? 1 : 0,
            transition: 'opacity .12s',
            color: 'var(--muted)',
            p: 0.25,
            '&:hover': {
              bgcolor: 'var(--err-soft)',
              color: 'var(--err)',
            },
            '&:focus-visible': { opacity: 1 },
          }}
          aria-label={`Archiver la conversation ${title}`}
        >
          <Delete size={13} strokeWidth={1.75} />
        </IconButton>
      </Tooltip>
    </div>
  );
};

// ─── Loading skeleton ────────────────────────────────────────────────────────

const SkeletonList: React.FC = () => {
  return (
    <div className="px-0.5 pt-1.5">
      {[80, 65, 75].map((width) => (
        <div className="mx-0.5 mb-0.5 py-1.5 px-2" key={width}>
          <div className="h-[11px] rounded-[6px] bg-[var(--hover)]" style={{ width: `${width}%` }} />
        </div>
      ))}
    </div>
  );
};

// ─── Period grouping ─────────────────────────────────────────────────────────

interface ConversationGroup {
  label: string;
  items: ConversationSummary[];
}

/**
 * Group conversations into Aujourd'hui / Hier / Cette semaine / Ce mois / Plus ancien.
 * Ordre stable, items deja tries desc par updatedAt en amont.
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
    "Aujourd'hui": [],
    Hier: [],
    'Cette semaine': [],
    'Ce mois': [],
    'Plus ancien': [],
  };

  for (const c of conversations) {
    const updatedAt = new Date(c.updatedAt);
    if (updatedAt >= startOfToday) groups["Aujourd'hui"].push(c);
    else if (updatedAt >= startOfYesterday) groups.Hier.push(c);
    else if (updatedAt >= startOfWeek) groups['Cette semaine'].push(c);
    else if (updatedAt >= startOfMonth) groups['Ce mois'].push(c);
    else groups['Plus ancien'].push(c);
  }

  // Filtre les groupes vides, preserve l'ordre defini ci-dessus.
  return Object.entries(groups)
    .flatMap(([label, items]) => (items.length > 0 ? [{ label, items }] : []));
}
