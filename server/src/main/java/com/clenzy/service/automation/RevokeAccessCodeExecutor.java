package com.clenzy.service.automation;

import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.CheckInInstructions;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.SmartLockAccessCode.CodeStatus;
import com.clenzy.repository.CheckInInstructionsRepository;
import com.clenzy.repository.SmartLockAccessCodeRepository;
import com.clenzy.service.NotificationService;
import com.clenzy.service.access.AccessCodeGenerator;
import com.clenzy.service.access.StayTimes;
import com.clenzy.service.smartlock.SmartLockAccessCodeService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;

/**
 * Executeur {@code REVOKE_ACCESS_CODE} (fiche 08, F4b — vague 3) : revocation
 * AUTOMATIQUE (pas de suggestion) du code d'acces apres le depart, avec delai de
 * grace pour les late checkouts.
 *
 * <p><b>Moment de revocation</b> = heure de check-out de la reservation (heure de la
 * resa, sinon defaut du logement, FUSEAU DU LOGEMENT — regle audit n°9) + offset
 * jours de la regle + grace ({@value #DEFAULT_GRACE_HOURS} h par defaut, configurable
 * via {@code actionConfig} JSON de la regle : {@code {"graceHours": 6}}, borne
 * 0..{@value #MAX_GRACE_HOURS}).</p>
 *
 * <p><b>Mecanisme temporel</b> (SKIPPED/EXECUTED consomment l'execution des triggers
 * one-shot) : double protection —</p>
 * <ol>
 *   <li>a la planification, le moteur ({@code calculateScheduledTime}) planifie le
 *       PENDING a l'heure EXACTE {@link #revocationMoment} (pas au triggerTime
 *       generique de la regle) ;</li>
 *   <li>au drain, le guard re-calcule le moment depuis l'etat COURANT de la
 *       reservation : si le check-out a ete deplace apres coup, l'executeur retourne
 *       {@link ExecutionResult#rescheduled} (statut NON-terminal, re-planification
 *       PENDING) au lieu de consommer l'execution.</li>
 * </ol>
 *
 * <p><b>Revocation</b> : codes de serrure connectee de la reservation via
 * {@link SmartLockAccessCodeService#revokeForReservation} (Tuya / providers Web API,
 * revocation locale conservee si le provider echoue) + rotation du code STATIQUE
 * (boite a cle) selon le pattern {@code AccessCodeRotationScheduler} (idempotence
 * {@code accessCodeRotatedAt} : pas de double rotation si le scheduler opt-in est
 * deja passe). Ni serrure ni code statique → skipped.</p>
 */
@Service
public class RevokeAccessCodeExecutor implements AutomationActionExecutor {

    public static final int DEFAULT_GRACE_HOURS = 4;
    static final int MAX_GRACE_HOURS = 72;
    /** Cle de {@code AutomationRule.actionConfig} portant la grace en heures. */
    public static final String CONFIG_GRACE_HOURS = "graceHours";

    private static final Logger log = LoggerFactory.getLogger(RevokeAccessCodeExecutor.class);
    /**
     * Mapper dedie au parsing de {@code actionConfig} : statique pour que
     * {@link #graceHours} et {@link #revocationMoment} restent utilisables par le
     * moteur (planification) sans dependre du bean. Thread-safe (lecture seule).
     */
    private static final ObjectMapper CONFIG_MAPPER = new ObjectMapper();

    private final SmartLockAccessCodeRepository accessCodeRepository;
    private final SmartLockAccessCodeService accessCodeService;
    private final CheckInInstructionsRepository instructionsRepository;
    private final AccessCodeGenerator accessCodeGenerator;
    private final NotificationService notificationService;
    private final Clock clock;

    public RevokeAccessCodeExecutor(SmartLockAccessCodeRepository accessCodeRepository,
                                    SmartLockAccessCodeService accessCodeService,
                                    CheckInInstructionsRepository instructionsRepository,
                                    AccessCodeGenerator accessCodeGenerator,
                                    NotificationService notificationService,
                                    Clock clock) {
        this.accessCodeRepository = accessCodeRepository;
        this.accessCodeService = accessCodeService;
        this.instructionsRepository = instructionsRepository;
        this.accessCodeGenerator = accessCodeGenerator;
        this.notificationService = notificationService;
        this.clock = clock;
    }

    @Override
    public AutomationAction action() {
        return AutomationAction.REVOKE_ACCESS_CODE;
    }

    /**
     * Moment de revocation dans le fuseau du logement : check-out effectif
     * (StayTimes : heure de la resa &gt; defaut logement &gt; 11:00) + offset jours de
     * la regle + grace. Null si la reservation n'a pas de date de depart.
     */
    public static ZonedDateTime revocationMoment(Reservation reservation, AutomationRule rule) {
        ZonedDateTime checkOut = StayTimes.checkOutMoment(reservation,
                reservation != null ? reservation.getProperty() : null);
        if (checkOut == null) {
            return null;
        }
        return checkOut.plusDays(rule.getTriggerOffsetDays()).plusHours(graceHours(rule));
    }

    /** Grace en heures de la regle ({@code actionConfig.graceHours}), bornee, defaut 4 h. */
    public static int graceHours(AutomationRule rule) {
        String config = rule.getActionConfig();
        if (config == null || config.isBlank()) {
            return DEFAULT_GRACE_HOURS;
        }
        try {
            JsonNode node = CONFIG_MAPPER.readTree(config).path(CONFIG_GRACE_HOURS);
            if (!node.isNumber()) {
                return DEFAULT_GRACE_HOURS;
            }
            return Math.max(0, Math.min(node.asInt(), MAX_GRACE_HOURS));
        } catch (Exception e) {
            // Config illisible → defaut sur (ne bloque jamais la revocation).
            return DEFAULT_GRACE_HOURS;
        }
    }

