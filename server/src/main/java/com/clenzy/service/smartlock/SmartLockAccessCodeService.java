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
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import com.clenzy.service.automation.BaitlyExternalEffectJournal;
import static com.clenzy.service.automation.BaitlyExternalEffectJournal.*;
import java.util.UUID;

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
    private final BaitlyExternalEffectJournal effects;
    private final TransactionTemplate read;
    private final TransactionTemplate write;
    private final com.clenzy.repository.ReservationRepository reservations;

    public SmartLockAccessCodeService(SmartLockAccessCodeRepository codeRepo,
                                      SmartLockDeviceRepository deviceRepo,
                                      OrganizationAccessGuard organizationAccessGuard,
                                      SmartLockCodeProvisioner provisioner,
                                      SmartLockAccessCodeJournal journal,
                                      SmartLockCodeDelivery delivery,
                                      SmartLockStayContext stayContext, BaitlyExternalEffectJournal effects,
                                      PlatformTransactionManager manager,
                                      com.clenzy.repository.ReservationRepository reservations) {
        this.codeRepo = codeRepo;
        this.deviceRepo = deviceRepo;
        this.organizationAccessGuard = organizationAccessGuard;
        this.provisioner = provisioner;
        this.journal = journal;
        this.delivery = delivery;
        this.stayContext = stayContext;
        this.effects = effects;
        this.reservations = reservations;
        this.read = new TransactionTemplate(manager); read.setReadOnly(true); read.setTimeout(10);
        this.write = new TransactionTemplate(manager); write.setTimeout(10);
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
     * notifie le voyageur. Une panne fournisseur est tracee ; une tentative
     * deja ouverte ou incertaine est refusee sans aucun nouvel appel.
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public SmartLockAccessCode generateForReservation(Reservation reservation, SmartLockDevice device, CodeSource source) {
        if (!java.util.Objects.equals(device.getOrganizationId(), reservation.getOrganizationId())
                || reservation.getProperty() == null || !device.getPropertyId().equals(reservation.getProperty().getId()))
            throw new org.springframework.security.access.AccessDeniedException("Serrure et reservation hors du meme perimetre");
        LocalDateTime from = reservation.getCheckIn().atStartOfDay();
        LocalDateTime until = reservation.getCheckOut().plusDays(1).atStartOfDay();
        long epoch = revocationEpoch(reservation.getId(), device);
        UUID window = UUID.nameUUIDFromBytes((from + ":" + until + ":" + epoch).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        Ticket ticket = effects.claim(new Scope(device.getOrganizationId(), Kind.LOCK, device.getId(),
            Operation.CREATE, "reservation:" + reservation.getId() + ":" + window), () -> {
                if (epoch != revocationEpoch(reservation.getId(), device)) throw new IllegalStateException("LOCK_SCOPE_CHANGED");
            });
        if (ticket.done()) return completedCode(ticket, device);
        String guestName = reservation.getGuestName() != null ? reservation.getGuestName() : "Guest";

        SmartLockAccessCode created = createAndPersist(
                device, reservation.getId(), from, until, source, "system", "Baitly-" + guestName, ticket);
        if (created != null) {
            delivery.deliver(reservation, created, device.getOrganizationId(),
                    stayContext.nameOf(device.getPropertyId()));
        }
        return created;
    }

    private long revocationEpoch(Long reservationId, SmartLockDevice device) {
        return read.execute(status -> codeRepo.findByReservationIdAndStatus(reservationId, CodeStatus.REVOKED).stream()
            .filter(code -> device.getOrganizationId().equals(code.getOrganizationId()) && device.getId().equals(code.getDeviceId()))
            .mapToLong(SmartLockAccessCode::getId).max().orElse(0));
    }

    // ─── Rotation manuelle ──────────────────────────────────────

    /**
     * Revoque le code actif courant de la serrure et en genere un nouveau (manuel).
     *
     * <p>Un voyageur est peut-etre DERRIERE cette porte : la revocation coupe son
     * code. Le nouveau code est donc rattache a son sejour et lui est envoye —
     * sans quoi la rotation le laisse dehors, en silence.</p>
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public SmartLockAccessCode rotateManual(Long deviceId, LocalDateTime validFrom, LocalDateTime validUntil,
                                            Long reservationId, String actor) {
        SmartLockDevice device = read.execute(status -> loadDeviceForCurrentOrg(deviceId)
                .orElseThrow(() -> new IllegalArgumentException("Serrure introuvable")));
        if (reservationId != null) read.executeWithoutResult(status -> {
            Reservation stay = reservations.findById(reservationId).orElseThrow(
                () -> new org.springframework.security.access.AccessDeniedException("Sejour inaccessible"));
            if (!device.getOrganizationId().equals(stay.getOrganizationId())
                    || stay.getProperty() == null || !device.getPropertyId().equals(stay.getProperty().getId()))
                throw new org.springframework.security.access.AccessDeniedException("Sejour hors du perimetre de la serrure");
        });
        Ticket rotation = effects.claim(new Scope(device.getOrganizationId(), Kind.LOCK, deviceId,
            Operation.ROTATE, "manual:" + UUID.randomUUID()));
        try {

            // Une seule fenetre active a la fois → revoque l'existant.
            for (SmartLockAccessCode existing : read.execute(status -> codeRepo.findByDeviceIdAndStatus(deviceId, CodeStatus.ACTIVE))) {
                revoke(existing, actor, SmartLockAccessCodeEvent.EventSource.MANUAL, rotation);
            }

            LocalDateTime from = validFrom != null ? validFrom : LocalDateTime.now();
            LocalDateTime until = validUntil != null ? validUntil : from.plusDays(MANUAL_DEFAULT_DAYS);

            Reservation ongoing = reservationId != null ? null : read.execute(status -> {
                Reservation stay = stayContext.ongoingStayOf(device);
                if (stay != null) {
                    org.hibernate.Hibernate.initialize(stay.getGuest());
                    org.hibernate.Hibernate.initialize(stay.getProperty());
                    if (stay.getProperty() != null) org.hibernate.Hibernate.initialize(stay.getProperty().getOwner());
                }
                return stay;
            });
            Long effectiveReservationId = reservationId != null ? reservationId
                    : (ongoing != null ? ongoing.getId() : null);

            SmartLockAccessCode created = createAndPersist(
                    device, effectiveReservationId, from, until, CodeSource.MANUAL, actor, "Baitly-Manuel", rotation);
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
        } catch (RuntimeException failure) {
            markUncertain(rotation);
            throw new IllegalStateException("LOCK_ROTATION_UNCONFIRMED");
        }
    }

    // ─── Revocation ─────────────────────────────────────────────

    /** Revoque les codes actifs ; une issue incertaine reste bloquee sans nouvel appel. */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public void revokeForReservation(Long reservationId, String actor) {
        for (SmartLockAccessCode code : read.execute(status -> codeRepo.findByReservationIdAndStatus(reservationId, CodeStatus.ACTIVE))) {
            organizationAccessGuard.requireSameOrganization(code.getOrganizationId(), "Code hors de votre organisation");
            revoke(code, actor, SmartLockAccessCodeEvent.EventSource.AUTO_RESERVATION, null);
        }
    }

    /**
     * Revoque le code actif courant d'une serrure (action manuelle).
     * Appele depuis HTTP avec un {@code deviceId} d'URL → ownership org verifie.
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public void revokeForDevice(Long deviceId, String actor) {
        if (read.execute(status -> loadDeviceForCurrentOrg(deviceId)).isEmpty()) {
            return;
        }
        for (SmartLockAccessCode code : read.execute(status -> codeRepo.findByDeviceIdAndStatus(deviceId, CodeStatus.ACTIVE))) {
            revoke(code, actor, SmartLockAccessCodeEvent.EventSource.MANUAL, null);
        }
    }

    /** No local revocation without a positive provider result; an uncertain fence never expires. */
    private void revoke(SmartLockAccessCode code, String actor, SmartLockAccessCodeEvent.EventSource source,
                        Ticket rotation) {
        Ticket ticket = rotation != null ? rotation : effects.claim(new Scope(
            code.getOrganizationId(), Kind.LOCK, code.getDeviceId(), Operation.REVOKE, String.valueOf(code.getId())));
        if (ticket.done()) return;
        try {
            SmartLockDevice device = read.execute(status -> deviceRepo.findById(code.getDeviceId()).orElseThrow());
            if (!code.getOrganizationId().equals(device.getOrganizationId())
                    || !java.util.Objects.equals(code.getPropertyId(), device.getPropertyId()))
                throw new IllegalStateException("LOCK_SCOPE_INVALID");
            provisioner.remove(device, code.getTuyaPasswordId());
            java.util.function.Supplier<SmartLockAccessCode> save = () -> {
                code.setStatus(CodeStatus.REVOKED); code.setRevokedAt(LocalDateTime.now());
                SmartLockAccessCode saved = codeRepo.save(code);
                journal.record(saved, EventType.CODE_REVOKED, source, "Revocation fournisseur confirmee");
                journal.publish(saved, "CODE_REVOKED");
                return saved;
            };
            if (rotation == null) effects.complete(ticket, save, SmartLockAccessCode::getId);
            else write.execute(status -> save.get());
        } catch (RuntimeException failure) {
            markUncertain(ticket);
            throw new IllegalStateException("LOCK_REVOCATION_UNCONFIRMED");
        }
    }

    private SmartLockAccessCode completedCode(Ticket ticket, SmartLockDevice device) {
        return read.execute(status -> codeRepo.findById(ticket.reference())
            .filter(code -> device.getOrganizationId().equals(code.getOrganizationId())
                && device.getId().equals(code.getDeviceId()))
            .orElseThrow(() -> new IllegalStateException("LOCK_RESULT_RECONCILIATION_REQUIRED")));
    }

    private void markUncertain(Ticket ticket) {
        try { effects.uncertain(ticket); }
        catch (RuntimeException failure) { log.warn("Baitly lock outcome remains fenced"); }
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
                                                 CodeSource source, String createdBy, String name, Ticket ticket) {
        Long orgId = device.getOrganizationId();
        SmartLockAccessCodeEvent.EventSource eventSource = SmartLockCodeDelivery.eventSource(source);

        if (device.getExternalDeviceId() == null || device.getExternalDeviceId().isBlank()) {
            markUncertain(ticket);
            journal.recordGenerationFailure(orgId, device.getId(), reservationId, device.getPropertyId(),
                    eventSource, "Pas d'ID device Tuya configure", stayContext.nameOf(device.getPropertyId()));
            return null;
        }
        try {
            SmartLockCodeProvisioner.PlacedCode placed = provisioner.place(
                    device, name, validFrom, validUntil, stayContext.zoneOf(device.getPropertyId()));

            if (placed == null || placed.pin() == null || placed.pin().isBlank()
                    || placed.externalCodeId() == null || placed.externalCodeId().isBlank())
                throw new IllegalStateException("LOCK_CREATION_UNCONFIRMED");
            return effects.complete(ticket, () -> {
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
            }, SmartLockAccessCode::getId);
        } catch (Exception e) {
            markUncertain(ticket);
            log.warn("Baitly lock creation unconfirmed");
            journal.recordGenerationFailure(orgId, device.getId(), reservationId, device.getPropertyId(),
                    eventSource, "LOCK_CREATION_UNCONFIRMED", stayContext.nameOf(device.getPropertyId()));
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
