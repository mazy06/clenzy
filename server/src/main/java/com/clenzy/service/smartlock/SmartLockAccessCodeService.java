package com.clenzy.service.smartlock;

import com.clenzy.config.KafkaConfig;
import com.clenzy.integration.tuya.service.TuyaApiService;
import com.clenzy.model.CheckInInstructions;
import com.clenzy.model.MessageChannelType;
import com.clenzy.model.MessageTemplate;
import com.clenzy.model.MessageTemplateType;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.SmartLockAccessCode;
import com.clenzy.model.SmartLockAccessCode.CodeSource;
import com.clenzy.model.SmartLockAccessCode.CodeStatus;
import com.clenzy.model.SmartLockAccessCodeEvent;
import com.clenzy.model.SmartLockAccessCodeEvent.EventType;
import com.clenzy.model.SmartLockDevice;
import com.clenzy.repository.CheckInInstructionsRepository;
import com.clenzy.repository.MessageTemplateRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.SmartLockAccessCodeEventRepository;
import com.clenzy.repository.SmartLockAccessCodeRepository;
import com.clenzy.repository.SmartLockDeviceRepository;
import com.clenzy.service.OutboxPublisher;
import com.clenzy.service.access.AccessCodeGenerator;
import com.clenzy.service.messaging.GuestMessagingService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Cycle de vie des codes d'acces de serrures (mots de passe temporaires Tuya) :
 * generation auto par reservation, rotation manuelle, revocation. Chaque mutation
 * persiste le code, ecrit un evenement d'audit, publie un event Outbox (audit.events)
 * et — pour la generation par reservation — notifie le voyageur.
 *
 * <p><b>Securite</b> : le PIN est chiffre au repos (entite) et n'apparait JAMAIS dans
 * les logs, l'audit {@code notes}, ni les payloads Outbox (seul l'id du code y figure).
 *
 * <p><b>Idempotence</b> : {@link com.clenzy.service.access.AccessCodeResolverService}
 * lit le code persiste (au lieu d'en creer un nouveau a chaque envoi de message), de
 * sorte qu'un renvoi de message reutilise le meme PIN.
 */
@Service
public class SmartLockAccessCodeService {

    private static final Logger log = LoggerFactory.getLogger(SmartLockAccessCodeService.class);

    /** Validite par defaut d'un code cree manuellement sans fenetre fournie. */
    private static final int MANUAL_DEFAULT_DAYS = 7;

    /** Fuseau par defaut si le logement n'en definit pas (ou invalide). */
    private static final ZoneId DEFAULT_ZONE = ZoneId.of("Europe/Paris");

    private final SmartLockAccessCodeRepository codeRepo;
    private final SmartLockAccessCodeEventRepository eventRepo;
    private final SmartLockDeviceRepository deviceRepo;
    private final TuyaApiService tuyaApiService;
    private final OutboxPublisher outboxPublisher;
    private final GuestMessagingService guestMessagingService;
    private final MessageTemplateRepository templateRepository;
    private final ObjectMapper objectMapper;
    private final PropertyRepository propertyRepository;
    private final CheckInInstructionsRepository checkInInstructionsRepository;
    private final AccessCodeGenerator accessCodeGenerator;
    private final SmartLockProviderRegistry providerRegistry;

    public SmartLockAccessCodeService(SmartLockAccessCodeRepository codeRepo,
                                      SmartLockAccessCodeEventRepository eventRepo,
                                      SmartLockDeviceRepository deviceRepo,
                                      TuyaApiService tuyaApiService,
                                      OutboxPublisher outboxPublisher,
                                      GuestMessagingService guestMessagingService,
                                      MessageTemplateRepository templateRepository,
                                      ObjectMapper objectMapper,
                                      PropertyRepository propertyRepository,
                                      CheckInInstructionsRepository checkInInstructionsRepository,
                                      AccessCodeGenerator accessCodeGenerator,
                                      SmartLockProviderRegistry providerRegistry) {
        this.codeRepo = codeRepo;
        this.eventRepo = eventRepo;
        this.deviceRepo = deviceRepo;
        this.tuyaApiService = tuyaApiService;
        this.outboxPublisher = outboxPublisher;
        this.guestMessagingService = guestMessagingService;
        this.templateRepository = templateRepository;
        this.objectMapper = objectMapper;
        this.propertyRepository = propertyRepository;
        this.checkInInstructionsRepository = checkInInstructionsRepository;
        this.accessCodeGenerator = accessCodeGenerator;
        this.providerRegistry = providerRegistry;
    }

    // ─── Generation par reservation (auto) ──────────────────────

    /**
     * Genere un code pour une reservation (fenetre check-in -> check-out+1) et
     * notifie le voyageur. Ne JETTE PAS : un echec Tuya est trace (GENERATION_FAILED)
     * mais ne doit pas bloquer la creation de la reservation.
     */
    @Transactional
    public SmartLockAccessCode generateForReservation(Reservation reservation, SmartLockDevice device, CodeSource source) {
        LocalDateTime from = reservation.getCheckIn().atStartOfDay();
        LocalDateTime until = reservation.getCheckOut().plusDays(1).atStartOfDay();
        String guestName = reservation.getGuestName() != null ? reservation.getGuestName() : "Guest";

        SmartLockAccessCode created = createAndPersist(
                device, reservation.getId(), from, until, source, "system", "Clenzy-" + guestName);
        if (created != null) {
            notifyGuest(reservation, created, device.getOrganizationId());
        }
        return created;
    }

    // ─── Rotation manuelle ──────────────────────────────────────

    /**
     * Revoque le code actif courant de la serrure et en genere un nouveau (manuel).
     * N'envoie pas de notification voyageur (le code s'affiche dans le hub).
     */
    @Transactional
    public SmartLockAccessCode rotateManual(Long deviceId, LocalDateTime validFrom, LocalDateTime validUntil,
                                            Long reservationId, String actor) {
        SmartLockDevice device = deviceRepo.findById(deviceId)
                .orElseThrow(() -> new IllegalArgumentException("Serrure introuvable: " + deviceId));

        // Une seule fenetre active a la fois → revoque l'existant.
        for (SmartLockAccessCode existing : codeRepo.findByDeviceIdAndStatus(deviceId, CodeStatus.ACTIVE)) {
            revoke(existing, actor, SmartLockAccessCodeEvent.EventSource.MANUAL);
        }

        LocalDateTime from = validFrom != null ? validFrom : LocalDateTime.now();
        LocalDateTime until = validUntil != null ? validUntil : from.plusDays(MANUAL_DEFAULT_DAYS);

        SmartLockAccessCode created = createAndPersist(
                device, reservationId, from, until, CodeSource.MANUAL, actor, "Clenzy-Manuel");
        if (created == null) {
            throw new IllegalStateException("Echec de la generation du code Tuya");
        }
        return created;
    }

    // ─── Revocation ─────────────────────────────────────────────

    /** Revoque tous les codes actifs d'une reservation (annulation). Best-effort. */
    @Transactional
    public void revokeForReservation(Long reservationId, String actor) {
        for (SmartLockAccessCode code : codeRepo.findByReservationIdAndStatus(reservationId, CodeStatus.ACTIVE)) {
            revoke(code, actor, SmartLockAccessCodeEvent.EventSource.AUTO_RESERVATION);
        }
    }

    /** Revoque le code actif courant d'une serrure (action manuelle). */
    @Transactional
    public void revokeForDevice(Long deviceId, String actor) {
        for (SmartLockAccessCode code : codeRepo.findByDeviceIdAndStatus(deviceId, CodeStatus.ACTIVE)) {
            revoke(code, actor, SmartLockAccessCodeEvent.EventSource.MANUAL);
        }
    }

    private void revoke(SmartLockAccessCode code, String actor, SmartLockAccessCodeEvent.EventSource source) {
        if (code.getStatus() != CodeStatus.ACTIVE) {
            return;
        }
        SmartLockDevice device = deviceRepo.findById(code.getDeviceId()).orElse(null);
        if (device != null && code.getTuyaPasswordId() != null
                && device.getExternalDeviceId() != null && !device.getExternalDeviceId().isBlank()) {
            try {
                SmartLockBrand brand = device.getBrand() != null ? device.getBrand() : SmartLockBrand.TUYA;
                if (brand == SmartLockBrand.TUYA) {
                    tuyaApiService.deleteTemporaryPassword(device.getExternalDeviceId(), code.getTuyaPasswordId());
                } else {
                    providerRegistry.getRequiredProvider(brand)
                            .revokeAccessCode(device.getExternalDeviceId(), code.getTuyaPasswordId(),
                                    device.getOrganizationId());
                }
            } catch (Exception e) {
                // Echec provider → on conserve la revocation locale (le code expire de toute facon).
                log.warn("Revocation provider echouee pour code={} (revocation locale conservee): {}",
                        code.getId(), e.getMessage());
            }
        }
        code.setStatus(CodeStatus.REVOKED);
        code.setRevokedAt(LocalDateTime.now());
        code.setCreatedBy(code.getCreatedBy());
        codeRepo.save(code);
        recordEvent(code, EventType.CODE_REVOKED, source, "Code revoque par " + (actor != null ? actor : "system"));
        publishOutbox(code, "CODE_REVOKED");
    }

    // ─── Lecture (code courant) ─────────────────────────────────

    /** Code actif courant d'une serrure, ou vide (avec bascule paresseuse en EXPIRED). */
    @Transactional
    public Optional<SmartLockAccessCode> getCurrentForDevice(Long deviceId) {
        return activeOrExpire(codeRepo.findFirstByDeviceIdAndStatusOrderByCreatedAtDesc(deviceId, CodeStatus.ACTIVE));
    }

    /** Code actif courant d'une reservation, ou vide. */
    @Transactional
    public Optional<SmartLockAccessCode> getCurrentForReservation(Long reservationId) {
        return activeOrExpire(codeRepo.findFirstByReservationIdAndStatusOrderByCreatedAtDesc(reservationId, CodeStatus.ACTIVE));
    }

    // ─── Internes ───────────────────────────────────────────────

    private SmartLockAccessCode createAndPersist(SmartLockDevice device, Long reservationId,
                                                 LocalDateTime validFrom, LocalDateTime validUntil,
                                                 CodeSource source, String createdBy, String name) {
        Long orgId = device.getOrganizationId();
        if (device.getExternalDeviceId() == null || device.getExternalDeviceId().isBlank()) {
            recordFailure(orgId, device.getId(), reservationId, device.getPropertyId(),
                    eventSource(source), "Pas d'ID device Tuya configure");
            return null;
        }
        try {
            SmartLockBrand brand = device.getBrand() != null ? device.getBrand() : SmartLockBrand.TUYA;
            // Mode PMS_GENERATED : PIN généré selon le format du logement (chiffres) et poussé à la serrure.
            // Mode LOCK_GENERATED : requestedPin null → la serrure génère elle-même (Tuya uniquement —
            // les providers Web API comme Nuki exigent un code fourni, on en génère alors un aléatoire).
            String requestedPin = null;
            if (device.getAccessCodeMode() == SmartLockDevice.AccessCodeMode.PMS_GENERATED) {
                String formatJson = checkInInstructionsRepository
                        .findByPropertyIdAndOrganizationId(device.getPropertyId(), orgId)
                        .map(CheckInInstructions::getAccessCodeFormat).orElse(null);
                requestedPin = accessCodeGenerator.generateNumeric(formatJson, 6);
            }

            String pinValue;
            String externalCodeId;
            if (brand == SmartLockBrand.TUYA) {
                ZoneId zone = resolveZone(device.getPropertyId());
                Map<String, Object> result = tuyaApiService.createTemporaryPassword(
                        device.getExternalDeviceId(), epoch(validFrom, zone), epoch(validUntil, zone), name, requestedPin);
                Object pin = result.get("password");
                Object tuyaId = result.get("tuyaPasswordId");
                pinValue = pin != null ? pin.toString() : null;
                externalCodeId = tuyaId != null ? tuyaId.toString() : null;
            } else {
                // Web API (Nuki...) : le code est toujours défini par l'appelant.
                // Keypad Nuki : exactement 6 chiffres, sans 0 → on ignore la longueur du format.
                String pin;
                if (brand == SmartLockBrand.NUKI) {
                    pin = accessCodeGenerator.withoutZeros(accessCodeGenerator.generateNumeric(null, 6));
                } else {
                    pin = requestedPin != null ? requestedPin : accessCodeGenerator.generateNumeric(null, 6);
                }
                SmartLockCommandResult result = providerRegistry.getRequiredProvider(brand).generateAccessCode(
                        device.getExternalDeviceId(),
                        new AccessCodeParams(pin, name, validFrom, validUntil, AccessCodeParams.AccessCodeType.TEMPORARY),
                        orgId);
                if (!result.success()) {
                    throw new IllegalStateException(result.message());
                }
                pinValue = pin;
                externalCodeId = result.externalId();
            }

            SmartLockAccessCode code = new SmartLockAccessCode();
            code.setOrganizationId(orgId);
            code.setDeviceId(device.getId());
            code.setReservationId(reservationId);
            code.setPropertyId(device.getPropertyId());
            code.setName(name);
            code.setCode(pinValue);
            // Id externe du code chez le provider (mot de passe Tuya OU code Web API Nuki) — requis pour la révocation.
            code.setTuyaPasswordId(externalCodeId);
            code.setValidFrom(validFrom);
            code.setValidUntil(validUntil);
            code.setStatus(CodeStatus.ACTIVE);
            code.setSource(source);
            code.setCreatedBy(createdBy);
            SmartLockAccessCode saved = codeRepo.save(code);

            recordEvent(saved, EventType.CODE_GENERATED, eventSource(source), "Code genere");
            publishOutbox(saved, "CODE_GENERATED");
            log.info("Code d'acces genere (code={}, device={}, reservation={}, source={})",
                    saved.getId(), device.getId(), reservationId, source);
            return saved;
        } catch (Exception e) {
            log.error("Echec generation code serrure device={} reservation={}: {}",
                    device.getId(), reservationId, e.getMessage());
            recordFailure(orgId, device.getId(), reservationId, device.getPropertyId(),
                    eventSource(source), "Echec provider: " + e.getMessage());
            return null;
        }
    }

    private void notifyGuest(Reservation reservation, SmartLockAccessCode code, Long orgId) {
        // Prefere le template dedie ACCESS_CODE ; repli sur CHECK_IN (qui porte deja {accessCode}).
        List<MessageTemplate> templates = templateRepository
                .findByOrganizationIdAndTypeAndIsActiveTrue(orgId, MessageTemplateType.ACCESS_CODE);
        if (templates.isEmpty()) {
            templates = templateRepository
                    .findByOrganizationIdAndTypeAndIsActiveTrue(orgId, MessageTemplateType.CHECK_IN);
        }
        if (templates.isEmpty()) {
            log.info("Pas de template CHECK_IN actif (org={}) — code non envoye au voyageur (reservation={})",
                    orgId, reservation.getId());
            recordEvent(code, EventType.DELIVERY_FAILED, eventSource(code.getSource()), "Aucun template CHECK_IN actif");
            return;
        }
        try {
            // extraVars vide : le resolver injecte {accessCode} depuis le code persiste (idempotent).
            guestMessagingService.sendForReservationViaChannel(
                    reservation, templates.get(0), orgId, MessageChannelType.EMAIL, Map.of());
            recordEvent(code, EventType.CODE_DELIVERED, eventSource(code.getSource()), "Code envoye au voyageur (EMAIL)");
        } catch (Exception e) {
            log.warn("Envoi du code au voyageur echoue (reservation={}): {}", reservation.getId(), e.getMessage());
            recordEvent(code, EventType.DELIVERY_FAILED, eventSource(code.getSource()), "Echec envoi: " + e.getMessage());
        }
    }

    private Optional<SmartLockAccessCode> activeOrExpire(Optional<SmartLockAccessCode> opt) {
        if (opt.isEmpty()) {
            return opt;
        }
        SmartLockAccessCode code = opt.get();
        if (code.getValidUntil() != null && code.getValidUntil().isBefore(LocalDateTime.now())) {
            code.setStatus(CodeStatus.EXPIRED);
            codeRepo.save(code);
            recordEvent(code, EventType.CODE_EXPIRED, eventSource(code.getSource()), "Code expire");
            return Optional.empty();
        }
        return opt;
    }

    private void recordEvent(SmartLockAccessCode code, EventType type,
                             SmartLockAccessCodeEvent.EventSource source, String notes) {
        SmartLockAccessCodeEvent ev = new SmartLockAccessCodeEvent();
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

    private void recordFailure(Long orgId, Long deviceId, Long reservationId, Long propertyId,
                               SmartLockAccessCodeEvent.EventSource source, String notes) {
        SmartLockAccessCodeEvent ev = new SmartLockAccessCodeEvent();
        ev.setOrganizationId(orgId);
        ev.setDeviceId(deviceId);
        ev.setReservationId(reservationId);
        ev.setPropertyId(propertyId);
        ev.setEventType(EventType.GENERATION_FAILED);
        ev.setSource(source);
        ev.setNotes(notes);
        eventRepo.save(ev);
    }

    private void publishOutbox(SmartLockAccessCode code, String eventType) {
        try {
            // Payload SANS le PIN (secret d'acces) — uniquement l'id et la fenetre.
            Map<String, Object> payload = new java.util.LinkedHashMap<>();
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

    private static long epoch(LocalDateTime dt, ZoneId zone) {
        return dt.atZone(zone).toEpochSecond();
    }

    /** Fuseau du logement (repli {@link #DEFAULT_ZONE} si absent/invalide). */
    private ZoneId resolveZone(Long propertyId) {
        String tz = propertyRepository.findById(propertyId).map(Property::getTimezone).orElse(null);
        if (tz == null || tz.isBlank()) {
            return DEFAULT_ZONE;
        }
        try {
            return ZoneId.of(tz);
        } catch (Exception e) {
            log.warn("Fuseau invalide '{}' pour property={}, repli Europe/Paris", tz, propertyId);
            return DEFAULT_ZONE;
        }
    }

    private static SmartLockAccessCodeEvent.EventSource eventSource(CodeSource source) {
        return source == CodeSource.MANUAL
                ? SmartLockAccessCodeEvent.EventSource.MANUAL
                : SmartLockAccessCodeEvent.EventSource.AUTO_RESERVATION;
    }
}
