package com.clenzy.service;

import com.clenzy.dto.ICalImportDto.*;
import com.clenzy.model.*;
import com.clenzy.repository.ICalFeedRepository;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.model.NotificationKey;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.net.InetAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service de gestion de l'import iCal.
 * Parse les fichiers .ics (Airbnb, Booking, Vrbo, etc.)
 * et cree les interventions de menage correspondantes.
 */
@Service
public class ICalImportService {

    private static final Logger log = LoggerFactory.getLogger(ICalImportService.class);

    private static final Set<String> ALLOWED_FORFAITS = Set.of("confort", "premium");

    // SSRF protection: max response size (5 MB)
    private static final long MAX_ICAL_RESPONSE_BYTES = 5 * 1024 * 1024;

    private final ICalFeedRepository icalFeedRepository;
    private final InterventionRepository interventionRepository;
    private final ServiceRequestRepository serviceRequestRepository;
    private final ReservationRepository reservationRepository2;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;
    private final NotificationService notificationService;
    private final PricingConfigService pricingConfigService;
    private final TenantContext tenantContext;
    private final HttpClient httpClient;

    public ICalImportService(ICalFeedRepository icalFeedRepository,
                             InterventionRepository interventionRepository,
                             ServiceRequestRepository serviceRequestRepository,
                             ReservationRepository reservationRepository2,
                             PropertyRepository propertyRepository,
                             UserRepository userRepository,
                             AuditLogService auditLogService,
                             NotificationService notificationService,
                             PricingConfigService pricingConfigService,
                             TenantContext tenantContext) {
        this.icalFeedRepository = icalFeedRepository;
        this.interventionRepository = interventionRepository;
        this.serviceRequestRepository = serviceRequestRepository;
        this.reservationRepository2 = reservationRepository2;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.auditLogService = auditLogService;
        this.notificationService = notificationService;
        this.pricingConfigService = pricingConfigService;
        this.tenantContext = tenantContext;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .followRedirects(HttpClient.Redirect.NEVER) // SSRF: disable redirects to prevent bypass
                .build();
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

        List<ICalEventPreview> events = fetchAndParseICalFeed(url);

        PreviewResponse response = new PreviewResponse();
        response.setEvents(events);
        response.setPropertyName(property.getName());
        response.setTotalReservations(events.size());
        response.setTotalBlocked(0);

        return response;
    }

    /**
     * Importe les reservations depuis un feed iCal et cree les interventions.
     */
    @Transactional
    public ImportResponse importICalFeed(ImportRequest request, String keycloakId) {
        // Verifier le forfait
        if (!isUserAllowed(keycloakId)) {
            throw new SecurityException("Votre forfait ne permet pas l'import iCal. Forfait Confort ou Premium requis.");
        }

        Property property = propertyRepository.findById(request.getPropertyId())
                .orElseThrow(() -> new IllegalArgumentException("Propriete introuvable : " + request.getPropertyId()));

        // Verifier l'ownership (Admin et Manager peuvent importer sur toute propriete)
        User user = userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new SecurityException("Utilisateur introuvable"));

        boolean isAdminOrManager = user.getRole().isPlatformStaff();
        if (!isAdminOrManager && !property.getOwner().getId().equals(user.getId())) {
            throw new SecurityException("Vous n'etes pas proprietaire de ce logement");
        }

        // Parser le feed — toutes les entrees sont traitees comme des reservations
        List<ICalEventPreview> events = fetchAndParseICalFeed(request.getUrl());
        List<ICalEventPreview> reservations = events;

        // Dedoublonnage : on ne skip QUE si la Reservation existe deja en base.
        // Les interventions orphelines (sans reservation) ne bloquent PAS le re-import.
        // Cela permet de recreer les reservations manquantes apres mise a jour du code.

        // Sauvegarder/mettre a jour le feed en premier (pour avoir le feedId)
        ICalFeed feed = icalFeedRepository.findByPropertyIdAndUrl(property.getId(), request.getUrl(), tenantContext.getRequiredOrganizationId());
        if (feed == null) {
            feed = new ICalFeed(property, request.getUrl(), request.getSourceName());
            feed.setOrganizationId(tenantContext.getOrganizationId());
        }
        feed.setAutoCreateInterventions(request.isAutoCreateInterventions());
        feed = icalFeedRepository.save(feed);

        int imported = 0;
        int skipped = 0;
        List<String> errors = new ArrayList<>();

        // Determiner la source a partir du nom
        String sourceKey = detectSource(request.getSourceName());

