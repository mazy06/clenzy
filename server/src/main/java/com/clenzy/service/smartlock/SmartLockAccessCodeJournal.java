package com.clenzy.service.smartlock;

import com.clenzy.config.KafkaConfig;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.SmartLockAccessCode;
import com.clenzy.model.SmartLockAccessCodeEvent;
import com.clenzy.model.SmartLockAccessCodeEvent.EventType;
import com.clenzy.model.User;
import com.clenzy.repository.SmartLockAccessCodeEventRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.NotificationMetadata;
import com.clenzy.service.NotificationService;
import com.clenzy.service.OutboxPublisher;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Ce qui est ENREGISTRE et ANNONCE quand un code de serrure change d'etat.
 *
 * <p>Extrait de {@code SmartLockAccessCodeService}, qui portait a la fois le
 * cycle de vie des codes et sa propre comptabilite. Trois sorties distinctes
 * vivent ici, et aucune n'appartient au cycle de vie :</p>
 * <ul>
 *   <li>le <b>journal</b> ({@code smart_lock_access_code_event}) — la trace
 *       durable, y compris des echecs, qui n'ont aucun code rattache ;</li>
 *   <li>l'<b>outbox</b> vers Kafka — la diffusion aux autres modules ;</li>
 *   <li>les <b>notifications</b> aux responsables — ce qui remonte a l'humain.</li>
 * </ul>
 *
 * <p><b>Aucune de ces sorties ne transporte le PIN.</b> Le journal ne garde que
 * des motifs, l'outbox que des identifiants et une fenetre, la notification que
 * des noms. C'est un invariant : trois canaux diffuses et conserves, pour un
 * secret d'acces physique.</p>
 *
 * <p><b>Rien ici ne jette.</b> Une panne de journal, d'outbox ou de notification
 * ne doit pas remonter dans un flux (creation de reservation, rotation) qui a
 * deja fait son travail.</p>
 */
@Service
public class SmartLockAccessCodeJournal {

    private static final Logger log = LoggerFactory.getLogger(SmartLockAccessCodeJournal.class);

    private final SmartLockAccessCodeEventRepository eventRepo;
    private final OutboxPublisher outboxPublisher;
    private final ObjectMapper objectMapper;
    private final NotificationService notificationService;
    private final UserRepository userRepository;

    public SmartLockAccessCodeJournal(SmartLockAccessCodeEventRepository eventRepo,
                                      OutboxPublisher outboxPublisher,
                                      ObjectMapper objectMapper,
                                      NotificationService notificationService,
                                      UserRepository userRepository) {
        this.eventRepo = eventRepo;
        this.outboxPublisher = outboxPublisher;
        this.objectMapper = objectMapper;
        this.notificationService = notificationService;
        this.userRepository = userRepository;
    }

    // ─── Journal ────────────────────────────────────────────────

    /** Journal d'une serrure, du plus recent au plus ancien (echecs compris). */
    public List<SmartLockAccessCodeEvent> eventsOf(Long deviceId) {
        return eventRepo.findByDeviceIdOrderByCreatedAtDesc(deviceId);
    }

    public void record(SmartLockAccessCode code, EventType type,
                       SmartLockAccessCodeEvent.EventSource source, String notes) {
        record(code, type, source, notes, null);
    }

    /** Variante portant l'auteur du geste, quand il y en a un d'humain. */
    public void record(SmartLockAccessCode code, EventType type,
                       SmartLockAccessCodeEvent.EventSource source, String notes, String actorName) {
        SmartLockAccessCodeEvent ev = new SmartLockAccessCodeEvent();
        ev.setActorName(actorName);
        ev.setOrganizationId(code.getOrganizationId());
        ev.setCodeId(code.getId());
        ev.setDeviceId(code.getDeviceId());
        ev.setReservationId(code.getReservationId());
        ev.setPropertyId(code.getPropertyId());
        ev.setEventType(type);
        ev.setSource(source);
        ev.setNotes(notes); // jamais le PIN
        eventRepo.save(ev);
    }

    /**
     * Echec de generation : aucun code n'existe, l'evenement n'a donc pas de
     * {@code codeId}. C'est pour ces lignes-la que le journal se lit par SERRURE
     * et non par code — elles seraient invisibles autrement.
     */
    public void recordGenerationFailure(Long orgId, Long deviceId, Long reservationId, Long propertyId,
                                        SmartLockAccessCodeEvent.EventSource source, String notes,
                                        String propertyName) {
        SmartLockAccessCodeEvent ev = new SmartLockAccessCodeEvent();
        ev.setOrganizationId(orgId);
        ev.setDeviceId(deviceId);
        ev.setReservationId(reservationId);
        ev.setPropertyId(propertyId);
        ev.setEventType(EventType.GENERATION_FAILED);
        ev.setSource(source);
        ev.setNotes(notes);
        eventRepo.save(ev);

        announceFailure(NotificationKey.SMART_LOCK_CODE_GENERATION_FAILED, orgId, propertyId, propertyName,
                "Code de serrure non posé",
                "Aucun code n'a pu être posé sur la serrure : " + notes
                        + ". Le voyageur arrivera devant une porte qui ne s'ouvre pas.");
    }

