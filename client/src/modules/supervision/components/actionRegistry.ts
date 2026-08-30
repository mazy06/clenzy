/* ============================================================
   actionRegistry — une entrée par type d'action, et rien d'autre

   AVANT : quatre modales, cinq prédicats, trois listes de types et deux
   catalogues de textes. Ajouter un type demandait de toucher quatre fichiers,
   et rien ne le rappelait — j'ai moi-même inscrit RELODGE_TRANSFER dans deux
   familles à la fois, faute qu'un test a rattrapée mais que la structure
   autorisait.

   ICI : chaque type déclare SA famille, une seule fois. L'appartenance à deux
   familles devient impossible à écrire, au lieu d'être seulement détectable.

   Un type absent du registre garde son geste direct : c'est le comportement
   sûr, et il vaut mieux qu'une modale vide de sens.
   ============================================================ */

// ─── Familles ────────────────────────────────────────────────────────────────

/**
 * Ce que la modale a réellement à faire.
 *
 * - `schedule`   : quand, et par qui — date et intervenant.
 * - `choice`     : trancher entre des candidats réels que le serveur fournit.
 * - `params`     : régler des valeurs que l'agent avait devinées.
 * - `review`     : relire ce qui part vers un tiers avant que ça parte.
 * - `confirm`    : rien à choisir, mais l'effet engage — dire la conséquence.
 * - `informative`: rendre compte d'une action DÉJÀ faite. Le bouton ferme, il
 *                  n'exécute rien.
 */
export type ModalFamily =
  | 'schedule'
  | 'choice'
  | 'params'
  | 'review'
  | 'confirm'
  | 'informative'
  /**
   * `inspection` : examiner des PIÈCES rendues, puis trancher dans un sens ou
   * dans l'autre. Deux issues, pas une — c'est ce qui la distingue de
   * `confirm`, où refuser revient simplement à ne rien faire.
   */
  | 'inspection';

// ─── Confirmation ────────────────────────────────────────────────────────────

/**
 * Gravité, qui décide du traitement visuel ET du garde-fou.
 *
 * - `standard`     : l'action se défait depuis un écran.
 * - `engaging`     : de l'argent bouge, ou quelque chose sort vers un tiers.
 * - `irreversible` : rien ne se rattrape. Le mot de confirmation doit être SAISI.
 */
export type ConfirmSeverity = 'standard' | 'engaging' | 'irreversible';

export interface ConfirmSpec {
  consequences: Array<{ key: string; fallback: string }>;
  severity: ConfirmSeverity;
  /**
   * Le montant affiché par la carte est un instantané du scan. Le serveur le
   * recalcule à l'exécution : quand c'est vrai, on le DIT.
   */
  amountIsRecomputed?: boolean;
}

// ─── Paramètres ──────────────────────────────────────────────────────────────

export type ParamFieldKind = 'integer' | 'percent' | 'date' | 'time' | 'boolean' | 'text';

export interface ParamField {
  /** Clé envoyée au serveur — celle que l'exécuteur lit. */
  name: string;
  kind: ParamFieldKind;
  labelKey: string;
  labelFallback: string;
  hintKey?: string;
  hintFallback?: string;
  min?: number;
  max?: number;
  /** Valeur de repli si la carte n'en porte pas. */
  fallback?: number | string | boolean;
  /** Champ facultatif : vide ne bloque pas la validation. */
  optional?: boolean;
}

export interface ParamsSpec {
  /** Ce que l'action va produire, en une phrase. */
  leadKey: string;
  leadFallback: string;
  fields: ParamField[];
}

// ─── Entrée du registre ──────────────────────────────────────────────────────

export interface ActionEntry {
  family: ModalFamily;
  titleKey: string;
  titleFallback: string;
  /** Libellé du bouton d'engagement. Nomme l'acte, jamais « Confirmer ». */
  ctaKey: string;
  ctaFallback: string;
  confirm?: ConfirmSpec;
  params?: ParamsSpec;
  /**
   * Ce type a son PROPRE éditeur, plus riche qu'une modale générique.
   *
   * <p>Son entrée existe quand même : titre, verbe et conséquences sont du
   * texte métier, et les tenir en deux endroits les ferait diverger. Seul
   * l'aiguillage change — {@link opensModal} rend {@code false}, et la carte
   * continue d'ouvrir son éditeur.</p>
   */
  editor?: true;
}

