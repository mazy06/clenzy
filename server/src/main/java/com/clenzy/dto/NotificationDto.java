package com.clenzy.dto;

import com.clenzy.model.Notification;
import com.clenzy.service.NotificationFactsResolver.ReadFacts;
import com.clenzy.service.NotificationMetadata;
import com.clenzy.model.NotificationCategory;
import com.clenzy.model.NotificationType;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.time.Instant;

/**
 * DTO pour les notifications — correspond exactement au type Notification du frontend.
 */
public class NotificationDto {

    public Long id;
    public String userId;
    public String title;
    public String message;
    public String type;       // "info" | "success" | "warning" | "error"
    public String category;   // "intervention" | "service_request" | "payment" | "system" | "team"
    public String notificationKey;  // NotificationKey enum name (e.g. "INTERVENTION_CREATED")
    public boolean read;
    public String actionUrl;
    /** Faits structures attaches a l'evenement — lecture seule, affichage seul. */
    public JsonNode metadata;
    public Instant createdAt;

    private static final ObjectMapper MAPPER = new ObjectMapper();

    /**
     * Cle du fait porte-photo. Resolue a la LECTURE, jamais ecrite en base :
     * elle n'a pas sa place dans {@code NotificationMetadata}, qui declare ce
     * qu'un EMETTEUR peut deposer.
     */
    private static final String GUEST_AVATAR_URL = "guestAvatarUrl";

    // ─── Constructeurs ──────────────────────────────────────────────────────────

    public NotificationDto() {}

    // ─── Factory depuis Entity ──────────────────────────────────────────────────

    public static NotificationDto fromEntity(Notification entity) {
        return fromEntity(entity, null);
    }

    /**
     * Notification, faits de lecture compris.
     *
     * <p>Deux faits ne peuvent pas etre figes a l'emission — la photo du
     * voyageur, dont l'URL porte un ticket qui expire, et le sejour d'une carte
     * de supervision emise avant que ce fait n'existe. Ils sont resolus par
     * {@code NotificationFactsResolver} et greffes ici, aux cotes de ceux que
     * l'emetteur, lui, a bien ecrits.</p>
     */
    public static NotificationDto fromEntity(Notification entity, ReadFacts readFacts) {
        NotificationDto dto = new NotificationDto();
        dto.id = entity.getId();
        dto.userId = entity.getUserId();
        dto.title = entity.getTitle();
        dto.message = entity.getMessage();
        dto.type = entity.getType().getValue();
        dto.category = entity.getCategory().getValue();
        dto.notificationKey = entity.getNotificationKey() != null ? entity.getNotificationKey().name() : null;
        dto.read = entity.isRead();
        dto.actionUrl = entity.getActionUrl();
        dto.metadata = withReadFacts(parseMetadata(entity.getMetadata()), readFacts);
        dto.createdAt = entity.getCreatedAt();
        return dto;
    }

    /**
     * Greffe les faits de lecture. Rien a greffer, ou des faits qui ne sont pas
     * un objet : ils ressortent inchanges — une notification reste lisible meme
     * quand son voyageur n'a pas de photo, ce qui est le cas courant.
     */
    private static JsonNode withReadFacts(JsonNode metadata, ReadFacts readFacts) {
        if (readFacts == null) return metadata;
        if (!(metadata instanceof ObjectNode facts)) return metadata;
        if (readFacts.reservationId() != null) {
            facts.put(NotificationMetadata.RESERVATION_ID, readFacts.reservationId());
        }
        if (readFacts.guestAvatarUrl() != null && !readFacts.guestAvatarUrl().isBlank()) {
            facts.put(GUEST_AVATAR_URL, readFacts.guestAvatarUrl());
        }
        // La serrure et l'avis ne sont greffes que s'ils MANQUENT : quand
        // l'emetteur les a ecrits, ce sont les siens qui font foi.
        if (readFacts.deviceId() != null && !facts.has(NotificationMetadata.DEVICE_ID)) {
            facts.put(NotificationMetadata.DEVICE_ID, readFacts.deviceId());
        }
        if (readFacts.reviewId() != null && !facts.has(NotificationMetadata.REVIEW_ID)) {
            facts.put(NotificationMetadata.REVIEW_ID, readFacts.reviewId());
        }
        return facts;
    }

    /** Des faits illisibles n'empechent pas de lire la notification. */
    private static JsonNode parseMetadata(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return MAPPER.readTree(json);
        } catch (Exception e) {
            return null;
        }
    }

    // ─── Factory vers Entity ────────────────────────────────────────────────────

    /**
     * Volontairement sans {@code metadata} : les faits sont ecrits par le
     * serveur au moment de l'evenement, jamais recopies depuis un DTO entrant.
     */
    public Notification toEntity() {
        Notification entity = new Notification();
        entity.setUserId(this.userId);
        entity.setTitle(this.title);
        entity.setMessage(this.message);
        entity.setType(this.type != null ? NotificationType.fromValue(this.type) : NotificationType.INFO);
        entity.setCategory(this.category != null ? NotificationCategory.fromValue(this.category) : NotificationCategory.SYSTEM);
        entity.setRead(this.read);
        entity.setActionUrl(this.actionUrl);
        return entity;
    }
}
