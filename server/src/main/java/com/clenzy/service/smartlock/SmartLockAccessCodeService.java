package com.clenzy.service.smartlock;

import com.clenzy.dto.smartlock.SmartLockAccessCodeDto;
import com.clenzy.dto.smartlock.SmartLockAccessCodeHistoryDto;
import com.clenzy.model.Reservation;
import com.clenzy.model.SmartLockAccessCode;
import com.clenzy.model.SmartLockAccessCode.CodeSource;
import com.clenzy.model.SmartLockAccessCode.CodeStatus;
import com.clenzy.model.SmartLockAccessCodeEvent;
import com.clenzy.model.SmartLockAccessCodeEvent.EventType;
import com.clenzy.model.SmartLockDevice;
import com.clenzy.repository.SmartLockAccessCodeRepository;
import com.clenzy.repository.SmartLockDeviceRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Cycle de vie des codes d'acces de serrures : generation auto par reservation,
 * rotation manuelle, revocation, lecture.
 *
 * <p>Ce service ORCHESTRE et ne fait plus rien lui-meme. Il portait seize
 * dependances et cinq metiers — le cycle de vie, la messagerie voyageur, les
 * notifications, la lecture des sejours et l'annuaire des comptes. Chacun vit
 * desormais chez un collaborateur dont le nom dit la responsabilite :</p>
 * <ul>
 *   <li>{@link SmartLockCodeProvisioner} — poser et retirer un code sur la
 *       serrure physique (Tuya, Web API) ;</li>
 *   <li>{@link SmartLockPinPolicy} — quel PIN, selon le logement et la marque
 *       (via le provisioner) ;</li>
 *   <li>{@link SmartLockAccessCodeJournal} — ce qui est enregistre, diffuse et
 *       annonce quand un code change d'etat ;</li>
 *   <li>{@link SmartLockCodeDelivery} — faire parvenir le code a son voyageur ;</li>
 *   <li>{@link SmartLockStayContext} — le logement, son fuseau, son sejour en cours.</li>
 * </ul>
 *
 * <p><b>Securite</b> : le PIN est chiffre au repos (entite) et n'apparait JAMAIS
 * dans les logs, les {@code notes} du journal, les payloads Outbox ni les
 * notifications (seul l'id du code y figure).
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

    private final SmartLockAccessCodeRepository codeRepo;
    private final SmartLockDeviceRepository deviceRepo;
    private final OrganizationAccessGuard organizationAccessGuard;
    private final SmartLockCodeProvisioner provisioner;
    private final SmartLockAccessCodeJournal journal;
    private final SmartLockCodeDelivery delivery;
    private final SmartLockStayContext stayContext;

    public SmartLockAccessCodeService(SmartLockAccessCodeRepository codeRepo,
                                      SmartLockDeviceRepository deviceRepo,
                                      OrganizationAccessGuard organizationAccessGuard,
                                      SmartLockCodeProvisioner provisioner,
                                      SmartLockAccessCodeJournal journal,
                                      SmartLockCodeDelivery delivery,
                                      SmartLockStayContext stayContext) {
        this.codeRepo = codeRepo;
        this.deviceRepo = deviceRepo;
        this.organizationAccessGuard = organizationAccessGuard;
        this.provisioner = provisioner;
        this.journal = journal;
        this.delivery = delivery;
        this.stayContext = stayContext;
    }

    // ─── Isolation multi-tenant ─────────────────────────────────

    /**
     * Refuse l'acces si la serrure n'appartient pas a l'organisation courante.
     *
     * <p>Les methodes exposees en HTTP recoivent un {@code deviceId} pris dans l'URL.
     * {@code findById} ne traverse pas le filtre Hibernate {@code organizationFilter},
     * et ce filtre est de toute facon inerte en HTTP ({@code open-in-view: false}) :
     * la verification doit donc etre explicite (audit 2026-07-26, constat P1-01).
     *
     * @return la serrure, ou {@link Optional#empty()} si elle n'existe pas — un
     *         identifiant inconnu ne doit pas se distinguer d'un identifiant interdit,
     *         sans quoi l'endpoint devient un oracle d'existence.
     * @throws org.springframework.security.access.AccessDeniedException si la serrure
     *         existe mais appartient a une autre organisation
     */
    private Optional<SmartLockDevice> loadDeviceForCurrentOrg(Long deviceId) {
        Optional<SmartLockDevice> device = deviceRepo.findById(deviceId);
        device.ifPresent(d -> organizationAccessGuard.requireSameOrganization(
                d.getOrganizationId(), "Serrure hors de votre organisation"));
        return device;
    }

    // ─── Generation par reservation (auto) ──────────────────────

    /**
     * Genere un code pour une reservation (fenetre check-in -> check-out+1) et
     * notifie le voyageur. Ne JETTE PAS : un echec provider est trace
     * (GENERATION_FAILED) mais ne doit pas bloquer la creation de la reservation.
     */
    @Transactional
    public SmartLockAccessCode generateForReservation(Reservation reservation, SmartLockDevice device, CodeSource source) {
        LocalDateTime from = reservation.getCheckIn().atStartOfDay();
        LocalDateTime until = reservation.getCheckOut().plusDays(1).atStartOfDay();
        String guestName = reservation.getGuestName() != null ? reservation.getGuestName() : "Guest";

        SmartLockAccessCode created = createAndPersist(
                device, reservation.getId(), from, until, source, "system", "Clenzy-" + guestName);
        if (created != null) {
            delivery.deliver(reservation, created, device.getOrganizationId(),
                    stayContext.nameOf(device.getPropertyId()));
        }
        return created;
    }

    // ─── Rotation manuelle ──────────────────────────────────────

    /**
     * Revoque le code actif courant de la serrure et en genere un nouveau (manuel).
     *
     * <p>Un voyageur est peut-etre DERRIERE cette porte : la revocation coupe son
     * code. Le nouveau code est donc rattache a son sejour et lui est envoye —
     * sans quoi la rotation le laisse dehors, en silence.</p>
     */
    @Transactional
    public SmartLockAccessCode rotateManual(Long deviceId, LocalDateTime validFrom, LocalDateTime validUntil,
                                            Long reservationId, String actor) {
        SmartLockDevice device = loadDeviceForCurrentOrg(deviceId)
                .orElseThrow(() -> new IllegalArgumentException("Serrure introuvable: " + deviceId));

        // Une seule fenetre active a la fois → revoque l'existant.
        for (SmartLockAccessCode existing : codeRepo.findByDeviceIdAndStatus(deviceId, CodeStatus.ACTIVE)) {
            revoke(existing, actor, SmartLockAccessCodeEvent.EventSource.MANUAL);
        }

        LocalDateTime from = validFrom != null ? validFrom : LocalDateTime.now();
        LocalDateTime until = validUntil != null ? validUntil : from.plusDays(MANUAL_DEFAULT_DAYS);

        Reservation ongoing = reservationId != null ? null : stayContext.ongoingStayOf(device);
        Long effectiveReservationId = reservationId != null ? reservationId
                : (ongoing != null ? ongoing.getId() : null);

        SmartLockAccessCode created = createAndPersist(
                device, effectiveReservationId, from, until, CodeSource.MANUAL, actor, "Clenzy-Manuel");
        if (created == null) {
            throw new IllegalStateException("Echec de la generation du code Tuya");
        }

        String propertyName = stayContext.nameOf(device.getPropertyId());
        if (ongoing != null) {
            delivery.deliver(ongoing, created, device.getOrganizationId(), propertyName);
        }
        journal.announceManualRotation(device.getOrganizationId(), device.getId(), device.getName(),
                device.getPropertyId(), propertyName, journal.displayNameOf(actor), ongoing != null);
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

    /**
     * Revoque le code actif courant d'une serrure (action manuelle).
     * Appele depuis HTTP avec un {@code deviceId} d'URL → ownership org verifie.
     */
    @Transactional
    public void revokeForDevice(Long deviceId, String actor) {
        if (loadDeviceForCurrentOrg(deviceId).isEmpty()) {
            return;
        }
        for (SmartLockAccessCode code : codeRepo.findByDeviceIdAndStatus(deviceId, CodeStatus.ACTIVE)) {
            revoke(code, actor, SmartLockAccessCodeEvent.EventSource.MANUAL);
        }
    }

    /**
     * Revocation d'un code : la serrure d'abord, l'etat local ensuite.
     *
     * <p>Un echec cote fournisseur ne fait PAS echouer la revocation locale — le
     * code expire de toute facon a la fin de sa fenetre, et laisser l'etat local
     * mentir serait pire que le laisser en avance.</p>
     */
    private void revoke(SmartLockAccessCode code, String actor, SmartLockAccessCodeEvent.EventSource source) {
        if (code.getStatus() != CodeStatus.ACTIVE) {
            return;
        }
        SmartLockDevice device = deviceRepo.findById(code.getDeviceId()).orElse(null);
        provisioner.remove(device, code.getTuyaPasswordId());

        code.setStatus(CodeStatus.REVOKED);
        code.setRevokedAt(LocalDateTime.now());
        codeRepo.save(code);

        // Le journal garde un NOM quand il y en a un : « Code revoque par
        // 44bfc16a-5ceb-… » ne dit a personne QUI a agi. L'identifiant reste le
        // repli quand l'auteur n'est pas un utilisateur connu (« system »).
        String actorName = journal.displayNameOf(actor);
        journal.record(code, EventType.CODE_REVOKED, source,
                "Code revoque par " + (actorName != null ? actorName : (actor != null ? actor : "system")),
                actorName);
        journal.publish(code, "CODE_REVOKED");
    }

    // ─── Lecture ────────────────────────────────────────────────

    /**
     * Code actif courant d'une serrure, ou vide (avec bascule paresseuse en EXPIRED).
     *
     * <p>Le PIN retourne est rendu tel quel par {@code GET /{id}/access-code}, endpoint
     * ouvert a tout utilisateur authentifie : l'ownership org est donc verifie ici.
     */
    @Transactional
    public Optional<SmartLockAccessCode> getCurrentForDevice(Long deviceId) {
        if (loadDeviceForCurrentOrg(deviceId).isEmpty()) {
            return Optional.empty();
        }
        return activeOrExpire(codeRepo.findFirstByDeviceIdAndStatusOrderByCreatedAtDesc(deviceId, CodeStatus.ACTIVE));
    }

    /**
     * Etat complet des codes d'une serrure : code en vigueur, codes passes, journal.
     *
     * <p>La bascule paresseuse en EXPIRED passe AVANT la relecture de
     * l'historique : sans cela le code qui vient d'expirer apparaitrait a la fois
     * comme « en vigueur » et dans les codes passes.</p>
     *
     * <p>Le PIN des codes passes n'est pas transporte — voir
     * {@link com.clenzy.dto.smartlock.SmartLockAccessCodeHistoryDto}.</p>
     *
     * @return vide si la serrure n'existe pas (un identifiant inconnu ne doit pas
     *         se distinguer d'un identifiant interdit)
     */
    @Transactional
    public Optional<SmartLockAccessCodeHistoryDto> getHistoryForDevice(Long deviceId) {
        Optional<SmartLockDevice> deviceOpt = loadDeviceForCurrentOrg(deviceId);
        if (deviceOpt.isEmpty()) {
            return Optional.empty();
        }

        Optional<SmartLockAccessCode> current = activeOrExpire(
                codeRepo.findFirstByDeviceIdAndStatusOrderByCreatedAtDesc(deviceId, CodeStatus.ACTIVE));
        Long currentId = current.map(SmartLockAccessCode::getId).orElse(null);

        List<SmartLockAccessCodeHistoryDto.PastCode> past = codeRepo
                .findByDeviceIdOrderByCreatedAtDesc(deviceId).stream()
                .filter(c -> !c.getId().equals(currentId))
                .map(SmartLockAccessCodeHistoryDto.PastCode::from)
                .toList();

        List<SmartLockAccessCodeHistoryDto.Event> events = journal.eventsOf(deviceId).stream()
                .map(SmartLockAccessCodeHistoryDto.Event::from)
                .toList();

        Reservation ongoing = stayContext.ongoingStayOf(deviceOpt.get());
        SmartLockAccessCodeHistoryDto.OngoingStay stay = ongoing == null ? null
                : new SmartLockAccessCodeHistoryDto.OngoingStay(
                        ongoing.getId(), ongoing.getCheckIn(), ongoing.getCheckOut());

        return Optional.of(new SmartLockAccessCodeHistoryDto(
                current.map(SmartLockAccessCodeDto::from).orElse(null), past, events, stay));
    }

    /** Code actif courant d'une reservation, ou vide. */
    @Transactional
    public Optional<SmartLockAccessCode> getCurrentForReservation(Long reservationId) {
        return activeOrExpire(codeRepo.findFirstByReservationIdAndStatusOrderByCreatedAtDesc(reservationId, CodeStatus.ACTIVE));
    }

    // ─── Internes ───────────────────────────────────────────────

    /**
     * Pose un code sur la serrure, le persiste, le journalise et le diffuse.
     *
     * <p>Retourne {@code null} plutot que de jeter : l'appelant automatique
     * (creation de reservation) ne doit pas echouer parce qu'une serrure est
     * injoignable. L'echec n'est pas silencieux pour autant — il est journalise
     * ET notifie.</p>
     */
    private SmartLockAccessCode createAndPersist(SmartLockDevice device, Long reservationId,
                                                 LocalDateTime validFrom, LocalDateTime validUntil,
                                                 CodeSource source, String createdBy, String name) {
        Long orgId = device.getOrganizationId();
        SmartLockAccessCodeEvent.EventSource eventSource = SmartLockCodeDelivery.eventSource(source);

        if (device.getExternalDeviceId() == null || device.getExternalDeviceId().isBlank()) {
            journal.recordGenerationFailure(orgId, device.getId(), reservationId, device.getPropertyId(),
                    eventSource, "Pas d'ID device Tuya configure", stayContext.nameOf(device.getPropertyId()));
            return null;
        }
        try {
            SmartLockCodeProvisioner.PlacedCode placed = provisioner.place(
                    device, name, validFrom, validUntil, stayContext.zoneOf(device.getPropertyId()));

            SmartLockAccessCode code = new SmartLockAccessCode();
            code.setOrganizationId(orgId);
            code.setDeviceId(device.getId());
            code.setReservationId(reservationId);
            code.setPropertyId(device.getPropertyId());
            code.setName(name);
            code.setCode(placed.pin());
            // Id externe du code chez le provider (mot de passe Tuya OU code Web API Nuki) — requis pour la révocation.
            code.setTuyaPasswordId(placed.externalCodeId());
            code.setValidFrom(validFrom);
            code.setValidUntil(validUntil);
            code.setStatus(CodeStatus.ACTIVE);
            code.setSource(source);
            code.setCreatedBy(createdBy);
            SmartLockAccessCode saved = codeRepo.save(code);

            journal.record(saved, EventType.CODE_GENERATED, eventSource, "Code genere",
                    journal.displayNameOf(createdBy));
            journal.publish(saved, "CODE_GENERATED");
            log.info("Code d'acces genere (code={}, device={}, reservation={}, source={})",
                    saved.getId(), device.getId(), reservationId, source);
            return saved;
        } catch (Exception e) {
            log.error("Echec generation code serrure device={} reservation={}: {}",
                    device.getId(), reservationId, e.getMessage());
            journal.recordGenerationFailure(orgId, device.getId(), reservationId, device.getPropertyId(),
                    eventSource, "Echec provider: " + e.getMessage(), stayContext.nameOf(device.getPropertyId()));
            return null;
        }
    }

    /**
     * Rend le code s'il est encore valide, et le fait basculer en EXPIRED sinon.
     *
     * <p>La bascule est PARESSEUSE : aucun scheduler ne repasse sur les codes, ils
     * expirent a la premiere lecture qui les depasse.</p>
     */
    private Optional<SmartLockAccessCode> activeOrExpire(Optional<SmartLockAccessCode> opt) {
        if (opt.isEmpty()) {
            return opt;
        }
        SmartLockAccessCode code = opt.get();
        if (code.getValidUntil() != null && code.getValidUntil().isBefore(LocalDateTime.now())) {
            code.setStatus(CodeStatus.EXPIRED);
            codeRepo.save(code);
            journal.record(code, EventType.CODE_EXPIRED, SmartLockCodeDelivery.eventSource(code.getSource()),
                    "Code expire");
            return Optional.empty();
        }
        return opt;
    }
}
