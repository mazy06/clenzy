/* ============================================================
   <ImportSourceChooserDialog> — choix du mécanisme d'import

   Ouvert par le bouton « Importer » du Planning : deux cartes au choix —
   import iCal ponctuel (.ics) OU connexion Channel Manager (Channex,
   synchronisation deux sens des OTA), le même flux guidé que le bouton
   « Channel Manager » du Dashboard.
   ============================================================ */

import { Box, Dialog, DialogContent, DialogTitle, Typography } from '@mui/material';
import { CalendarMonth, Hub } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';

interface ImportSourceChooserDialogProps {
  open: boolean;
  onClose: () => void;
  /** Ouvre le flux d'import iCal (modale existante). */
  onChooseIcal: () => void;
  /** Ouvre le flux Channel Manager Channex (modale guidée existante). */
  onChooseChannelManager: () => void;
}

interface ChoiceCardProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  onSelect: () => void;
}

function ChoiceCard({ icon, iconBg, iconColor, title, description, onSelect }: ChoiceCardProps) {
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      sx={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        p: 2,
        borderRadius: '14px',
        border: '1px solid var(--line)',
        bgcolor: 'var(--card)',
        cursor: 'pointer',
        transition: 'border-color 180ms cubic-bezier(.16,1,.3,1), background 180ms cubic-bezier(.16,1,.3,1), box-shadow 180ms cubic-bezier(.16,1,.3,1)',
        '&:hover': {
          borderColor: iconColor,
          boxShadow: `0 8px 24px -16px color-mix(in srgb, ${iconColor} 55%, transparent)`,
        },
        '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '2px' },
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: iconBg,
          color: iconColor,
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 700, fontSize: 14.5, color: 'var(--ink)', textWrap: 'balance' }}>
          {title}
        </Typography>
        <Typography sx={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.45, mt: 0.5 }}>
          {description}
        </Typography>
      </Box>
    </Box>
  );
}

export default function ImportSourceChooserDialog({
  open,
  onClose,
  onChooseIcal,
  onChooseChannelManager,
}: ImportSourceChooserDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t('planning.importChooser.title', 'Importer des réservations')}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {t('planning.importChooser.subtitle', 'Choisissez comment connecter vos canaux de réservation.')}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pb: 3 }}>
        <Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
          <ChoiceCard
            icon={<CalendarMonth size={20} strokeWidth={1.75} />}
            iconBg="var(--accent-soft)"
            iconColor="var(--accent)"
            title={t('planning.importChooser.ical.title', 'Import iCal')}
            description={t(
              'planning.importChooser.ical.description',
              'Importez les réservations d’un calendrier externe via un lien .ics (Airbnb, Booking, Vrbo…). Synchronisation en lecture seule.',
            )}
            onSelect={() => {
              onClose();
              onChooseIcal();
            }}
          />
          <ChoiceCard
            icon={<Hub size={20} strokeWidth={1.75} />}
            iconBg="var(--info-soft)"
            iconColor="var(--info)"
            title={t('planning.importChooser.channex.title', 'Channel Manager')}
            description={t(
              'planning.importChooser.channex.description',
              'Connectez vos OTA via Channex : réservations, tarifs et disponibilités synchronisés dans les deux sens.',
            )}
            onSelect={() => {
              onClose();
              onChooseChannelManager();
            }}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
}
