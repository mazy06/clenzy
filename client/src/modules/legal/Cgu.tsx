import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '../../components/ui';
import { Info } from 'lucide-react';

import LegalLayout, { LegalSections, type LegalSection } from './LegalLayout';

/**
 * Conditions Generales d'Utilisation Baitly.
 *
 * <p>Page publique liee depuis le formulaire d'inscription (case CGU obligatoire).
 * Le contenu actuel est un stub clairement identifie comme tel — il doit etre
 * remplace par le texte juridique valide avant la mise en production.</p>
 *
 * <p>Une fois le texte definitif redige par le service juridique, mettre a jour
 * la {@code lastUpdated} et supprimer l'Alert de stub.</p>
 *
 * <p>Le texte vit en locales (`legal.cgu.*`) et non dans ce fichier : la page
 * est servie en francais, en anglais et en arabe selon le pays du visiteur
 * (cf. {@code useGeoAuthLanguage} dans le layout). La version francaise reste
 * la version de reference, ce que dit la section « Droit applicable ».</p>
 */

/** Sections des CGU, dans l'ordre de lecture. Cles : `legal.cgu.<id>.*`. */
const SECTIONS: readonly LegalSection[] = [
  { id: 'purpose', paragraphs: ['p1', 'p2'] },
  { id: 'account', paragraphs: ['p1'] },
  { id: 'subscription', paragraphs: ['p1', 'p2'] },
  { id: 'ip', paragraphs: ['p1'] },
  { id: 'availability', paragraphs: ['p1'] },
  { id: 'liability', paragraphs: ['p1'] },
  { id: 'personalData', paragraphs: ['p1'] },
  { id: 'termination', paragraphs: ['p1'] },
  // `law.p2` : clause de langue faisant foi. Le document existe en trois
  // langues ; sans elle, rien ne tranche entre le texte francais et sa
  // traduction en cas de litige.
  { id: 'law', paragraphs: ['p1', 'p2'] },
  { id: 'contact', paragraphs: ['p1'] },
];

/**
 * Liens cites dans le corps du document. Le traducteur les place ou la phrase
 * l'exige : `<support>` et `<privacy>` peuvent changer de position d'une langue
 * a l'autre sans toucher au code.
 */
const LINKS = {
  support: <a href="mailto:support@clenzy.fr" />,
  privacy: <a href="/confidentialite" />,
};

export default function Cgu() {
  const { t } = useTranslation();

  return (
    <LegalLayout title={t('legal.cgu.title')} lastUpdated="2026-05-27">
      <Alert variant="info" className="mb-4">
        <Info />
        <AlertDescription>
          <Trans i18nKey="legal.cgu.draftNotice" components={LINKS} />
        </AlertDescription>
      </Alert>

      <LegalSections base="legal.cgu" sections={SECTIONS} components={LINKS} />
    </LegalLayout>
  );
}
