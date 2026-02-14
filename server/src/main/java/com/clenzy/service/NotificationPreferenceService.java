package com.clenzy.service;

import com.clenzy.model.NotificationKey;
import com.clenzy.model.NotificationPreference;
import com.clenzy.repository.NotificationPreferenceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@Transactional
public class NotificationPreferenceService {

    private static final Logger log = LoggerFactory.getLogger(NotificationPreferenceService.class);

    private final NotificationPreferenceRepository preferenceRepository;

    public NotificationPreferenceService(NotificationPreferenceRepository preferenceRepository) {
        this.preferenceRepository = preferenceRepository;
    }

    /**
     * Retourne toutes les preferences de l'utilisateur.
     * Pour chaque NotificationKey, retourne la valeur stockee en base ou la valeur par defaut de l'enum.
     */
    @Transactional(readOnly = true)
    public Map<String, Boolean> getPreferencesForUser(String userId) {
        // Charger les preferences existantes en base
        List<NotificationPreference> stored = preferenceRepository.findByUserId(userId);
        Map<String, Boolean> storedMap = new LinkedHashMap<>();
        for (NotificationPreference pref : stored) {
            storedMap.put(pref.getNotificationKey().name(), pref.isEnabled());
        }

        // Construire la map complete avec defaults pour les cles manquantes
        Map<String, Boolean> result = new LinkedHashMap<>();
        for (NotificationKey key : NotificationKey.values()) {
            String keyName = key.name();
            result.put(keyName, storedMap.getOrDefault(keyName, key.isEnabledByDefault()));
        }

        return result;
    }

    /**
     * Met a jour les preferences de l'utilisateur (upsert).
     * Seules les cles presentes dans la map sont modifiees.
     */
    public void updatePreferences(String userId, Map<String, Boolean> preferences) {
        if (preferences == null || preferences.isEmpty()) {
            return;
        }

        for (Map.Entry<String, Boolean> entry : preferences.entrySet()) {
            try {
                NotificationKey key = NotificationKey.valueOf(entry.getKey());
                boolean enabled = entry.getValue();

                Optional<NotificationPreference> existing = preferenceRepository
                        .findByUserIdAndNotificationKey(userId, key);

                if (existing.isPresent()) {
                    NotificationPreference pref = existing.get();
                    pref.setEnabled(enabled);
                    preferenceRepository.save(pref);
                } else {
                    NotificationPreference pref = new NotificationPreference(userId, key, enabled);
                    preferenceRepository.save(pref);
                }
            } catch (IllegalArgumentException e) {
                log.warn("Cle de notification inconnue ignoree: {}", entry.getKey());
            }
        }

        log.info("{} preferences mises a jour pour l'utilisateur {}", preferences.size(), userId);
    }

    /**
     * Verifie si une notification est activee pour un utilisateur.
     * Si pas de preference stockee, utilise la valeur par defaut de l'enum.
     */
    @Transactional(readOnly = true)
    public boolean isEnabled(String userId, NotificationKey key) {
        if (userId == null || key == null) {
            return false;
        }

        // Si explicitement desactivee en base -> false
        if (preferenceRepository.existsByUserIdAndNotificationKeyAndEnabledFalse(userId, key)) {
            return false;
        }

        // Si pas de row en base, utiliser la valeur par defaut
        Optional<NotificationPreference> pref = preferenceRepository.findByUserIdAndNotificationKey(userId, key);
        if (pref.isPresent()) {
            return pref.get().isEnabled();
        }

        return key.isEnabledByDefault();
    }
}
