package com.clenzy.service;

import com.clenzy.dto.ICalImportDto.*;
import com.clenzy.model.*;
import com.clenzy.repository.ICalFeedRepository;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.InvoiceRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.model.NotificationKey;
import com.clenzy.service.ical.FeedUrlMasker;
import com.clenzy.service.ical.ICalFeedDownloader;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service de gestion de l'import iCal.
 * Parse les fichiers .ics (Airbnb, Booking, Vrbo, etc.)
 * et cree les interventions de menage correspondantes.
 * Le telechargement (validation SSRF + connexion epinglee anti DNS-rebinding)
 * est delegue a {@link ICalFeedDownloader}.
 */
@Service
public class ICalImportService {

    private static final Logger log = LoggerFactory.getLogger(ICalImportService.class);

    private static final Set<String> ALLOWED_FORFAITS = Set.of("confort", "premium");

    /**
     * Heures par defaut quand la propriete ne definit pas les siennes.
     * Utilisees a la fois pour la reservation importee ET pour la fenetre de
     * menage (guestCheckinTime) — les deux doivent rester alignees (T-BP-09).
     */
    private static final String DEFAULT_CHECK_IN_TIME = "15:00";
    private static final String DEFAULT_CHECK_OUT_TIME = "11:00";

    /**
     * Seuil d'avortement de la detection d'orphelins. Si la part des reservations
     * futures actives qui disparaitraient du feed depasse ce ratio, on n'annule
     * RIEN : un feed transitoirement tronque (HTTP 200 partiel, drop de parsing)
     * ne doit jamais declencher d'annulation en masse — l'annulation cascade
     * libere les jours (CalendarEngine -> sync sortante vers les autres canaux)
     * et n'est pas reversible automatiquement (pas de reactivation au retour de
     * l'UID). Valeur choisie : 20% — l'ancien seuil de 50% laissait s'annuler
     * jusqu'a la moitie du carnet de reservations sur un feed incomplet.
     */
    private static final double MAX_ORPHAN_RATIO = 0.20;

    private final ICalFeedRepository icalFeedRepository;
    private final ServiceRequestRepository serviceRequestRepository;
    private final ReservationRepository reservationRepository;
    private final InterventionRepository interventionRepository;
    private final InvoiceRepository invoiceRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;
    private final NotificationService notificationService;
    private final PricingConfigService pricingConfigService;
    private final PriceEngine priceEngine;
    private final CalendarEngine calendarEngine;
    private final GuestService guestService;
    private final TenantContext tenantContext;
    private final ServiceRequestService serviceRequestService;
    private final OtaReservationInvoicingService otaInvoicingService;
    private final ICalFeedDownloader feedDownloader;
    /** Proxy Spring de ce bean : permet a syncFeeds d'invoquer importICalFeed AVEC sa
     *  propre transaction (l'auto-invocation directe contournerait le proxy, T-BP-06). */
    private final ObjectProvider<ICalImportService> self;

    public ICalImportService(ICalFeedRepository icalFeedRepository,
                             ServiceRequestRepository serviceRequestRepository,
                             ReservationRepository reservationRepository,
                             InterventionRepository interventionRepository,
                             InvoiceRepository invoiceRepository,
                             PropertyRepository propertyRepository,
                             UserRepository userRepository,
                             AuditLogService auditLogService,
                             NotificationService notificationService,
                             PricingConfigService pricingConfigService,
                             PriceEngine priceEngine,
                             CalendarEngine calendarEngine,
                             GuestService guestService,
                             TenantContext tenantContext,
                             @org.springframework.context.annotation.Lazy ServiceRequestService serviceRequestService,
                             OtaReservationInvoicingService otaInvoicingService,
                             ICalFeedDownloader feedDownloader,
                             ObjectProvider<ICalImportService> self) {
        this.icalFeedRepository = icalFeedRepository;
        this.serviceRequestRepository = serviceRequestRepository;
        this.reservationRepository = reservationRepository;
        this.interventionRepository = interventionRepository;
        this.invoiceRepository = invoiceRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.auditLogService = auditLogService;
        this.notificationService = notificationService;
        this.pricingConfigService = pricingConfigService;
        this.priceEngine = priceEngine;
        this.calendarEngine = calendarEngine;
        this.guestService = guestService;
        this.tenantContext = tenantContext;
        this.serviceRequestService = serviceRequestService;
        this.otaInvoicingService = otaInvoicingService;
        this.feedDownloader = feedDownloader;
        this.self = self;
    }

    /**
     * Verifie que l'utilisateur a acces a l'import iCal.
     * Les ADMIN et MANAGER ont toujours acces.
     * Les HOST doivent avoir un forfait Confort ou Premium.
     */
    public boolean isUserAllowed(String keycloakId) {
        return userRepository.findByKeycloakId(keycloakId)
                .map(user -> {
                    // Admin et Manager : acces sans restriction de forfait
                    UserRole role = user.getRole();
                    if (role.isPlatformStaff()) {
                        return true;
                    }
                    // Host et autres roles : verification du forfait
                    return user.getForfait() != null && ALLOWED_FORFAITS.contains(user.getForfait().toLowerCase());
                })
                .orElse(false);
    }

    /**
     * Previsualise le contenu d'un feed iCal sans rien sauvegarder.
     */
    public PreviewResponse previewICalFeed(String url, Long propertyId) {
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new IllegalArgumentException("Propriete introuvable : " + propertyId));

        List<ICalEventPreview> events = fetchAndParseICalFeed(url, resolvePropertyZone(property));

        long blockedCount = events.stream().filter(e -> "blocked".equals(e.getType())).count();
        List<ICalEventPreview> reservationEvents = events.stream()
                .filter(e -> !"blocked".equals(e.getType())).collect(Collectors.toList());

        PreviewResponse response = new PreviewResponse();
        response.setEvents(events);
        response.setPropertyName(property.getName());
        response.setTotalReservations(reservationEvents.size());
        response.setTotalBlocked((int) blockedCount);

