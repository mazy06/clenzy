package com.clenzy.dto;

import com.clenzy.model.Notification;
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
     * Notification, photo du voyageur comprise.
     *
     * <p>La photo ne peut pas etre figee a l'emission : son URL porte un ticket
     * signe valable un quart d'heure, et une notification se lit souvent bien
     * plus tard. Elle est donc frappee a la lecture
     * ({@code NotificationGuestAvatarResolver}) et greffee aux faits, ou elle
     * accompagne le NOM du voyageur qui, lui, a bien ete ecrit a l'emission.</p>
     */
    public static NotificationDto fromEntity(Notification entity, String guestAvatarUrl) {
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
        dto.metadata = withGuestAvatar(parseMetadata(entity.getMetadata()), guestAvatarUrl);
        dto.createdAt = entity.getCreatedAt();
        return dto;
    }

    /**
     * Greffe la photo aux faits. Rien a greffer, ou des faits qui ne sont pas un
     * objet : les faits ressortent inchanges — une notification reste lisible
     * meme quand son voyageur n'a pas de photo, ce qui est le cas courant.
     */
    private static JsonNode withGuestAvatar(JsonNode metadata, String guestAvatarUrl) {
        if (guestAvatarUrl == null || guestAvatarUrl.isBlank()) return metadata;
        if (!(metadata instanceof ObjectNode facts)) return metadata;
        facts.put(GUEST_AVATAR_URL, guestAvatarUrl);
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
