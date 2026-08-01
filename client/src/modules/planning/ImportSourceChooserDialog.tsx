/* ============================================================
   <ImportSourceChooserDialog> — choix du mécanisme d'import

   Ouvert par le bouton « Importer » du Planning : deux cartes au choix —
   import iCal ponctuel (.ics) OU connexion Channel Manager (Channex,
   synchronisation deux sens des OTA), le même flux guidé que le bouton
   « Channel Manager » du Dashboard.
   ============================================================ */

import { Dialog, DialogContent, DialogTitle } from '@mui/material';
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
    // iconColor vient des props : une classe Tailwind ne peut pas naitre d'une
    // valeur d'execution, on la passe en variable CSS pour garder les classes
    // de survol statiques. gap 1.25 = 7.5px, p 2 = 12px (theme.spacing = 6).
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      style={{ '--choice-accent': iconColor } as React.CSSProperties}
      className={
        'flex-1 min-w-0 flex flex-col gap-[7.5px] p-3 rounded-[14px] border border-solid border-[var(--line)] bg-[var(--card)] cursor-pointer '
        + 'transition-[border-color,background,box-shadow] duration-[180ms] ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none '
        + 'hover:border-[var(--choice-accent)] hover:shadow-[0_8px_24px_-16px_color-mix(in_srgb,var(--choice-accent)_55%,transparent)] '
        + 'focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2'
      }
    >
      <div className="w-[40px] h-[40px] rounded-[12px] flex items-center justify-center shrink-0" style={{ backgroundColor: iconBg, color: iconColor }}>
        {icon}
      </div>
      <div>
        <p className="cn-text-body1 font-bold text-[14.5px] text-[var(--ink)] text-balance">
          {title}
        </p>
        <p className="cn-text-body1 text-[12.5px] text-[var(--muted)] leading-[1.45] mt-0.5">
          {description}
        </p>
      </div>
    </div>
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
