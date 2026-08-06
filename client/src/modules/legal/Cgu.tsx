import React from 'react';
import { Alert, AlertDescription } from '../../components/ui';
import { Info } from 'lucide-react';

import LegalLayout from './LegalLayout';

/**
 * Conditions Generales d'Utilisation Baitly.
 *
 * <p>Page publique liee depuis le formulaire d'inscription (case CGU obligatoire).
 * Le contenu actuel est un stub clairement identifie comme tel — il doit etre
 * remplace par le texte juridique valide avant la mise en production.</p>
 *
 * <p>Une fois le texte definitif redige par le service juridique, mettre a jour
 * la {@code lastUpdated} et supprimer l'Alert de stub.</p>
 */
export default function Cgu() {
  return (
    <LegalLayout title="Conditions Générales d'Utilisation" lastUpdated="27 mai 2026">
      <Alert variant="info" className="mb-4">
        <Info />
        <AlertDescription>
          Cette page est un brouillon. Les conditions générales définitives seront publiées
          prochainement. Pour toute question urgente, contactez{' '}
          <a href="mailto:support@clenzy.fr">support@clenzy.fr</a>.
        </AlertDescription>
      </Alert>

      <h2>1. Objet</h2>
      <p>
        Les présentes conditions générales d'utilisation (ci-après « CGU ») ont pour objet de
        définir les modalités d'utilisation de la plateforme Baitly, un logiciel de gestion
        de locations courte durée (Property Management System) édité par la société Baitly.
      </p>
      <p>
        L'inscription au service vaut acceptation pleine et entière des présentes CGU.
      </p>

      <h2>2. Compte utilisateur</h2>
      <p>
        L'utilisateur s'engage à fournir des informations exactes lors de la création de son
        compte et à maintenir ces informations à jour. Il est seul responsable de la
        confidentialité de ses identifiants de connexion.
      </p>

      <h2>3. Abonnement et facturation</h2>
      <p>
        L'accès à la plateforme nécessite la souscription à un abonnement mensuel, annuel ou
        biennal. Les prix en vigueur sont affichés sur la page d'inscription. Le paiement est
        traité par notre partenaire Stripe.
      </p>
      <p>
        L'abonnement est reconduit tacitement à chaque échéance, sauf résiliation par
        l'utilisateur depuis son espace de gestion.
      </p>

      <h2>4. Propriété intellectuelle</h2>
      <p>
        L'ensemble des éléments composant la plateforme Baitly (interface, code, marques,
        logos, contenus) est protégé par le droit de la propriété intellectuelle. Toute
        reproduction non autorisée est strictement interdite.
      </p>

      <h2>5. Disponibilité du service</h2>
      <p>
        Baitly met en œuvre les moyens raisonnables pour assurer la disponibilité de la
        plateforme 24h/24, 7j/7. Des interruptions peuvent survenir pour maintenance ou en
        cas de force majeure.
      </p>

      <h2>6. Responsabilité</h2>
      <p>
        Baitly est tenu à une obligation de moyens et ne saurait être tenu responsable des
        pertes indirectes, pertes de données ou pertes de chiffre d'affaires subies par
        l'utilisateur.
      </p>

      <h2>7. Données personnelles</h2>
      <p>
        Le traitement des données personnelles est régi par notre{' '}
        <a href="/confidentialite">Politique de confidentialité</a>, accessible à tout moment
        depuis le pied de page.
      </p>

      <h2>8. Résiliation</h2>
      <p>
        L'utilisateur peut résilier son abonnement à tout moment depuis son espace de gestion.
        La résiliation prend effet à la fin de la période en cours déjà payée.
      </p>

      <h2>9. Droit applicable</h2>
      <p>
        Les présentes CGU sont régies par le droit français. Tout litige relatif à
        l'utilisation du service relève de la compétence exclusive des tribunaux français.
      </p>

      <h2>10. Contact</h2>
      <p>
        Pour toute question relative aux présentes CGU, contactez-nous à{' '}
        <a href="mailto:support@clenzy.fr">support@clenzy.fr</a>.
      </p>
    </LegalLayout>
  );
}
