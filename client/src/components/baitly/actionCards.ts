import type { DashboardActionKind } from '../../services/api/dashboardOperationsApi';

/**
 * Ce que dit et ce que propose la carte de chaque nature d'action.
 *
 * <p>Une table plutôt qu'une cascade de conditions : ajouter une nature est une
 * entrée, et une nature oubliée se voit immédiatement — la carte ne s'ouvre
 * pas, au lieu d'afficher un texte générique qui n'aide personne.</p>
 *
 * <p>Chaque entrée porte deux phrases dont la seconde compte le plus :
 * <b>ce qui s'est passé</b>, puis <b>ce que coûte l'inaction</b>. Sans la
 * seconde, rien ne distingue l'urgent du reste, et une file d'actions devient
 * une liste de reproches.</p>
 *
 * <p>Un {@link ActionCard#gesture} n'existe que là où le geste est réellement
 * faisable en un clic. Trois natures s'en passent délibérément :</p>
 *
 * <ul>
 *   <li><b>Confirmer une réservation</b> traverse le contrôle de conflits de
 *       calendrier — un simple changement de statut ouvrirait la porte à la
 *       surréservation.</li>
 *   <li><b>Rejouer une automatisation</b> réévalue <i>toutes</i> les règles du
 *       déclencheur, pas seulement celle qui a échoué : on renverrait des
 *       messages déjà partis.</li>
 *   <li><b>Reconnecter une intégration</b> ou <b>terminer une vérification
 *       bancaire</b> passe par un parcours externe qu'aucun bouton ne
 *       remplace.</li>
 * </ul>
 */

export interface ActionCard {
  whatKey: string;
  what: string;
  consequenceKey: string;
  consequence: string;
  /** Le geste fait sur place, quand il existe. */
  gesture?: {
    /** Nom transmis au serveur, qui sait quel service le porte. */
    action: string;
    labelKey: string;
    label: string;
    doneKey: string;
    done: string;
    destructive?: boolean;
  };
  /** L'écran qui porte le sujet, quand il y a lieu d'y aller. */
  route?: string;
  linkKey?: string;
  link?: string;
}

