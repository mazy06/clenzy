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
      <div className="w-[40px] h-[40px] rounded-[12px] flex items-center justify-center shrink-0" style={{ backgroundColor: iconBg, color: iconColor }}>
        {icon}
      </div>
      <div>
        <Typography sx={{ fontWeight: 700, fontSize: 14.5, color: 'var(--ink)', textWrap: 'balance' }}>
          {title}
        </Typography>
        <p className="cn-text-body1 text-[12.5px] text-[var(--muted)] leading-[1.45] mt-0.5">
          {description}
        </p>
      </div>
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
        <p className="cn-text-body2 text-muted-foreground mt-0.5">
          {t('planning.importChooser.subtitle', 'Choisissez comment connecter vos canaux de réservation.')}
        </p>
      </DialogTitle>
      <DialogContent sx={{ pb: 3 }}>
        <div className="flex gap-[9px] flex-col min-[600px]:flex-row">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
