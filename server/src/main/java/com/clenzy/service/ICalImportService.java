package com.clenzy.service;

import com.clenzy.dto.ICalImportDto.*;
import com.clenzy.model.*;
import com.clenzy.repository.ICalFeedRepository;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.UserRepository;
import net.fortuna.ical4j.data.CalendarBuilder;
import net.fortuna.ical4j.data.ParserException;
import net.fortuna.ical4j.model.Calendar;
import net.fortuna.ical4j.model.Component;
import net.fortuna.ical4j.model.component.VEvent;
import net.fortuna.ical4j.model.property.Description;
import net.fortuna.ical4j.model.property.DtEnd;
import net.fortuna.ical4j.model.property.DtStart;
import net.fortuna.ical4j.model.property.Summary;
import net.fortuna.ical4j.model.property.Uid;
import com.clenzy.model.NotificationKey;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Service de gestion de l'import iCal.
 * Parse les fichiers .ics (Airbnb, Booking, Vrbo, etc.)
 * et cree les interventions de menage correspondantes.
 */
@Service
public class ICalImportService {

    private static final Logger log = LoggerFactory.getLogger(ICalImportService.class);

    // Pattern pour extraire le nom du guest et le code de confirmation du SUMMARY
    // Ex: "John Doe (HMXXXXXXXX)" ou "Réservation - John Doe"
    private static final Pattern SUMMARY_GUEST_PATTERN = Pattern.compile("^(.+?)\\s*\\(([A-Z0-9]+)\\)$");
    private static final Pattern DESCRIPTION_NIGHTS_PATTERN = Pattern.compile("NIGHTS:\\s*(\\d+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern DESCRIPTION_PHONE_PATTERN = Pattern.compile("PHONE:\\s*([+\\d\\s]+)", Pattern.CASE_INSENSITIVE);

    // Mots-cles indiquant une date bloquee (non une reservation)
    private static final List<String> BLOCKED_KEYWORDS = List.of(
            "not available", "airbnb (not available)", "blocked", "indisponible",
            "not available - airbnb", "reservé", "reserved"
    );

    private static final Set<String> ALLOWED_FORFAITS = Set.of("confort", "premium");

    // SSRF protection: max response size (5 MB) and max events per feed
    private static final long MAX_ICAL_RESPONSE_BYTES = 5 * 1024 * 1024;
    private static final int MAX_EVENTS_PER_FEED = 5000;
    private static final Set<String> ALLOWED_ICAL_SCHEMES = Set.of("https");

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
                    if (role == UserRole.ADMIN || role == UserRole.MANAGER) {
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

        boolean isAdminOrManager = user.getRole() == UserRole.ADMIN || user.getRole() == UserRole.MANAGER;
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
     * Valide une URL iCal contre les attaques SSRF.
     * Bloque : schemes non-HTTPS, IPs privees/loopback/link-local, metadata endpoints.
     */
    private void validateICalUrl(String url) {
        if (url == null || url.isBlank()) {
            throw new IllegalArgumentException("L'URL du calendrier iCal ne peut pas etre vide");
        }

        URI uri;
        try {
            uri = URI.create(url.trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("URL iCal invalide : " + e.getMessage());
        }

        // Scheme check: HTTPS only
        String scheme = uri.getScheme();
        if (scheme == null || !ALLOWED_ICAL_SCHEMES.contains(scheme.toLowerCase())) {
            throw new IllegalArgumentException("Seul le protocole HTTPS est autorise pour les URLs iCal (recu: " + scheme + ")");
        }

        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            throw new IllegalArgumentException("L'URL iCal doit contenir un nom d'hote valide");
        }

        // Block localhost variants
        String hostLower = host.toLowerCase();
        if (hostLower.equals("localhost") || hostLower.equals("127.0.0.1")
                || hostLower.equals("[::1]") || hostLower.equals("0.0.0.0")
                || hostLower.endsWith(".local") || hostLower.endsWith(".internal")) {
            throw new IllegalArgumentException("Les adresses locales ne sont pas autorisees pour les URLs iCal");
        }

        // Block cloud metadata endpoints
        if (hostLower.equals("169.254.169.254") || hostLower.equals("metadata.google.internal")) {
            throw new IllegalArgumentException("Les endpoints de metadata cloud ne sont pas autorises");
        }

        // DNS resolution + private IP check
        try {
            InetAddress[] addresses = InetAddress.getAllByName(host);
            for (InetAddress addr : addresses) {
                if (addr.isLoopbackAddress() || addr.isSiteLocalAddress()
                        || addr.isLinkLocalAddress() || addr.isAnyLocalAddress()) {
                    throw new IllegalArgumentException("L'URL iCal pointe vers une adresse IP privee ou locale");
                }
            }
        } catch (UnknownHostException e) {
            throw new IllegalArgumentException("Impossible de resoudre le nom d'hote : " + host);
        }
    }

    /**
     * Telecharge et parse un fichier iCal depuis une URL.
     * Inclut : validation SSRF, limite de taille, limite d'evenements.
     */
    public List<ICalEventPreview> fetchAndParseICalFeed(String url) {
        validateICalUrl(url);

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url.trim()))
                    .GET()
                    .timeout(Duration.ofSeconds(30))
                    .header("User-Agent", "Clenzy-PMS/1.0")
                    .build();

            HttpResponse<InputStream> response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());