    @Override
    public ExecutionResult execute(AutomationRule rule, AutomationActionContext ctx) {
        if (!AutomationSubject.TYPE_RESERVATION.equals(ctx.subjectType()) || ctx.reservation() == null) {
            throw new IllegalStateException("REVOKE_ACCESS_CODE attend un sujet "
                    + AutomationSubject.TYPE_RESERVATION + " resolu, recu : " + ctx.subjectType()
                    + "#" + ctx.subjectId() + " (regle " + rule.getId() + ")");
        }
        Reservation reservation = ctx.reservation();
        Property property = reservation.getProperty();
        if (property == null) {
            return ExecutionResult.skipped("Reservation " + reservation.getId() + " sans logement");
        }
        if ("cancelled".equalsIgnoreCase(reservation.getStatus())) {
            return ExecutionResult.skipped(
                    "Reservation annulee — codes deja revoques par le flux d'annulation");
        }

        ZonedDateTime due = revocationMoment(reservation, rule);
        if (due == null) {
            return ExecutionResult.skipped("Reservation sans date de depart");
        }
        ZonedDateTime now = clock.instant().atZone(due.getZone());
        if (now.isBefore(due)) {
            // Guard de grace : check-out (peut-etre deplace depuis la planification)
            // pas encore passe + grace → re-planification NON-terminale.
            return ExecutionResult.rescheduled(toServerWallTime(due),
                    "Check-out + grace non atteint (revocation prevue le " + due + ")");
        }

        boolean smartLockRevoked = revokeSmartLockCodes(reservation);
        StaticRotation staticRotation = rotateStaticCode(property, ctx.orgId(), reservation);

        if (!smartLockRevoked && staticRotation == StaticRotation.NONE) {
            return ExecutionResult.skipped("Aucun code d'acces gere pour ce logement "
                    + "(ni code de serrure actif, ni code statique)");
        }
        if (!smartLockRevoked && staticRotation == StaticRotation.ALREADY_ROTATED) {
            return ExecutionResult.skipped(
                    "Code statique deja tourne depuis ce depart (rotation opt-in du logement)");
        }
        log.info("REVOKE_ACCESS_CODE: acces revoques pour reservation {} (serrure: {}, statique: {})",
                reservation.getId(), smartLockRevoked, staticRotation);
        return ExecutionResult.executed();
    }

    /** Revoque les codes serrure ACTIFS de la reservation ; false si aucun. */
    private boolean revokeSmartLockCodes(Reservation reservation) {
        if (accessCodeRepository
                .findByReservationIdAndStatus(reservation.getId(), CodeStatus.ACTIVE).isEmpty()) {
            return false;
        }
        accessCodeService.revokeForReservation(reservation.getId(), "system:automation");
        return true;
    }

    private enum StaticRotation { NONE, ALREADY_ROTATED, ROTATED }

    /**
     * Rotation du code statique (boite a cle) — pattern AccessCodeRotationScheduler.
     * Idempotence : {@code accessCodeRotatedAt} posterieur au check-out = deja tourne
     * pour ce depart (par le scheduler opt-in ou une execution precedente).
     */
    private StaticRotation rotateStaticCode(Property property, Long orgId, Reservation reservation) {
        CheckInInstructions instructions = instructionsRepository
                .findByPropertyIdAndOrganizationId(property.getId(), orgId).orElse(null);
        if (instructions == null || instructions.getAccessCode() == null
                || instructions.getAccessCode().isBlank()) {
            return StaticRotation.NONE;
        }

        ZonedDateTime checkOut = StayTimes.checkOutMoment(reservation, property);
        LocalDateTime rotatedAt = instructions.getAccessCodeRotatedAt();
        if (checkOut != null && rotatedAt != null
                && !rotatedAt.atZone(ZoneId.systemDefault()).toInstant().isBefore(checkOut.toInstant())) {
            return StaticRotation.ALREADY_ROTATED;
        }

        String newCode = accessCodeGenerator.generate(
                instructions.getAccessCodeFormat(), instructions.getAccessCode());
        if (newCode == null || newCode.isBlank()) {
            // Echec explicite (statut FAILED) : un code statique existe mais n'a pas pu
            // etre regenere — jamais de no-op silencieux sur une revocation d'acces.
            throw new IllegalStateException("Generation du nouveau code statique impossible "
                    + "pour le logement " + property.getId());
        }
        instructions.setAccessCode(newCode);
        instructions.setAccessCodeRotatedAt(LocalDateTime.ofInstant(clock.instant(), ZoneId.systemDefault()));
        instructionsRepository.save(instructions);

        notificationService.notifyAdminsAndManagersByOrgId(
                orgId,
                NotificationKey.ACCESS_CODE_ROTATED,
                "Nouveau code d'acces — " + property.getName(),
                "Le voyageur est parti : le code d'acces de « " + property.getName()
                        + " » a ete regenere (" + newCode + "). Pensez a mettre a jour "
                        + "le code de la boite a cle.",
                "/properties/" + property.getId());
        return StaticRotation.ROTATED;
    }

    /** Convention {@code scheduled_at} : heure murale serveur. */
    private static LocalDateTime toServerWallTime(ZonedDateTime moment) {
        return moment.withZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
    }
}
