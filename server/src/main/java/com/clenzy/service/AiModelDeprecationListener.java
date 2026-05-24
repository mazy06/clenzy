package com.clenzy.service;

import com.clenzy.config.ai.AiModelDeprecatedEvent;
import com.clenzy.model.NotificationKey;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Ecoute {@link AiModelDeprecatedEvent} et notifie les SUPER_ADMIN qu'un modele
 * configure est mort (typiquement 410 Gone chez NVIDIA Build quand un modele
 * atteint sa date d'EOL).
 *
 * <h2>Dedup</h2>
 * <p>Maintient un Set en memoire ({@link ConcurrentHashMap}-backed) des modeles
 * deja notifies dans la vie du process. Evite de spammer les admins quand
 * plusieurs requetes concurrentes tapent le meme modele mort.</p>
 *
 * <p>Le Set se vide au redemarrage du serveur : accepte parce que la
 * deprecation est un evenement rare (cycle de vie modele LLM ~ trimestriel)
 * et que recevoir une notif post-redemarrage est utile (rappel).</p>
 *
 * <h2>Async</h2>
 * <p>{@code @Async} pour ne pas ralentir la requete utilisateur initiale qui
 * a deja remonte une erreur claire vers le client.</p>
 */
@Component
public class AiModelDeprecationListener {

    private static final Logger log = LoggerFactory.getLogger(AiModelDeprecationListener.class);

    private final NotificationService notificationService;

    /** Modeles deja notifies (cle = "providerLabel|modelId"). */
    private final Set<String> alreadyNotified = ConcurrentHashMap.newKeySet();

    public AiModelDeprecationListener(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @Async
    @EventListener
    public void onAiModelDeprecated(AiModelDeprecatedEvent event) {
        String dedupKey = event.providerLabel() + "|" + event.modelId();
        if (!alreadyNotified.add(dedupKey)) {
            log.debug("AI model {} already notified, skipping dedup", dedupKey);
            return;
        }

        String title = "Modele IA obsolete : " + event.modelId();
        String message = "Le modele '" + event.modelId() + "' n'est plus disponible chez "
                + event.providerLabel() + ". Action requise : selectionnez un nouveau modele "
                + "dans Parametres > IA et sauvegardez pour reactiver les features impactees.";

        // /settings?tab=ai → route stable, deep-link vers la section AI config
        String actionUrl = "/settings?tab=ai";

        log.warn("AI model EOL detected: {} ({}). Notifying super-admins.",
                event.modelId(), event.providerLabel());
        notificationService.notifyAllPlatformStaff(
                NotificationKey.AI_MODEL_EOL, title, message, actionUrl);
    }
}
