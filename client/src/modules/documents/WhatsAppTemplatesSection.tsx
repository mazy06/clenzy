import React, { useImperativeHandle, useMemo, useState, forwardRef } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { Edit } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useWhatsAppTemplatesList } from '../../hooks/useWhatsAppTemplates';
import type { WhatsAppTemplateGroup } from '../../services/api/whatsappTemplatesApi';
import WhatsAppTemplateEditorDialog from './WhatsAppTemplateEditorDialog';
import { softChipSx } from '../../utils/statusUtils';

// ─── Palette Baitly (alignee sur MessageTemplatesSection) ───────────────────

const ACCENT_TEAL = '#4A9B8E';
const WARM = '#D4A574';
const SOFT_BLUE = '#7BA3C2';
const NEUTRAL = '#8A8378';

/** Couleur signature par categorie Meta WhatsApp. */
const CATEGORY_COLOR: Record<string, string> = {
  UTILITY: ACCENT_TEAL,
  MARKETING: WARM,
  AUTHENTICATION: SOFT_BLUE,
};

/**
 * Resout le code de langue Meta (fr_FR/en_US/ar_AR) selon la langue active
 * du PMS. Fallback sur fr_FR si la langue active n'est pas dispo dans le
 * template (ex: l'org a override fr mais pas en).
 *
 * <p>Pourquoi : sans ca, on prenait {@code Object.values(group.languages)[0]}
 * qui retournait ar_AR en premier (ordre alphabetique de serialisation JSON)
 * → l'utilisateur voyait l'apercu en arabe meme en interface francaise.</p>
 */
function resolvePreviewLang(group: WhatsAppTemplateGroup, pmsLang: string): string {
  const candidates = [
    metaCodeFor(pmsLang),
    'fr_FR',
    'en_US',
  ];
  for (const code of candidates) {
    if (group.languages[code]) return code;
  }
  // Worst case : prend la 1ere dispo (l'org a peut-etre supprime fr/en).
  return Object.keys(group.languages)[0] ?? 'fr_FR';
}

/** Mapping i18n.language (fr/en/ar) → locale Meta (fr_FR/en_US/ar_AR). */
function metaCodeFor(pmsLang: string): string {
  switch (pmsLang) {
    case 'en': return 'en_US';
    case 'ar': return 'ar_AR';
    default: return 'fr_FR';
  }
}

// ─── Ref Interface (aligne sur MessageTemplatesSectionRef) ──────────────────

export interface WhatsAppTemplatesSectionRef {
  refresh: () => void;
}

/**
 * Tab "Templates WhatsApp" dans Documents & Communication.
 *
 * <h3>Architecture</h3>
 * Mirror visuel de {@code MessageTemplatesSection} (table avec colonnes Nom /
 * Origine / Objet / Langue / Actions). La seule difference UX significative
 * reste dans le dialog d'edition : preview en bulle WhatsApp verte (cf.
 * {@link WhatsAppTemplateEditorDialog}) au lieu de Paper plain pour les emails.
 *
 * <h3>Donnees</h3>
 * Fetch via {@link useWhatsAppTemplatesList} (React Query, staleTime 60s).
 * Les overrides per-org masquent les templates systeme avec meme cle/langue
 * cote service backend.
 */
const WhatsAppTemplatesSection = forwardRef<WhatsAppTemplatesSectionRef>((_, ref) => {
  const { t } = useTranslation();
  const { data: groups = [], isLoading, error, refetch } = useWhatsAppTemplatesList();
  const [editingKey, setEditingKey] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    refresh: () => { void refetch(); },
  }), [refetch]);

  // Tri stable : personnalises en premier, puis ordre alphabetique de templateKey.
  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) => {
      if (a.isCustomized !== b.isCustomized) return a.isCustomized ? -1 : 1;
      return a.templateKey.localeCompare(b.templateKey);
    });
  }, [groups]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('whatsappTemplates.loadError')}
        </Alert>
      )}

      {sortedGroups.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          {t('whatsappTemplates.empty')}
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('messaging.templates.name')}</TableCell>
                <TableCell>{t('messaging.templates.origin')}</TableCell>
                <TableCell>{t('whatsappTemplates.table.preview')}</TableCell>
                <TableCell>{t('messaging.templates.language')}</TableCell>
                <TableCell align="center">{t('messaging.templates.status')}</TableCell>
                <TableCell align="center">{t('messaging.templates.version')}</TableCell>
                <TableCell>{t('messaging.templates.createdBy')}</TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedGroups.map((group) => (
                <WhatsAppRow
                  key={group.templateKey}
                  group={group}
                  onEdit={() => setEditingKey(group.templateKey)}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {editingKey && (
        <WhatsAppTemplateEditorDialog
          templateKey={editingKey}
          open={true}
          onClose={() => setEditingKey(null)}
        />
      )}
    </Box>
  );
});

