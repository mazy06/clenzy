package com.clenzy.dto;

import java.util.Map;

/**
 * DTO pour les preferences de notifications.
 * La map associe le nom de chaque NotificationKey a son etat (true = active, false = desactivee).
 */
public class NotificationPreferenceDto {

    /** Map: NotificationKey.name() -> enabled */
    public Map<String, Boolean> preferences;

    public NotificationPreferenceDto() {}

    public NotificationPreferenceDto(Map<String, Boolean> preferences) {
        this.preferences = preferences;
    }
}
