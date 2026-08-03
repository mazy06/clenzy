package com.clenzy.service.agent.supervision;

/**
 * Types d'action exécutables portés par une suggestion de la constellation.
 *
 * <p>Une suggestion sans {@code actionType} reste informationnelle (l'opérateur
 * lit + rejette). Avec un type ci-dessous, la carte HITL propose « Appliquer »
 * → exécution serveur idempotente (cf. {@link SuggestionActionExecutor}).</p>
 */
public final class SupervisionActionType {

    /**
     * Baisse de tarif sur une plage : applique un override de prix par date
     * (prix courant résolu × (1 − percent)). Params : {@code from}, {@code to}
     * (ISO, {@code to} exclusif), {@code percent} (entier, ex. 12 = −12 %).
     */
    public static final String PRICE_DROP = "PRICE_DROP";

    /**
     * Remboursement de la caution d'une reservation ANNULEE (F2b) : libere le hold
     * Stripe (aucun debit). Params : {@code reservationId}, {@code depositId}
     * (indicatif). L'etat de la caution est RELU a l'apply — le montant affiche
     * dans la suggestion n'est jamais applique aveuglement (regle audit n°1).
     */
    public static final String DEPOSIT_REFUND = "DEPOSIT_REFUND";

    /**
     * Liberation de la caution encore retenue apres le depart (F4c). Meme effet
     * et memes garanties que {@link #DEPOSIT_REFUND} (hold Stripe annule,
     * transition CAS HELD → RELEASED, idempotency key deterministe).
     */
    public static final String DEPOSIT_RELEASE = "DEPOSIT_RELEASE";

    /**
     * Blocage du calendrier du logement apres incidents bruit (F6c). Params :
     * {@code days} (defaut 7, borne 1..30) — plage [aujourd'hui, aujourd'hui+days).
     * Refuse si des jours BOOKED existent dans la plage (CalendarEngine.block).
     */
    public static final String CALENDAR_BLOCK = "CALENDAR_BLOCK";

    /**
     * Ajustement yield v1 (F8a, mode SUGGEST) : applique un pourcentage SIGNE
     * ({@code percent} &lt; 0 = baisse, &gt; 0 = hausse) sur la plage
     * [{@code from}, {@code to}) — {@code ruleId} indicatif. Les prix sont
     * RE-resolus a l'apply et bornes par le plancher/plafond yield du bien
     * (regle audit n°1) ; cap « un apply par bien et par jour » via le journal
     * yield_adjustments (+ index unique partiel DB).
     */
    public static final String YIELD_PRICE_ADJUST = "YIELD_PRICE_ADJUST";

    /**
     * Planifie le menage manquant du depart de demain (agent Operations). Reutilise
     * {@code ServiceRequestService.createAutomaticCleaningRequest} (idempotent, org-validee,
     * ecriture DB uniquement). Params : {@code reservationId}, {@code checkIn}, {@code checkOut}
     * (ISO). N'est propose qu'aux logements en frequence AFTER_EACH_STAY (l'apply reussit alors
     * toujours) — cf. {@code CleaningBackfillScheduler.scanTomorrowCheckoutsMissingCleaning}.
     */
    public static final String CLEANING_REQUEST = "CLEANING_REQUEST";

    /**
     * Relance de paiement voyageur apres un echec (agent Finance). Regenere un lien
     * de paiement Stripe pour le solde du ({@code BookingBalanceService.createBalanceCheckoutUrl})
     * et l'envoie a l'email de paiement de la reservation. EFFET EXTERNE (Stripe + email) :
     * execute HORS transaction (regle audit n°2), compensation en cas d'echec. Params :
     * {@code reservationId}. L'email et le montant du sont RE-resolus a l'apply (regle audit n°1) ;
     * la carte n'est proposee que si un email de paiement est resoluble.
     */
    public static final String PAYMENT_REMINDER = "PAYMENT_REMINDER";

