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
 * faisable en un clic.</p>
 *
 * <p>Deux gestes méritent d'être signalés parce qu'ils ne sont pas de simples
 * changements d'état : <b>confirmer une réservation</b> réserve les jours au
 * calendrier et échoue si les dates sont déjà prises ; <b>rejouer une
 * automatisation</b> ne réexécute que la règle en échec, et refait donc
 * réellement partir ce qui devait partir — un message déjà envoyé par ailleurs
 * arriverait une seconde fois. C'est pourquoi la décision reste humaine.</p>
 *
 * <p>Restent sans geste sur place <b>reconnecter une intégration</b> et
 * <b>terminer une vérification bancaire</b> : l'un comme l'autre passent par un
 * parcours externe qu'aucun bouton ne remplace.</p>
 */

export interface ActionCard {
  whatKey: string;
  what: string;
  consequenceKey: string;
  consequence: string;
  /**
   * Les gestes faits sur place. Plusieurs quand la situation admet plusieurs
   * issues légitimes — une intervention en retard peut avoir eu lieu, être
   * reportée, ou ne plus avoir lieu du tout.
   */
  gestures?: Gesture[];
  /** L'écran qui porte le sujet, quand il y a lieu d'y aller. */
  route?: string;
  linkKey?: string;
  link?: string;
}

export interface Gesture {
  /** Nom transmis au serveur, qui sait quel service le porte. */
  action: string;
  /** Le geste vise une équipe que l'utilisateur choisit dans la carte. */
  needsAssignee?: boolean;
  /** Le geste vise une date que l'utilisateur choisit dans la carte. */
  needsDate?: boolean;
  labelKey: string;
  label: string;
  doneKey: string;
  done: string;
  destructive?: boolean;
  /**
   * Ce que le geste déclenche au-delà du changement d'état, quand ce n'est pas
   * évident. Affiché avant le clic : terminer une intervention paie le
   * prestataire, et personne ne le devine depuis un bouton « Terminer ».
   */
  warnKey?: string;
  warn?: string;
}