    // ─── Diffusion ──────────────────────────────────────────────

    public void publish(SmartLockAccessCode code, String eventType) {
        try {
            // Payload SANS le PIN (secret d'acces) — uniquement l'id et la fenetre.
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("codeId", code.getId());
            payload.put("deviceId", code.getDeviceId());
            payload.put("reservationId", code.getReservationId());
            payload.put("propertyId", code.getPropertyId());
            payload.put("validFrom", String.valueOf(code.getValidFrom()));
            payload.put("validUntil", String.valueOf(code.getValidUntil()));
            outboxPublisher.publish("SMART_LOCK_ACCESS_CODE", String.valueOf(code.getId()), eventType,
                    KafkaConfig.TOPIC_AUDIT_EVENTS, String.valueOf(code.getPropertyId()),
                    objectMapper.writeValueAsString(payload), code.getOrganizationId());
        } catch (Exception e) {
            log.warn("Publication Outbox echouee pour code={}: {}", code.getId(), e.getMessage());
        }
    }

    // ─── Notifications ──────────────────────────────────────────

    /**
     * Previent les responsables d'un echec touchant un code de serrure.
     *
     * <p>Seuls les ECHECS et la rotation MANUELLE notifient. Une generation, un
     * envoi ou une revocation automatiques restent dans le journal : un logement
     * a trois serrures produirait sinon trois notifications par reservation
     * creee, puis trois de plus a chaque depart — pour une information que
     * personne n'a a traiter.</p>
     */
    public void announceFailure(NotificationKey key, Long orgId, Long propertyId, String propertyName,
                                String title, String message) {
        if (orgId == null) return;
        try {
            String suffix = propertyName != null ? " — " + propertyName : "";
            notificationService.notifyAdminsAndManagersByOrgId(
                    orgId, key, title + suffix, message,
                    propertyId != null ? "/connected-objects" : null);
        } catch (Exception e) {
            log.warn("Notification d'echec de code serrure non emise (org={}, property={}): {}",
                    orgId, propertyId, e.getMessage());
        }
    }

    /**
     * Trace dans le fil la regeneration manuelle d'un code de serrure.
     *
     * <p>Le PIN n'y figure pas : la notification dit QU'UN code a change, elle ne
     * le transporte pas. La SERRURE, elle, entre dans les faits — c'est par elle
     * que la fiche va relire le code EN VIGUEUR, celui du message vieillirait a
     * la rotation suivante.</p>
     */
    public void announceManualRotation(Long orgId, Long deviceId, String lockName,
                                       Long propertyId, String propertyName,
                                       String actorName, boolean guestNotified) {
        if (orgId == null) return;
        try {
            String lock = lockName != null ? lockName : "la serrure";
            notificationService.notifyAdminsAndManagersByOrgId(
                    orgId,
                    NotificationKey.SMART_LOCK_CODE_ROTATED_MANUALLY,
                    "Code de serrure régénéré" + (propertyName != null ? " — " + propertyName : ""),
                    lock + " : "
                            + (actorName != null
                                    ? actorName + " a posé un nouveau code à la main"
                                    : "un nouveau code a été posé à la main")
                            + ", l'ancien ne fonctionne plus."
                            + (guestNotified
                                    ? " Un séjour est en cours : le voyageur a reçu le nouveau code."
                                    : ""),
                    "/connected-objects",
                    NotificationMetadata.of()
                            .property(propertyName)
                            .propertyId(propertyId)
                            .deviceId(deviceId)
                            .actor(actorName)
                            .build());
        } catch (Exception e) {
            log.warn("Notification de rotation manuelle non emise (device={}): {}", deviceId, e.getMessage());
        }
    }

    // ─── Identite de l'auteur ───────────────────────────────────

    /**
     * Nom lisible de l'auteur d'un geste, ou {@code null}.
     *
     * <p>L'« acteur » est un sujet Keycloak : un UUID, qui n'apprend rien a qui
     * lit une notification ou un journal. On lui substitue le nom du compte
     * quand il en existe un ; les acteurs techniques ({@code system},
     * {@code system:automation}) n'en ont pas, et c'est tres bien — ils se
     * reconnaissent a leur absence de nom.</p>
     */
    public String displayNameOf(String actor) {
        if (actor == null || actor.isBlank() || actor.startsWith("system")) return null;
        try {
            return userRepository.findByKeycloakId(actor)
                    .map(User::getFullName)
                    .map(String::trim)
                    .filter(name -> !name.isBlank())
                    .orElse(null);
        } catch (Exception e) {
            log.warn("Resolution du nom de l'acteur echouee ({}): {}", actor, e.getMessage());
            return null;
        }
    }
}