const c = (key: string, fallback: string) => ({ key, fallback });

// ─── Le registre ─────────────────────────────────────────────────────────────

export const ACTION_REGISTRY: Record<string, ActionEntry> = {
  // ── Planification : quand, et par qui ─────────────────────────────────────
  LOCK_BATTERY_REPLACE: {
    family: 'schedule',
    titleKey: 'supervision.schedule.title',
    titleFallback: 'Planifier l’intervention',
    ctaKey: 'supervision.verbs.schedule',
    ctaFallback: 'Planifier',
  },
  PREVENTIVE_MAINTENANCE: {
    family: 'schedule',
    titleKey: 'supervision.schedule.title',
    titleFallback: 'Planifier l’intervention',
    ctaKey: 'supervision.verbs.schedule',
    ctaFallback: 'Planifier',
  },

  // ── Éditeurs dédiés : la carte ouvre leur écran, pas une modale générique ──
  PRICE_DROP: {
    family: 'params',
    editor: true,
    titleKey: 'supervision.price.title',
    titleFallback: 'Ajuster les tarifs',
    ctaKey: 'supervision.price.apply',
    ctaFallback: 'Appliquer les tarifs',
    confirm: {
      severity: 'standard',
      consequences: [
        c('supervision.price.c1', 'Les nuits des plages retenues changent de prix sur tous les canaux.'),
        c('supervision.price.c2', 'Les réservations déjà prises ne bougent pas.'),
        c('supervision.price.c3', 'Réversible depuis l’écran Tarification.'),
      ],
    },
  },
  REVIEW_DRAFT_REPLY: {
    family: 'review',
    editor: true,
    titleKey: 'supervision.reviewReply.title',
    titleFallback: 'Répondre à cet avis',
    ctaKey: 'supervision.reviewReply.cta',
    ctaFallback: 'Publier la réponse',
    confirm: {
      severity: 'engaging',
      consequences: [
        c('supervision.reviewReply.c1', 'La réponse est publiée sous l’avis, visible de tous.'),
        c('supervision.reviewReply.c2', 'Le brouillon proposé est modifiable : rien ne part sans votre relecture.'),
      ],
    },
  },

  // ── Examiner des pièces, puis trancher ────────────────────────────────────
  WORK_REVIEW: {
    family: 'inspection',
    titleKey: 'supervision.inspection.title',
    titleFallback: 'Contrôler le travail rendu',
    ctaKey: 'supervision.inspection.approve',
    ctaFallback: 'Valider le travail',
  },

  // ── Rendre compte : la modale n'exécute rien ──────────────────────────────
  ASSIGNMENT_RECAP: {
    family: 'informative',
    titleKey: 'supervision.recap.assignment.title',
    titleFallback: 'Mission confiée',
    ctaKey: 'supervision.recap.assignment.cta',
    ctaFallback: 'J’ai vu',
  },

  // ── Choix entre candidats réels ───────────────────────────────────────────
  REASSIGN_MANUAL: {
    family: 'choice',
    titleKey: 'supervision.choice.reassign.title',
    titleFallback: 'À qui confier cette demande',
    ctaKey: 'supervision.choice.reassign.cta',
    ctaFallback: 'Confier la mission',
  },
  QUOTE_APPROVAL: {
    family: 'choice',
    titleKey: 'supervision.choice.quote.title',
    titleFallback: 'Quel devis retenir',
    ctaKey: 'supervision.choice.quote.cta',
    ctaFallback: 'Retenir ce devis',
  },
  OVERBOOKING_RESOLVE: {
    family: 'choice',
    titleKey: 'supervision.choice.overbooking.title',
    titleFallback: 'Quelle réservation annuler',
    ctaKey: 'supervision.choice.overbooking.cta',
    ctaFallback: 'Annuler ce séjour',
  },
  RELODGE_TRANSFER: {
    family: 'choice',
    titleKey: 'supervision.choice.relodge.title',
    titleFallback: 'Vers quel logement reloger',
    ctaKey: 'supervision.choice.relodge.cta',
    ctaFallback: 'Proposer ce logement',
  },

  // ── Paramètres à régler ───────────────────────────────────────────────────
  CALENDAR_BLOCK: {
    family: 'params',
    titleKey: 'supervision.params.calendarBlock.title',
    titleFallback: 'Bloquer le calendrier',
    ctaKey: 'supervision.params.calendarBlock.cta',
    ctaFallback: 'Bloquer',
    params: {
      leadKey: 'supervision.params.calendarBlock.lead',
      leadFallback: 'Les nuits bloquées cessent d’être vendables, à partir d’aujourd’hui.',
      fields: [{
        name: 'days', kind: 'integer',
        labelKey: 'supervision.params.calendarBlock.days', labelFallback: 'Nombre de nuits',
        hintKey: 'supervision.params.calendarBlock.daysHint',
        hintFallback: 'Refusé si une nuit de la période est déjà réservée.',
        min: 1, max: 30, fallback: 7,
      }],
    },
  },
  PARITY_REPUBLISH: {
    family: 'params',
    titleKey: 'supervision.params.parityRepublish.title',
    titleFallback: 'Republier les tarifs',
    ctaKey: 'supervision.params.parityRepublish.cta',
    ctaFallback: 'Republier',
    params: {
      leadKey: 'supervision.params.parityRepublish.lead',
      leadFallback: 'Les tarifs de la fenêtre sont recalculés puis repoussés vers les canaux.',
      fields: [{
        name: 'days', kind: 'integer',
        labelKey: 'supervision.params.parityRepublish.days', labelFallback: 'Fenêtre, en jours',
        min: 1, max: 365, fallback: 30,
      }],
    },
  },
  GOODWILL_REFUND: {
    family: 'params',
    titleKey: 'supervision.params.goodwillRefund.title',
    titleFallback: 'Accorder un geste commercial',
    ctaKey: 'supervision.params.goodwillRefund.cta',
    ctaFallback: 'Rembourser',
    params: {
      leadKey: 'supervision.params.goodwillRefund.lead',
      leadFallback: 'Un remboursement partiel part vers le voyageur. Le montant est calculé sur le total du séjour.',
      fields: [{
        name: 'percent', kind: 'percent',
        labelKey: 'supervision.params.goodwillRefund.percent', labelFallback: 'Part remboursée',
        min: 1, max: 50, fallback: 15,
      }],
    },
  },
  YIELD_PRICE_ADJUST: {
    family: 'params',
    titleKey: 'supervision.params.yieldAdjust.title',
    titleFallback: 'Ajuster les tarifs',
    ctaKey: 'supervision.params.yieldAdjust.cta',
    ctaFallback: 'Ajuster',
    params: {
      leadKey: 'supervision.params.yieldAdjust.lead',
      leadFallback: 'Les prix sont recalculés sur la période, puis bornés par le plancher et le plafond du logement.',
      fields: [
        { name: 'from', kind: 'date', labelKey: 'supervision.params.from', labelFallback: 'Du' },
        { name: 'to', kind: 'date', labelKey: 'supervision.params.to', labelFallback: 'Au (exclu)' },
        {
          name: 'percent', kind: 'percent',
          labelKey: 'supervision.params.yieldAdjust.percent', labelFallback: 'Variation',
          hintKey: 'supervision.params.yieldAdjust.percentHint',
          hintFallback: 'Négatif pour baisser, positif pour augmenter.',
          min: -50, max: 50, fallback: -10,
        },
      ],
    },
  },
  MIN_STAY_RESTRICTION: {
    family: 'params',
    titleKey: 'supervision.params.minStay.title',
    titleFallback: 'Imposer un séjour minimum',
    ctaKey: 'supervision.params.minStay.cta',
    ctaFallback: 'Appliquer la restriction',
    params: {
      leadKey: 'supervision.params.minStay.lead',
      leadFallback: 'Les séjours plus courts que ce minimum ne seront plus réservables sur la période.',
      fields: [
        { name: 'from', kind: 'date', labelKey: 'supervision.params.from', labelFallback: 'Du' },
        { name: 'to', kind: 'date', labelKey: 'supervision.params.to', labelFallback: 'Au (exclu)' },
        {
          name: 'minNights', kind: 'integer',
          labelKey: 'supervision.params.minStay.nights', labelFallback: 'Nuits minimum',
          min: 2, max: 7, fallback: 2,
        },
        {
          name: 'weekendsOnly', kind: 'boolean',
          labelKey: 'supervision.params.minStay.weekendsOnly', labelFallback: 'Week-ends seulement',
          hintKey: 'supervision.params.minStay.weekendsOnlyHint',
          hintFallback: 'Sinon la restriction couvre toute la période.',
          fallback: true,
        },
      ],
    },
  },
  LATE_CHECKOUT_APPROVAL: {
    family: 'params',
    titleKey: 'supervision.params.lateCheckout.title',
    titleFallback: 'Accorder un départ tardif',
    ctaKey: 'supervision.params.lateCheckout.cta',
    ctaFallback: 'Accorder',
    params: {
      leadKey: 'supervision.params.lateCheckout.lead',
      leadFallback: 'La réponse part dans la conversation du voyageur et l’accord est tracé sur la réservation.',
      fields: [{
        name: 'requestedTime', kind: 'time',
        labelKey: 'supervision.params.lateCheckout.time', labelFallback: 'Heure accordée',
        hintKey: 'supervision.params.lateCheckout.timeHint',
        hintFallback: 'Le calendrier est revérifié : refusé si une arrivée est prévue ce jour-là.',
        fallback: '14:00',
      }],
    },
  },
  LINEN_STOCK_ORDER: {
    family: 'params',
    titleKey: 'supervision.params.stockOrder.title',
    titleFallback: 'Commander le réassort',
    ctaKey: 'supervision.params.stockOrder.cta',
    ctaFallback: 'Commander',
    params: {
      leadKey: 'supervision.params.stockOrder.lead',
      leadFallback: 'Un bon de commande part par email au fournisseur, avec l’adresse du logement.',
      fields: [{
        name: 'quantity', kind: 'integer',
        labelKey: 'supervision.params.stockOrder.quantity', labelFallback: 'Quantité',
        min: 1, max: 999,
      }],
    },
  },
  OWNER_STATEMENT_SEND: {
    family: 'params',
    titleKey: 'supervision.params.ownerStatement.title',
    titleFallback: 'Envoyer le relevé au propriétaire',
    ctaKey: 'supervision.params.ownerStatement.cta',
    ctaFallback: 'Envoyer',
    params: {
      leadKey: 'supervision.params.ownerStatement.lead',
      leadFallback: 'Le relevé est reconstruit depuis les reversements payés de la période, puis envoyé en PDF.',
      fields: [
        { name: 'from', kind: 'date', labelKey: 'supervision.params.from', labelFallback: 'Du' },
        { name: 'to', kind: 'date', labelKey: 'supervision.params.to', labelFallback: 'Au' },
      ],
    },
  },
  STAY_MODIFICATION: {
    family: 'params',
    titleKey: 'supervision.params.stayModification.title',
    titleFallback: 'Proposer un avenant au séjour',
    ctaKey: 'supervision.params.stayModification.cta',
    ctaFallback: 'Proposer',
    params: {
      leadKey: 'supervision.params.stayModification.lead',
      leadFallback:
        'Le voyageur reçoit une proposition chiffrée, valable 72 h. L’avenant ne s’applique qu’à son accord : disponibilité et tarif sont revérifiés à ce moment-là.',
      fields: [
        {
          name: 'newCheckIn', kind: 'date',
          labelKey: 'supervision.params.stayModification.checkIn', labelFallback: 'Nouvelle arrivée',
        },
        {
          name: 'newCheckOut', kind: 'date',
          labelKey: 'supervision.params.stayModification.checkOut', labelFallback: 'Nouveau départ',
          hintKey: 'supervision.params.stayModification.checkOutHint',
          hintFallback: 'Le nouveau total est calculé par le moteur tarifaire, jamais saisi ici.',
        },
      ],
    },
  },
  TAX_MARK_FILED: {
    family: 'params',
    titleKey: 'supervision.params.taxFiled.title',
    titleFallback: 'Enregistrer le dépôt',
    ctaKey: 'supervision.params.taxFiled.cta',
    ctaFallback: 'Enregistrer',
    params: {
      leadKey: 'supervision.params.taxFiled.lead',
      leadFallback:
        'Rien n’est télédéclaré : vous avez déposé vous-même, la carte enregistre le fait au registre.',
      fields: [
        {
          name: 'depositedOn', kind: 'date',
          labelKey: 'supervision.params.taxFiled.depositedOn', labelFallback: 'Date du dépôt',
          hintKey: 'supervision.params.taxFiled.depositedOnHint',
          hintFallback: 'La date à laquelle vous avez réellement déposé, pas celle d’aujourd’hui.',
        },
        {
          name: 'reference', kind: 'text',
          labelKey: 'supervision.params.taxFiled.reference', labelFallback: 'Référence du dépôt',
          hintKey: 'supervision.params.taxFiled.referenceHint',
          hintFallback: 'Le numéro remis par l’administration — vous seul l’avez.',
          fallback: '', optional: true,
        },
      ],
    },
  },

  // ── Relecture avant envoi ─────────────────────────────────────────────────
  PAYMENT_REMINDER: rev('supervision.review.paymentReminder', 'Relancer le paiement', 'Envoyer la relance'),
  GUIDE_SEND: rev('supervision.review.guideSend', 'Envoyer le livret d’accueil', 'Envoyer le livret'),
  REVIEW_REQUEST_SEND: rev('supervision.review.reviewRequest', 'Demander un avis', 'Envoyer la demande'),
  UPSELL_OFFER: rev('supervision.review.upsell', 'Proposer un service', 'Envoyer la proposition'),
  NOISE_WARNING_SEND: rev('supervision.review.noiseWarning', 'Avertir le voyageur', 'Envoyer l’avertissement'),
  OWNER_WORKS_APPROVAL: rev('supervision.review.ownerWorks', 'Demander l’accord du propriétaire', 'Envoyer la demande'),
  MANDATE_SIGN_SEND: rev('supervision.review.mandateSign', 'Envoyer le mandat en signature', 'Envoyer le mandat'),
  CART_RECOVERY_SEND: rev('supervision.review.cartRecovery', 'Relancer le panier abandonné', 'Envoyer la relance'),
  OWNER_REVENUE_NOTE: rev('supervision.review.revenueNote', 'Informer le propriétaire des revenus', 'Envoyer la note'),
  SITE_TRANSLATION_DRAFT: rev('supervision.review.siteTranslation', 'Traduire le site en brouillon', 'Générer les brouillons'),
  CHARGEBACK_SUBMIT: rev('supervision.review.chargeback', 'Déposer les preuves du litige', 'Déposer le dossier'),

  // ── Confirmation ──────────────────────────────────────────────────────────
  GDPR_ERASE: {
    family: 'confirm',
    titleKey: 'supervision.confirm.gdprErase.title',
    titleFallback: 'Effacer les données de ce voyageur',
    ctaKey: 'supervision.confirm.gdprErase.cta',
    ctaFallback: 'Effacer définitivement',
    confirm: {
      severity: 'irreversible',
      consequences: [
        c('supervision.confirm.gdprErase.c1', 'Son identité, ses coordonnées et le contenu de ses messages sont purgés.'),
        c('supervision.confirm.gdprErase.c2', 'Ses factures et ses fiches police sont conservées : la loi l’impose.'),
        c('supervision.confirm.gdprErase.c3', 'Rien ne se rattrape. Il n’existe pas de restauration.'),
      ],
    },
  },
  FRAUD_BLOCK: {
    family: 'confirm',
    titleKey: 'supervision.confirm.fraudBlock.title',
    titleFallback: 'Bloquer cette réservation',
    ctaKey: 'supervision.confirm.fraudBlock.cta',
    ctaFallback: 'Annuler la réservation',
    confirm: {
      severity: 'irreversible',
      consequences: [
        c('supervision.confirm.fraudBlock.c1', 'La réservation est annulée et les nuits repassent en vente.'),
        c('supervision.confirm.fraudBlock.c2', 'Les codes d’accès du voyageur sont révoqués.'),
        c('supervision.confirm.fraudBlock.c3', 'Le paiement en cours, s’il y en a un, est interrompu.'),
      ],
    },
  },
  DEPOSIT_WITHHOLD: {
    family: 'confirm',
    titleKey: 'supervision.confirm.depositWithhold.title',
    titleFallback: 'Retenir une part de la caution',
    ctaKey: 'supervision.confirm.depositWithhold.cta',
    ctaFallback: 'Retenir',
    confirm: {
      severity: 'engaging', amountIsRecomputed: true,
      consequences: [
        c('supervision.confirm.depositWithhold.c1', 'La somme est débitée de la caution du voyageur.'),
        c('supervision.confirm.depositWithhold.c2', 'Le montant est celui de l’intervention, plafonné par la caution.'),
      ],
    },
  },
  CLEANING_PAYOUT: {
    family: 'confirm',
    titleKey: 'supervision.confirm.cleaningPayout.title',
    titleFallback: 'Verser la rémunération de la mission',
    ctaKey: 'supervision.confirm.cleaningPayout.cta',
    ctaFallback: 'Verser',
    confirm: {
      severity: 'engaging', amountIsRecomputed: true,
      consequences: [
        c('supervision.confirm.cleaningPayout.c1', 'Le virement part vers le compte de l’intervenant.'),
        c('supervision.confirm.cleaningPayout.c2', 'La preuve photo et le compte de paiement sont revérifiés avant le versement.'),
      ],
    },
  },
  OWNER_PAYOUT: {
    family: 'confirm',
    titleKey: 'supervision.confirm.ownerPayout.title',
    titleFallback: 'Approuver le reversement au propriétaire',
    ctaKey: 'supervision.confirm.ownerPayout.cta',
    ctaFallback: 'Approuver',
    confirm: {
      severity: 'engaging', amountIsRecomputed: true,
      consequences: [
        c('supervision.confirm.ownerPayout.c1', 'Le reversement passe en « approuvé » et le propriétaire en est informé.'),
        c('supervision.confirm.ownerPayout.c2', 'Aucun virement n’est déclenché : il reste à faire depuis la banque.'),
      ],
    },
  },
  DEPOSIT_REFUND: {
    family: 'confirm',
    titleKey: 'supervision.confirm.depositRefund.title',
    titleFallback: 'Libérer la caution',
    ctaKey: 'supervision.confirm.depositRefund.cta',
    ctaFallback: 'Libérer',
    confirm: {
      severity: 'engaging', amountIsRecomputed: true,
      consequences: [
        c('supervision.confirm.depositRefund.c1', 'L’empreinte bancaire est annulée : le voyageur récupère sa capacité de paiement.'),
        c('supervision.confirm.depositRefund.c2', 'Aucun débit n’a lieu — la caution n’avait pas été encaissée.'),
      ],
    },
  },
  DEPOSIT_RELEASE: {
    family: 'confirm',
    titleKey: 'supervision.confirm.depositRelease.title',
    titleFallback: 'Libérer la caution après le départ',
    ctaKey: 'supervision.confirm.depositRelease.cta',
    ctaFallback: 'Libérer',
    confirm: {
      severity: 'engaging', amountIsRecomputed: true,
      consequences: [
        c('supervision.confirm.depositRelease.c1', 'L’empreinte bancaire est annulée : plus rien ne pourra être retenu.'),
        c('supervision.confirm.depositRelease.c2', 'À faire après avoir constaté l’état du logement.'),
      ],
    },
  },
  POLICE_DECLARE: {
    family: 'confirm',
    titleKey: 'supervision.confirm.policeDeclare.title',
    titleFallback: 'Télédéclarer les fiches',
    ctaKey: 'supervision.confirm.policeDeclare.cta',
    ctaFallback: 'Télédéclarer',
    confirm: {
      severity: 'engaging',
      consequences: [
        c('supervision.confirm.policeDeclare.c1', 'Les fiches complétées partent vers le portail officiel.'),
        c('supervision.confirm.policeDeclare.c2', 'Les fiches incomplètes ne partent pas et restent à compléter.'),
      ],
    },
  },
  CHANNEL_PUBLISH: {
    family: 'confirm',
    titleKey: 'supervision.confirm.channelPublish.title',
    titleFallback: 'Publier le logement sur ses canaux',
    ctaKey: 'supervision.confirm.channelPublish.cta',
    ctaFallback: 'Publier',
    confirm: {
      severity: 'engaging',
      consequences: [
        c('supervision.confirm.channelPublish.c1', 'Environ 500 jours de disponibilités et de tarifs sont poussés vers les canaux.'),
        c('supervision.confirm.channelPublish.c2', 'Les photos et la description suivent.'),
        c('supervision.confirm.channelPublish.c3', 'Le logement devient réservable côté canal. L’opération dure plusieurs minutes.'),
      ],
    },
  },
  NOSHOW_MARK: {
    family: 'confirm',
    titleKey: 'supervision.confirm.noshowMark.title',
    titleFallback: 'Marquer le séjour en non-présentation',
    ctaKey: 'supervision.confirm.noshowMark.cta',
    ctaFallback: 'Marquer',
    confirm: {
      severity: 'standard',
      consequences: [
        c('supervision.confirm.noshowMark.c1', 'Les nuits restantes repassent en vente. Les nuits passées ne bougent pas.'),
        c('supervision.confirm.noshowMark.c2', 'Rien n’est modifié côté paiement.'),
        c('supervision.confirm.noshowMark.c3', 'La déclaration au canal reste à faire à la main.'),
      ],
    },
  },
  PROMO_DEACTIVATE: {
    family: 'confirm',
    titleKey: 'supervision.confirm.promoDeactivate.title',
    titleFallback: 'Désactiver ce tarif promotionnel',
    ctaKey: 'supervision.confirm.promoDeactivate.cta',
    ctaFallback: 'Désactiver',
    confirm: {
      severity: 'standard',
      consequences: [
        c('supervision.confirm.promoDeactivate.c1', 'Le tarif cesse de s’appliquer aux nouvelles réservations.'),
        c('supervision.confirm.promoDeactivate.c2', 'Réactivable depuis l’écran Tarification.'),
      ],
    },
  },
  CONVERSATION_TAKEOVER: {
    family: 'confirm',
    titleKey: 'supervision.confirm.conversationTakeover.title',
    titleFallback: 'Reprendre la conversation',
    ctaKey: 'supervision.confirm.conversationTakeover.cta',
    ctaFallback: 'Reprendre',
    confirm: {
      severity: 'standard',
      consequences: [
        c('supervision.confirm.conversationTakeover.c1', 'Le fil vous est assigné.'),
        c('supervision.confirm.conversationTakeover.c2', 'Les réponses automatiques s’arrêtent : le voyageur vous attend.'),
      ],
    },
  },
  ICAL_RETRY: {
    family: 'confirm',
    titleKey: 'supervision.confirm.icalRetry.title',
    titleFallback: 'Relancer la synchronisation',
    ctaKey: 'supervision.confirm.icalRetry.cta',
    ctaFallback: 'Relancer',
    confirm: {
      severity: 'standard',
      consequences: [
        c('supervision.confirm.icalRetry.c1', 'Le calendrier distant est retéléchargé et réimporté.'),
        c('supervision.confirm.icalRetry.c2', 'Des réservations peuvent apparaître ou disparaître du planning.'),
      ],
    },
  },
  REASSIGN_CLEANING: {
    family: 'confirm',
    titleKey: 'supervision.confirm.reassignCleaning.title',
    titleFallback: 'Relancer la recherche d’un prestataire',
    ctaKey: 'supervision.confirm.reassignCleaning.cta',
    ctaFallback: 'Relancer la recherche',
    confirm: {
      severity: 'standard',
      consequences: [
        c('supervision.confirm.reassignCleaning.c1', 'La recherche automatique repart sur les équipes et prestataires disponibles.'),
        c('supervision.confirm.reassignCleaning.c2', 'Sans personne de libre, la demande reste sans suite : il faudra assigner à la main.'),
      ],
    },
  },

  /**
   * Règlement d'une demande de service.
   *
   * <p>Type porté par le FRONT, pas par le serveur : ces cartes n'ont pas
   * d'{@code actionType}, leur règlement passe par le flux de paiement de la
   * demande. L'entrée existe pour qu'elles cessent d'être la seule famille à
   * partir au clic — vers une fenêtre Stripe, qui plus est.</p>
   */
  SERVICE_REQUEST_SETTLE: {
    family: 'confirm',
    titleKey: 'supervision.payment.confirmTitle',
    titleFallback: 'Régler cette prestation',
    ctaKey: 'supervision.payment.settle',
    ctaFallback: 'Régler',
    confirm: {
      severity: 'engaging',
      consequences: [
        c('supervision.payment.c1', 'Une page de paiement sécurisée s’ouvre dans un nouvel onglet.'),
        c('supervision.payment.c2', 'Aucun débit tant que vous n’avez pas validé sur cette page.'),
        c('supervision.payment.c3', 'L’acompte éventuel est compris dans ce montant, jamais en plus.'),
      ],
    },
  },

  CLEANING_REQUEST: {
    family: 'confirm',
    titleKey: 'supervision.confirm.cleaningRequest.title',
    titleFallback: 'Planifier le ménage manquant',
    ctaKey: 'supervision.confirm.cleaningRequest.cta',
    ctaFallback: 'Créer la demande',
    confirm: {
      severity: 'standard',
      consequences: [
        c('supervision.confirm.cleaningRequest.c1', 'Une demande de ménage est créée pour le départ concerné.'),
        c('supervision.confirm.cleaningRequest.c2', 'La recherche d’un prestataire démarre aussitôt.'),
        c('supervision.confirm.cleaningRequest.c3', 'La date suit le départ : elle ne se choisit pas ici.'),
      ],
    },
  },
};

