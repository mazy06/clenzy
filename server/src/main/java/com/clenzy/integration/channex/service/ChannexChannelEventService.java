package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.model.ChannexSyncLog;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.NotificationKey;
import com.clenzy.service.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

/**
 * Phase B Channex — traitement des evenements webhook additionnels
 * (au-dela des bookings et du sync_error deja geres) :
 *
 * <ul>
 *   <li><b>booking_unmapped_room / booking_unmapped_rate</b> — priorite haute
 *       selon la doc : une resa est arrivee sur un room type / rate plan non
 *       mappe ({@code room_type_id} null dans la revision) → risque de DOUBLE
 *       RESERVATION tant que le mapping n'est pas corrige. Notification ERROR
 *       + sync log FAIL. La revision elle-meme est persistee par le drain du
 *       feed (le mapping Clenzy se resout par propriete, mono-room en VR) ;</li>
 *   <li><b>rate_error</b> — tarifs rejetes par l'OTA → notification ERROR +
 *       sync log FAIL (sans flag ERROR du mapping : la sync n'est pas morte) ;</li>
 *   <li><b>sync_warning</b> — avertissement non bloquant → notification WARNING ;</li>
 *   <li><b>cycle de vie channel</b> (new/updated/activate/deactivate/
 *       disconnect_channel, disconnect_listing) — notification : une
 *       deconnexion stoppe la distribution OTA sans aucun signe cote PMS ;</li>
 *   <li><b>evenements Airbnb</b> (reservation_request, alteration_request,
 *       inquiry, accepted/declined_reservation) — l'action (accepter/refuser)
 *       se fait dans l'ecran Channex embarque : on notifie avec le deep-link.</li>
 * </ul>
 *
 * <p>Lookup tenant-agnostic ({@code AnyOrg}) : meme convention que
 * {@link ChannexSyncErrorService} — le webhook arrive sans TenantContext,
 * l'authentification est le header {@code X-Channex-Token} et le mapping
 * porte son organizationId.</p>
 */
@Service
public class ChannexChannelEventService {

    private static final Logger log = LoggerFactory.getLogger(ChannexChannelEventService.class);

    private final ChannexPropertyMappingRepository mappingRepository;
    private final ChannexSyncLogService syncLogService;
    private final NotificationService notificationService;

    public ChannexChannelEventService(ChannexPropertyMappingRepository mappingRepository,
                                      ChannexSyncLogService syncLogService,
                                      NotificationService notificationService) {
        this.mappingRepository = mappingRepository;
        this.syncLogService = syncLogService;
        this.notificationService = notificationService;
    }

    /**
     * Resa sur room/rate non mappe. Retourne true si un mapping a ete trouve
     * (notification emise), false sinon.
     */
    @Transactional
    public boolean onUnmappedBooking(String channexPropertyId, String event) {
        Optional<ChannexPropertyMapping> mappingOpt = findMapping(channexPropertyId, event);
        if (mappingOpt.isEmpty()) return false;
        ChannexPropertyMapping mapping = mappingOpt.get();

        String detail = "booking_unmapped_room".equals(event)
            ? "room type non mappe" : "rate plan non mappe";
        syncLogService.record(mapping.getOrganizationId(), mapping.getClenzyPropertyId(),
            mapping.getId(), ChannexSyncLog.SyncType.PUSH_PROPERTY, ChannexSyncLog.Status.FAIL,
            0, Instant.now(), "Reservation recue sur un " + detail + " (" + event + ")");

        notifySafely(mapping, NotificationKey.CHANNEX_UNMAPPED_BOOKING,
            "Réservation sur un canal mal mappé",
            "Une réservation OTA est arrivée sur un " + detail + " côté Channex. "
                + "Vérifiez le mapping du logement — risque de double réservation tant "
                + "que ce n'est pas corrigé.",
            "/properties?diagnoseChannex=" + mapping.getClenzyPropertyId());
        return true;
    }

    /** Tarifs rejetes par l'OTA (rate_error). */
    @Transactional
    public boolean onRateError(String channexPropertyId, String errorDetail) {
        Optional<ChannexPropertyMapping> mappingOpt = findMapping(channexPropertyId, "rate_error");
        if (mappingOpt.isEmpty()) return false;
        ChannexPropertyMapping mapping = mappingOpt.get();

        String message = errorDetail != null && !errorDetail.isBlank()
            ? errorDetail : "Tarifs rejetes par l'OTA (voir channel logs Channex)";
        syncLogService.record(mapping.getOrganizationId(), mapping.getClenzyPropertyId(),
            mapping.getId(), ChannexSyncLog.SyncType.PUSH_PROPERTY, ChannexSyncLog.Status.FAIL,
            0, Instant.now(), "rate_error: " + message);

        notifySafely(mapping, NotificationKey.CHANNEX_RATE_ERROR,
            "Tarifs rejetés par un canal OTA",
            "Un canal a rejeté les derniers tarifs poussés (" + message + "). "
                + "Les prix affichés côté OTA peuvent être obsolètes.",
            "/properties?diagnoseChannex=" + mapping.getClenzyPropertyId());
        return true;
    }