export const ACTION_CARDS: Partial<Record<DashboardActionKind, ActionCard>> = {
  NOISE_ALERT_UNACKNOWLEDGED: {
    whatKey: 'dashboard.actionCard.noiseWhat',
    what: 'Un dépassement sonore a été mesuré dans le logement.',
    consequenceKey: 'dashboard.actionCard.noiseConsequence',
    consequence: 'Non traitée, c’est ce qui précède une plainte de voisinage — puis une amende dans certaines villes.',
    gestures: [{
      action: 'acknowledge',
      labelKey: 'dashboard.actionCard.acknowledge',
      label: 'Acquitter l’alerte',
      doneKey: 'dashboard.actionCard.acknowledged',
      done: 'Alerte acquittée.',
    }],
    route: '/properties?tab=connected-objects',
    linkKey: 'dashboard.guidance.seeDevices',
    link: 'Voir les objets connectés',
  },

  OWNER_PAYOUT_PENDING: {
    whatKey: 'dashboard.actionCard.payoutWhat',
    what: 'Un reversement est préparé mais personne ne l’a approuvé.',
    consequenceKey: 'dashboard.actionCard.payoutConsequence',
    consequence: 'Le propriétaire attend son virement, et rien ne partira tant que la décision manque.',
    gestures: [{
      action: 'approve',
      labelKey: 'dashboard.actionCard.approve',
      label: 'Approuver le reversement',
      doneKey: 'dashboard.actionCard.approved',
      done: 'Reversement approuvé — il partira au prochain versement.',
    }],
    route: '/billing?tab=payouts',
    linkKey: 'dashboard.guidance.seePayouts',
    link: 'Voir les reversements',
  },

  DEPOSIT_STUCK: {
    whatKey: 'dashboard.actionCard.depositWhat',
    what: 'La caution est encore retenue plusieurs jours après le départ.',
    consequenceKey: 'dashboard.actionCard.depositConsequence',
    consequence: 'L’argent du voyageur reste bloqué sur sa carte : c’est une réclamation qui arrive, puis un avis.',
    gestures: [{
      action: 'release',
      labelKey: 'dashboard.actionCard.release',
      label: 'Libérer la caution',
      doneKey: 'dashboard.actionCard.released',
      done: 'Caution libérée auprès du fournisseur de paiement.',
    }],
  },

  INVITATION_EXPIRED: {
    whatKey: 'dashboard.actionCard.invitationWhat',
    what: 'Le lien d’invitation a expiré sans être utilisé.',
    consequenceKey: 'dashboard.actionCard.invitationConsequence',
    consequence: 'La personne ne peut plus rejoindre l’organisation, et rien ne l’en avertit de son côté.',
    gestures: [{
      action: 'resendInvitation',
      labelKey: 'dashboard.actionCard.resendInvitation',
      label: 'Renvoyer l’invitation',
      doneKey: 'dashboard.actionCard.invitationResent',
      done: 'Nouvelle invitation envoyée, avec un nouveau délai.',
    }],
    route: '/directory',
    linkKey: 'dashboard.guidance.seeDirectory',
    link: 'Voir l’annuaire',
  },

  ISSUE_OPEN: {
    whatKey: 'dashboard.actionCard.issueWhat',
    what: 'Un signalement du terrain attend une décision.',
    consequenceKey: 'dashboard.actionCard.issueConsequence',
    consequence: 'Tant qu’il reste ouvert, le dégât constaté n’est ni réparé ni écarté — il est simplement oublié.',
    gestures: [{
      action: 'convert',
      labelKey: 'dashboard.actionCard.convert',
      label: 'Convertir en prestation',
      doneKey: 'dashboard.actionCard.converted',
      done: 'Prestation créée à partir du signalement.',
    }],
    route: '/interventions',
    linkKey: 'dashboard.guidance.seeInterventions',
    link: 'Voir les interventions',
  },

  OUTBOX_DEAD_LETTER: {
    whatKey: 'dashboard.actionCard.outboxWhat',
    what: 'Un message interne a épuisé toutes ses tentatives.',
    consequenceKey: 'dashboard.actionCard.outboxConsequence',
    consequence: 'Ses conséquences apparaissent ailleurs — un calendrier jamais prévenu, donc une double réservation possible.',
    gestures: [{
      action: 'replay',
      labelKey: 'dashboard.actionCard.replay',
      label: 'Remettre en file',
      doneKey: 'dashboard.actionCard.replayed',
      done: 'Message remis en file — il repartira dans quelques secondes.',
    }],
    route: '/admin/monitoring',
    linkKey: 'dashboard.guidance.seeMonitoring',
    link: 'Voir la supervision',
  },

  INTERVENTION_OVERDUE: {
    whatKey: 'dashboard.actionCard.interventionOverdueWhat',
    what: 'La date de cette intervention est passée et elle n’est toujours pas terminée.',
    consequenceKey: 'dashboard.actionCard.interventionOverdueConsequence',
    consequence: 'Le logement n’est peut-être pas prêt pour la prochaine arrivée, et personne n’a signalé pourquoi.',
    // Trois issues légitimes : le travail a eu lieu sans être saisi, il est
    // reporté, ou il n'aura pas lieu. Aucune n'est plus probable que les autres.
    gestures: [
      {
        action: 'complete',
        labelKey: 'dashboard.actionCard.complete',
        label: 'Marquer terminée',
        doneKey: 'dashboard.actionCard.completed',
        done: 'Intervention terminée.',
        // Personne ne devine cela depuis un bouton « Terminer ».
        warnKey: 'dashboard.actionCard.completeWarn',
        warn: 'Terminer déclenche le paiement du prestataire, sous réserve de la preuve photo.',
      },
      {
        action: 'rescheduleIntervention',
        needsDate: true,
        labelKey: 'dashboard.actionCard.reschedule',
        label: 'Replanifier',
        doneKey: 'dashboard.actionCard.rescheduled',
        done: 'Intervention replanifiée.',
      },
      {
        action: 'cancelIntervention',
        destructive: true,
        labelKey: 'dashboard.actionCard.cancelIntervention',
        label: 'Annuler',
        doneKey: 'dashboard.actionCard.cancelled',
        done: 'Intervention annulée.',
        warnKey: 'dashboard.actionCard.cancelWarn',
        warn: 'Réservé à l’équipe plateforme, et sans retour possible.',
      },
    ],
    route: '/interventions',
    linkKey: 'dashboard.guidance.seeInterventions',
    link: 'Voir les interventions',
  },

  GUEST_DECLARATION_MISSING: {
    whatKey: 'dashboard.actionCard.declarationWhat',
    what: 'Le séjour a eu lieu sans que la fiche voyageur (fiche de police, DGSN selon le pays du logement) soit remplie.',
    consequenceKey: 'dashboard.actionCard.declarationConsequence',
    consequence: 'Seul le voyageur peut la remplir, depuis son livret d’accueil : une fois le séjour passé, plus personne ne peut la déposer à sa place.',
    route: '/booking-engine',
    linkKey: 'dashboard.actionCard.seeGuestExperience',
    link: 'Ouvrir l’expérience voyageur',
  },

  CONVERSATION_UNANSWERED: {
    whatKey: 'dashboard.actionCard.conversationWhat',
    what: 'Le dernier message de cette conversation vient du voyageur.',
    consequenceKey: 'dashboard.actionCard.conversationConsequence',
    consequence: 'Un silence pendant un séjour se paie en avis, et c’est le reproche le plus fréquent dans les mauvaises notes.',
    route: '/contact',
    linkKey: 'dashboard.actionCard.seeMessaging',
    link: 'Ouvrir la messagerie',
  },

  WELCOME_GUIDE_MISSING: {
    whatKey: 'dashboard.actionCard.guideWhat',
    what: 'Aucun livret d’accueil publié pour ce logement, alors qu’une arrivée approche.',
    consequenceKey: 'dashboard.actionCard.guideConsequence',
    consequence: 'Le voyageur recevra un lien mort, et le code d’accès ne pourra pas lui être délivré.',
    route: '/booking-engine',
    linkKey: 'dashboard.actionCard.seeGuestExperience',
    link: 'Ouvrir l’expérience voyageur',
  },

  RESERVATION_PENDING: {
    whatKey: 'dashboard.actionCard.reservationWhat',
    what: 'Cette réservation n’a jamais été confirmée et l’arrivée approche.',
    consequenceKey: 'dashboard.actionCard.reservationConsequence',
    consequence: 'En attente, elle est exclue de tout le reste : ni ménage, ni message de séjour, ni solde réclamé.',
    gestures: [{
      action: 'confirm',
      labelKey: 'dashboard.actionCard.confirm',
      label: 'Confirmer la réservation',
      doneKey: 'dashboard.actionCard.confirmed',
      done: 'Réservation confirmée et jours réservés au calendrier.',
    }],
    route: '/reservations',
    linkKey: 'dashboard.guidance.seeReservations',
    link: 'Voir les réservations',
  },

  INTERVENTION_UNASSIGNED: {
    whatKey: 'dashboard.guidance.interventionUnassignedWhat',
    what: 'Aucune personne ni équipe n’est rattachée à cette intervention.',
    consequenceKey: 'dashboard.actionCard.interventionUnassignedConsequence',
    consequence: 'Le jour venu, personne ne se présentera — et on l’apprendra par le voyageur.',
    gestures: [{
      action: 'assign',
      needsAssignee: true,
      labelKey: 'dashboard.actionCard.assign',
      label: 'Assigner l’équipe',
      doneKey: 'dashboard.actionCard.assigned',
      done: 'Intervention assignée.',
    }],
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
    gestures: [{
      action: 'replayAutomation',
      labelKey: 'dashboard.actionCard.replayAutomation',
      label: 'Rejouer cette règle',
      doneKey: 'dashboard.actionCard.automationReplayed',
      done: 'Règle rejouée — vérifiez qu’elle a abouti cette fois.',
    }],
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

/**
 * Natures qui ouvrent une modale dédiée, écrite pour elles.
 *
 * <p>Déclarées ici pour qu'une vérification puisse s'assurer que <b>chaque</b>
 * nature ouvre quelque chose. Quatre d'entre elles ne le faisaient pas : on
 * cliquait, et rien ne se passait. L'aiguillage étant une suite de conditions
 * écrites à la main, rien ne le signalait.</p>
 */
export const DEDICATED_ACTION_KINDS: ReadonlySet<DashboardActionKind> = new Set([
  'PAYMENT_INCIDENT',
  'REVIEW_UNANSWERED',
  'BALANCE_DUE',
  'BALANCE_ABANDONED',
  'SERVICE_UNPAID',
  'SERVICE_UNASSIGNED',
  'FEED_STALE',
  'DEPOSIT_STUCK',
  'DOCUMENT_DELIVERY_FAILED',
  'GUEST_MESSAGE_FAILED',
]);