            if (response.statusCode() != 200) {
                throw new IOException("Erreur HTTP " + response.statusCode() + " lors du telechargement du calendrier");
            }

            // Limit response size to prevent memory exhaustion
            InputStream limitedStream = new java.io.FilterInputStream(response.body()) {
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

            CalendarBuilder builder = new CalendarBuilder();
            Calendar calendar = builder.build(limitedStream);

            List<ICalEventPreview> events = new ArrayList<>();
            int eventCount = 0;

            for (Object component : calendar.getComponents(Component.VEVENT)) {
                if (++eventCount > MAX_EVENTS_PER_FEED) {
                    log.warn("Feed iCal {} depasse la limite de {} evenements, troncature", url, MAX_EVENTS_PER_FEED);
                    break;
                }
                VEvent vevent = (VEvent) component;
                ICalEventPreview preview = parseVEvent(vevent);
                if (preview != null) {
                    events.add(preview);
                }
            }

            // Trier par date de debut
            events.sort(Comparator.comparing(ICalEventPreview::getDtStart, Comparator.nullsLast(Comparator.naturalOrder())));

            return events;

        } catch (IOException | InterruptedException e) {
            log.error("Erreur telechargement iCal depuis {}: {}", url, e.getMessage());
            throw new RuntimeException("Impossible de telecharger le calendrier iCal : " + e.getMessage());
        } catch (ParserException e) {
            log.error("Erreur parsing iCal depuis {}: {}", url, e.getMessage());
            throw new RuntimeException("Format de calendrier iCal invalide : " + e.getMessage());
        }
    }

    /**
     * Parse un VEVENT iCal en preview.
     */
    private ICalEventPreview parseVEvent(VEvent vevent) {
        ICalEventPreview preview = new ICalEventPreview();

        // UID
        Uid uid = vevent.getUid();
        if (uid != null) {
            preview.setUid(uid.getValue());
        }

        // SUMMARY
        Summary summary = vevent.getSummary();
        String summaryText = summary != null ? summary.getValue() : "";
        preview.setSummary(summaryText);

        // Toutes les entrees iCal sont traitees comme des reservations
        preview.setType("reservation");

        // Extraire guest name et confirmation code du SUMMARY
        Matcher matcher = SUMMARY_GUEST_PATTERN.matcher(summaryText.trim());
        if (matcher.matches()) {
            preview.setGuestName(matcher.group(1).trim());
            preview.setConfirmationCode(matcher.group(2).trim());
        } else if (!summaryText.isBlank()) {
            // Pas de code de confirmation : utiliser le summary entier comme nom
            preview.setGuestName(summaryText.trim());
        }

        // DTSTART
        DtStart dtStart = vevent.getStartDate();
        if (dtStart != null) {
            try {
                String dateStr = dtStart.getValue();
                // Format DATE (yyyyMMdd) ou DATE-TIME
                if (dateStr.length() == 8) {
                    preview.setDtStart(LocalDate.parse(dateStr, DateTimeFormatter.BASIC_ISO_DATE));
                } else {
                    // Tenter ISO local date time
                    preview.setDtStart(LocalDate.parse(dateStr.substring(0, 8), DateTimeFormatter.BASIC_ISO_DATE));
                }
            } catch (Exception e) {
                log.warn("Impossible de parser DTSTART: {}", dtStart.getValue());
            }
        }

        // DTEND
        DtEnd dtEnd = vevent.getEndDate();
        if (dtEnd != null) {
            try {
                String dateStr = dtEnd.getValue();
                if (dateStr.length() == 8) {
                    preview.setDtEnd(LocalDate.parse(dateStr, DateTimeFormatter.BASIC_ISO_DATE));
                } else {
                    preview.setDtEnd(LocalDate.parse(dateStr.substring(0, 8), DateTimeFormatter.BASIC_ISO_DATE));
                }
            } catch (Exception e) {
                log.warn("Impossible de parser DTEND: {}", dtEnd.getValue());
            }
        }

        // DESCRIPTION
        Description description = vevent.getDescription();
        if (description != null) {
            preview.setDescription(description.getValue());

            // Parser le nombre de nuits depuis la description
            Matcher nightsMatcher = DESCRIPTION_NIGHTS_PATTERN.matcher(description.getValue());
            if (nightsMatcher.find()) {
                preview.setNights(Integer.parseInt(nightsMatcher.group(1)));
            }
        }

        // Calculer les nuits si pas dans la description
        if (preview.getNights() == 0 && preview.getDtStart() != null && preview.getDtEnd() != null) {
            preview.setNights((int) (preview.getDtEnd().toEpochDay() - preview.getDtStart().toEpochDay()));
        }

        // Ignorer les evenements sans dates
        if (preview.getDtStart() == null) {
            return null;
        }

        return preview;
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
     */
    @Transactional
    public void syncAllActiveFeeds() {
        List<ICalFeed> activeFeeds = icalFeedRepository.findBySyncEnabledTrue();
        log.info("Synchro iCal planifiee : {} feeds actifs", activeFeeds.size());

        for (ICalFeed feed : activeFeeds) {
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
                log.info("Synchro feed {} : {} importees, {} doublons", feed.getId(), result.getImported(), result.getSkipped());

            } catch (Exception e) {
                log.error("Erreur synchro feed {}: {}", feed.getId(), e.getMessage());
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
        if (user.getRole() == UserRole.ADMIN || user.getRole() == UserRole.MANAGER) {
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
