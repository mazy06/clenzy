import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, TextField, Typography } from '@mui/material';
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
  const [localEmail, setLocalEmail] = useState(email);
  const [localName, setLocalName] = useState(name);

  useEffect(() => { setLocalEmail(email); }, [email]);
  useEffect(() => { setLocalName(name); }, [name]);

  const emailValid = EMAIL_RE.test(localEmail.trim());
  const dirty = localEmail.trim() !== email.trim() || localName.trim() !== name.trim();
  const domain = useMemo(
    () => localEmail.split('@')[1]?.trim().toLowerCase() ?? '',
    [localEmail],
  );
  const foreignDomain = emailValid && domain.length > 0 && domain !== AUTHENTICATED_DOMAIN;

  return (
    <Box sx={{ py: 1.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, mb: 0.75 }}>
        <Box sx={{ color: 'text.secondary', display: 'inline-flex', flexShrink: 0, mt: '1px' }}>
          <Send size={18} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 500, color: 'text.primary' }}>
            Adresse d'expédition
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
            Le « From » de tous les emails de la plateforme. Le nom d'affichage précède l'adresse
            (ex. Baitly &lt;info@clenzy.fr&gt;).
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, ml: { sm: '30px' } }}>
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
      </Box>

      {foreignDomain && (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mt: 0.75, ml: { sm: '30px' } }}>
          <Box sx={{ color: 'warning.main', display: 'inline-flex', mt: '1px', flexShrink: 0 }}>
            <Info size={14} />
          </Box>
          <Typography sx={{ fontSize: '0.72rem', color: 'warning.main' }}>
            Domaine «&nbsp;{domain}&nbsp;» : authentifiez-le d'abord dans Brevo (SPF&nbsp;+&nbsp;DKIM)
            avant de l'utiliser, sinon les emails partiront en spam / soft bounce.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default SenderEmailRow;
