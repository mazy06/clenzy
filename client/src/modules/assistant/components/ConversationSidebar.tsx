import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  Tooltip,
  Typography,
  alpha,
  useTheme,
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
 * <p>Design pattern : Linear/Notion-style — pill active discrete, hover
 * reveals delete button, dense list scrollable. Group par jour ("Aujourd'hui",
 * "Hier", "Cette semaine", "Plus ancien") pour eviter une longue liste plate.</p>
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
  const theme = useTheme();
  const grouped = useMemo(() => groupByPeriod(conversations), [conversations]);

  return (
    <Box
      sx={{
        width: { xs: '100%', md: 280 },
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: alpha(theme.palette.text.primary, 0.02),
        borderRight: { md: `1px solid ${alpha(theme.palette.text.primary, 0.06)}` },
        py: 1.5,
      }}
    >
      <Box sx={{ px: 1.5, pb: 1 }}>
        <Button
          fullWidth
          onClick={onNew}
          startIcon={<Add size={16} strokeWidth={2} />}
          sx={{
            justifyContent: 'flex-start',
            color: theme.palette.text.primary,
            fontSize: '0.8125rem',
            fontWeight: 600,
            textTransform: 'none',
            py: 0.875,
            px: 1.25,
            borderRadius: 1.5,
            bgcolor: alpha(theme.palette.text.primary, 0.04),
            '&:hover': {
              bgcolor: alpha(theme.palette.text.primary, 0.08),
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
            bgcolor: alpha(theme.palette.text.primary, 0.12),
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
              color: theme.palette.text.secondary,
              fontSize: '0.8125rem',
              lineHeight: 1.5,
            }}
          >
            <MessageIcon
              size={20}
              strokeWidth={1.5}
              style={{ opacity: 0.4, marginBottom: 8 }}
            />
            <div>Aucune conversation.</div>
            <div style={{ opacity: 0.6, marginTop: 2 }}>
              Lance ta premiere question.
            </div>
          </Box>
        )}

        {grouped.map((group) => (
          <Box key={group.label} sx={{ mb: 1.5 }}>
            <Typography
              variant="overline"
              sx={{
                display: 'block',
                px: 1.5,
                pt: 1,
                pb: 0.5,
                fontSize: '0.625rem',
                letterSpacing: 0.8,
                fontWeight: 700,
                color: alpha(theme.palette.text.secondary, 0.7),
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
  const theme = useTheme();
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
        borderRadius: 1.25,
        cursor: 'pointer',
        bgcolor: active
          ? alpha(theme.palette.primary.main, 0.10)
          : 'transparent',
        transition: 'background-color 120ms ease-out',
        '&:hover': {
          bgcolor: active
            ? alpha(theme.palette.primary.main, 0.14)
            : alpha(theme.palette.text.primary, 0.05),
        },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: '0.8125rem',
            fontWeight: active ? 600 : 500,
            color: active ? theme.palette.primary.dark : theme.palette.text.primary,
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
            transition: 'opacity 120ms',
            color: alpha(theme.palette.error.main, 0.7),
            p: 0.25,
            '&:hover': {
              bgcolor: alpha(theme.palette.error.main, 0.10),
              color: theme.palette.error.main,
            },
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
  const theme = useTheme();
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
              borderRadius: 1,
              bgcolor: alpha(theme.palette.text.primary, 0.08),
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
