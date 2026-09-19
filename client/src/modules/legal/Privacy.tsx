import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '../../components/ui';
import { Info } from 'lucide-react';

import LegalLayout, { LegalSections, type LegalSection } from './LegalLayout';

/**
 * Politique de confidentialite Baitly (RGPD).
 *
 * <p>Page publique liee depuis le formulaire d'inscription (lien CGU) et le footer.
 * Stub a remplacer par la version definitive validee par le DPO.</p>
 *
 * <p>Le texte vit en locales (`legal.privacy.*`) : la page est servie en
 * francais, en anglais et en arabe selon le pays du visiteur (cf.
 * {@code useGeoAuthLanguage} dans le layout).</p>
 */

/** Sections de la politique, dans l'ordre de lecture. Cles : `legal.privacy.<id>.*`. */
const SECTIONS: readonly LegalSection[] = [
  { id: 'controller', paragraphs: ['p1'] },
  { id: 'data', paragraphs: ['p1'], items: ['i1', 'i2', 'i3', 'i4', 'i5'] },
  { id: 'purposes', paragraphs: ['p1'], items: ['i1', 'i2', 'i3', 'i4', 'i5'] },
  { id: 'recipients', paragraphs: ['p1'], items: ['i1', 'i2', 'i3', 'i4'] },
  { id: 'retention', paragraphs: ['p1'] },
  {
    id: 'rights',
    paragraphs: ['p1'],
    items: ['i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7'],
    after: ['after1'],
  },
  { id: 'security', paragraphs: ['p1'] },
  { id: 'cookies', paragraphs: ['p1'] },
  // `changes.p2` : version de reference. Formulee plus souplement que dans les
  // CGU — une politique de confidentialite ne contracte pas, et les droits
  // RGPD ne se reduisent pas par le choix d'une langue de consultation.
  { id: 'changes', paragraphs: ['p1', 'p2'] },
];

/**
 * Elements cites dans le corps du document : le contact DPO, et la mise en
 * exergue du nom de chaque droit RGPD. Le traducteur les place ou la phrase
 * l'exige.
 */
const COMPONENTS = {
  dpo: <a href="mailto:dpo@clenzy.fr" />,
  b: <strong />,
};

export default function Privacy() {
  const { t } = useTranslation();

  return (
    <LegalLayout title={t('legal.privacy.title')} lastUpdated="2026-05-27">
      <Alert variant="info" className="mb-4">
        <Info />
        <AlertDescription>
          <Trans i18nKey="legal.privacy.draftNotice" components={COMPONENTS} />
        </AlertDescription>
      </Alert>

      <LegalSections base="legal.privacy" sections={SECTIONS} components={COMPONENTS} />
    </LegalLayout>
  );
}