        return response;
    }

    /**
     * Importe les reservations depuis un feed iCal et cree les interventions.
     * Orchestration : garde forfait/ownership -> fetch+parse -> upsert feed ->
     * import evenement par evenement -> detection orphelins -> persistance des
     * resultats -> notifications -> hooks afterCommit.
     */
    @Transactional
    public ImportResponse importICalFeed(ImportRequest request, String keycloakId) {
        if (!isUserAllowed(keycloakId)) {
            throw new SecurityException("Votre forfait ne permet pas l'import iCal. Forfait Confort ou Premium requis.");
        }
        Property property = loadPropertyCheckingOwnership(request.getPropertyId(), keycloakId);
        Long orgId = tenantContext.getRequiredOrganizationId();
        assertFeedNotLinkedToAnotherProperty(request, property, orgId);

        ICalEventParser.ParseResult parseResult = fetchAndParseICalFeedDetailed(request.getUrl(), resolvePropertyZone(property));
        List<ICalEventPreview> reservationEvents = filterReservationEvents(parseResult.events());

        ICalFeed feed = upsertFeed(property, request);
        ImportSession session = new ImportSession(request, property, feed, orgId,
                detectSource(request.getSourceName()));
        recordParseAnomalies(session, parseResult);
        preloadKnownFeedReservations(session);

        for (ICalEventPreview event : reservationEvents) {
            importEvent(session, event);
        }

        detectAndCancelOrphans(session, reservationEvents);
        persistFeedSyncResult(session);
        auditAndLogResult(session);

        ImportResponse response = buildResponse(session);
        notifyImportResult(session, keycloakId);

        // Auto-assignation differee : tournee apres le commit dans des transactions
        // independantes, pour qu'une defaillance ne casse pas l'import.
        scheduleAutoAssignAfterCommit(session.srsToAutoAssign, orgId);
        // Auto-facture OTA differee : apres le commit, dans des transactions independantes.
        scheduleReservationInvoicesAfterCommit(session.reservationsToInvoice);

        return response;
    }

    // ── Etapes privees de l'import ──────────────────────────────────────────────

    /**
     * Etat mutable d'une passe d'import : compteurs, erreurs et travaux differes
     * apres commit. Les SR sont auto-assignees en afterCommit car les services
     * {@code @Transactional} appeles (findAvailableTeamForProperty, notifications...)
     * peuvent marquer la transaction d'import rollback-only meme si l'exception est
     * avalee localement (UnexpectedRollbackException au commit sinon).
     */
    private static final class ImportSession {
        final ImportRequest request;
        final Property property;
        final ICalFeed feed;
        final Long orgId;
        final String sourceKey;
        /**
         * Source OTA "deja payee" (regle alignee sur PanelFinancial / PaymentController) :
         * ces reservations sont reglees sur le canal externe -> auto-facturees a l'import
         * (pas via Stripe).
         */
        final boolean otaPaidSource;
        int imported;
        int skipped;
        int cancelled;
        final List<String> errors = new ArrayList<>();
        /** SR dont l'auto-assignation est differee jusqu'apres le commit. */
        final List<Long> srsToAutoAssign = new ArrayList<>();
        /** Reservations OTA nouvellement creees, facturees apres le commit. */
        final List<Long> reservationsToInvoice = new ArrayList<>();
        /**
         * UID presents dans le feed mais non parsables : proteges de la detection
         * d'orphelins (une date malformee ne doit pas annuler la reservation en base).
         */
        final Set<String> unparsableUids = new HashSet<>();
        /**
         * Dedoublonnage par UID scope au feed (Z6-SECBUGS-06) : UID -> reservationId
         * pour les reservations de CE feed (ou sans feed : feed supprime puis recree,
         * FK ON DELETE SET NULL). Un meme UID porte par un AUTRE feed de la propriete
         * n'est pas un doublon — c'est une vraie reservation d'un autre canal.
         */
        final Map<String, Long> knownUidToReservationId = new HashMap<>();
        /**
         * Compteur local pour les noms generiques (ex: "Reserved" -> #1, #2, #3...).
         * Cle = propertyId + "_" + nomGenerique (lowercase).
         */
        final Map<String, Long> guestNameCounters = new HashMap<>();

        ImportSession(ImportRequest request, Property property, ICalFeed feed, Long orgId, String sourceKey) {
            this.request = request;
            this.property = property;
            this.feed = feed;
            this.orgId = orgId;
            this.sourceKey = sourceKey;
            this.otaPaidSource = "airbnb".equals(sourceKey)
                    || "booking".equals(sourceKey) || "other".equals(sourceKey);
        }
    }

    private Property loadPropertyCheckingOwnership(Long propertyId, String keycloakId) {
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new IllegalArgumentException("Propriete introuvable : " + propertyId));

        // Verifier l'ownership (Admin et Manager peuvent importer sur toute propriete)
        User user = userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new SecurityException("Utilisateur introuvable"));

        boolean isAdminOrManager = user.getRole().isPlatformStaff();
        if (!isAdminOrManager && !property.getOwner().getId().equals(user.getId())) {
            throw new SecurityException("Vous n'etes pas proprietaire de ce logement");
        }
        return property;
    }

    /** Verifie que ce calendrier iCal n'est pas deja importe sur un autre logement. */
    private void assertFeedNotLinkedToAnotherProperty(ImportRequest request, Property property, Long orgId) {
        List<ICalFeed> duplicateFeeds = icalFeedRepository.findByUrlAndDifferentProperty(
                request.getUrl(), property.getId(), orgId);
        if (!duplicateFeeds.isEmpty()) {
            String otherPropertyName = duplicateFeeds.get(0).getProperty().getName();
            throw new IllegalArgumentException(
                    "Ce calendrier iCal est deja importe sur le logement \"" + otherPropertyName
                            + "\". Un calendrier iCal correspond a un seul logement.");
        }
    }

    /**
     * Filtre les blocs ("Not available", "Blocked", etc.) :
     * seules les vraies reservations sont retournees.
     */
    private static List<ICalEventPreview> filterReservationEvents(List<ICalEventPreview> events) {
        List<ICalEventPreview> reservations = events.stream()
                .filter(e -> !"blocked".equals(e.getType()))
                .collect(Collectors.toList());
        int blocksIgnored = events.size() - reservations.size();
        if (blocksIgnored > 0) {
            log.info("iCal import: {} bloc(s) ignore(s) (Not available / Blocked)", blocksIgnored);
        }
        return reservations;
    }

    /**
     * Remonte dans le resultat de sync les anomalies de parsing (Z6-SECBUGS-05/07) :
     * evenements ecartes (dates non parsables) et evenements recurrents non expanses.
     * Pas de perte silencieuse : ces compteurs alimentent {@code session.errors}
     * (statut PARTIAL + notification utilisateur).
     */
    private void recordParseAnomalies(ImportSession session, ICalEventParser.ParseResult parseResult) {
        if (parseResult.unparsableEvents() > 0) {
            session.unparsableUids.addAll(parseResult.unparsableUids());
            String msg = parseResult.unparsableEvents()
                    + " evenement(s) ignore(s) (DTSTART manquant ou date non parsable)";
            log.warn("iCal import feed #{}: {}", session.feed.getId(), msg);
            session.errors.add(msg);
        }
        if (parseResult.recurringEvents() > 0) {
            String msg = parseResult.recurringEvents()
                    + " evenement(s) recurrent(s) (RRULE/RDATE) non expanse(s) : seule la premiere occurrence est importee";
            log.warn("iCal import feed #{}: {}", session.feed.getId(), msg);
            session.errors.add(msg);
        }
    }

    /**
     * Precharge la table de dedoublonnage UID -> reservation, scope au feed
     * (Z6-SECBUGS-06). Les reservations rattachees a un AUTRE feed de la meme
     * propriete sont exclues : un channel manager peut reutiliser le meme UID
     * sur deux canaux, et la reservation du second canal ne doit pas etre
     * silencieusement skippee. Les reservations sans feed restent dedupliquees
     * (feed supprime puis recree : la FK reservations.ical_feed_id est
     * ON DELETE SET NULL) — priorite aux reservations rattachees a CE feed.
     */
    private void preloadKnownFeedReservations(ImportSession session) {
        Long feedId = session.feed.getId();
        for (Reservation reservation : reservationRepository.findByPropertyId(
                session.property.getId(), session.orgId)) {
            String uid = reservation.getExternalUid();
            if (uid == null) {
                continue;
            }
            ICalFeed reservationFeed = reservation.getIcalFeed();
            if (reservationFeed != null && !feedId.equals(reservationFeed.getId())) {
                continue; // UID d'un autre feed : pas un doublon pour ce feed
            }
            if (reservationFeed != null || !session.knownUidToReservationId.containsKey(uid)) {
                session.knownUidToReservationId.put(uid, reservation.getId());
            }
        }
    }

    /** Sauvegarde/met a jour le feed en premier (pour avoir le feedId). */
    private ICalFeed upsertFeed(Property property, ImportRequest request) {
        ICalFeed feed = icalFeedRepository.findByPropertyIdAndUrl(
                property.getId(), request.getUrl(), tenantContext.getRequiredOrganizationId());
        if (feed == null) {
            feed = new ICalFeed(property, request.getUrl(), request.getSourceName());
            feed.setOrganizationId(tenantContext.getOrganizationId());
        }
        feed.setAutoCreateInterventions(request.isAutoCreateInterventions());
        return icalFeedRepository.save(feed);
    }

    /**
     * Importe un evenement : dedoublonnage par UID, creation ou annulation de la
     * reservation, puis creation/relance de la demande de menage. Une erreur sur
     * un evenement n'arrete pas les suivants.
     */
    private void importEvent(ImportSession session, ICalEventPreview event) {
        try {
            Long reservationId = findExistingReservationId(session, event);
            if (reservationId != null) {
                handleExistingReservation(session, event, reservationId);
            } else {
                reservationId = createReservationFromEvent(session, event);
            }
            maybeCreateOrRetryCleaningRequest(session, event, reservationId);
        } catch (Exception e) {
            // Pas un swallow : l'erreur est comptee dans le resultat de sync (statut PARTIAL).
            log.warn("Erreur import evenement {}: {}", event.getUid(), e.getMessage());
            session.errors.add("Evenement " + event.getSummary() + " : " + e.getMessage());
        }
    }

    /**
     * Dedoublonnage par UID scope au feed (cf. {@link #preloadKnownFeedReservations}) :
     * retourne l'id de la Reservation si elle existe deja pour CE feed.
     */
    private Long findExistingReservationId(ImportSession session, ICalEventPreview event) {
        if (event.getUid() == null) {
            return null;
        }
        return session.knownUidToReservationId.get(event.getUid());
    }

    /** Reservation deja existante — verifier si annulee cote OTA, sinon skip. */
    private void handleExistingReservation(ImportSession session, ICalEventPreview event, Long reservationId) {
        Reservation existing = reservationRepository.findById(reservationId).orElse(null);
        if (existing != null && "cancelled".equals(event.getStatus())
                && !"cancelled".equals(existing.getStatus())) {
            cancelReservationWithCascade(existing, session);
            session.cancelled++;
            return;
        }
        if (existing != null && "cancelled".equals(existing.getStatus())
                && !"cancelled".equals(event.getStatus())) {
            // L'UID est revenu actif dans le feed alors que la reservation est annulee
            // localement : pas de reactivation automatique (risque de re-bloquer des
            // dates revendues) — visibilite operateur via ce warn.
            log.warn("iCal sync: reservation #{} (uid={}) annulee cote PMS mais active dans le feed — reactivation manuelle requise",
                    existing.getId(), existing.getExternalUid());
        }
        session.skipped++;
    }

    /** Cree la Reservation a partir de l'evenement iCal et planifie la facture OTA. */
    private Long createReservationFromEvent(ImportSession session, ICalEventPreview event) {
        Reservation reservation = buildReservation(session, event);
        reservation = reservationRepository.save(reservation);
        Long reservationId = reservation.getId();

        // Dedup intra-batch : un meme UID repete dans ce feed sera skippe.
        if (event.getUid() != null) {
            session.knownUidToReservationId.put(event.getUid(), reservationId);
        }

        // Auto-facture OTA : reservation de canal externe (deja payee). Facturee APRES
        // le commit (date facture = maintenant ≈ date d'import). Pas de backfill : seules
        // les reservations nouvellement creees ici sont concernees (dedup par UID en amont).
        if (session.otaPaidSource && reservation.getTotalPrice() != null
                && reservation.getTotalPrice().compareTo(BigDecimal.ZERO) > 0) {
            session.reservationsToInvoice.add(reservationId);
        }

        linkGuest(session, reservation);
        hideCancelledOverlapping(session, reservation);

        session.imported++;
        return reservationId;
    }

    private Reservation buildReservation(ImportSession session, ICalEventPreview event) {
        Property property = session.property;
        Reservation reservation = new Reservation();
        reservation.setProperty(property);

        // Si le guest name est generique ("Reserved", "Not available", etc.),
        // on l'incremente pour individualiser chaque fiche client
        String guestName = disambiguateGuestName(event.getGuestName(), property.getId(), session.guestNameCounters);
        reservation.setGuestName(guestName);
        reservation.setGuestCount(property.getMaxGuests() != null ? property.getMaxGuests() : 2);
        reservation.setCheckIn(event.getDtStart());
        LocalDate checkOut = event.getDtEnd() != null ? event.getDtEnd() : event.getDtStart().plusDays(1);
        reservation.setCheckOut(checkOut);
        // Utiliser les heures par defaut de la propriete, sinon fallback global
        String defaultCheckIn = property.getDefaultCheckInTime() != null ? property.getDefaultCheckInTime() : DEFAULT_CHECK_IN_TIME;
        String defaultCheckOut = property.getDefaultCheckOutTime() != null ? property.getDefaultCheckOutTime() : DEFAULT_CHECK_OUT_TIME;
        reservation.setCheckInTime(defaultCheckIn);
        reservation.setCheckOutTime(defaultCheckOut);
        // Utiliser le statut parse depuis l'iCal (CONFIRMED/TENTATIVE/CANCELLED).
        // Si absent (la plupart des OTA ne le fournissent pas), defaut = "confirmed" :
        // les blocages ("Not available", "Blocked") sont deja filtres en amont (type
        // "blocked"), donc tout evenement restant est une vraie reservation OTA = booking
        // confirme. "pending" excluait a tort ces reservations des traitements filtres sur
        // "confirmed" (livret d'accueil, envoi auto des instructions check-in, revenus).
        reservation.setStatus(event.getStatus() != null ? event.getStatus() : "confirmed");
        reservation.setSource(session.sourceKey);
        reservation.setSourceName(session.request.getSourceName());
        reservation.setConfirmationCode(event.getConfirmationCode());
        reservation.setExternalUid(event.getUid());
        reservation.setIcalFeed(session.feed);
        reservation.setNotes(event.getDescription());
        reservation.setOrganizationId(tenantContext.getOrganizationId());

        applyDynamicPrice(session, reservation, checkOut);
        return reservation;
    }

    /**
     * Calcule le prix total via le moteur de pricing dynamique.
     * Resout les overrides, rate plans (promo/seasonal/base) et fallback property.nightlyPrice.
     */
    private void applyDynamicPrice(ImportSession session, Reservation reservation, LocalDate checkOut) {
        Map<LocalDate, BigDecimal> priceMap = priceEngine.resolvePriceRange(
                session.property.getId(), reservation.getCheckIn(), checkOut, session.orgId);
        BigDecimal totalPrice = BigDecimal.ZERO;
        for (LocalDate date = reservation.getCheckIn(); date.isBefore(checkOut); date = date.plusDays(1)) {
            BigDecimal nightlyPrice = priceMap.get(date);
            if (nightlyPrice != null) {
                totalPrice = totalPrice.add(nightlyPrice);
            }
        }
        if (totalPrice.compareTo(BigDecimal.ZERO) > 0) {
            reservation.setTotalPrice(totalPrice);
        }
    }

    /** Cree/lie le Guest des l'import pour que guestEmail soit persistable via PUT. */
    private void linkGuest(ImportSession session, Reservation reservation) {
        String guestName = reservation.getGuestName();
        if (reservation.getGuest() != null || guestName == null || guestName.isBlank()) {
            return;
        }
        try {
            Guest guest = guestService.findOrCreateFromName(guestName, session.sourceKey, session.orgId);
            if (guest != null) {
                reservation.setGuest(guest);
                reservationRepository.save(reservation);
            }
        } catch (Exception e) {
            // Comptage explicite dans le resultat de sync : sans fiche Guest, le guestEmail
            // n'est pas persistable (PUT) — l'echec ne doit pas etre silencieux.
            log.error("Impossible de creer le Guest pour reservation #{}: {}",
                    reservation.getId(), e.getMessage());
            session.errors.add("Guest non lie pour la reservation #" + reservation.getId()
                    + " : " + e.getMessage());
        }
    }

    /** Auto-masque les reservations annulees qui chevauchent la nouvelle. */
    private void hideCancelledOverlapping(ImportSession session, Reservation reservation) {
        List<Reservation> cancelledOverlapping = reservationRepository.findCancelledOverlapping(
                session.property.getId(), reservation.getCheckIn(), reservation.getCheckOut(),
                tenantContext.getRequiredOrganizationId());
        for (Reservation cancelledRes : cancelledOverlapping) {
            cancelledRes.setHiddenFromPlanning(true);
            reservationRepository.save(cancelledRes);
            log.info("Auto-masque reservation annulee #{} (chevauche nouvelle OTA #{})",
                    cancelledRes.getId(), reservation.getId());
        }
    }

    /**
     * Cree ou reactive la demande de menage (si auto-create active).
     * IMPORTANT: verifie meme si la reservation est un doublon, car l'utilisateur
     * peut activer l'auto-menage apres un premier import sans cette option,
     * ou ajouter une equipe apres que le scheduler ait epuise ses retries.
     */
    private void maybeCreateOrRetryCleaningRequest(ImportSession session, ICalEventPreview event, Long reservationId) {
        if (!session.request.isAutoCreateInterventions() || reservationId == null) {
            return;
        }
        ServiceRequest existingSR = findExistingCleaningRequest(session, event);
        if (existingSR == null) {
            // Aucune SR : on la cree puis on planifie l'auto-assignation post-commit
            // (cf. srsToAutoAssign) pour eviter qu'une exception interne ne marque
            // la transaction rollback-only.
            ServiceRequest created = createCleaningServiceRequest(
                    session.property, event, session.request.getSourceName(), reservationId);
            if (created != null) {
                session.srsToAutoAssign.add(created.getId());
            }
            return;
        }
        if (existingSR.getStatus() == RequestStatus.PENDING && existingSR.getAssignedToId() == null) {
            // SR existe mais coincee en PENDING non-assignee. Cause typique :
            // l'utilisateur a ajoute une equipe / config apres l'import initial,
            // et le scheduler a deja epuise ses 10 retries (autoAssignStatus='exhausted').
            // On reset le compteur et on retente apres commit.
            existingSR.setAutoAssignRetryCount(0);
            existingSR.setAutoAssignStatus("searching");
            existingSR.setLastAutoAssignAttempt(null);
            ServiceRequest reset = serviceRequestRepository.save(existingSR);
            session.srsToAutoAssign.add(reset.getId());
        }
    }

    private ServiceRequest findExistingCleaningRequest(ImportSession session, ICalEventPreview event) {
        if (event.getUid() == null) {
            return null;
        }
        String marker = "[ICAL:" + event.getUid() + "]";
        return serviceRequestRepository.findByPropertyId(session.property.getId(), session.orgId).stream()
                .filter(sr -> sr.getSpecialInstructions() != null
                        && sr.getSpecialInstructions().contains(marker))
                .findFirst()
                .orElse(null);
    }

    /**
     * Detection des reservations orphelines : presentes en DB mais disparues du feed iCal.
     * Cas le plus courant : Airbnb supprime l'evenement du calendrier lors d'une annulation.
     *
     * Garde-fous (anti-fausse-annulation-massive) :
     *   1. Feed sans aucun UID (vide / erreur de parsing) -> aucune suppression + alerte
     *      si des reservations futures existent
     *   2. Feed sans aucun evenement futur alors que des reservations futures actives
     *      existent (feed tronque) -> aucune suppression + alerte
     *   3. Seules les reservations FUTURES sont candidates (les feeds OTA omettent le passe)
     *   4. Si plus de {@link #MAX_ORPHAN_RATIO} des futures actives deviendraient
     *      orphelines, on n'annule rien (feed incomplet)
     */
    private void detectAndCancelOrphans(ImportSession session, List<ICalEventPreview> feedEvents) {
        try {
            Set<String> feedUids = feedEvents.stream()
                    .map(ICalEventPreview::getUid)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toCollection(HashSet::new));
            // Z6-SECBUGS-05 : un UID present dans le feed mais dont l'evenement n'a pas pu
            // etre parse (date malformee) ne doit PAS rendre la reservation orpheline —
            // sinon une simple date non standard declenche une annulation cascade.
            feedUids.addAll(session.unparsableUids);

            LocalDate today = LocalDate.now();
            List<Reservation> futureActive = reservationRepository
                    .findActiveByICalFeedId(session.feed.getId(), session.orgId)
                    .stream()
                    .filter(r -> r.getCheckOut() != null && r.getCheckOut().isAfter(today))
                    .collect(Collectors.toList());

            List<Reservation> orphans = futureActive.stream()
                    .filter(r -> r.getExternalUid() != null && !feedUids.contains(r.getExternalUid()))
                    .collect(Collectors.toList());

            if (shouldAbortOrphanPass(session, feedUids, feedEvents, futureActive, orphans, today)) {
                return;
            }

            for (Reservation orphan : orphans) {
                cancelReservationWithCascade(orphan, session);
                session.cancelled++;
                log.info("iCal sync: reservation orpheline #{} (uid={}) annulee — absente du feed",
                        orphan.getId(), orphan.getExternalUid());
            }
        } catch (Exception e) {
            // Pas un swallow : l'erreur est comptee dans le resultat de sync (statut PARTIAL).
            log.warn("Erreur detection orphelins iCal feed #{}: {}", session.feed.getId(), e.getMessage());
            session.errors.add("Detection orphelins: " + e.getMessage());
        }
    }

    /**
     * Applique les garde-fous de la detection d'orphelins. Retourne true si la passe
     * doit etre abandonnee (et ajoute l'alerte correspondante a la session).
     */
    private boolean shouldAbortOrphanPass(ImportSession session, Set<String> feedUids,
                                          List<ICalEventPreview> feedEvents,
                                          List<Reservation> futureActive,
                                          List<Reservation> orphans, LocalDate today) {
        if (feedUids.isEmpty()) {
            log.warn("iCal sync feed #{}: aucun UID parse, detection des orphelins ignoree (securite)",
                    session.feed.getId());
            if (!futureActive.isEmpty()) {
                session.errors.add("Detection orphelins ignoree: le feed distant est vide alors que "
                        + futureActive.size() + " reservation(s) future(s) existe(nt) (feed potentiellement tronque)");
            }
            return true;
        }
        if (futureActive.isEmpty()) {
            return true;
        }
        boolean feedHasFutureEvents = feedEvents.stream().anyMatch(e -> isFutureEvent(e, today));
        if (!feedHasFutureEvents) {
            log.warn("iCal sync feed #{}: aucun evenement futur dans le feed alors que {} reservation(s) future(s) active(s) existe(nt) — abort (feed tronque ?)",
                    session.feed.getId(), futureActive.size());
            session.errors.add("Detection orphelins ignoree: aucun evenement futur dans le feed (feed potentiellement tronque)");
            return true;
        }
        if (!orphans.isEmpty() && orphans.size() > futureActive.size() * MAX_ORPHAN_RATIO) {
            log.warn("iCal sync feed #{}: {}/{} reservations futures seraient annulees (> {}%) — abort (feed incomplet ?)",
                    session.feed.getId(), orphans.size(), futureActive.size(), (int) (MAX_ORPHAN_RATIO * 100));
            session.errors.add("Detection orphelins ignoree: trop de reservations seraient annulees (feed potentiellement incomplet)");
            return true;
        }
        return false;
    }

    private static boolean isFutureEvent(ICalEventPreview event, LocalDate today) {
        LocalDate end = event.getDtEnd() != null ? event.getDtEnd() : event.getDtStart();
        return end != null && end.isAfter(today);
    }

    /** Met a jour le feed avec les resultats de la synchronisation. */
    private void persistFeedSyncResult(ImportSession session) {
        ICalFeed feed = session.feed;
        feed.setLastSyncAt(LocalDateTime.now());
        feed.setLastSyncStatus(session.errors.isEmpty() ? "SUCCESS" : "PARTIAL");
        feed.setLastSyncError(session.errors.isEmpty() ? null : String.join("; ", session.errors));
        feed.setEventsImported(feed.getEventsImported() + session.imported);
        icalFeedRepository.save(feed);
    }

    private void auditAndLogResult(ImportSession session) {
        String auditMsg = String.format("Import iCal: %d importees, %d doublons, %d annulees, %d erreurs",
                session.imported, session.skipped, session.cancelled, session.errors.size());
        auditLogService.logSync("ICalImport", session.feed.getId().toString(), auditMsg);

        log.info("Import iCal termine pour propriete {} ({}): {} importees, {} doublons, {} annulees, {} erreurs",
                session.property.getName(), session.request.getSourceName(),
                session.imported, session.skipped, session.cancelled, session.errors.size());
    }

    private ImportResponse buildResponse(ImportSession session) {
        ImportResponse response = new ImportResponse();
        response.setImported(session.imported);
        response.setSkipped(session.skipped);
        response.setCancelled(session.cancelled);
        response.setErrors(session.errors);
        response.setFeedId(session.feed.getId());
        return response;
    }

    /**
     * Notifie l'utilisateur du resultat de l'import.
     * Uniquement quand il y a de nouvelles reservations, annulations ou erreurs —
     * les syncs silencieuses ne notifient pas.
     */
    private void notifyImportResult(ImportSession session, String keycloakId) {
        try {
            if (!session.errors.isEmpty()) {
                // Errors occurred — always notify
                notificationService.notify(
                    keycloakId,
                    NotificationKey.ICAL_IMPORT_FAILED,
                    "Import iCal partiel — " + session.property.getName(),
                    session.imported + " importee(s), " + session.cancelled + " annulee(s), "
                            + session.errors.size() + " erreur(s) via " + session.request.getSourceName(),
                    "/planning"
                );
            } else if (session.imported > 0 || session.cancelled > 0) {
                // New reservations or cancellations — notify
                String plural = session.imported > 1 ? "s" : "";
                String cancelledInfo = session.cancelled > 0
                        ? ", " + session.cancelled + " annulee" + (session.cancelled > 1 ? "s" : "")
                        : "";
                notificationService.notify(
                    keycloakId,
                    NotificationKey.ICAL_IMPORT_SUCCESS,
                    session.imported + " nouvelle" + plural + " reservation" + plural + cancelledInfo
                            + " — " + session.property.getName(),
                    session.imported + " reservation" + plural + " importee" + plural + cancelledInfo
                            + " via " + session.request.getSourceName()
                            + (session.request.isAutoCreateInterventions() ? " (menages crees automatiquement)" : ""),
                    "/planning"
                );
            }
            // imported == 0 && no errors → silent sync, no notification needed
        } catch (Exception e) {
            // Notification best-effort : propager annulerait l'import deja persiste.
            log.error("Erreur notification import iCal: {}", e.getMessage());
        }
    }

    /**
     * Enregistre une synchronisation de transaction qui declenche l'auto-assignation
     * de chaque SR APRES le commit de l'import. Chaque appel ouvre sa propre transaction
     * (il n'y a plus de transaction active a ce stade), donc une exception interne
     * ne peut plus polluer l'import via le mecanisme rollback-only de Spring.
     */
    private void scheduleAutoAssignAfterCommit(List<Long> srIds, Long orgId) {
        if (srIds == null || srIds.isEmpty()) {
            return;
        }
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            // Pas de transaction active (cas de tests directs ou contexte exotique) :
            // on lance immediatement, chaque attemptAutoAssignByOrgId ouvrant sa TX.
            runDeferredAutoAssign(srIds, orgId);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                runDeferredAutoAssign(srIds, orgId);
            }
        });
    }

    private void runDeferredAutoAssign(List<Long> srIds, Long orgId) {
        for (Long srId : srIds) {
            try {
                ServiceRequest sr = serviceRequestRepository.findById(srId).orElse(null);
                if (sr != null) {
                    boolean assigned = serviceRequestService.attemptAutoAssignByOrgId(sr, orgId);
                    if (assigned) {
                        log.info("iCal sync (post-commit): SR #{} auto-assignee a une equipe", sr.getId());
                    } else {
                        log.debug("iCal sync (post-commit): SR #{} reste en PENDING (pas d'equipe disponible)", sr.getId());
                    }
                }
            } catch (Exception e) {
                // Pas un swallow definitif : la SR reste PENDING/searching et le scheduler
                // d'auto-assignation retente (jusqu'a epuisement de ses retries).
                log.warn("iCal sync (post-commit): erreur auto-assign SR #{}: {}", srId, e.getMessage());
            }
        }
    }

    /**
     * Enregistre une synchronisation qui auto-facture les reservations OTA APRES le commit de
     * l'import. Chaque facture est generee dans sa propre transaction (AutoInvoiceService est
     * @Transactional), donc une defaillance n'affecte ni l'import ni les autres factures.
     * Reservations OTA = deja reglees sur le canal externe (pas de paiement Stripe -> pas de
     * facture via les webhooks). Date facture = maintenant (≈ date d'import). Pas de backfill.
     */
    private void scheduleReservationInvoicesAfterCommit(List<Long> reservationIds) {
        if (reservationIds == null || reservationIds.isEmpty()) {
            return;
        }
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            runDeferredReservationInvoices(reservationIds);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                runDeferredReservationInvoices(reservationIds);
            }
        });
    }

    private void runDeferredReservationInvoices(List<Long> reservationIds) {
        for (Long resId : reservationIds) {
            try {
                Reservation reservation = reservationRepository.findById(resId).orElse(null);
                if (reservation != null) {
                    // Route séjour/commission selon le modèle de paiement du contrat (idempotent).
                    otaInvoicingService.invoiceImportedReservation(reservation);
                }
            } catch (Exception e) {
                // Aucun retry automatique (la reservation sera skippee aux syncs suivants,
                // donc jamais re-facturee) : ERROR pour garantir la visibilite operateur.
                log.error("Auto-facture OTA (post-commit) echouee pour reservation #{}: {}", resId, e.getMessage());
            }
        }
    }

    /**
     * Telecharge et parse un fichier iCal depuis une URL.
     * La validation SSRF (HTTPS only, IP publique) et le pinning de la connexion sur
     * l'IP validee (anti DNS-rebinding) sont assures par {@link ICalFeedDownloader},
     * qui limite aussi la taille de la reponse.
     * L'URL n'est jamais loggee en clair (la query string contient le token du feed).
     */
    @CircuitBreaker(name = "ical-import")
    public List<ICalEventPreview> fetchAndParseICalFeed(String url) {
        return fetchAndParseICalFeedDetailed(url).events();
    }

    /**
     * Variante timezone-aware : les DATE-TIME UTC (suffixe Z) ou TZID du feed sont
     * convertis vers la zone de la propriete (Z6-SECBUGS-04) au lieu de la zone systeme.
     */
    @CircuitBreaker(name = "ical-import")
    public List<ICalEventPreview> fetchAndParseICalFeed(String url, ZoneId targetZone) {
        return fetchAndParseICalFeedDetailed(url, targetZone).events();
    }

    /**
     * Variante detaillee : retourne aussi le comptage des evenements ecartes
     * (dates non parsables) et recurrents, pour les remonter dans le resultat de sync.
     */
    @CircuitBreaker(name = "ical-import")
    public ICalEventParser.ParseResult fetchAndParseICalFeedDetailed(String url) {
        return fetchAndParseICalFeedDetailed(url, null);
    }

    /**
     * Variante timezone-aware : delegue la conversion des DATE-TIME (Z / TZID) a la
     * zone cible fournie ; {@code null} = repli historique sur la zone systeme (trace
     * par le parser).
     */
    @CircuitBreaker(name = "ical-import")
    public ICalEventParser.ParseResult fetchAndParseICalFeedDetailed(String url, ZoneId targetZone) {
        // try-with-resources : ical4j ne ferme pas l'InputStream, et le close() est le seul
        // mecanisme qui libere la socket TLS ouverte par ICalFeedDownloader (sinon fuite de FD
        // en CLOSE_WAIT a chaque telechargement, y compris quand le parsing leve).
        try (InputStream limitedStream = feedDownloader.download(url)) {
            return targetZone != null
                    ? ICalEventParser.parse(limitedStream, targetZone)
                    : ICalEventParser.parse(limitedStream);
        } catch (IOException e) {
            log.error("Erreur telechargement iCal depuis {}: {}", FeedUrlMasker.mask(url), e.getMessage());
            throw new RuntimeException("Impossible de telecharger le calendrier iCal : " + e.getMessage());
        }
    }

    /**
     * Zone de la propriete pour l'interpretation des dates iCal ; repli documente
     * sur Europe/Paris (defaut projet) si la timezone est absente ou invalide.
     */
    private ZoneId resolvePropertyZone(Property property) {
        String tz = property.getTimezone();
        if (tz == null || tz.isBlank()) {
            return ZoneId.of("Europe/Paris");
        }
        try {
            return ZoneId.of(tz);
        } catch (Exception e) {
            log.warn("Timezone invalide '{}' pour la propriete #{} — repli sur Europe/Paris", tz, property.getId());
            return ZoneId.of("Europe/Paris");
        }
    }

    /**
     * Cree automatiquement une demande de service de menage pour une reservation importee.
     * L'intervention sera creee uniquement apres le paiement.
     * Retourne la SR persistee (ou null si la creation a echoue).
     */
    private ServiceRequest createCleaningServiceRequest(Property property, ICalEventPreview event,
                                                         String sourceName, Long reservationId) {
        User owner = property.getOwner();

        // Date du checkout avec l'heure par defaut de la propriete
        LocalDate checkOut = event.getDtEnd() != null ? event.getDtEnd() : event.getDtStart().plusDays(1);
        String defaultCheckOutTime = property.getDefaultCheckOutTime() != null ? property.getDefaultCheckOutTime() : DEFAULT_CHECK_OUT_TIME;
        LocalTime checkOutTime = LocalTime.parse(defaultCheckOutTime);
        LocalDateTime scheduledDate = LocalDateTime.of(checkOut, checkOutTime);
        // Fenetre de menage bornee par le check-in du guest suivant : respecter l'heure
        // de check-in de la propriete (T-BP-09), alignee sur buildReservation.
        String defaultCheckInTime = property.getDefaultCheckInTime() != null ? property.getDefaultCheckInTime() : DEFAULT_CHECK_IN_TIME;
        LocalTime checkInTime = LocalTime.parse(defaultCheckInTime);

        // Duree estimee : utiliser cleaningDurationMinutes de la propriete (calcule par PropertyService)
        // Convertir minutes -> heures arrondi au superieur (ex: 150 min -> 3h)
        int estimatedDuration;
        if (property.getCleaningDurationMinutes() != null && property.getCleaningDurationMinutes() > 0) {
            estimatedDuration = (int) Math.ceil(property.getCleaningDurationMinutes() / 60.0);
        } else {
            // Fallback si le champ n'est pas renseigne
            estimatedDuration = 2;
            log.debug("Property {} n'a pas de cleaningDurationMinutes, fallback a {}h", property.getName(), estimatedDuration);
        }
        BigDecimal estimatedCost = estimateCleaningCost(property);

        // Instructions speciales avec UID pour dedoublonnage
        StringBuilder instructions = new StringBuilder();
        if (event.getUid() != null) {
            instructions.append("[ICAL:").append(event.getUid()).append("] ");
        }
        instructions.append("[SOURCE:").append(sourceName).append("] ");
        if (event.getGuestName() != null) {
            instructions.append("Guest: ").append(event.getGuestName()).append(" ");
        }
        if (event.getConfirmationCode() != null) {
            instructions.append("Code: ").append(event.getConfirmationCode()).append(" ");
        }
        if (event.getNights() > 0) {
            instructions.append(event.getNights()).append(" nuits ");
        }
        if (property.getAccessInstructions() != null) {
            instructions.append("| Acces: ").append(property.getAccessInstructions());
        }
        String specialInstructions = instructions.toString().trim();

        // ─── 1. Creer la ServiceRequest associee ───
        String srTitle = "Menage " + sourceName + " — " + property.getName();
        ServiceType cleaningType = property.resolveCleaningServiceType();
        ServiceRequest serviceRequest = new ServiceRequest(
                srTitle,
                cleaningType,
                scheduledDate,
                owner != null ? owner : property.getOwner(),
                property
        );
        serviceRequest.setPriority(Priority.HIGH);
        serviceRequest.setStatus(RequestStatus.PENDING);
        serviceRequest.setEstimatedDurationHours(estimatedDuration);
        serviceRequest.setEstimatedCost(estimatedCost);
        serviceRequest.setGuestCheckoutTime(scheduledDate);
        serviceRequest.setGuestCheckinTime(LocalDateTime.of(checkOut, checkInTime));
        serviceRequest.setSpecialInstructions(specialInstructions);
        serviceRequest.setDescription("Import iCal " + sourceName
                + (event.getGuestName() != null ? " — Guest: " + event.getGuestName() : "")
                + (event.getConfirmationCode() != null ? " (" + event.getConfirmationCode() + ")" : ""));
        serviceRequest.setReservationId(reservationId);
        serviceRequest.setOrganizationId(tenantContext.getOrganizationId());

        serviceRequest = serviceRequestRepository.save(serviceRequest);

        log.info("Demande de service menage #{} creee pour reservation #{} propriete {} ({}, {})",
                serviceRequest.getId(), reservationId, property.getName(), sourceName,
                event.getGuestName() != null ? event.getGuestName() : "N/A");
        return serviceRequest;
    }

    /**
     * Estime le cout de menage en euros via PricingConfigService.
     * Formule : basePrix(forfait) x typeCoeff x surfaceCoeff x guestCoeff
     * Prix minimum et arrondi au multiple de 5 EUR.
     */
    private BigDecimal estimateCleaningCost(Property property) {
        // Prix de base depuis la config dynamique, selon le forfait du owner
        Map<String, Integer> basePrices = pricingConfigService.getBasePrices();
        String forfait = (property.getOwner() != null && property.getOwner().getForfait() != null)
                ? property.getOwner().getForfait().toLowerCase() : "confort";
        int basePrice = basePrices.getOrDefault(forfait, basePrices.getOrDefault("confort", 75));

        // Coefficient type de propriete (mapper PropertyType enum -> cle PricingConfig)
        Map<String, Double> typeCoeffs = pricingConfigService.getPropertyTypeCoeffs();
        String propertyTypeKey = mapPropertyTypeToKey(property.getType());
        double typeCoeff = typeCoeffs.getOrDefault(propertyTypeKey, 1.0);

        // Coefficient surface (via tiers dynamiques)
        double surfaceCoeff = property.getSquareMeters() != null
                ? pricingConfigService.getSurfaceCoeff(property.getSquareMeters()) : 1.0;

        // Coefficient capacite guests
        Map<String, Double> guestCoeffs = pricingConfigService.getGuestCapacityCoeffs();
        int guests = property.getMaxGuests() != null ? property.getMaxGuests() : 2;
        String guestKey = guests <= 2 ? "1-2" : guests <= 4 ? "3-4" : guests <= 6 ? "5-6" : "7+";
        double guestCoeff = guestCoeffs.getOrDefault(guestKey, 1.0);

        double cost = basePrice * typeCoeff * surfaceCoeff * guestCoeff;

        // Prix minimum
        int minPrice = pricingConfigService.getMinPrice();
        cost = Math.max(cost, minPrice);

        // Arrondir au multiple de 5 EUR le plus proche
        cost = Math.round(cost / 5.0) * 5.0;

        log.debug("Estimation cout menage pour {} : base={} x type({})={} x surface={} x guests({})={} = {}",
                property.getName(), basePrice, propertyTypeKey, typeCoeff, surfaceCoeff, guestKey, guestCoeff, cost);

        return BigDecimal.valueOf(cost);
    }

    /**
     * Mappe un PropertyType enum vers la cle utilisee dans PricingConfig.
     */
    private String mapPropertyTypeToKey(PropertyType type) {
        if (type == null) return "autre";
        switch (type) {
            case APARTMENT: return "appartement";
            case HOUSE: return "maison";
            case STUDIO: return "studio";
            case VILLA: return "villa";
            case LOFT: return "loft";
            case GUEST_ROOM: return "chambre-hote";
            case COTTAGE: return "gite";
            case CHALET: return "chalet";
            case BOAT: return "bateau";
            default: return "autre";
        }
    }

    /**
     * Detecte la source (airbnb, booking, etc.) a partir du nom fourni par l'utilisateur.
     */
    private String detectSource(String sourceName) {
        if (sourceName == null) return "other";
        String lower = sourceName.toLowerCase();
        if (lower.contains("airbnb")) return "airbnb";
        if (lower.contains("booking")) return "booking";
        if (lower.contains("vrbo") || lower.contains("homeaway")) return "other";
        if (lower.contains("direct")) return "direct";
        return "other";
    }

    // ---- Gestion des feeds ----

    /**
     * Liste les feeds iCal d'un utilisateur.
     */
    public List<FeedDto> getUserFeeds(String keycloakId) {
        User user = userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new SecurityException("Utilisateur introuvable"));

        return icalFeedRepository.findByPropertyOwnerId(user.getId(), tenantContext.getRequiredOrganizationId()).stream()
                .map(this::toFeedDto)
                .collect(Collectors.toList());
    }

    /**
     * Supprime un feed iCal.
     */
    @Transactional
    public void deleteFeed(Long feedId, String keycloakId) {
        ICalFeed feed = icalFeedRepository.findById(feedId)
                .orElseThrow(() -> new IllegalArgumentException("Feed introuvable"));

        checkOwnership(feed, keycloakId);
        icalFeedRepository.delete(feed);

        log.info("Feed iCal {} supprime pour propriete {}", feedId, feed.getPropertyId());

        try {
            notificationService.notify(
                keycloakId,
                NotificationKey.ICAL_FEED_DELETED,
                "Feed iCal supprime",
                "Le feed " + feed.getSourceName() + " a ete supprime",
                "/dashboard"
            );
        } catch (Exception e) {
            // Notification best-effort : propager annulerait la suppression deja effectuee.
            log.error("Erreur notification ICAL_FEED_DELETED: {}", e.getMessage());
        }
    }

    /**
     * Active/desactive l'auto-creation d'interventions pour un feed.
     */
    @Transactional
    public FeedDto toggleAutoInterventions(Long feedId, String keycloakId) {
        ICalFeed feed = icalFeedRepository.findById(feedId)
                .orElseThrow(() -> new IllegalArgumentException("Feed introuvable"));

        checkOwnership(feed, keycloakId);

        // Verifier le forfait
        if (!isUserAllowed(keycloakId)) {
            throw new SecurityException("Votre forfait ne permet pas l'auto-creation de menage");
        }

        feed.setAutoCreateInterventions(!feed.isAutoCreateInterventions());
        icalFeedRepository.save(feed);

        log.info("Toggle auto-interventions feed {} -> {}", feedId, feed.isAutoCreateInterventions());

        try {
            notificationService.notify(
                keycloakId,
                NotificationKey.ICAL_AUTO_INTERVENTIONS_TOGGLED,
                "Auto-interventions modifie",
                "Auto-creation d'interventions " + (feed.isAutoCreateInterventions() ? "activee" : "desactivee") + " pour " + feed.getSourceName(),
                "/dashboard"
            );
        } catch (Exception e) {
            // Notification best-effort : propager annulerait le toggle deja persiste.
            log.error("Erreur notification ICAL_AUTO_INTERVENTIONS_TOGGLED: {}", e.getMessage());
        }

        return toFeedDto(feed);
    }

    /**
     * Force la synchronisation d'un feed.
     */
    @Transactional
    public ImportResponse syncFeed(Long feedId, String keycloakId) {
        ICalFeed feed = icalFeedRepository.findById(feedId)
                .orElseThrow(() -> new IllegalArgumentException("Feed introuvable"));

        checkOwnership(feed, keycloakId);

        ImportRequest request = new ImportRequest();
        request.setUrl(feed.getUrl());
        request.setPropertyId(feed.getPropertyId());
        request.setSourceName(feed.getSourceName());
        request.setAutoCreateInterventions(feed.isAutoCreateInterventions());

        // importICalFeed handles notifications: notifies only when new reservations found or errors
        return importICalFeed(request, keycloakId);
    }

    /**
     * Synchronise tous les feeds actifs (appele par le scheduler).
     * @deprecated Utiliser {@link #syncFeeds(List)} avec groupement par org depuis le scheduler.
     */
    @Deprecated
    public void syncAllActiveFeeds() {
        List<ICalFeed> activeFeeds = icalFeedRepository.findBySyncEnabledTrue();
        syncFeeds(activeFeeds);
    }

    /**
     * Synchronise une liste de feeds iCal (appele par le scheduler, groupe par org).
     * Chaque feed est traite independamment, dans SA PROPRE transaction (import via le
     * proxy {@link #self}) : une erreur sur un feed n'arrete pas les suivants et ne peut
     * plus marquer rollback-only les imports deja commites (T-BP-06 — l'ancienne version
     * @Transactional partageait une transaction unique entre tous les feeds).
     */
    public void syncFeeds(List<ICalFeed> feeds) {
        log.info("Synchro iCal : {} feeds a traiter", feeds.size());

        for (ICalFeed feed : feeds) {
            try {
                Property property = feed.getProperty();
                if (property == null || property.getOwner() == null) {
                    continue;
                }

                String ownerKeycloakId = property.getOwner().getKeycloakId();
                if (ownerKeycloakId == null || !isUserAllowed(ownerKeycloakId)) {
                    log.warn("Feed {} ignore : proprietaire sans forfait adequat (owner={})", feed.getId(), ownerKeycloakId);
                    continue;
                }

                ImportRequest request = new ImportRequest();
                request.setUrl(feed.getUrl());
                request.setPropertyId(feed.getPropertyId());
                request.setSourceName(feed.getSourceName());
                request.setAutoCreateInterventions(feed.isAutoCreateInterventions());

                ImportResponse result = self.getObject().importICalFeed(request, ownerKeycloakId);
                log.info("Synchro feed {} (org={}) : {} importees, {} doublons",
                        feed.getId(),
                        property.getOrganizationId(),
                        result.getImported(), result.getSkipped());

            } catch (Exception e) {
                log.error("Erreur synchro feed {} : {}", feed.getId(), e.getMessage());
                feed.setLastSyncStatus("ERROR");
                feed.setLastSyncError(e.getMessage());
                feed.setLastSyncAt(LocalDateTime.now());
                icalFeedRepository.save(feed);
            }
        }
    }

    // ---- Helpers ----

    /** Noms de guest generiques produits par les plateformes OTA (iCal) */
    private static final Set<String> GENERIC_GUEST_NAMES = Set.of(
            "reserved", "not available", "unavailable", "blocked",
            "airbnb", "booking.com", "vrbo", "homeaway"
    );

    /**
     * Si le nom du guest est generique (ex: "Reserved" via Airbnb iCal),
     * on l'incremente en "Reserved #1", "Reserved #2", etc.
     * Utilise un compteur local (en memoire) + le count en base pour garantir
     * un numero unique meme au sein d'un meme batch d'import.
     */
    private String disambiguateGuestName(String originalName, Long propertyId,
                                          Map<String, Long> counters) {
        if (originalName == null || originalName.isBlank()) {
            originalName = "Reserved";
        }

        String nameLower = originalName.trim().toLowerCase();
        if (!GENERIC_GUEST_NAMES.contains(nameLower)) {
            return originalName.trim(); // Nom reel, on ne touche pas
        }

        String counterKey = propertyId + "_" + nameLower;

        if (!counters.containsKey(counterKey)) {
            // Premiere occurrence dans ce batch : initialiser depuis la base
            long orgId = tenantContext.getRequiredOrganizationId();
            long dbCount = reservationRepository.countByGuestNameStartingWithAndPropertyId(
                    originalName.trim(), propertyId, orgId);
            counters.put(counterKey, dbCount);
        }

        long next = counters.merge(counterKey, 1L, Long::sum);
        return originalName.trim() + " #" + next;
    }

    private void checkOwnership(ICalFeed feed, String keycloakId) {
        User user = userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new SecurityException("Utilisateur introuvable"));

        // Admin et Manager peuvent gerer tous les feeds
        if (user.getRole().isPlatformStaff()) {
            return;
        }

        Property property = propertyRepository.findById(feed.getPropertyId())
                .orElseThrow(() -> new IllegalArgumentException("Propriete introuvable"));

        if (!property.getOwner().getId().equals(user.getId())) {
            throw new SecurityException("Vous n'etes pas proprietaire de ce logement");
        }
    }

    private FeedDto toFeedDto(ICalFeed feed) {
        FeedDto dto = new FeedDto();
        dto.setId(feed.getId());
        dto.setPropertyId(feed.getPropertyId());
        dto.setPropertyName(feed.getProperty() != null ? feed.getProperty().getName() : null);
        dto.setUrl(feed.getUrl());
        dto.setSourceName(feed.getSourceName());
        dto.setAutoCreateInterventions(feed.isAutoCreateInterventions());
        dto.setSyncEnabled(feed.isSyncEnabled());
        dto.setLastSyncAt(feed.getLastSyncAt());
        dto.setLastSyncStatus(feed.getLastSyncStatus());
        dto.setEventsImported(feed.getEventsImported());
        return dto;
    }

    // ── Cascade cancellation (iCal sync) ───────────────────────────────────────

    /**
     * Annule une reservation avec cascade vers paiements, interventions et factures.
     * Appele lors d'un sync iCal quand une reservation est detectee comme annulee
     * (STATUS:CANCELLED dans le feed ou evenement disparu du feed).
     *
     * Note : on ne masque PAS la reservation du planning (hiddenFromPlanning reste false).
     * Le bloc s'affiche en rouge avec une croix pour que l'utilisateur puisse choisir
     * de le retirer manuellement (PATCH /api/reservations/{id}/hide).
     */
    private void cancelReservationWithCascade(Reservation reservation, ImportSession session) {
        reservation.setStatus("cancelled");

        // Annuler le paiement reservation (sauf si deja rembourse ou annule)
        if (reservation.getPaymentStatus() != null
                && reservation.getPaymentStatus() != PaymentStatus.REFUNDED
                && reservation.getPaymentStatus() != PaymentStatus.CANCELLED) {
            reservation.setPaymentStatus(PaymentStatus.CANCELLED);
        }
        reservationRepository.save(reservation);

        // Liberer les jours du calendrier — un echec laisse les jours bloques sans
        // retry automatique : compte dans le resultat de sync (pas de swallow).
        try {
            calendarEngine.cancel(reservation.getId(), session.orgId, "ical-sync");
        } catch (Exception e) {
            log.error("Erreur liberation calendrier reservation #{}: {}", reservation.getId(), e.getMessage());
            session.errors.add("Liberation calendrier reservation #" + reservation.getId()
                    + " : " + e.getMessage());
        }

        // Annuler les interventions (menage) liees
        cancelLinkedInterventions(reservation.getId(), session.orgId);

        // Annuler la facture brouillon liee
        cancelLinkedDraftInvoice(reservation.getId());

        log.info("iCal sync: annulation cascade reservation #{} (property #{}, uid={})",
                reservation.getId(), reservation.getProperty().getId(), reservation.getExternalUid());
    }

    /**
     * Annule les interventions et ServiceRequests liees a une reservation.
     * Les interventions deja COMPLETED ou deja CANCELLED ne sont pas touchees.
     * Les paiements d'interventions non encore regles sont annules.
     */
    private void cancelLinkedInterventions(Long reservationId, Long orgId) {
        // Annuler les interventions
        List<Intervention> interventions = interventionRepository.findByReservationId(reservationId, orgId);
        for (Intervention intervention : interventions) {
            if (intervention.getStatus() != InterventionStatus.CANCELLED
                    && intervention.getStatus() != InterventionStatus.COMPLETED) {
                intervention.setStatus(InterventionStatus.CANCELLED);
                if (intervention.getPaymentStatus() != null
                        && intervention.getPaymentStatus() != PaymentStatus.PAID
                        && intervention.getPaymentStatus() != PaymentStatus.REFUNDED) {
                    intervention.setPaymentStatus(PaymentStatus.CANCELLED);
                }
                interventionRepository.save(intervention);
                log.debug("Intervention #{} annulee (reservation #{} annulee via iCal)",
                        intervention.getId(), reservationId);
            }
        }

        // Annuler les ServiceRequests liees
        List<ServiceRequest> srs = serviceRequestRepository.findByReservationId(reservationId, orgId);
        for (ServiceRequest sr : srs) {
            if (sr.getStatus() != RequestStatus.CANCELLED && sr.getStatus() != RequestStatus.COMPLETED) {
                sr.setStatus(RequestStatus.CANCELLED);
                serviceRequestRepository.save(sr);
                log.debug("ServiceRequest #{} annulee (reservation #{} annulee via iCal)",
                        sr.getId(), reservationId);
            }
        }
    }

    /**
     * Annule la facture brouillon liee a une reservation.
     * Seules les factures DRAFT sont annulees ; les factures emises/payees ne sont pas touchees.
     */
    private void cancelLinkedDraftInvoice(Long reservationId) {
        // Annule les brouillons (séjour ET commission) ; les factures émises/payées restent intactes.
        for (Invoice invoice : invoiceRepository.findAllByReservationId(reservationId)) {
            if (invoice.getStatus() == InvoiceStatus.DRAFT) {
                invoice.setStatus(InvoiceStatus.CANCELLED);
                invoiceRepository.save(invoice);
                log.debug("Facture #{} annulee (reservation #{} annulee via iCal)",
                        invoice.getId(), reservationId);
            }
        }
    }
}