/** Entrée « relecture » — leur forme ne varie que par les libellés. */
function rev(prefix: string, title: string, cta: string): ActionEntry {
  return {
    family: 'review',
    titleKey: `${prefix}.title`,
    titleFallback: title,
    ctaKey: `${prefix}.cta`,
    ctaFallback: cta,
  };
}

// ─── Lecture ─────────────────────────────────────────────────────────────────

/** Famille de ce type, ou `null` s'il garde son geste direct. */
export function familyOf(actionType: string | undefined): ModalFamily | null {
  return ACTION_REGISTRY[actionType ?? '']?.family ?? null;
}

/** Entrée complète, ou `null`. */
export function entryOf(actionType: string | undefined): ActionEntry | null {
  return ACTION_REGISTRY[actionType ?? ''] ?? null;
}

/**
 * Vrai si le CTA de la carte doit ouvrir une modale GÉNÉRIQUE au lieu d'agir.
 *
 * <p>Faux pour les types à éditeur dédié : ils sont déclarés au registre pour
 * leurs textes, mais gardent leur propre écran, plus riche.</p>
 */
export function opensModal(actionType: string | undefined): boolean {
  const entry = entryOf(actionType);
  return entry !== null && entry.editor !== true;
}

/** Conséquences de ce type, où qu'il s'affiche — modale générique ou éditeur. */
export function consequencesOf(actionType: string | undefined): ConfirmSpec['consequences'] {
  return entryOf(actionType)?.confirm?.consequences ?? [];
}

/**
 * Valeurs initiales d'un formulaire : celles de la carte quand elle en porte,
 * sinon les replis du schéma. Montrer ce que l'agent avait proposé est le point
 * de départ ; le champ vide obligerait à deviner.
 */
export function initialValues(
  spec: ParamsSpec,
  actionParams: string | undefined,
): Record<string, number | string | boolean> {
  let carried: Record<string, unknown> = {};
  try {
    if (actionParams) carried = JSON.parse(actionParams) as Record<string, unknown>;
  } catch {
    /* params illisibles : on part des replis */
  }
  const values: Record<string, number | string | boolean> = {};
  for (const field of spec.fields) {
    const raw = carried[field.name];
    if (typeof raw === 'number' || typeof raw === 'string' || typeof raw === 'boolean') {
      values[field.name] = raw;
    } else if (field.fallback !== undefined) {
      values[field.name] = field.fallback;
    } else {
      values[field.name] = field.kind === 'boolean'
        ? false
        : field.kind === 'integer' || field.kind === 'percent' ? 0 : '';
    }
  }
  return values;
}
