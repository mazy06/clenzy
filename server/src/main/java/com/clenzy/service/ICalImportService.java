package com.clenzy.service;

import com.clenzy.dto.ICalImportDto.*;
import com.clenzy.model.*;
import com.clenzy.repository.ICalFeedRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.ical.FeedUrlMasker;
import com.clenzy.service.ical.ICalBlockImporter;
import com.clenzy.service.ical.ICalCleaningScheduler;
import com.clenzy.service.ical.ICalFeedDownloader;
import com.clenzy.service.ical.ICalImportSession;
import com.clenzy.service.ical.ICalOrphanDetector;
import com.clenzy.service.ical.ICalReservationImporter;
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
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service de gestion de l'import iCal.
 * Parse les fichiers .ics (Airbnb, Booking, Vrbo, etc.)
 * et cree les interventions de menage correspondantes.
 *
 * <p>Orchestration uniquement — les responsabilites sont decoupees en collaborateurs :</p>
 * <ul>
 *   <li>{@link ICalFeedDownloader} : telechargement (validation SSRF + connexion
 *       epinglee anti DNS-rebinding)</li>
 *   <li>{@link ICalReservationImporter} : import d'un evenement -> Reservation
 *       (dedup par UID scope au feed, pricing, guest)</li>
 *   <li>{@link ICalOrphanDetector} : detection/annulation des reservations orphelines
 *       (garde-fous anti-annulation massive)</li>
 *   <li>{@link ICalCleaningScheduler} : creation/relance des demandes de menage</li>
 * </ul>
 */
@Service
public class ICalImportService {

    private static final Logger log = LoggerFactory.getLogger(ICalImportService.class);

    private static final Set<String> ALLOWED_FORFAITS = Set.of("confort", "premium");

    private final ICalFeedRepository icalFeedRepository;
    private final ServiceRequestRepository serviceRequestRepository;
    private final ReservationRepository reservationRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;
    private final NotificationService notificationService;
    private final TenantContext tenantContext;
    private final ServiceRequestService serviceRequestService;
    private final OtaReservationInvoicingService otaInvoicingService;
    private final ICalFeedDownloader feedDownloader;
    private final ICalReservationImporter reservationImporter;
    private final ICalBlockImporter blockImporter;
    private final ICalOrphanDetector orphanDetector;
    private final ICalCleaningScheduler cleaningScheduler;
    /** Proxy Spring de ce bean : permet a syncFeeds d'invoquer importICalFeed AVEC sa
     *  propre transaction (l'auto-invocation directe contournerait le proxy, T-BP-06). */
    private final ObjectProvider<ICalImportService> self;

    public ICalImportService(ICalFeedRepository icalFeedRepository,
                             ServiceRequestRepository serviceRequestRepository,
                             ReservationRepository reservationRepository,
                             PropertyRepository propertyRepository,
                             UserRepository userRepository,
                             AuditLogService auditLogService,
                             NotificationService notificationService,
                             TenantContext tenantContext,
                             @org.springframework.context.annotation.Lazy ServiceRequestService serviceRequestService,
                             OtaReservationInvoicingService otaInvoicingService,
                             ICalFeedDownloader feedDownloader,
                             ICalReservationImporter reservationImporter,
                             ICalBlockImporter blockImporter,
                             ICalOrphanDetector orphanDetector,
                             ICalCleaningScheduler cleaningScheduler,
                             ObjectProvider<ICalImportService> self) {
        this.icalFeedRepository = icalFeedRepository;
        this.serviceRequestRepository = serviceRequestRepository;
        this.reservationRepository = reservationRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.auditLogService = auditLogService;
        this.notificationService = notificationService;
        this.tenantContext = tenantContext;
        this.serviceRequestService = serviceRequestService;
        this.otaInvoicingService = otaInvoicingService;
        this.feedDownloader = feedDownloader;
        this.reservationImporter = reservationImporter;
        this.blockImporter = blockImporter;
        this.orphanDetector = orphanDetector;
        this.cleaningScheduler = cleaningScheduler;
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
        List<ICalEventPreview> blockedEvents = filterBlockedEvents(parseResult.events());

        ICalFeed feed = upsertFeed(property, request);
        ICalImportSession session = new ICalImportSession(request, property, feed, orgId,
                detectSource(request.getSourceName()));
        recordParseAnomalies(session, parseResult);
        reservationImporter.preloadKnownFeedReservations(session);

        for (ICalEventPreview event : reservationEvents) {
            importEvent(session, event);
        }

        orphanDetector.detectAndCancelOrphans(session, reservationEvents);
        // Blocages OTA ("Not available", "Blocked") -> CalendarDay BLOCKED (planning + booking engine).
        blockImporter.importBlocks(session, blockedEvents);
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
        return events.stream()
                .filter(e -> !"blocked".equals(e.getType()))
                .collect(Collectors.toList());
    }

