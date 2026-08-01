import React, { useMemo, useState } from 'react';
import { Button, TextField } from '@mui/material';
import { Info, Send } from 'lucide-react';

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
/** Domaine déjà authentifié dans Brevo (SPF/DKIM). */
const AUTHENTICATED_DOMAIN = 'clenzy.fr';

interface Props {
  email: string;
  name: string;
  onSave: (email: string, name: string) => void;
  saving?: boolean;
}

/**
 * Éditeur de l'adresse d'expédition (From) de la plateforme + nom d'affichage.
 * Niveau plateforme uniquement. Avertit si le domaine saisi n'est pas celui déjà
 * authentifié dans Brevo (sinon spam / soft bounce).
 */
const SenderEmailRow: React.FC<Props> = ({ email, name, onSave, saving }) => {
  // Copies editables initialisees depuis les props ; le resync backend passe par
  // le remount via `key` chez le parent (LaunchSettingsSection) — plus d'effet miroir.
  const [localEmail, setLocalEmail] = useState(email);
  const [localName, setLocalName] = useState(name);

  const emailValid = EMAIL_RE.test(localEmail.trim());
  const dirty = localEmail.trim() !== email.trim() || localName.trim() !== name.trim();
  const domain = useMemo(
    () => localEmail.split('@')[1]?.trim().toLowerCase() ?? '',
    [localEmail],
  );
  const foreignDomain = emailValid && domain.length > 0 && domain !== AUTHENTICATED_DOMAIN;

  return (
    <div className="py-2">
      <div className="flex items-start gap-2 mb-1">
        <span className="text-[var(--muted)] inline-flex shrink-0 mt-px">
          <Send size={18} />
        </span>
        <div className="min-w-0">
          <p className="cn-text-body1 text-[0.8125rem] font-medium text-foreground">
            Adresse d'expédition
          </p>
          <p className="cn-text-body1 text-[0.75rem] text-muted-foreground">
            Le « From » de tous les emails de la plateforme. Le nom d'affichage précède l'adresse
            (ex. Baitly &lt;info@clenzy.fr&gt;).
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 min-[600px]:ms-[30px]">
        <TextField
          size="small"
          label="Adresse email"
          value={localEmail}
          onChange={(e) => setLocalEmail(e.target.value)}
          error={localEmail.length > 0 && !emailValid}
          sx={{ flex: '1 1 220px', '& .MuiInputBase-input': { fontSize: '0.8rem' } }}
        />
        <TextField
          size="small"
          label="Nom d'affichage"
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          sx={{ flex: '1 1 160px', '& .MuiInputBase-input': { fontSize: '0.8rem' } }}
        />
        <Button
          variant="outlined"
          size="small"
          disabled={!emailValid || !dirty || saving}
          onClick={() => onSave(localEmail.trim(), localName.trim())}
          sx={{ textTransform: 'none', fontSize: '0.78rem', flexShrink: 0 }}
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>

      {foreignDomain && (
        <div className="flex items-start gap-[4.5px] mt-[4.5px] min-[600px]:ms-[30px]">
          {/* `warning.main` du theme MUI = #D4A574 (palette accents Baitly). */}
          <span className="text-[#D4A574] inline-flex mt-px shrink-0">
            <Info size={14} />
          </span>
          <p className="cn-text-body1 text-[0.72rem] text-[var(--bui-warning-ink)]">
            Domaine «&nbsp;{domain}&nbsp;» : authentifiez-le d'abord dans Brevo (SPF&nbsp;+&nbsp;DKIM)
            avant de l'utiliser, sinon les emails partiront en spam / soft bounce.
          </p>
        </div>
      )}
    </div>
  );
};

export default SenderEmailRow;
