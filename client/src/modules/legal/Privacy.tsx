import React from 'react';
import { Alert, AlertDescription } from '../../components/ui';
import { Info } from 'lucide-react';

import LegalLayout from './LegalLayout';

/**
 * Politique de confidentialite Baitly (RGPD).
 *
 * <p>Page publique liee depuis le formulaire d'inscription (lien CGU) et le footer.
 * Stub a remplacer par la version definitive validee par le DPO.</p>
 */
export default function Privacy() {
  return (
    <LegalLayout title="Politique de confidentialité" lastUpdated="27 mai 2026">
      <Alert variant="info" className="mb-4">
        <Info />
        <AlertDescription>
          Cette page est un brouillon. La politique définitive sera publiée prochainement.
          Pour toute question RGPD, contactez{' '}
          <a href="mailto:dpo@clenzy.fr">dpo@clenzy.fr</a>.
        </AlertDescription>
      </Alert>

      <h2>1. Responsable du traitement</h2>
      <p>
        Le responsable du traitement de vos données personnelles est la société Baitly.
        Pour toute demande relative à vos données, contactez notre Délégué à la Protection
        des Données (DPO) à <a href="mailto:dpo@clenzy.fr">dpo@clenzy.fr</a>.
      </p>

      <h2>2. Données collectées</h2>
      <p>
        Lors de votre inscription et de votre utilisation de la plateforme, nous collectons
        les catégories de données suivantes :
      </p>
      <ul>
        <li>Données d'identité : nom, prénom, adresse email, numéro de téléphone</li>
        <li>Données professionnelles : type d'organisation, nom de société, ville</li>
        <li>Données de facturation : via notre partenaire Stripe (nous ne stockons aucun numéro de carte)</li>
        <li>Données d'utilisation : logs techniques, préférences d'interface</li>
        <li>Données d'attribution (optionnelles) : code promo, canal d'acquisition déclaré</li>
      </ul>

      <h2>3. Finalités</h2>
      <p>Vos données sont utilisées pour :</p>
      <ul>
        <li>Créer et gérer votre compte (base légale : exécution du contrat)</li>
        <li>Vous facturer le service (base légale : exécution du contrat)</li>
        <li>Vous envoyer des notifications relatives à votre activité (base légale : intérêt légitime)</li>
        <li>Vous envoyer notre newsletter (base légale : consentement explicite, retirable à tout moment)</li>
        <li>Améliorer le service via des statistiques d'usage agrégées et anonymisées</li>
      </ul>

      <h2>4. Destinataires</h2>
      <p>
        Vos données sont accessibles aux équipes Baitly strictement habilitées et à nos
        sous-traitants techniques :
      </p>
      <ul>
        <li>Stripe, CMI, PayZone, YouCan Pay et PayTabs (encaissement des paiements)</li>
        <li>Brevo (envoi d'emails transactionnels)</li>
        <li>Meta Platforms — WhatsApp Business Cloud API (messagerie voyageurs)</li>
        <li>Hébergeur cloud (stockage et calcul)</li>
      </ul>

      <h2>5. Durée de conservation</h2>
      <p>
        Vos données sont conservées le temps de la relation contractuelle, puis archivées
        pendant la durée légale (notamment 10 ans pour les pièces comptables).
      </p>

      <h2>6. Vos droits (RGPD)</h2>
      <p>
        Conformément au Règlement Général sur la Protection des Données (RGPD), vous
        disposez des droits suivants :
      </p>
      <ul>
        <li><strong>Accès</strong> : obtenir une copie de vos données</li>
        <li><strong>Rectification</strong> : corriger des données inexactes</li>
        <li><strong>Effacement</strong> : demander la suppression de vos données</li>
        <li><strong>Limitation</strong> : limiter le traitement</li>
        <li><strong>Portabilité</strong> : récupérer vos données dans un format structuré</li>
        <li><strong>Opposition</strong> : vous opposer à un traitement</li>
        <li><strong>Retrait du consentement</strong> : retirer votre consentement à tout moment (notamment pour la newsletter, depuis la page Préférences de notifications)</li>
      </ul>
      <p>
        Pour exercer ces droits, contactez <a href="mailto:dpo@clenzy.fr">dpo@clenzy.fr</a>.
        Vous pouvez également déposer une réclamation auprès de la CNIL.
      </p>

      <h2>7. Sécurité</h2>
      <p>
        Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour
        protéger vos données : chiffrement TLS en transit, hash des mots de passe, contrôles
        d'accès, audits de sécurité réguliers.
      </p>

      <h2>8. Cookies</h2>
      <p>
        La plateforme utilise uniquement des cookies strictement nécessaires au
        fonctionnement du service (authentification, préférences d'interface). Aucun cookie
        publicitaire ou de tracking tiers n'est déposé.
      </p>

      <h2>9. Modifications</h2>
      <p>
        La présente politique peut être mise à jour. La date de dernière modification est
        affichée en haut de cette page. Toute modification substantielle vous sera notifiée
        par email.
      </p>
    </LegalLayout>
  );
}
