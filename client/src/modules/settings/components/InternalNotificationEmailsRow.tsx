import React, { useMemo, useState } from 'react';
import { cn } from '../../../utils/cn';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  Field,
  FieldError,
  Spinner,
  useComboboxAnchor,
} from '../../../components/ui';
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
  const [inputValue, setInputValue] = useState('');
  const anchor = useComboboxAnchor();

  const hasSelfSend = useMemo(
    () => emails.some((e) => e.trim().toLowerCase() === SENDER),
    [emails],
  );

  // Saisie libre : la seule proposition de la liste est ce que l'utilisateur est
  // en train de taper. Entree la selectionne, ce qui reproduit exactement le
  // comportement free-solo de l'ancien champ (aucune option n'a jamais existe).
  const candidate = inputValue.trim();
  const items = useMemo(
    () => (candidate && !emails.some((e) => e.toLowerCase() === candidate.toLowerCase())
      ? [candidate]
      : []),
    [candidate, emails],
  );

  const commit = (next: string[]) => {
    // Dédoublonnage insensible à la casse, en conservant la 1ʳᵉ casse saisie.
    const cleaned = Array.from(
      new Map(next.map((e) => [e.trim().toLowerCase(), e.trim()] as const)).values(),
    ).filter(Boolean);
    setEmails(cleaned);
    if (cleaned.length > 0) onSave(cleaned);
  };

  const handleValueChange = (next: string[]) => {
    const invalid = next.find((e) => !EMAIL_RE.test(e.trim()));
    if (invalid) {
      setInputError(`Adresse invalide : ${invalid}`);
      return;
    }
    setInputError(null);
    commit(next);
    setInputValue('');
  };

  return (
    <div className="py-2">
      <div className="flex items-start gap-2 mb-1">
        <span className="mt-px inline-flex shrink-0 text-[var(--muted)]">
          <BellRing size={18} />
        </span>
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

      <Field className="min-[600px]:ms-[30px]">
        <Combobox
          multiple
          autoHighlight
          items={items}
          value={emails}
          onValueChange={handleValueChange}
          inputValue={inputValue}
          onInputValueChange={setInputValue}
        >
          <ComboboxChips ref={anchor} className="w-full">
            <ComboboxValue>
              {(values) => (
                <React.Fragment>
                  {values.map((email: string) => (
                    <ComboboxChip
                      key={email}
                      className={cn(
                        email.trim().toLowerCase() === SENDER
                          && 'border-[var(--warn)] text-[var(--warn)] bg-[var(--warn-soft)]',
                      )}
                    >
                      {email}
                    </ComboboxChip>
                  ))}
                  <ComboboxChipsInput
                    className="text-[0.8rem]"
                    aria-invalid={!!inputError}
                    placeholder={values.length === 0 ? 'ajouter un email puis Entrée' : ''}
                  />
                </React.Fragment>
              )}
            </ComboboxValue>
          </ComboboxChips>
          <ComboboxContent anchor={anchor}>
            <ComboboxEmpty>Saisissez une adresse email.</ComboboxEmpty>
            <ComboboxList>
              {(item: string) => (
                <ComboboxItem key={item} value={item}>
                  Ajouter « {item} »
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        {inputError && <FieldError>{inputError}</FieldError>}
      </Field>

      {hasSelfSend && (
        <div className="flex items-start gap-[4.5px] mt-[4.5px] min-[600px]:ms-[30px]">
          <span className="mt-px inline-flex shrink-0 text-[#D4A574]">
            <AlertTriangle size={14} />
          </span>
          <p className="cn-text-body1 text-[0.72rem] text-[var(--bui-warning-ink)]">
            info@clenzy.fr est l'expéditeur : se l'envoyer à soi-même provoque des soft bounces
            intermittents. Préférez une autre adresse (ex. votre boîte perso).
          </p>
        </div>
      )}

      {saving && (
        <div className="inline-flex items-center gap-[3px] mt-[3px] min-[600px]:ms-[30px]">
          <Spinner className="size-[11px]" />
          <p className="cn-text-body1 text-[0.7rem] text-muted-foreground">Enregistrement…</p>
        </div>
      )}
    </div>
  );
};

export default InternalNotificationEmailsRow;