    /**
     * Génère un BROUILLON de réponse d'avis via LLM (agent Réputation, REP) et l'enregistre dans
     * {@code guest_reviews.host_response_draft} — JAMAIS publié automatiquement (l'opérateur valide,
     * édite, publie). EFFET EXTERNE (appel LLM) → exécuté hors transaction. Params : {@code reviewId}.
     */
    public static final String REVIEW_DRAFT_REPLY = "REVIEW_DRAFT_REPLY";

    /**
     * Relance la réassignation d'une demande de ménage dont le prestataire s'est
     * désisté (agent Operations). Réutilise {@code ServiceRequestService.attemptAutoAssign}
     * (écriture DB + notifications in-app uniquement) : « Appliquer » retente la
     * recherche d'équipe/prestataire disponible ; idempotent si la demande a été
     * réassignée entre-temps (scheduler 15 min). Params : {@code serviceRequestId}.
     */
    public static final String REASSIGN_CLEANING = "REASSIGN_CLEANING";

    /**
     * Relance la synchronisation d'un flux iCal en échec (agent Synchronisation, SYNC —
     * constellation métiers Phase 2). Re-télécharge et ré-importe le flux via
     * {@code ICalImportService.retryFeedForSupervision} (org re-validée contre le feed).
     * EFFET EXTERNE (fetch HTTP du calendrier distant) → exécuté hors transaction.
     * Params : {@code feedId}.
     */
    public static final String ICAL_RETRY = "ICAL_RETRY";

    /**
     * Republie les tarifs vers Channex après un écart de parité détecté (agent
     * Synchronisation, SYNC). Re-pousse l'ARI de la fenêtre de contrôle via
     * {@code ChannexSyncService.pushProperty} — les prix poussés sont RE-résolus par le
     * PriceEngine à l'apply (règle audit n°1). EFFET EXTERNE (HTTP Channex) → exécuté
     * hors transaction. Params : {@code days} (fenêtre depuis aujourd'hui, défaut 30).
     */
    public static final String PARITY_REPUBLISH = "PARITY_REPUBLISH";

    /**
     * Envoie l'avertissement de bruit au voyageur du séjour EN COURS (agent Opérations).
     * Réutilise {@code NoiseAlertNotificationService.sendGuestWarning} (WhatsApp Meta,
     * repli email, idempotence « 1 avertissement / séjour / 24 h »). L'org est re-validée
     * contre l'alerte. EFFET EXTERNE (WhatsApp/email) → exécuté hors transaction.
     * Params : {@code alertId}.
     */
    public static final String NOISE_WARNING_SEND = "NOISE_WARNING_SEND";

    /**
     * Envoie la relance d'un panier abandonné (agent Communication) pour les orgs SANS
     * relance automatique : l'agent propose, l'humain valide. Même chemin que le
     * scheduler (consentement RGPD re-vérifié, étape courante recalculée, compteur
     * avancé après envoi). EFFET EXTERNE (email) → exécuté hors transaction.
     * Params : {@code abandonedBookingId}.
     */
    public static final String CART_RECOVERY_SEND = "CART_RECOVERY_SEND";

    /**
     * Envoie le lien du livret d'accueil au voyageur qui arrive DEMAIN (agent Voyageur,
     * GST). Le lien (token borné à la réservation) est généré à l'apply via
     * {@code WelcomeGuideService.linkForReservation} — la carte n'est proposée que si un
     * livret PUBLIÉ existe. EFFET EXTERNE (email) → hors transaction.
     * Params : {@code reservationId}.
     */
    public static final String GUIDE_SEND = "GUIDE_SEND";

    /**
     * Envoie la demande d'avis post-séjour (agent Voyageur, GST) au voyageur parti la
     * veille : lien d'avis à durée bornée généré à l'apply via
     * {@code WelcomeGuideService.reviewLinkForReservation}. EFFET EXTERNE (email) →
     * hors transaction. Params : {@code reservationId}.
     */
    public static final String REVIEW_REQUEST_SEND = "REVIEW_REQUEST_SEND";

