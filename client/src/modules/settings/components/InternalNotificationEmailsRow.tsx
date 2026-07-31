import React, { useMemo, useState } from 'react';
import { Spinner } from '../../../components/ui';
import { Autocomplete, Box, Chip, TextField } from '@mui/material';
import { AlertTriangle, BellRing } from 'lucide-react';

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const SENDER = 'info@clenzy.fr';

interface Props {
  /** Liste actuelle des destinataires (depuis le backend). */
  value: string[];
  /** Persiste la nouvelle liste (déclenché à chaque ajout/suppression valide). */
  onSave: (emails: string[]) => void;
  saving?: boolean;
}

/**
 * Éditeur multi-emails des destinataires des notifications internes (lead devis,
 * copie devis, waitlist, maintenance). L'expéditeur reste toujours info@clenzy.fr ;
 * on configure seulement le(s) destinataire(s). Avertit si info@clenzy.fr est saisi
 * (self-send → soft bounces intermittents).
 */
const InternalNotificationEmailsRow: React.FC<Props> = ({ value, onSave, saving }) => {
  // Copie editable initialisee depuis la prop ; le resync backend passe par le
  // remount via `key` chez le parent (LaunchSettingsSection) — plus d'effet miroir.
  const [emails, setEmails] = useState<string[]>(value);
  const [inputError, setInputError] = useState<string | null>(null);

  const hasSelfSend = useMemo(
    () => emails.some((e) => e.trim().toLowerCase() === SENDER),
    [emails],
  );

  const commit = (next: string[]) => {
    // Dédoublonnage insensible à la casse, en conservant la 1ʳᵉ casse saisie.
    const cleaned = Array.from(
      new Map(next.map((e) => [e.trim().toLowerCase(), e.trim()] as const)).values(),
    ).filter(Boolean);
    setEmails(cleaned);
    if (cleaned.length > 0) onSave(cleaned);
  };

  return (
    <div className="py-2">
      <div className="flex items-start gap-2 mb-1">
        <Box sx={{ color: 'text.secondary', display: 'inline-flex', flexShrink: 0, mt: '1px' }}>
          <BellRing size={18} />
        </Box>
        <div className="min-w-0">
          <p className="cn-text-body1 text-[0.8125rem] font-medium text-foreground">
            Destinataires des notifications internes
          </p>
          <p className="cn-text-body1 text-[0.75rem] text-muted-foreground">
            Reçoivent les nouvelles demandes de devis, les copies de devis envoyés, la liste
            d'attente et les demandes de maintenance. L'expéditeur reste toujours info@clenzy.fr.
          </p>
        </div>
      </div>

      <Autocomplete
        multiple
        freeSolo
        size="small"
        options={[]}
        value={emails}
        onChange={(_, newVal) => {
          const next = newVal as string[];
          const invalid = next.find((e) => !EMAIL_RE.test(e.trim()));
          if (invalid) {
            setInputError(`Adresse invalide : ${invalid}`);
            return;
          }
          setInputError(null);
          commit(next);
        }}
        renderTags={(val: readonly string[], getTagProps) =>
          val.map((option, index) => {
            const isSelf = option.trim().toLowerCase() === SENDER;
            const { key, ...tagProps } = getTagProps({ index });
            return (
              <Chip
                key={key}
                {...tagProps}
                label={option}
                size="small"
                color={isSelf ? 'warning' : 'default'}
                variant={isSelf ? 'outlined' : 'filled'}
              />
            );
          })
        }
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={emails.length === 0 ? 'ajouter un email puis Entrée' : ''}
            error={!!inputError}
            helperText={inputError ?? undefined}
            sx={{ '& .MuiInputBase-input': { fontSize: '0.8rem' } }}
          />
        )}
        sx={{ ml: { sm: '30px' } }}
      />

      {hasSelfSend && (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mt: 0.75, ml: { sm: '30px' } }}>
          <Box sx={{ color: 'warning.main', display: 'inline-flex', mt: '1px', flexShrink: 0 }}>
            <AlertTriangle size={14} />
          </Box>
          <p className="cn-text-body1 text-[0.72rem] text-[var(--bui-warning-ink)]">
            info@clenzy.fr est l'expéditeur : se l'envoyer à soi-même provoque des soft bounces
            intermittents. Préférez une autre adresse (ex. votre boîte perso).
          </p>
        </Box>
      )}

      {saving && (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.5, ml: { sm: '30px' } }}>
          <Spinner className="size-[11px]" />
          <p className="cn-text-body1 text-[0.7rem] text-muted-foreground">Enregistrement…</p>
        </Box>
      )}
    </div>
  );
};

export default InternalNotificationEmailsRow;