export const ACTION_CARDS: Partial<Record<DashboardActionKind, ActionCard>> = {
  NOISE_ALERT_UNACKNOWLEDGED: {
    whatKey: 'dashboard.actionCard.noiseWhat',
    what: 'Un dépassement sonore a été mesuré dans le logement.',
    consequenceKey: 'dashboard.actionCard.noiseConsequence',
    consequence: 'Non traitée, c’est ce qui précède une plainte de voisinage — puis une amende dans certaines villes.',
    gesture: {
      action: 'acknowledge',
      labelKey: 'dashboard.actionCard.acknowledge',
      label: 'Acquitter l’alerte',
      doneKey: 'dashboard.actionCard.acknowledged',
      done: 'Alerte acquittée.',
    },
    route: '/properties?tab=connected-objects',
    linkKey: 'dashboard.guidance.seeDevices',
    link: 'Voir les objets connectés',
  },

  OWNER_PAYOUT_PENDING: {
    whatKey: 'dashboard.actionCard.payoutWhat',
    what: 'Un reversement est préparé mais personne ne l’a approuvé.',
    consequenceKey: 'dashboard.actionCard.payoutConsequence',
    consequence: 'Le propriétaire attend son virement, et rien ne partira tant que la décision manque.',
    gesture: {
      action: 'approve',
      labelKey: 'dashboard.actionCard.approve',
      label: 'Approuver le reversement',
      doneKey: 'dashboard.actionCard.approved',
      done: 'Reversement approuvé — il partira au prochain versement.',
    },
    route: '/billing?tab=payouts',
    linkKey: 'dashboard.guidance.seePayouts',
    link: 'Voir les reversements',
  },

  DEPOSIT_STUCK: {
    whatKey: 'dashboard.actionCard.depositWhat',
    what: 'La caution est encore retenue plusieurs jours après le départ.',
    consequenceKey: 'dashboard.actionCard.depositConsequence',
    consequence: 'L’argent du voyageur reste bloqué sur sa carte : c’est une réclamation qui arrive, puis un avis.',
    gesture: {
      action: 'release',
      labelKey: 'dashboard.actionCard.release',
      label: 'Libérer la caution',
      doneKey: 'dashboard.actionCard.released',
      done: 'Caution libérée auprès du fournisseur de paiement.',
    },
  },

  INVITATION_EXPIRED: {
    whatKey: 'dashboard.actionCard.invitationWhat',
    what: 'Le lien d’invitation a expiré sans être utilisé.',
    consequenceKey: 'dashboard.actionCard.invitationConsequence',
    consequence: 'La personne ne peut plus rejoindre l’organisation, et rien ne l’en avertit de son côté.',
    gesture: {
      action: 'resendInvitation',
      labelKey: 'dashboard.actionCard.resendInvitation',
      label: 'Renvoyer l’invitation',
      doneKey: 'dashboard.actionCard.invitationResent',
      done: 'Nouvelle invitation envoyée, avec un nouveau délai.',
    },
    route: '/directory',
    linkKey: 'dashboard.guidance.seeDirectory',
    link: 'Voir l’annuaire',
  },

  ISSUE_OPEN: {
    whatKey: 'dashboard.actionCard.issueWhat',
    what: 'Un signalement du terrain attend une décision.',
    consequenceKey: 'dashboard.actionCard.issueConsequence',
    consequence: 'Tant qu’il reste ouvert, le dégât constaté n’est ni réparé ni écarté — il est simplement oublié.',
    gesture: {
      action: 'convert',
      labelKey: 'dashboard.actionCard.convert',
      label: 'Convertir en prestation',
      doneKey: 'dashboard.actionCard.converted',
      done: 'Prestation créée à partir du signalement.',
    },
    route: '/interventions',
    linkKey: 'dashboard.guidance.seeInterventions',
    link: 'Voir les interventions',
  },

  OUTBOX_DEAD_LETTER: {
    whatKey: 'dashboard.actionCard.outboxWhat',
    what: 'Un message interne a épuisé toutes ses tentatives.',
    consequenceKey: 'dashboard.actionCard.outboxConsequence',
    consequence: 'Ses conséquences apparaissent ailleurs — un calendrier jamais prévenu, donc une double réservation possible.',
    gesture: {
      action: 'replay',
      labelKey: 'dashboard.actionCard.replay',
      label: 'Remettre en file',
      doneKey: 'dashboard.actionCard.replayed',
      done: 'Message remis en file — il repartira dans quelques secondes.',
    },
    route: '/admin/monitoring',
    linkKey: 'dashboard.guidance.seeMonitoring',
    link: 'Voir la supervision',
  },

  // ─── Sans geste sur place, et c'est délibéré ──────────────────────────────

  RESERVATION_PENDING: {
    whatKey: 'dashboard.actionCard.reservationWhat',
    what: 'Cette réservation n’a jamais été confirmée et l’arrivée approche.',
    consequenceKey: 'dashboard.actionCard.reservationConsequence',
    consequence: 'En attente, elle est exclue de tout le reste : ni ménage, ni message de séjour, ni solde réclamé.',
    route: '/reservations',
    linkKey: 'dashboard.guidance.seeReservations',
    link: 'Voir les réservations',
  },

  INTERVENTION_UNASSIGNED: {
    whatKey: 'dashboard.guidance.interventionUnassignedWhat',
    what: 'Aucune personne ni équipe n’est rattachée à cette intervention.',
    consequenceKey: 'dashboard.actionCard.interventionUnassignedConsequence',
    consequence: 'Le jour venu, personne ne se présentera — et on l’apprendra par le voyageur.',
    route: '/interventions',
    linkKey: 'dashboard.guidance.seeInterventions',
    link: 'Voir les interventions',
  },

  INTERVENTION_UNPAID: {
    whatKey: 'dashboard.guidance.interventionUnpaidWhat',
    what: 'Le travail est fait, mais l’intervention reste bloquée faute de règlement.',
    consequenceKey: 'dashboard.actionCard.interventionUnpaidConsequence',
    consequence: 'Le prestataire attend son paiement, et l’intervention ne se clôturera pas d’elle-même.',
    route: '/interventions',
    linkKey: 'dashboard.guidance.seeInterventions',
    link: 'Voir les interventions',
  },

  CHECKIN_NOT_STARTED: {
    whatKey: 'dashboard.guidance.checkinWhat',
    what: 'Le voyageur arrive bientôt et n’a pas commencé son check-in en ligne.',
    consequenceKey: 'dashboard.actionCard.checkinConsequence',
    consequence: 'Sans ses pièces d’identité, la déclaration voyageur ne pourra pas être déposée dans les délais.',
    route: '/reservations',
    linkKey: 'dashboard.guidance.seeReservations',
    link: 'Voir les réservations',
  },

  PAYOUT_ONBOARDING_INCOMPLETE: {
    whatKey: 'dashboard.guidance.onboardingWhat',
    what: 'Le compte de paiement est raccordé, mais sa vérification n’a jamais été terminée.',
    consequenceKey: 'dashboard.actionCard.onboardingConsequence',
    consequence: 'Tout paraît configuré, et pourtant aucun versement ne partira jamais.',
    route: '/billing?tab=payouts',
    linkKey: 'dashboard.guidance.seePayouts',
    link: 'Voir les reversements',
  },

  EINVOICE_FAILED: {
    whatKey: 'dashboard.guidance.einvoiceWhat',
    what: 'L’administration fiscale a refusé la transmission de cette facture.',
    consequenceKey: 'dashboard.actionCard.einvoiceConsequence',
    consequence: 'L’obligation légale n’est pas remplie, et le client a pourtant sa facture entre les mains.',
    route: '/billing?tab=invoices',
    linkKey: 'dashboard.guidance.seeInvoices',
    link: 'Voir les factures',
  },

  AUTOMATION_FAILED: {
    whatKey: 'dashboard.guidance.automationWhat',
    what: 'Une automatisation a échoué : l’action promise n’a pas eu lieu.',
    consequenceKey: 'dashboard.actionCard.automationConsequence',
    consequence: 'Le produit affiche la règle comme active, et le voyageur n’a rien reçu.',
    route: '/automation-rules',
    linkKey: 'dashboard.guidance.seeAutomations',
    link: 'Voir les automatisations',
  },

  INTEGRATION_DISCONNECTED: {
    whatKey: 'dashboard.guidance.integrationWhat',
    what: 'La connexion est morte : jeton expiré, accès révoqué, ou erreur persistante.',
    consequenceKey: 'dashboard.actionCard.integrationConsequence',
    consequence: 'Tant qu’elle est muette, les disponibilités ne remontent plus — c’est la première cause de double réservation.',
    route: '/channels',
    linkKey: 'dashboard.guidance.seeChannels',
    link: 'Voir les canaux',
  },
};