    /**
     * Isole les blocages de calendrier ("Not available", "Blocked", ...) : reconcilies
     * en CalendarDay BLOCKED par {@link ICalBlockImporter}, separement des reservations.
     */
    private static List<ICalEventPreview> filterBlockedEvents(List<ICalEventPreview> events) {
        return events.stream()
                .filter(e -> "blocked".equals(e.getType()))
                .collect(Collectors.toList());
    }

    /**
     * Remonte dans le resultat de sync les anomalies de parsing (Z6-SECBUGS-05/07) :
     * evenements ecartes (dates non parsables) et evenements recurrents non expanses.
     * Pas de perte silencieuse : ces compteurs alimentent {@code session.errors}
     * (statut PARTIAL + notification utilisateur).
     */
    private void recordParseAnomalies(ICalImportSession session, ICalEventParser.ParseResult parseResult) {
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
     * Importe un evenement : creation ou annulation de la reservation
     * ({@link ICalReservationImporter}), puis creation/relance de la demande de
     * menage ({@link ICalCleaningScheduler}). Une erreur sur un evenement n'arrete
     * pas les suivants.
     */
    private void importEvent(ICalImportSession session, ICalEventPreview event) {
        try {
            Long reservationId = reservationImporter.importEvent(session, event);
            cleaningScheduler.maybeCreateOrRetryCleaningRequest(session, event, reservationId);
        } catch (Exception e) {
            // Pas un swallow : l'erreur est comptee dans le resultat de sync (statut PARTIAL).
            log.warn("Erreur import evenement {}: {}", event.getUid(), e.getMessage());
            session.errors.add("Evenement " + event.getSummary() + " : " + e.getMessage());
        }
    }

    /** Met a jour le feed avec les resultats de la synchronisation. */
    private void persistFeedSyncResult(ICalImportSession session) {
        ICalFeed feed = session.feed;
        feed.setLastSyncAt(LocalDateTime.now());
        feed.setLastSyncStatus(session.errors.isEmpty() ? "SUCCESS" : "PARTIAL");
        feed.setLastSyncError(session.errors.isEmpty() ? null : String.join("; ", session.errors));
        feed.setEventsImported(feed.getEventsImported() + session.imported);
        icalFeedRepository.save(feed);
    }

    private void auditAndLogResult(ICalImportSession session) {
        String auditMsg = String.format(
                "Import iCal: %d importees, %d doublons, %d annulees, %d jours bloques, %d jours liberes, %d erreurs",
                session.imported, session.skipped, session.cancelled,
                session.blocksApplied, session.blocksReleased, session.errors.size());
        auditLogService.logSync("ICalImport", session.feed.getId().toString(), auditMsg);

        log.info("Import iCal termine pour propriete {} ({}): {} importees, {} doublons, {} annulees, "
                        + "{} jours bloques, {} jours liberes, {} erreurs",
                session.property.getName(), session.request.getSourceName(),
                session.imported, session.skipped, session.cancelled,
                session.blocksApplied, session.blocksReleased, session.errors.size());
    }

    private ImportResponse buildResponse(ICalImportSession session) {
        ImportResponse response = new ImportResponse();
        response.setImported(session.imported);
        response.setSkipped(session.skipped);
        response.setCancelled(session.cancelled);
        response.setDaysBlocked(session.blocksApplied);
        response.setDaysReleased(session.blocksReleased);
        response.setErrors(session.errors);
        response.setFeedId(session.feed.getId());
        return response;
    }

    /**
     * Notifie l'utilisateur du resultat de l'import.
     * Uniquement quand il y a de nouvelles reservations, annulations ou erreurs —
     * les syncs silencieuses ne notifient pas.
     */
    private void notifyImportResult(ICalImportSession session, String keycloakId) {
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
}
