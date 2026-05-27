import React from 'react';
import { Typography, Alert } from '@mui/material';
import LegalLayout from './LegalLayout';

/**
 * Politique de confidentialite Clenzy (RGPD).
 *
 * <p>Page publique liee depuis le formulaire d'inscription (lien CGU) et le footer.
 * Stub a remplacer par la version definitive validee par le DPO.</p>
 */
export default function Privacy() {
  return (
    <LegalLayout title="Politique de confidentialité" lastUpdated="27 mai 2026">
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          Cette page est un brouillon. La politique définitive sera publiée prochainement.
          Pour toute question RGPD, contactez{' '}
          <a href="mailto:dpo@clenzy.fr">dpo@clenzy.fr</a>.
        </Typography>
      </Alert>

      <Typography component="h2">1. Responsable du traitement</Typography>
      <Typography component="p">
        Le responsable du traitement de vos données personnelles est la société Clenzy.
        Pour toute demande relative à vos données, contactez notre Délégué à la Protection
        des Données (DPO) à <a href="mailto:dpo@clenzy.fr">dpo@clenzy.fr</a>.
      </Typography>

      <Typography component="h2">2. Données collectées</Typography>
      <Typography component="p">
        Lors de votre inscription et de votre utilisation de la plateforme, nous collectons
        les catégories de données suivantes :
      </Typography>
      <ul>
        <li>Données d'identité : nom, prénom, adresse email, numéro de téléphone</li>
        <li>Données professionnelles : type d'organisation, nom de société, ville</li>
        <li>Données de facturation : via notre partenaire Stripe (nous ne stockons aucun numéro de carte)</li>
        <li>Données d'utilisation : logs techniques, préférences d'interface</li>
        <li>Données d'attribution (optionnelles) : code promo, canal d'acquisition déclaré</li>
      </ul>

      <Typography component="h2">3. Finalités</Typography>
      <Typography component="p">Vos données sont utilisées pour :</Typography>
      <ul>
        <li>Créer et gérer votre compte (base légale : exécution du contrat)</li>
        <li>Vous facturer le service (base légale : exécution du contrat)</li>
        <li>Vous envoyer des notifications relatives à votre activité (base légale : intérêt légitime)</li>
        <li>Vous envoyer notre newsletter (base légale : consentement explicite, retirable à tout moment)</li>
        <li>Améliorer le service via des statistiques d'usage agrégées et anonymisées</li>
      </ul>

      <Typography component="h2">4. Destinataires</Typography>
      <Typography component="p">
        Vos données sont accessibles aux équipes Clenzy strictement habilitées et à nos
        sous-traitants techniques :
      </Typography>
      <ul>
        <li>Stripe (paiement)</li>
        <li>Brevo et Postal (envoi d'emails transactionnels)</li>
        <li>Twilio (envoi de SMS et WhatsApp)</li>
        <li>Hébergeur cloud (stockage et calcul)</li>
      </ul>

      <Typography component="h2">5. Durée de conservation</Typography>
      <Typography component="p">
        Vos données sont conservées le temps de la relation contractuelle, puis archivées
        pendant la durée légale (notamment 10 ans pour les pièces comptables).
      </Typography>

      <Typography component="h2">6. Vos droits (RGPD)</Typography>
      <Typography component="p">
        Conformément au Règlement Général sur la Protection des Données (RGPD), vous
        disposez des droits suivants :
      </Typography>
      <ul>
        <li><strong>Accès</strong> : obtenir une copie de vos données</li>
        <li><strong>Rectification</strong> : corriger des données inexactes</li>
        <li><strong>Effacement</strong> : demander la suppression de vos données</li>
        <li><strong>Limitation</strong> : limiter le traitement</li>
        <li><strong>Portabilité</strong> : récupérer vos données dans un format structuré</li>
        <li><strong>Opposition</strong> : vous opposer à un traitement</li>
        <li><strong>Retrait du consentement</strong> : retirer votre consentement à tout moment (notamment pour la newsletter, depuis la page Préférences de notifications)</li>
      </ul>
      <Typography component="p">
        Pour exercer ces droits, contactez <a href="mailto:dpo@clenzy.fr">dpo@clenzy.fr</a>.
        Vous pouvez également déposer une réclamation auprès de la CNIL.
      </Typography>

      <Typography component="h2">7. Sécurité</Typography>
      <Typography component="p">
        Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour
        protéger vos données : chiffrement TLS en transit, hash des mots de passe, contrôles
        d'accès, audits de sécurité réguliers.
      </Typography>

      <Typography component="h2">8. Cookies</Typography>
      <Typography component="p">
        La plateforme utilise uniquement des cookies strictement nécessaires au
        fonctionnement du service (authentification, préférences d'interface). Aucun cookie
        publicitaire ou de tracking tiers n'est déposé.
      </Typography>

      <Typography component="h2">9. Modifications</Typography>
      <Typography component="p">
        La présente politique peut être mise à jour. La date de dernière modification est
        affichée en haut de cette page. Toute modification substantielle vous sera notifiée
        par email.
      </Typography>
    </LegalLayout>
  );
}
