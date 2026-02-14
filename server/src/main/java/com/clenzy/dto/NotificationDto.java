package com.clenzy.dto;

import com.clenzy.model.Notification;
import com.clenzy.model.NotificationCategory;
import com.clenzy.model.NotificationType;

import java.time.LocalDateTime;

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
    public LocalDateTime createdAt;

    // ─── Constructeurs ──────────────────────────────────────────────────────────

    public NotificationDto() {}

    // ─── Factory depuis Entity ──────────────────────────────────────────────────

    public static NotificationDto fromEntity(Notification entity) {
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
        dto.createdAt = entity.getCreatedAt();
        return dto;
    }

    // ─── Factory vers Entity ────────────────────────────────────────────────────

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