        for (ICalEventPreview event : reservations) {
            try {
                // Dedoublonnage par UID : skip uniquement si la Reservation existe deja
                if (event.getUid() != null) {
                    if (reservationRepository2.existsByExternalUidAndPropertyId(event.getUid(), property.getId())) {
                        skipped++;
                        continue;
                    }
                }

                // 1. Creer la Reservation
                Reservation reservation = new Reservation();
                reservation.setProperty(property);
                reservation.setGuestName(event.getGuestName());
                reservation.setGuestCount(property.getMaxGuests() != null ? property.getMaxGuests() : 2);
                reservation.setCheckIn(event.getDtStart());
                LocalDate checkOut = event.getDtEnd() != null ? event.getDtEnd() : event.getDtStart().plusDays(1);
                reservation.setCheckOut(checkOut);
                // Utiliser les heures par defaut de la propriete, sinon fallback global
                String defaultCheckIn = property.getDefaultCheckInTime() != null ? property.getDefaultCheckInTime() : "15:00";
                String defaultCheckOut = property.getDefaultCheckOutTime() != null ? property.getDefaultCheckOutTime() : "11:00";
                reservation.setCheckInTime(defaultCheckIn);
                reservation.setCheckOutTime(defaultCheckOut);
                reservation.setStatus("confirmed");
                reservation.setSource(sourceKey);
                reservation.setSourceName(request.getSourceName());
                reservation.setConfirmationCode(event.getConfirmationCode());
                reservation.setExternalUid(event.getUid());
                reservation.setIcalFeed(feed);
                reservation.setNotes(event.getDescription());
                reservation.setOrganizationId(tenantContext.getOrganizationId());
                reservation = reservationRepository2.save(reservation);

                // 2. Creer l'intervention de menage (si auto-create active ET pas deja existante)
                if (request.isAutoCreateInterventions()) {
                    // Verifier si une intervention avec ce UID existe deja (via specialInstructions)
                    boolean interventionExists = false;
                    if (event.getUid() != null) {
                        List<Intervention> existingInterventions = interventionRepository.findByPropertyId(property.getId(), tenantContext.getRequiredOrganizationId());
                        interventionExists = existingInterventions.stream()
                                .map(Intervention::getSpecialInstructions)
                                .filter(Objects::nonNull)
                                .anyMatch(instr -> instr.contains("[ICAL:" + event.getUid() + "]"));
                    }
                    if (!interventionExists) {
                        createCleaningIntervention(property, event, request.getSourceName(), true);
                    }
                }

                imported++;

            } catch (Exception e) {
                log.warn("Erreur import evenement {}: {}", event.getUid(), e.getMessage());
                errors.add("Evenement " + event.getSummary() + " : " + e.getMessage());
            }
        }

        // Mettre a jour le feed avec les resultats
        feed.setLastSyncAt(LocalDateTime.now());
        feed.setLastSyncStatus(errors.isEmpty() ? "SUCCESS" : "PARTIAL");
        feed.setLastSyncError(errors.isEmpty() ? null : String.join("; ", errors));
        feed.setEventsImported(feed.getEventsImported() + imported);
        icalFeedRepository.save(feed);

        // Audit
        auditLogService.logSync("ICalImport", feed.getId().toString(),
                "Import iCal: " + imported + " importees, " + skipped + " doublons ignores, " + errors.size() + " erreurs");

        log.info("Import iCal termine pour propriete {} ({}): {} importees, {} doublons, {} erreurs",
                property.getName(), request.getSourceName(), imported, skipped, errors.size());

        ImportResponse response = new ImportResponse();
        response.setImported(imported);
        response.setSkipped(skipped);
        response.setErrors(errors);
        response.setFeedId(feed.getId());

        // Notify user about import result
        try {
            if (errors.isEmpty()) {
                notificationService.notify(
                    keycloakId,
                    NotificationKey.ICAL_IMPORT_SUCCESS,
                    "Import iCal reussi",
                    imported + " reservations importees pour " + property.getName(),
                    "/dashboard"
                );
            } else {
                notificationService.notify(
                    keycloakId,
                    NotificationKey.ICAL_IMPORT_FAILED,
                    "Import iCal partiel",
                    imported + " importees, " + errors.size() + " erreurs pour " + property.getName(),
                    "/dashboard"
                );
            }
        } catch (Exception e) {
            log.warn("Erreur notification import iCal: {}", e.getMessage());
        }

