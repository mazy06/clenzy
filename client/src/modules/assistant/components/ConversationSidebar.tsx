import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
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
    <Box
      sx={{
        width: { xs: '100%', md: 280 },
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        py: 1.5,
      }}
    >
      <Box sx={{ px: 1.5, pb: 1 }}>
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
      </Box>

      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: 0.75,
          // Scrollbar discrete
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'var(--line-2)',
            borderRadius: 3,
          },
        }}
      >
        {loading && conversations.length === 0 && <SkeletonList />}

        {!loading && conversations.length === 0 && (
          <Box
            sx={{
              px: 1.5,
              py: 3,
              textAlign: 'center',
              color: 'var(--muted)',
              fontSize: '12.5px',
              lineHeight: 1.5,
            }}
          >
            <MessageIcon
              size={20}
              strokeWidth={1.5}
              style={{ opacity: 0.4, marginBottom: 8 }}
            />
            <div>Aucune conversation.</div>
            <div style={{ color: 'var(--faint)', marginTop: 2 }}>
              Lance ta premiere question.
            </div>
          </Box>
        )}

        {grouped.map((group) => (
          <Box key={group.label} sx={{ mb: 1.5 }}>
            <Typography
              sx={{
                display: 'block',
                px: 1.5,
                pt: 1,
                pb: 0.5,
                fontSize: '10.5px',
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                fontWeight: 700,
                color: 'var(--faint)',
              }}
            >
              {group.label}
            </Typography>
            {group.items.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                active={conv.id === activeConversationId}
                onSelect={onSelect}
                onArchive={onArchive}
              />
            ))}
          </Box>
        ))}
      </Box>
    </Box>
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
    <Box
      onClick={() => onSelect(conversation.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1.25,
        py: 0.75,
        mx: 0.5,
        borderRadius: '9px',
        cursor: 'pointer',
        bgcolor: active ? 'var(--accent-soft)' : 'transparent',
        transition: 'background .12s',
        '&:hover': {
          bgcolor: active ? 'var(--accent-soft)' : 'var(--hover)',
        },
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
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
      </Box>

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
    </Box>
  );
};

// ─── Loading skeleton ────────────────────────────────────────────────────────

const SkeletonList: React.FC = () => {
  return (
    <Box sx={{ px: 0.5, pt: 1 }}>
      {[80, 65, 75].map((width, i) => (
        <Box
          key={i}
          sx={{
            mx: 0.5,
            mb: 0.5,
            py: 1,
            px: 1.25,
          }}
        >
          <Box
            sx={{
              width: `${width}%`,
              height: 11,
              borderRadius: '6px',
              bgcolor: 'var(--hover)',
            }}
          />
        </Box>
      ))}
    </Box>
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
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}
