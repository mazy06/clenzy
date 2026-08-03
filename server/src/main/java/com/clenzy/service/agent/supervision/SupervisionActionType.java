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

    /**
     * Planifie le remplacement de batterie d'une serrure connectée (agent Opérations,
     * vague B) : crée l'intervention préventive via le chemin partagé avec
     * l'AutomationRule F7a (org re-validée, dédup par marqueur d'épisode, owner
     * requis). Écriture DB pure. Params : {@code deviceId}.
     */
    public static final String LOCK_BATTERY_REPLACE = "LOCK_BATTERY_REPLACE";

    /**
     * Planifie une tournée d'entretien préventif (agent Opérations, vague B) : aucun
     * entretien terminé depuis 11 mois → intervention PREVENTIVE_MAINTENANCE créée
     * (dédup par marqueur tant qu'une tournée est ouverte). Écriture DB pure.
     * Pas de param (le logement est celui de la carte).
     */
    public static final String PREVENTIVE_MAINTENANCE = "PREVENTIVE_MAINTENANCE";

    /**
     * Retenue partielle de caution après un dégât constaté AU DÉPART (agent Finance,
     * vague B) : capture Stripe via {@code SecurityDepositPaymentService.captureHold} —
     * le montant est RE-résolu à l'apply (coût de l'intervention, borné par la caution,
     * règle audit n°1), jamais celui affiché par la carte. EFFET EXTERNE (Stripe) →
     * hors transaction. Params : {@code depositId}, {@code interventionId}.
     */
    public static final String DEPOSIT_WITHHOLD = "DEPOSIT_WITHHOLD";

    /**
     * Geste commercial après un incident SUBI PENDANT le séjour (agent Finance,
     * vague B) : remboursement partiel via {@code ReservationRefundService.initiateRefund}
     * (motif GESTURE) — montant calculé et borné SERVEUR depuis le total de la
     * réservation. EFFET EXTERNE (Stripe) → hors transaction.
     * Params : {@code reservationId}, {@code percent} (1..50, défaut 15).
     */
    public static final String GOODWILL_REFUND = "GOODWILL_REFUND";

    /**
     * Approuve un reversement propriétaire en attente (agent Propriétaire, vague B) :
     * transition PENDING → APPROVED via {@code AccountingService.approvePayout}
     * (org validée, propriétaire et admins notifiés). Le VIREMENT reste le flux
     * bancaire existant (markAsPaid avec référence) — approuver n'exécute aucun
     * transfert. Écriture DB + notifications. Params : {@code payoutId}.
     */
    public static final String OWNER_PAYOUT = "OWNER_PAYOUT";

    /**
     * Demande l'accord du propriétaire pour des travaux à sa charge (agent
     * Propriétaire, vague B) : email récapitulatif (intitulé + coût estimé) adressé au
     * propriétaire du logement. EFFET EXTERNE (email) → hors transaction.
     * Params : {@code interventionId}.
     */
    public static final String OWNER_WORKS_APPROVAL = "OWNER_WORKS_APPROVAL";

    /**
     * Génère les BROUILLONS de traduction d'un site vitrine vers une langue activée
     * mais non couverte (agent Croissance, vague A tardive). Réutilise
     * {@code ContentTranslationService.autoTranslatePage} : variantes créées en DRAFT,
     * JAMAIS publiées automatiquement — la relecture et la publication restent dans le
     * Studio (même philosophie que REVIEW_DRAFT_REPLY). EFFET EXTERNE (LLM) → hors
     * transaction. Params : {@code siteId}, {@code targetLocale}.
     */
    public static final String SITE_TRANSLATION_DRAFT = "SITE_TRANSLATION_DRAFT";

    /**
     * Résout un chevauchement de réservations (agent Synchronisation, vague C) :
     * annule la réservation désignée par la carte via {@code ReservationService.cancel}
     * (calendrier libéré, codes révoqués, session Stripe expirée). REFUSÉ si le séjour
     * à annuler a déjà commencé, ou si la réservation à GARDER n'est plus active
     * (situation re-vérifiée à l'apply — la carte peut être périmée).
     * Params : {@code cancelReservationId}, {@code keepReservationId}.
     */
    public static final String OVERBOOKING_RESOLVE = "OVERBOOKING_RESOLVE";

    /**
     * Reprise en main HUMAINE d'une conversation chaude (agent Communication,
     * vague C) : assigne la conversation à l'opérateur qui valide la carte
     * ({@code assignedToKeycloakId} ← identité portée par {@code appliedBy}).
     * Écriture DB pure. Params : {@code conversationId}.
     */
    public static final String CONVERSATION_TAKEOVER = "CONVERSATION_TAKEOVER";

    /**
     * Note de revenus au propriétaire après un recul marqué (agent Propriétaire,
     * vague C) : email FACTUEL — revenus du mois vs même mois N−1, re-calculés à
     * l'apply depuis les réservations (règle audit n°1), renvoi au relevé mensuel
     * pour le détail. Devancer la question du propriétaire plutôt que la subir.
     * EFFET EXTERNE (email) → hors transaction. Params : {@code month} (YYYY-MM).
     */
    public static final String OWNER_REVENUE_NOTE = "OWNER_REVENUE_NOTE";

    /**
     * Trace le dépôt MANUEL de la déclaration de taxe de séjour au registre (agent
     * Conformité, vague M-A) : transition CAS DUE → FILED via
     * {@code TaxFilingService.markFiled}. Rien n'est télédéclaré — l'opérateur a
     * déposé lui-même, la carte enregistre le fait. Params : {@code filingId}.
     */
    public static final String TAX_MARK_FILED = "TAX_MARK_FILED";

    /**
     * Relogement d'un séjour vers un logement de repli (agent Voyageur, M11 v1) :
     * incident bloquant sur le logement × séjour en cours/imminent × repli libre.
     * L'apply délègue au chemin canonique {@code ReservationService.relodge}
     * (calendrier déplacé atomiquement — conflit = refus 409 —, ménage lié déplacé,
     * codes régénérés) puis INFORME le voyageur par email. Situation re-vérifiée à
     * l'apply, idempotent si déjà relogé. JAMAIS automatisable (engage le voyageur).
     * EFFET EXTERNE (email) → hors transaction.
     * Params : {@code reservationId}, {@code targetPropertyId}.
     */
    public static final String RELODGE_TRANSFER = "RELODGE_TRANSFER";

    /**
     * Marque un séjour en NO-SHOW (agent Synchronisation, M7) : flag + libération des
     * nuits restantes du calendrier ({@code CalendarEngine.cancel} — les nuits passées
     * sont passées, le financier n'est pas touché). La déclaration côté OTA reste
     * MANUELLE (aucune API branchée) — le motif de la carte le dit. Refus si le séjour
     * est annulé ou terminé ; idempotent si déjà marqué. Écriture DB pure.
     * Params : {@code reservationId}.
     */
    public static final String NOSHOW_MARK = "NOSHOW_MARK";

    /**
     * Dépose les preuves d'un litige bancaire à Stripe (agent Finance, M6) :
     * dossier assemblé depuis NOS données (séjour, fiche voyageur, livret transmis)
     * via {@code DisputeEvidenceService.submitEvidence} — CAS OPEN → SUBMITTED,
     * idempotency key stable (un re-apply retente sans doublon). Refus explicite si
     * déjà soumis/tranché. EFFET EXTERNE (API Stripe) → hors transaction.
     * Params : {@code disputeId}.
     */
    public static final String CHARGEBACK_SUBMIT = "CHARGEBACK_SUBMIT";

    /**
     * Approuve le devis recommandé d'une intervention (agent Opérations, M4) :
     * CAS RECEIVED → APPROVED via {@code ServiceQuoteService.approve} (unique partiel
     * DB, concurrents écartés, montant reporté sur l'intervention). La carte compare
     * les devis dans son motif ; « Ajuster » = fiche intervention. Écriture DB pure.
     * Params : {@code quoteId}.
     */
    public static final String QUOTE_APPROVAL = "QUOTE_APPROVAL";

    /**
     * Commande de réassort d'un consommable sous le seuil (agent Opérations, M5) :
     * bon de commande envoyé par email au fournisseur configuré (quantité de réappro,
     * adresse du logement). Quantités RE-lues à l'apply ; article repassé au-dessus du
     * seuil entre-temps → refus explicite. EFFET EXTERNE (email) → hors transaction.
     * Params : {@code stockItemId}.
     */
    public static final String LINEN_STOCK_ORDER = "LINEN_STOCK_ORDER";

    /**
     * Accorde un late check-out demandé par le voyageur (agent Communication, M8) :
     * détecté par intent LLM ({@code MessageIntent}), la carte n'existe que si le
     * calendrier le permet (aucune arrivée ni blocage le jour du départ) — condition
     * RE-vérifiée à l'apply (refus explicite sinon). L'apply envoie la réponse dans
     * la conversation (canal du fil) et trace l'accord dans les notes de la
     * réservation. EFFET EXTERNE (message sortant) → hors transaction.
     * Params : {@code conversationId}, {@code reservationId}, {@code requestedTime?}.
     */
    public static final String LATE_CHECKOUT_APPROVAL = "LATE_CHECKOUT_APPROVAL";

    /**
     * Répond CHIFFRÉ à une demande de modification de séjour (agent Voyageur, M8 v1) :
     * dates extraites de l'intent, disponibilité et différentiel tarifaire RE-calculés
     * à l'apply (dates prises entre-temps → refus explicite). v1 = accord de principe
     * envoyé dans la conversation, la modification effective reste manuelle (v2 M-D :
     * avenant automatisé calendrier + paiement). EFFET EXTERNE (message sortant).
     * Params : {@code conversationId}, {@code reservationId}, {@code newCheckIn},
     * {@code newCheckOut}.
     */
    public static final String STAY_MODIFICATION = "STAY_MODIFICATION";

    /**
     * Exécute l'effacement RGPD sélectif d'un voyageur (agent Conformité, M9) :
     * IRRÉVERSIBLE — identité, coordonnées et contenu des messages purgés ; factures
     * et fiches police CONSERVÉES (bases légales tracées dans le rapport persisté sur
     * la demande). Verrou CAS RECEIVED → IN_PROGRESS (jamais exécuté deux fois),
     * réservé à un opérateur humain identifié. Écritures DB pures.
     * Params : {@code requestId}.
     */
    public static final String GDPR_ERASE = "GDPR_ERASE";

    private SupervisionActionType() {}
}