WhatsAppTemplatesSection.displayName = 'WhatsAppTemplatesSection';

// ─── Row par template (pattern aligne sur SystemRow/UserRow de MessageTemplatesSection) ─

interface RowProps {
  group: WhatsAppTemplateGroup;
  onEdit: () => void;
}

const WhatsAppRow: React.FC<RowProps> = ({ group, onEdit }) => {
  const { t, currentLanguage } = useTranslation();

  // Resoud la langue d'apercu selon la langue active du PMS (avec fallback fr).
  // Sinon le `Object.values()[0]` retournait ar_AR par hasard d'ordre alpha,
  // et l'utilisateur en interface FR voyait de l'arabe dans la table.
  const previewLangCode = resolvePreviewLang(group, currentLanguage);
  const previewLang = group.languages[previewLangCode];
  const previewExcerpt = previewLang
    ? previewLang.bodyNamed.slice(0, 80).replace(/\s+/g, ' ').trim()
        + (previewLang.bodyNamed.length > 80 ? '…' : '')
    : '—';

  const friendlyName = t(`whatsappTemplates.keys.${group.templateKey}`);
  const categoryColor = CATEGORY_COLOR[group.category] ?? NEUTRAL;
  // Affiche le code court (FR/EN/AR) de la langue d'apercu courante. Les autres
  // langues sont accessibles depuis le dialog d'edition via le selecteur.
  const langChipLabel = previewLangCode.split('_')[0].toUpperCase();

  return (
    <TableRow hover>
      <TableCell>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" fontWeight={600}>
            {friendlyName}
          </Typography>
          <Chip
            label={group.category}
            size="small"
            sx={softChipSx(categoryColor)}
          />
        </Box>
      </TableCell>
      <TableCell>
        <Chip
          label={group.isCustomized
            ? t('messaging.templates.originCustomized')
            : t('messaging.templates.originSystem')}
          size="small"
          sx={softChipSx(group.isCustomized ? ACCENT_TEAL : NEUTRAL)}
          variant={group.isCustomized ? 'filled' : 'outlined'}
        />
      </TableCell>
      <TableCell>
        <Typography
          variant="body2"
          noWrap
          sx={{
            maxWidth: 280,
            fontSize: '0.8125rem',
            // RTL pour l'apercu si la langue active est l'arabe — sinon le
            // texte arabe s'affiche en LTR et est cassé visuellement.
            direction: previewLangCode === 'ar_AR' ? 'rtl' : 'ltr',
            textAlign: previewLangCode === 'ar_AR' ? 'right' : 'left',
          }}
        >
          {previewExcerpt}
        </Typography>
      </TableCell>
      <TableCell>
        <Chip label={langChipLabel} size="small" sx={softChipSx(NEUTRAL)} />
      </TableCell>
      <TableCell align="center">
        {/* Templates WhatsApp toujours actifs cote serveur (pas de notion
            d'activation/desactivation pour les templates WhatsApp en BDD).
            La valeur reelle d'activation cote Meta est dans metaApprovalStatus
            (PENDING/APPROVED/REJECTED) — non expose ici en colonne. */}
        <Chip
          label={t('messaging.templates.active')}
          size="small"
          sx={softChipSx(ACCENT_TEAL)}
        />
      </TableCell>
      <TableCell align="center">
        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>v1</Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
          {group.isCustomized ? '—' : t('messaging.templates.systemAuthor')}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Tooltip title={t('common.edit')} arrow>
          <IconButton
            size="small"
            onClick={onEdit}
            aria-label={t('common.edit')}
            sx={{ cursor: 'pointer', '&:hover': { color: ACCENT_TEAL } }}
          >
            <Edit size={16} strokeWidth={1.75} />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
};

export default WhatsAppTemplatesSection;
