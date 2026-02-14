package com.clenzy.service;

import com.clenzy.dto.ICalImportDto.*;
import com.clenzy.model.*;
import com.clenzy.repository.ICalFeedRepository;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.net.URI;
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

    private final ICalFeedRepository icalFeedRepository;
    private final InterventionRepository interventionRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;
    private final NotificationService notificationService;
    private final HttpClient httpClient;

    public ICalImportService(ICalFeedRepository icalFeedRepository,
                             InterventionRepository interventionRepository,
                             PropertyRepository propertyRepository,
                             UserRepository userRepository,
                             AuditLogService auditLogService,
                             NotificationService notificationService) {
        this.icalFeedRepository = icalFeedRepository;
        this.interventionRepository = interventionRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.auditLogService = auditLogService;
        this.notificationService = notificationService;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .followRedirects(HttpClient.Redirect.NORMAL)
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
        response.setTotalReservations((int) events.stream().filter(e -> "reservation".equals(e.getType())).count());
        response.setTotalBlocked((int) events.stream().filter(e -> "blocked".equals(e.getType())).count());

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

        // Parser le feed
        List<ICalEventPreview> events = fetchAndParseICalFeed(request.getUrl());
        List<ICalEventPreview> reservations = events.stream()
                .filter(e -> "reservation".equals(e.getType()))
                .collect(Collectors.toList());

        // Recuperer les UIDs existants pour le dedoublonnage
        List<Intervention> existingInterventions = interventionRepository.findByPropertyId(property.getId());
        Set<String> existingUids = existingInterventions.stream()
                .map(Intervention::getSpecialInstructions)
                .filter(Objects::nonNull)
                .flatMap(instructions -> {
                    // Extraire les UIDs du format [ICAL:xxx]
                    Pattern p = Pattern.compile("\\[ICAL:([^]]+)]");
                    Matcher m = p.matcher(instructions);
                    List<String> uids = new ArrayList<>();
                    while (m.find()) { uids.add(m.group(1)); }
                    return uids.stream();
                })
                .collect(Collectors.toSet());

        int imported = 0;
        int skipped = 0;
        List<String> errors = new ArrayList<>();

        for (ICalEventPreview event : reservations) {
            try {
                // Dedoublonnage par UID
                if (event.getUid() != null && existingUids.contains(event.getUid())) {
                    skipped++;
                    continue;
                }

                // Creer l'intervention
                createCleaningIntervention(property, event, request.getSourceName(),
                        request.isAutoCreateInterventions());
                imported++;

                if (event.getUid() != null) {
                    existingUids.add(event.getUid());
                }

            } catch (Exception e) {
                log.warn("Erreur import evenement {}: {}", event.getUid(), e.getMessage());
                errors.add("Evenement " + event.getSummary() + " : " + e.getMessage());
            }
        }

        // Sauvegarder/mettre a jour le feed
        ICalFeed feed = icalFeedRepository.findByPropertyIdAndUrl(property.getId(), request.getUrl());
        if (feed == null) {
            feed = new ICalFeed(property, request.getUrl(), request.getSourceName());
        }
        feed.setAutoCreateInterventions(request.isAutoCreateInterventions());
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
     */
    public List<ICalEventPreview> fetchAndParseICalFeed(String url) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .GET()
                    .timeout(Duration.ofSeconds(30))
                    .header("User-Agent", "Clenzy-PMS/1.0")
                    .build();

            HttpResponse<InputStream> response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());

            if (response.statusCode() != 200) {
                throw new IOException("Erreur HTTP " + response.statusCode() + " lors du telechargement du calendrier");
            }

            CalendarBuilder builder = new CalendarBuilder();
            Calendar calendar = builder.build(response.body());

            List<ICalEventPreview> events = new ArrayList<>();

            for (Object component : calendar.getComponents(Component.VEVENT)) {
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

        // Determiner le type : reservation ou bloquee
        String summaryLower = summaryText.toLowerCase().trim();
        boolean isBlocked = BLOCKED_KEYWORDS.stream().anyMatch(keyword -> summaryLower.contains(keyword));
        preview.setType(isBlocked ? "blocked" : "reservation");

        // Extraire guest name et confirmation code du SUMMARY
        if (!isBlocked) {
            Matcher matcher = SUMMARY_GUEST_PATTERN.matcher(summaryText.trim());
            if (matcher.matches()) {
                preview.setGuestName(matcher.group(1).trim());
                preview.setConfirmationCode(matcher.group(2).trim());
            } else {
                // Pas de code de confirmation : utiliser le summary entier comme nom
                preview.setGuestName(summaryText.trim());
            }
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
        Intervention intervention = new Intervention();

        intervention.setTitle("Menage " + sourceName + " — " + property.getName());
        intervention.setDescription("Menage apres depart du guest "
                + (event.getGuestName() != null ? event.getGuestName() : "")
                + (event.getConfirmationCode() != null ? " (reservation " + event.getConfirmationCode() + ")" : "")
                + " | Import iCal " + sourceName);

        intervention.setType(ServiceType.CLEANING.name());

        // Determiner le status selon le mode de paiement du host
        User owner = property.getOwner();
        InterventionStatus interventionStatus;
        if (autoSchedule) {
            if (owner != null && owner.isDeferredPayment()) {
                // Paiement differe : skip AWAITING_PAYMENT, direct en PENDING
                interventionStatus = InterventionStatus.PENDING;
            } else {
                // Paiement immediat requis
                interventionStatus = InterventionStatus.AWAITING_PAYMENT;
            }
        } else {
            interventionStatus = InterventionStatus.PENDING;
        }
        intervention.setStatus(interventionStatus);

        intervention.setPriority(Priority.HIGH.name());
        intervention.setProperty(property);

        // Date du checkout a 11h00
        LocalDate checkOut = event.getDtEnd() != null ? event.getDtEnd() : event.getDtStart().plusDays(1);
        intervention.setScheduledDate(LocalDateTime.of(checkOut, LocalTime.of(11, 0)));
        intervention.setGuestCheckoutTime(LocalDateTime.of(checkOut, LocalTime.of(11, 0)));
        intervention.setGuestCheckinTime(LocalDateTime.of(checkOut, LocalTime.of(15, 0)));

        // Estimer la duree de menage
        int guestCount = property.getMaxGuests() != null ? property.getMaxGuests() : 2;
        intervention.setEstimatedDurationHours(estimateCleaningDuration(property, guestCount).intValue());

        // Calculer le cout estime (pour le suivi du cumul impaye)
        intervention.setEstimatedCost(estimateCleaningCost(property));

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
        intervention.setSpecialInstructions(instructions.toString().trim());

        intervention.setIsUrgent(false);
        intervention.setRequiresFollowUp(false);

        // Requestor = owner de la propriete
        if (property.getOwner() != null) {
            intervention.setRequestor(property.getOwner());
        }

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
     * Estime le cout de menage en euros.
     * Base forfait : Essentiel 35, Confort 55, Premium 80 EUR.
     * Coefficient surface : +10% si > 60m2, +25% si > 100m2.
     */
    private BigDecimal estimateCleaningCost(Property property) {
        // Prix de base selon le forfait du owner
        double baseCost = 55.0; // defaut Confort
        if (property.getOwner() != null && property.getOwner().getForfait() != null) {
            String forfait = property.getOwner().getForfait().toLowerCase();
            switch (forfait) {
                case "essentiel": baseCost = 35.0; break;
                case "confort": baseCost = 55.0; break;
                case "premium": baseCost = 80.0; break;
                default: baseCost = 55.0;
            }
        }
        // Coefficient surface
        if (property.getSquareMeters() != null) {
            if (property.getSquareMeters() > 100) {
                baseCost *= 1.25;
            } else if (property.getSquareMeters() > 60) {
                baseCost *= 1.10;
            }
        }
        return BigDecimal.valueOf(Math.round(baseCost * 100.0) / 100.0);
    }

    // ---- Gestion des feeds ----

    /**
     * Liste les feeds iCal d'un utilisateur.
     */
    public List<FeedDto> getUserFeeds(String keycloakId) {
        User user = userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new SecurityException("Utilisateur introuvable"));

        return icalFeedRepository.findByPropertyOwnerId(user.getId()).stream()
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