        return response;
    }

    /**
     * Telecharge et parse un fichier iCal depuis une URL.
     * Inclut : validation SSRF (via ICalUrlValidator), limite de taille,
     * parsing des evenements (via ICalEventParser).
     * Protection DNS rebinding : on resout le DNS une seule fois dans ICalUrlValidator,
     * puis on force la meme IP dans la requete HTTP pour eviter le TOCTOU.
     */
    @CircuitBreaker(name = "ical-import")
    public List<ICalEventPreview> fetchAndParseICalFeed(String url) {
        // Validate URL and resolve DNS (SSRF + DNS rebinding protection)
        InetAddress resolvedAddress = ICalUrlValidator.validateAndResolve(url);

        try {
            InputStream limitedStream = downloadICalContent(url, resolvedAddress);
            return ICalEventParser.parseEvents(limitedStream);
        } catch (java.net.URISyntaxException e) {
            log.error("Erreur construction URI resolue depuis {}: {}", url, e.getMessage());
            throw new RuntimeException("URL iCal invalide : " + e.getMessage());
        } catch (IOException | InterruptedException e) {
            log.error("Erreur telechargement iCal depuis {}: {}", url, e.getMessage());
            throw new RuntimeException("Impossible de telecharger le calendrier iCal : " + e.getMessage());
        }
    }

    /**
     * Downloads iCal content from the given URL using the pre-resolved IP address.
     * Returns a size-limited InputStream to prevent memory exhaustion.
     */
    private InputStream downloadICalContent(String url, InetAddress resolvedAddress)
            throws java.net.URISyntaxException, IOException, InterruptedException {
        URI originalUri = URI.create(url.trim());
        URI resolvedUri = new URI(
                originalUri.getScheme(),
                null, // userInfo
                resolvedAddress.getHostAddress(),
                originalUri.getPort() == -1 ? 443 : originalUri.getPort(),
                originalUri.getPath(),
                originalUri.getQuery(),
                null
        );

        HttpRequest request = HttpRequest.newBuilder()
                .uri(resolvedUri)
                .GET()
                .timeout(Duration.ofSeconds(30))
                .header("User-Agent", "Clenzy-PMS/1.0")
                .header("Host", originalUri.getHost()) // Keep original Host for SNI/TLS
                .build();

        HttpResponse<InputStream> response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());

        if (response.statusCode() != 200) {
            throw new IOException("Erreur HTTP " + response.statusCode() + " lors du telechargement du calendrier");
        }

        // Limit response size to prevent memory exhaustion
        return new java.io.FilterInputStream(response.body()) {
            private long bytesRead = 0;
            @Override
            public int read() throws IOException {
                if (bytesRead >= MAX_ICAL_RESPONSE_BYTES) {
                    throw new IOException("Calendrier iCal trop volumineux (limite: " + MAX_ICAL_RESPONSE_BYTES / 1024 / 1024 + " Mo)");
                }
                int b = super.read();
                if (b != -1) bytesRead++;
                return b;
            }
            @Override
            public int read(byte[] buf, int off, int len) throws IOException {
                if (bytesRead >= MAX_ICAL_RESPONSE_BYTES) {
                    throw new IOException("Calendrier iCal trop volumineux (limite: " + MAX_ICAL_RESPONSE_BYTES / 1024 / 1024 + " Mo)");
                }
                int n = super.read(buf, off, (int) Math.min(len, MAX_ICAL_RESPONSE_BYTES - bytesRead));
                if (n > 0) bytesRead += n;
                return n;
            }
        };
    }

    /**
     * Cree automatiquement une intervention de menage pour une reservation importee.
     * Suit le meme pattern que AirbnbReservationService.createCleaningIntervention()
     */
    private void createCleaningIntervention(Property property, ICalEventPreview event,
                                            String sourceName, boolean autoSchedule) {
        User owner = property.getOwner();

        // Date du checkout avec l'heure par defaut de la propriete
        LocalDate checkOut = event.getDtEnd() != null ? event.getDtEnd() : event.getDtStart().plusDays(1);
        String defaultCheckOutTime = property.getDefaultCheckOutTime() != null ? property.getDefaultCheckOutTime() : "11:00";
        LocalTime checkOutTime = LocalTime.parse(defaultCheckOutTime);
        LocalDateTime scheduledDate = LocalDateTime.of(checkOut, checkOutTime);

        // Estimer la duree et le cout
        int guestCount = property.getMaxGuests() != null ? property.getMaxGuests() : 2;
        int estimatedDuration = estimateCleaningDuration(property, guestCount).intValue();
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
        ServiceRequest serviceRequest = new ServiceRequest(
                srTitle,
                ServiceType.CLEANING,
                scheduledDate,
                owner != null ? owner : property.getOwner(),
                property
        );
        serviceRequest.setPriority(Priority.HIGH);
        serviceRequest.setStatus(RequestStatus.APPROVED);
        serviceRequest.setEstimatedDurationHours(estimatedDuration);
        serviceRequest.setEstimatedCost(estimatedCost);
        serviceRequest.setGuestCheckoutTime(scheduledDate);
        serviceRequest.setGuestCheckinTime(LocalDateTime.of(checkOut, LocalTime.of(15, 0)));
        serviceRequest.setSpecialInstructions(specialInstructions);
        serviceRequest.setDescription("Import iCal " + sourceName
                + (event.getGuestName() != null ? " — Guest: " + event.getGuestName() : "")
                + (event.getConfirmationCode() != null ? " (" + event.getConfirmationCode() + ")" : ""));
        serviceRequest.setOrganizationId(tenantContext.getOrganizationId());

        serviceRequest = serviceRequestRepository.save(serviceRequest);

        // ─── 2. Creer l'Intervention ───
        Intervention intervention = new Intervention();

        intervention.setTitle(srTitle);
        intervention.setDescription("Menage apres depart du guest "
                + (event.getGuestName() != null ? event.getGuestName() : "")
                + (event.getConfirmationCode() != null ? " (reservation " + event.getConfirmationCode() + ")" : "")
                + " | Import iCal " + sourceName);

        intervention.setType(ServiceType.CLEANING.name());

        // Determiner le status selon le mode de paiement du host
        InterventionStatus interventionStatus;
        if (autoSchedule) {
            if (owner != null && owner.isDeferredPayment()) {
                interventionStatus = InterventionStatus.PENDING;
            } else {
                interventionStatus = InterventionStatus.AWAITING_PAYMENT;
            }
        } else {
            interventionStatus = InterventionStatus.PENDING;
        }
        intervention.setStatus(interventionStatus);

        intervention.setPriority(Priority.HIGH.name());
        intervention.setProperty(property);
        intervention.setServiceRequest(serviceRequest);

        intervention.setScheduledDate(scheduledDate);
        intervention.setGuestCheckoutTime(scheduledDate);
        intervention.setGuestCheckinTime(LocalDateTime.of(checkOut, LocalTime.of(15, 0)));

        intervention.setEstimatedDurationHours(estimatedDuration);
        intervention.setEstimatedCost(estimatedCost);
        intervention.setSpecialInstructions(specialInstructions);

        intervention.setIsUrgent(false);
        intervention.setRequiresFollowUp(false);

        if (owner != null) {
            intervention.setRequestor(owner);
        }

        intervention.setOrganizationId(tenantContext.getOrganizationId());
        interventionRepository.save(intervention);

        log.info("Intervention menage #{} creee pour propriete {} ({}, {}, auto={})",
                intervention.getId(), property.getName(), sourceName,
                event.getGuestName() != null ? event.getGuestName() : "N/A", autoSchedule);
    }

    /**
     * Estime la duree de menage.
     * Meme formule que AirbnbReservationService.estimateCleaningDuration().
     */
    private BigDecimal estimateCleaningDuration(Property property, int guestCount) {
        double base = 1.5;
        if (property.getBedroomCount() != null) {
            base += property.getBedroomCount() * 0.5;
        }
        if (guestCount > 2) {
            base += (guestCount - 2) * 0.25;
        }
        if (property.getSquareMeters() != null && property.getSquareMeters() > 80) {
            base += 0.5;
        }
        return BigDecimal.valueOf(Math.ceil(base * 2) / 2);
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
            default: return "autre"; // LOFT, GUEST_ROOM, COTTAGE, CHALET, BOAT, OTHER
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
            log.warn("Erreur notification ICAL_FEED_DELETED: {}", e.getMessage());
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
            log.warn("Erreur notification ICAL_AUTO_INTERVENTIONS_TOGGLED: {}", e.getMessage());
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

        ImportResponse response = importICalFeed(request, keycloakId);

        try {
            notificationService.notify(
                keycloakId,
                NotificationKey.ICAL_SYNC_COMPLETED,
                "Synchronisation iCal terminee",
                "Feed " + feed.getSourceName() + " synchronise : " + response.getImported() + " importees",
                "/dashboard"
            );
        } catch (Exception e) {
            log.warn("Erreur notification ICAL_SYNC_COMPLETED: {}", e.getMessage());
        }

        return response;
    }

    /**
     * Synchronise tous les feeds actifs (appele par le scheduler).
     * @deprecated Utiliser {@link #syncFeeds(List)} avec groupement par org depuis le scheduler.
     */
    @Deprecated
    @Transactional
    public void syncAllActiveFeeds() {
        List<ICalFeed> activeFeeds = icalFeedRepository.findBySyncEnabledTrue();
        syncFeeds(activeFeeds);
    }

    /**
     * Synchronise une liste de feeds iCal (appele par le scheduler, groupe par org).
     * Chaque feed est traite independamment — une erreur sur un feed n'arrete pas les suivants.
     */
    @Transactional
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
                    log.debug("Feed {} ignore : proprietaire sans forfait adequat", feed.getId());
                    continue;
                }

                ImportRequest request = new ImportRequest();
                request.setUrl(feed.getUrl());
                request.setPropertyId(feed.getPropertyId());
                request.setSourceName(feed.getSourceName());
                request.setAutoCreateInterventions(feed.isAutoCreateInterventions());

                ImportResponse result = importICalFeed(request, ownerKeycloakId);
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