    /**
     * Débloque/relance le versement ménage d'une mission (agent Opérations). Réutilise
     * {@code HousekeeperPayoutService.retryPayout} : re-gate COMPLET à l'apply (preuve
     * photo, onboarding Connect, montants re-résolus depuis l'intervention — règle
     * audit n°1), verrou anti-double-versement par contrainte unique. EFFET EXTERNE
     * (transfert Stripe) → hors transaction. Params : {@code recordId}.
     */
    public static final String CLEANING_PAYOUT = "CLEANING_PAYOUT";

    /**
     * Bloque une réservation signalée à risque par le scoring de fraude (agent
     * Finance) : annulation via {@code ReservationService.cancel} (calendrier libéré,
     * codes d'accès révoqués, session Stripe ouverte expirée). REFUSÉ si la
     * réservation n'est plus au statut {@code pending} (déjà payée/confirmée → flux
     * de remboursement manuel). Params : {@code reservationId}.
     */
    public static final String FRAUD_BLOCK = "FRAUD_BLOCK";

    /**
     * Télédéclare les fiches police COMPLÉTÉES d'une réservation (agent Conformité).
     * Réutilise {@code ComplianceSubmissionService.submitForReservation} (stratégie par
     * provider — DGSN, fiche FR… ; provider non intégrable = tracé, retry possible).
     * EFFET EXTERNE (portail gouvernemental) → hors transaction. Params : {@code reservationId}.
     */
    public static final String POLICE_DECLARE = "POLICE_DECLARE";

    /**
     * Envoie le mandat de gestion en signature électronique (agent Conformité) :
     * génération du document si absent + lien de signature SES interne au propriétaire,
     * via {@code ContractSignatureService.requestSignature}. EFFET EXTERNE (email) →
     * hors transaction. Params : {@code contractId}.
     */
    public static final String MANDATE_SIGN_SEND = "MANDATE_SIGN_SEND";

    /**
     * Envoie le relevé mensuel au propriétaire (agent Propriétaire) pour les orgs SANS
     * automatisation OWNER_MONTHLY_STATEMENT : montants re-calculés depuis les
     * reversements PAID par {@code OwnerStatementService.sendStatement} (règle audit
     * n°1). EFFET EXTERNE (email + PDF) → hors transaction.
     * Params : {@code ownerId}, {@code from}, {@code to} (ISO).
     */
    public static final String OWNER_STATEMENT_SEND = "OWNER_STATEMENT_SEND";

    /**
     * Restriction de séjour minimum (agent Revenue, vague B) : écrit des
     * {@code min_nights_overrides} source {@code SUPERVISION_MIN_STAY} sur la fenêtre —
     * week-ends seulement si {@code weekendsOnly}. Les overrides d'AUTRES sources
     * (MANUAL, ORPHAN_GAP…) ne sont JAMAIS touchés. Réversible (suppression manuelle).
     * Params : {@code from}, {@code to} (ISO, exclusif, fenêtre ≤ 92 j),
     * {@code minNights} (2..7), {@code weekendsOnly} (bool, défaut true).
     */
    public static final String MIN_STAY_RESTRICTION = "MIN_STAY_RESTRICTION";

    /**
     * Désactive un rate plan promotionnel qui en cannibalise un autre (agent Revenue,
     * vague B) : {@code isActive = false}, réversible depuis l'écran Tarification.
     * Params : {@code ratePlanId}.
     */
    public static final String PROMO_DEACTIVATE = "PROMO_DEACTIVATE";

    /**
     * Propose un upsell au voyageur (agent Voyageur, vague B) : early check-in la
     * veille d'une arrivée sans départ le même jour, late checkout la veille d'un
     * départ sans arrivée le même jour. L'email envoyé porte l'offre (titre + prix) et
     * le lien du livret — l'ACHAT reste le flux Stripe existant du livret, jamais un
     * débit direct. EFFET EXTERNE (email) → hors transaction.
     * Params : {@code reservationId}, {@code offerId}.
     */
    public static final String UPSELL_OFFER = "UPSELL_OFFER";

    private SupervisionActionType() {}
}
