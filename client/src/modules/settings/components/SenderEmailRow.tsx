import React, { useMemo, useState } from 'react';
import { Alert, AlertDescription, Button, Field, FieldLabel, Input } from '../../../components/ui';
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
        <span className="text-muted-foreground inline-flex shrink-0 mt-px">
          <Send size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-medium text-foreground">
            Adresse d'expédition
          </p>
          <p className="text-xs text-muted-foreground">
            Le « From » de tous les emails de la plateforme. Le nom d'affichage précède l'adresse
            (ex. Baitly &lt;info@clenzy.fr&gt;).
          </p>
        </div>
      </div>

      {/* items-end : le libelle est passe au-dessus du champ, le bouton doit
          rester aligne sur la ligne de saisie et non s'etirer sur toute la hauteur. */}
      <div className="flex flex-wrap items-end gap-1.5 min-[600px]:ms-[30px]">
        <Field className="flex-[1_1_220px]">
          <FieldLabel htmlFor="sender-email">Adresse email</FieldLabel>
          <Input
            id="sender-email"
            className="w-full text-[0.8rem]"
            value={localEmail}
            onChange={(e) => setLocalEmail(e.target.value)}
            aria-invalid={localEmail.length > 0 && !emailValid}
          />
        </Field>
        <Field className="flex-[1_1_160px]">
          <FieldLabel htmlFor="sender-display-name">Nom d'affichage</FieldLabel>
          <Input
            id="sender-display-name"
            className="w-full text-[0.8rem]"
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
          />
        </Field>
        {/* Seule action de la rangee, elle valide les deux champs : action
            principale de la zone, d'ou l'encre pleine. */}
        <Button
          size="sm"
          disabled={!emailValid || !dirty || saving}
          onClick={() => onSave(localEmail.trim(), localName.trim())}
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>

      {foreignDomain && (
        <Alert variant="warning" className="mt-[4.5px] min-[600px]:ms-[30px]">
          <Info />
          <AlertDescription className="text-[0.72rem]">
            Domaine «&nbsp;{domain}&nbsp;» : authentifiez-le d'abord dans Brevo (SPF&nbsp;+&nbsp;DKIM)
            avant de l'utiliser, sinon les emails partiront en spam / soft bounce.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default SenderEmailRow;
