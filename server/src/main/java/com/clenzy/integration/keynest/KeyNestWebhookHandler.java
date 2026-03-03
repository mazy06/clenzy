package com.clenzy.integration.keynest;

import com.clenzy.model.KeyExchangeCode;
import com.clenzy.model.KeyExchangeCode.CodeStatus;
import com.clenzy.model.KeyExchangeEvent;
import com.clenzy.model.KeyExchangeEvent.EventSource;
import com.clenzy.model.KeyExchangeEvent.EventType;
import com.clenzy.repository.KeyExchangeCodeRepository;
import com.clenzy.repository.KeyExchangeEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

/**
 * Traitement des webhooks KeyNest.
 * KeyNest envoie des notifications JSON quand :
 * - Une cle est recuperee par un voyageur
 * - Une cle est retournee au point de depot
 *
 * La signature HMAC-SHA256 est verifiee avant traitement.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TODO [KEYNEST-9] — Valider le format des webhooks KeyNest
 *   Le format actuel du payload est une hypothese basee sur la doc publique.
 *   Une fois le compte KeyNest configure, verifier :
 *   1. Le format du payload JSON :
 *      - Champs exacts : "event" vs "event_type" vs "type"
 *      - "code_id" vs "collection_code_id" vs "key_code_id"
 *      - "actor_name" vs "collector_name" vs "person_name"
 *      - Presence de champs additionnels utiles (timestamp, store_id, key_id...)
 *   2. Les valeurs des types d'evenements :
 *      - "key_collected" vs "collected" vs "KEY_COLLECTED"
 *      - "key_returned" vs "returned" vs "KEY_RETURNED"
 *      - "key_deposited" vs "deposited" vs "KEY_DEPOSITED"
 *      - Autres types possibles (key_lost, code_expired, etc.)
 *   3. Le header de signature :
 *      - "X-KeyNest-Signature" vs "X-Signature" vs "X-Webhook-Signature"
 *      - Algorithme : HMAC-SHA256 confirme ? Ou SHA1, SHA512 ?
 *      - Format de la signature : hex, base64, prefixe "sha256=" ?
 *   4. Le mode de retry de KeyNest :
 *      - Combien de fois KeyNest retente en cas d'echec ?
 *      - Quel delai entre les retries ?
 *      - Faut-il implementer l'idempotence (deduplication par event_id) ?
 *
 * TODO [KEYNEST-10] — Configurer l'URL du webhook dans le dashboard KeyNest
 *   URL a enregistrer : https://api.clenzy.fr/api/webhooks/keynest
 *   - Verifier que l'endpoint est accessible depuis l'exterieur
 *   - Tester avec un webhook de test depuis le dashboard KeyNest
 *   - Configurer le secret HMAC dans le dashboard KeyNest
 *     et le reporter dans la variable KEYNEST_WEBHOOK_SECRET
 * ═══════════════════════════════════════════════════════════════════════════
 */
@Component
public class KeyNestWebhookHandler {

    private static final Logger log = LoggerFactory.getLogger(KeyNestWebhookHandler.class);

    private final KeyNestConfig config;
    private final KeyExchangeCodeRepository codeRepository;
    private final KeyExchangeEventRepository eventRepository;

    public KeyNestWebhookHandler(KeyNestConfig config,
                                  KeyExchangeCodeRepository codeRepository,
                                  KeyExchangeEventRepository eventRepository) {
        this.config = config;
        this.codeRepository = codeRepository;
        this.eventRepository = eventRepository;
    }

    /**
     * Verifie la signature HMAC-SHA256 du webhook.
     */
    public boolean verifySignature(String payload, String signature) {
        if (config.getWebhookSecret() == null || config.getWebhookSecret().isBlank()) {
            log.warn("Webhook secret non configure — signature non verifiee");
            return true; // Accepter si pas de secret configure (dev)
        }

        try {
            Mac hmac = Mac.getInstance("HmacSHA256");
            SecretKeySpec keySpec = new SecretKeySpec(
                    config.getWebhookSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            hmac.init(keySpec);
            byte[] hash = hmac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            String computed = bytesToHex(hash);
            return computed.equalsIgnoreCase(signature);
        } catch (Exception e) {
            log.error("Erreur verification signature webhook KeyNest: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Traite un evenement webhook KeyNest.
     */
    public void handleWebhookEvent(Map<String, Object> payload) {
        String eventType = String.valueOf(payload.getOrDefault("event", ""));
        String codeId = String.valueOf(payload.getOrDefault("code_id", ""));
        String actorName = String.valueOf(payload.getOrDefault("actor_name", ""));

        log.info("Webhook KeyNest recu: event={}, code_id={}", eventType, codeId);

        // Trouver le code dans notre base
        Optional<KeyExchangeCode> codeOpt = codeRepository.findByProviderCodeId(codeId);
        if (codeOpt.isEmpty()) {
            log.warn("Code KeyNest inconnu: {} — webhook ignore", codeId);
            return;
        }

        KeyExchangeCode code = codeOpt.get();
        EventType mappedType;

        switch (eventType.toLowerCase()) {
            case "key_collected", "collected" -> {
                mappedType = EventType.KEY_COLLECTED;
                code.setCollectedAt(LocalDateTime.now());
                code.setStatus(CodeStatus.USED);
            }
            case "key_returned", "returned" -> {
                mappedType = EventType.KEY_RETURNED;
                code.setReturnedAt(LocalDateTime.now());
            }
            case "key_deposited", "deposited" -> {
                mappedType = EventType.KEY_DEPOSITED;
            }
            default -> {
                log.warn("Type d'evenement KeyNest inconnu: {}", eventType);
                return;
            }
        }

        codeRepository.save(code);

        // Creer l'evenement dans notre historique
        KeyExchangeEvent event = new KeyExchangeEvent();
        event.setOrganizationId(code.getOrganizationId());
        event.setCodeId(code.getId());
        event.setPointId(code.getPointId());
        event.setPropertyId(code.getPropertyId());
        event.setEventType(mappedType);
        event.setActorName(actorName);
        event.setNotes("Webhook KeyNest: " + eventType);
        event.setSource(EventSource.WEBHOOK);
        eventRepository.save(event);

        log.info("Evenement KeyNest traite: {} pour code {} (id={})", mappedType, code.getCode(), code.getId());
    }

    // ─── Private helpers ────────────────────────────────────────────────

    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