    /** Avertissement de sync non bloquant (sync_warning). */
    public boolean onSyncWarning(String channexPropertyId, String warningDetail) {
        Optional<ChannexPropertyMapping> mappingOpt = findMapping(channexPropertyId, "sync_warning");
        if (mappingOpt.isEmpty()) return false;
        ChannexPropertyMapping mapping = mappingOpt.get();

        String message = warningDetail != null && !warningDetail.isBlank()
            ? warningDetail : "Avertissement de synchronisation remonte par Channex";
        log.warn("ChannexChannelEvent[sync_warning]: property={} : {}",
            mapping.getClenzyPropertyId(), message);
        notifySafely(mapping, NotificationKey.CHANNEX_SYNC_WARNING,
            "Avertissement de synchronisation OTA",
            message,
            "/properties?diagnoseChannex=" + mapping.getClenzyPropertyId());
        return true;
    }

    /**
     * Cycle de vie d'un canal OTA. Les deconnexions/desactivations sont les cas
     * critiques : la distribution s'arrete sans aucun autre signal cote PMS.
     */
    public boolean onChannelLifecycleEvent(String channexPropertyId, String event) {
        Optional<ChannexPropertyMapping> mappingOpt = findMapping(channexPropertyId, event);
        if (mappingOpt.isEmpty()) return false;
        ChannexPropertyMapping mapping = mappingOpt.get();

        boolean distributionStopped = switch (event) {
            case "disconnect_channel", "disconnect_listing", "deactivate_channel" -> true;
            default -> false;
        };
        String title = distributionStopped
            ? "Canal OTA déconnecté ou désactivé"
            : "Canal OTA mis à jour";
        String message = switch (event) {
            case "new_channel" -> "Un nouveau canal OTA a été connecté sur ce logement via Channex.";
            case "updated_channel" -> "La configuration d'un canal OTA a été modifiée côté Channex.";
            case "activate_channel" -> "Un canal OTA a été activé — la distribution reprend.";
            case "deactivate_channel" -> "Un canal OTA a été désactivé — la distribution est SUSPENDUE sur ce canal.";
            case "disconnect_channel" -> "Un canal OTA a été déconnecté — la distribution est ARRÊTÉE sur ce canal.";
            case "disconnect_listing" -> "Un listing a été dissocié de son canal OTA — il n'est plus distribué.";
            default -> "Événement canal OTA : " + event;
        };

        log.info("ChannexChannelEvent[{}]: property={}", event, mapping.getClenzyPropertyId());
        notifySafely(mapping, NotificationKey.CHANNEX_CHANNEL_EVENT, title, message,
            "/properties?diagnoseChannex=" + mapping.getClenzyPropertyId());
        return true;
    }

    /**
     * Evenements Airbnb necessitant une action ou information de l'hote.
     * L'action (accepter/refuser une demande) se fait dans l'ecran Channex
     * embarque — le PMS notifie et route.
     */
    public boolean onAirbnbEvent(String channexPropertyId, String event) {
        Optional<ChannexPropertyMapping> mappingOpt = findMapping(channexPropertyId, event);
        if (mappingOpt.isEmpty()) return false;
        ChannexPropertyMapping mapping = mappingOpt.get();

        String title = switch (event) {
            case "reservation_request" -> "Demande de réservation Airbnb — action requise";
            case "alteration_request" -> "Demande de modification Airbnb — action requise";
            case "inquiry" -> "Nouvelle question de voyageur Airbnb";
            case "accepted_reservation" -> "Demande Airbnb acceptée";
            case "declined_reservation" -> "Demande Airbnb refusée";
            default -> "Événement Airbnb : " + event;
        };
        boolean actionRequired = "reservation_request".equals(event)
            || "alteration_request".equals(event);
        String message = actionRequired
            ? "Une demande Airbnb attend une réponse. Traitez-la depuis l'écran Channex "
                + "du logement (Intégrations) avant expiration."
            : "Événement Airbnb reçu via Channex (" + event + ").";

        log.info("ChannexChannelEvent[{}]: property={} actionRequired={}",
            event, mapping.getClenzyPropertyId(), actionRequired);
        notifySafely(mapping, NotificationKey.CHANNEX_AIRBNB_REQUEST, title, message,
            "/properties?diagnoseChannex=" + mapping.getClenzyPropertyId());
        return true;
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    private Optional<ChannexPropertyMapping> findMapping(String channexPropertyId, String event) {
        if (channexPropertyId == null || channexPropertyId.isBlank()) {
            log.warn("ChannexChannelEvent[{}]: pas de property_id, ignore", event);
            return Optional.empty();
        }
        Optional<ChannexPropertyMapping> mapping =
            mappingRepository.findByChannexPropertyIdAnyOrg(channexPropertyId);
        if (mapping.isEmpty()) {
            log.warn("ChannexChannelEvent[{}]: mapping introuvable pour property={}",
                event, channexPropertyId);
        }
        return mapping;
    }

    /** La notification est un effet secondaire best-effort : jamais bloquante. */
    private void notifySafely(ChannexPropertyMapping mapping, NotificationKey key,
                              String title, String message, String link) {
        try {
            notificationService.notifyAdminsAndManagersByOrgId(
                mapping.getOrganizationId(), key, title, message, link);
        } catch (Exception e) {
            log.warn("ChannexChannelEvent: notification KO ({}): {}", key, e.getMessage());
        }
    }
}
