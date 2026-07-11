package com.clenzy.repository;

import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Reservation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ReservationRepository extends JpaRepository<Reservation, Long> {

    /**
     * Séjours directs terminés éligibles au gain de crédit fidélité (2.8) : réservation directe,
     * confirmée, check-out passé (< cutoff). L'idempotence (déjà crédité) est vérifiée côté service.
     */
    @Query("SELECT r FROM Reservation r LEFT JOIN FETCH r.guest WHERE r.organizationId = :orgId "
        + "AND r.source = 'direct' AND r.status = 'confirmed' AND r.checkOut < :cutoff")
    List<Reservation> findLoyaltyEligible(@Param("orgId") Long orgId, @Param("cutoff") LocalDate cutoff);

    /**
     * Réservations directes d'un voyageur (re-booking 1-clic, 2.11) : matching par email guest +
     * org, source directe uniquement (les imports OTA ne sont pas re-réservables ici). Triées du
     * plus récent au plus ancien ; le service borne le nombre via {@link Pageable}.
     */
    @Query("SELECT r FROM Reservation r JOIN FETCH r.property LEFT JOIN FETCH r.guest "
        + "WHERE r.organizationId = :orgId AND r.source = 'direct' AND LOWER(r.guest.email) = :email "
        + "ORDER BY r.checkIn DESC")
    List<Reservation> findGuestDirectBookings(@Param("orgId") Long orgId, @Param("email") String email, Pageable pageable);

    @Query("SELECT r FROM Reservation r JOIN FETCH r.property LEFT JOIN FETCH r.guest WHERE r.property.id IN :propertyIds " +
           "AND r.checkOut >= :from AND r.checkIn <= :to AND r.hiddenFromPlanning = false AND r.organizationId = :orgId ORDER BY r.checkIn ASC")
    List<Reservation> findByPropertyIdsAndDateRange(
            @Param("propertyIds") List<Long> propertyIds,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("orgId") Long orgId);

    @Query("SELECT r FROM Reservation r JOIN FETCH r.property LEFT JOIN FETCH r.guest WHERE r.property.id = :propertyId " +
           "AND r.organizationId = :orgId ORDER BY r.checkIn ASC")
    List<Reservation> findByPropertyId(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    /**
     * Réservations chevauchant la fenêtre du dashboard overview — KPI financiers
     * (occupation, revenu, ADR, RevPAN). Org-scope strict, owner optionnel (HOST).
     * Sans join fetch : seules les bornes / statut / prix sont lues.
     */
    @Query("SELECT r FROM Reservation r WHERE r.organizationId = :orgId "
        + "AND (:ownerKc IS NULL OR r.property.owner.keycloakId = :ownerKc) "
        + "AND r.checkOut >= :from AND r.checkIn < :toExclusive")
    List<Reservation> findOverlappingWindowForDashboard(
            @Param("from") LocalDate from,
            @Param("toExclusive") LocalDate toExclusive,
            @Param("orgId") Long orgId,
            @Param("ownerKc") String ownerKc);

    /**
     * Compteur « paiements en attente » du dashboard : réservations DIRECTES non
     * annulées avec paiement PENDING et montant dû. Les réservations OTA sont
     * exclues (déjà réglées sur le canal — affichées « Payé » côté PMS).
     */
    @Query("SELECT COUNT(r) FROM Reservation r WHERE r.organizationId = :orgId "
        + "AND (:ownerKc IS NULL OR r.property.owner.keycloakId = :ownerKc) "
        + "AND r.source = 'direct' AND r.status <> 'cancelled' "
        + "AND r.paymentStatus = :pendingStatus AND r.totalPrice > 0")
    long countDirectPendingPaymentsForDashboard(
            @Param("orgId") Long orgId,
            @Param("ownerKc") String ownerKc,
            @Param("pendingStatus") PaymentStatus pendingStatus);

    /**
     * Réservations d'un LOT de logements chevauchant la fenêtre — agrégats de
     * performance (PropertyPerformanceService). Volontairement SANS join fetch
     * (seules les bornes/statut/prix sont lues) : remplace l'appel
     * {@link #findByPropertyId} par logement (N+1, entités complètes hydratées).
     */
    @Query("SELECT r FROM Reservation r WHERE r.property.id IN :propertyIds AND r.organizationId = :orgId " +
           "AND r.checkOut >= :from AND r.checkIn < :toExclusive")
    List<Reservation> findByPropertyIdsOverlappingWindow(
            @Param("propertyIds") List<Long> propertyIds,
            @Param("from") LocalDate from,
            @Param("toExclusive") LocalDate toExclusive,
            @Param("orgId") Long orgId);

    /**
     * Recherche par nom de guest ou de logement (autocomplete rattachement
     * « à trier » → réservation). Pas de filtre org explicite : réservé au
     * platform staff (cross-org) ; le filtre tenant Hibernate s'applique pour
     * les autres rôles.
     */
    @Query("SELECT r FROM Reservation r LEFT JOIN FETCH r.property LEFT JOIN FETCH r.guest " +
           "WHERE LOWER(r.guestName) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "OR LOWER(r.property.name) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "ORDER BY r.checkIn DESC")
    List<Reservation> searchByGuestOrProperty(@Param("q") String q, Pageable pageable);

    @Query("SELECT r FROM Reservation r JOIN FETCH r.property LEFT JOIN FETCH r.guest WHERE r.property.owner.id = :ownerId " +
           "AND r.checkOut >= :from AND r.checkIn <= :to AND r.organizationId = :orgId ORDER BY r.checkIn ASC")
    List<Reservation> findByOwnerIdAndDateRange(
            @Param("ownerId") Long ownerId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("orgId") Long orgId);

    @Query("SELECT r FROM Reservation r JOIN FETCH r.property LEFT JOIN FETCH r.guest WHERE r.property.owner.keycloakId = :keycloakId " +
           "AND r.checkOut >= :from AND r.checkIn <= :to AND r.hiddenFromPlanning = false AND r.organizationId = :orgId ORDER BY r.checkIn ASC")
    List<Reservation> findByOwnerKeycloakIdAndDateRange(
            @Param("keycloakId") String keycloakId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("orgId") Long orgId);

    @Query("SELECT r FROM Reservation r JOIN FETCH r.property LEFT JOIN FETCH r.guest " +
           "WHERE r.checkOut >= :from AND r.checkIn <= :to AND r.hiddenFromPlanning = false AND r.organizationId = :orgId ORDER BY r.checkIn ASC")
    List<Reservation> findAllByDateRange(
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("orgId") Long orgId);

    @Query("SELECT r FROM Reservation r JOIN FETCH r.property LEFT JOIN FETCH r.guest LEFT JOIN FETCH r.intervention WHERE r.id = :id")
    Optional<Reservation> findByIdFetchAll(@Param("id") Long id);

    Optional<Reservation> findByExternalUidAndPropertyId(String externalUid, Long propertyId);

    boolean existsByExternalUidAndPropertyId(String externalUid, Long propertyId);

    @Query("SELECT COUNT(r) FROM Reservation r WHERE r.property.id = :propertyId AND r.organizationId = :orgId")
    long countByPropertyId(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    /** Nombre de réservations par propriété (batch, preuve sociale honnête 2.9 — évite le N+1). */
    @Query("SELECT r.property.id, COUNT(r) FROM Reservation r WHERE r.property.id IN :propertyIds AND r.organizationId = :orgId GROUP BY r.property.id")
    List<Object[]> countByPropertyIds(@Param("propertyIds") List<Long> propertyIds, @Param("orgId") Long orgId);

    /**
     * Total moyen des réservations passées d'une propriété (org-scopé) — baseline du signal « montant
     * atypique » du scoring de fraude (P2). {@code null} si aucune réservation avec un total. La moyenne
     * porte sur le total <b>déjà persisté côté serveur</b> ({@code totalPrice}) — jamais un montant client.
     */
    @Query("SELECT AVG(r.totalPrice) FROM Reservation r WHERE r.property.id = :propertyId "
        + "AND r.organizationId = :orgId AND r.totalPrice IS NOT NULL")
    BigDecimal averageTotalPriceByProperty(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);

    /**
     * Reservations confirmees avec check-in dans la plage donnee.
     * Utilise par le balayage du hub d'automatisation (AutomationSchedulerService)
     * pour les regles de cycle de vie (messages check-in, etc.).
     */
    @Query("SELECT r FROM Reservation r JOIN FETCH r.property LEFT JOIN FETCH r.guest " +
           "WHERE r.checkIn BETWEEN :from AND :to " +
           "AND r.status = 'confirmed' AND r.organizationId = :orgId")
    List<Reservation> findConfirmedByCheckInRange(
        @Param("from") LocalDate from,
        @Param("to") LocalDate to,
        @Param("orgId") Long orgId);

    /**
     * Reservation pertinente d'un livret : sejour actif OU prochaine reservation a venir
     * (checkOut >= date), la plus proche en premier. Le premier element = la reservation a
     * lier au livret d'accueil. Liste vide entre deux sejours.
     *
     * Statut : toute reservation NON annulee. Les reservations OTA importees via iCal
     * (Airbnb, Booking, Vrbo...) ont le statut "pending" par defaut — les OTA ne fournissent
     * pas de propriete STATUS dans l'iCal (cf. ICalImportService.setStatus). Filtrer sur
     * "confirmed" excluait donc TOUTES les reservations de channel, rendant le livret non
     * creable malgre un sejour en cours. Les valeurs de statut sont normalisees en minuscules
     * (cf. ICalEventParser), donc la comparaison litterale est sure.
     */
    @Query("SELECT r FROM Reservation r JOIN FETCH r.property LEFT JOIN FETCH r.guest " +
           "WHERE r.property.id = :propertyId AND r.checkOut >= :date " +
           "AND r.status <> 'cancelled' AND r.organizationId = :orgId ORDER BY r.checkIn ASC")
    List<Reservation> findCurrentOrNextByPropertyId(
        @Param("propertyId") Long propertyId,
        @Param("date") LocalDate date,
        @Param("orgId") Long orgId);

    /**
     * Réservations d'une propriété dont la date de départ tombe dans [from, to] (non annulées),
     * la plus récente d'abord. Utilisé par la rotation auto du code d'accès après checkout.
     */
    @Query("SELECT r FROM Reservation r JOIN FETCH r.property " +
           "WHERE r.property.id = :propertyId AND r.checkOut >= :from AND r.checkOut <= :to " +
           "AND r.status <> 'cancelled' AND r.organizationId = :orgId ORDER BY r.checkOut DESC")
    List<Reservation> findRecentCheckoutsByProperty(
        @Param("propertyId") Long propertyId,
        @Param("from") LocalDate from,
        @Param("to") LocalDate to,
        @Param("orgId") Long orgId);

    /**
     * Reservation active (en cours) pour une propriete a une date donnee.
     * Utilise par NoiseAlertNotificationService pour envoyer un message au voyageur.
     */
    @Query("SELECT r FROM Reservation r JOIN FETCH r.property LEFT JOIN FETCH r.guest " +
           "WHERE r.property.id = :propertyId " +
           "AND r.checkIn <= :date AND r.checkOut >= :date " +
           "AND r.status = 'confirmed' AND r.organizationId = :orgId")
    Optional<Reservation> findActiveByPropertyIdAndDate(
        @Param("propertyId") Long propertyId,
        @Param("date") LocalDate date,
        @Param("orgId") Long orgId);

    /**
     * Reservations confirmees avec check-out dans la plage donnee.
     */
    @Query("SELECT r FROM Reservation r JOIN FETCH r.property LEFT JOIN FETCH r.guest " +
           "WHERE r.checkOut BETWEEN :from AND :to " +
           "AND r.status = 'confirmed' AND r.organizationId = :orgId")
    List<Reservation> findConfirmedByCheckOutRange(
        @Param("from") LocalDate from,
        @Param("to") LocalDate to,
        @Param("orgId") Long orgId);

    /**
     * Reservations liees a des interventions (via intervention_id FK).
     * Utilise par le planning pour rattacher visuellement les interventions menage au checkout.
     */
    /**
     * Reservations annulees non masquees qui chevauchent une plage de dates sur une propriete.
     * Utilise par ICalImportService pour auto-masquer les annulees lors d'un nouvel import.
     */
    @Query("SELECT r FROM Reservation r WHERE r.property.id = :propertyId " +
           "AND r.status = 'cancelled' AND r.hiddenFromPlanning = false " +
           "AND r.checkOut > :checkIn AND r.checkIn < :checkOut " +
           "AND r.organizationId = :orgId")
    List<Reservation> findCancelledOverlapping(
            @Param("propertyId") Long propertyId,
            @Param("checkIn") LocalDate checkIn,
            @Param("checkOut") LocalDate checkOut,
            @Param("orgId") Long orgId);

    @Query("SELECT r FROM Reservation r WHERE r.intervention.id IN :interventionIds AND r.organizationId = :orgId")
    List<Reservation> findByInterventionIdIn(
        @Param("interventionIds") List<Long> interventionIds,
        @Param("orgId") Long orgId);

    /**
     * Compte les reservations dont le guestName commence par un prefix donne, sur une propriete.
     * Utilise par ICalImportService pour incrementer les noms generiques (Reserved #1, #2...).
     */
    @Query("SELECT COUNT(r) FROM Reservation r WHERE r.guestName LIKE CONCAT(:prefix, '%') " +
           "AND r.property.id = :propertyId AND r.organizationId = :orgId")
    long countByGuestNameStartingWithAndPropertyId(
            @Param("prefix") String prefix,
            @Param("propertyId") Long propertyId,
            @Param("orgId") Long orgId);

    /**
     * Toutes les reservations liees a un guest.
     * Utilise par GuestService.recalculateAllStats pour recalculer les compteurs.
     */
    List<Reservation> findByGuestId(Long guestId);

    // ─── Booking Engine (public) ────────────────────────────────────────────────

    /**
     * Trouve une reservation par son code de confirmation et organisation.
     * Utilise par le Booking Engine public pour checkout et confirmation.
     */
    @Query("SELECT r FROM Reservation r JOIN FETCH r.property LEFT JOIN FETCH r.guest " +
           "WHERE r.confirmationCode = :code AND r.organizationId = :orgId")
    Optional<Reservation> findByConfirmationCodeAndOrganizationId(
        @Param("code") String code,
        @Param("orgId") Long orgId);

    /**
     * Reservations PENDING expirees (non payees apres le delai).
     * Utilise par un scheduler pour annuler automatiquement les reservations abandonnees.
     */
    @Query("SELECT r FROM Reservation r JOIN FETCH r.property " +
           "WHERE r.status = 'pending' AND r.paymentStatus = com.clenzy.model.PaymentStatus.PENDING " +
           "AND r.createdAt < :cutoff")
    List<Reservation> findExpiredPendingReservations(@Param("cutoff") java.time.LocalDateTime cutoff);

    // ─── Payment queries ────────────────────────────────────────────────────────

    /**
     * Trouve une reservation par son stripeSessionId (sans orgId — utilise par le webhook Stripe).
     */
    @Query("SELECT r FROM Reservation r JOIN FETCH r.property WHERE r.stripeSessionId = :sessionId")
    Optional<Reservation> findByStripeSessionId(@Param("sessionId") String sessionId);

    /**
     * Historique des paiements de reservations (avec montant > 0).
     * Filtre optionnel par paymentStatus. Trie par createdAt DESC.
     */
    @Query("SELECT r FROM Reservation r JOIN FETCH r.property LEFT JOIN FETCH r.guest " +
           "WHERE r.totalPrice IS NOT NULL AND r.totalPrice > 0 " +
           "AND (:status IS NULL OR r.paymentStatus = :status) " +
           "AND r.organizationId = :orgId ORDER BY r.createdAt DESC")
    Page<Reservation> findPaymentHistory(
            @Param("status") PaymentStatus status,
            Pageable pageable,
            @Param("orgId") Long orgId);

    /**
     * Compte les reservations ayant un paiement (totalPrice > 0) pour le summary.
     */
    @Query("SELECT r FROM Reservation r " +
           "WHERE r.totalPrice IS NOT NULL AND r.totalPrice > 0 " +
           "AND r.organizationId = :orgId")
    List<Reservation> findAllWithPayment(@Param("orgId") Long orgId);

    /**
     * Reservations RESERVEES (non annulees, tous statuts sauf 'cancelled' : confirmed
     * / checked_in / checked_out) dont le check-in tombe dans [from, to], pour l'org.
     * Utilise par le widget « Revenus par canal » : on veut le revenu RESERVE par
     * canal — y compris les resas iCal/manuelles SANS flag paymentStatus=PAID (le
     * flux iCal ne transporte pas l'info de paiement) et les sejours passes
     * (checked_out).
     * (Distinct de findConfirmedByCheckInRange ci-dessus, strict status='confirmed'.)
     */
    @Query("SELECT r FROM Reservation r WHERE r.checkIn >= :from AND r.checkIn <= :to "
         + "AND r.status <> 'cancelled' "
         + "AND r.hiddenFromPlanning = false AND r.organizationId = :orgId")
    List<Reservation> findBookedByCheckInRange(
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("orgId") Long orgId);

    /**
     * Reservations actives (non annulees) importees depuis un feed iCal donne.
     * Utilise par ICalImportService pour detecter les reservations orphelines
     * (presentes en DB mais disparues du feed = annulees cote OTA).
     */
    @Query("SELECT r FROM Reservation r WHERE r.icalFeed.id = :feedId " +
           "AND r.status <> 'cancelled' AND r.organizationId = :orgId")
    List<Reservation> findActiveByICalFeedId(
            @Param("feedId") Long feedId,
            @Param("orgId") Long orgId);
}
