package com.clenzy.service.automation;

import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.NoiseAlert;
import com.clenzy.model.Property;
import com.clenzy.model.SmartLockDevice;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.NoiseAlertRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.SmartLockDeviceRepository;
import com.clenzy.service.access.StayTimes;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;

/**
 * Executeur {@code CREATE_MAINTENANCE_INTERVENTION} du moteur AutomationRule.
 * Deux sujets supportes :
 * <ul>
 *   <li><b>F7a</b> — {@link #SUBJECT_SMART_LOCK_DEVICE} (deviceId) : batterie
 *       serrure critique → intervention preventive (remplacer les piles avant la
 *       panne) ;</li>
 *   <li><b>F6b</b> — {@code TYPE_NOISE_ALERT} (alertId) : escalade bruit →
 *       intervention de VERIFICATION sur place (regle recommandee : conditions
 *       {@code {"alertsLast24h": {"gte": 3}}}).</li>
 * </ul>
 *
 * <p>Dans les deux cas : intervention MAINTENANCE planifiee au lendemain 10:00
 * dans le fuseau du logement (regle audit n°9).</p>
 *
 * <p><b>Filet d'idempotence metier</b> (en plus de l'idempotence generique du
 * moteur) : marqueur dans specialInstructions ({@code [lock-battery:&lt;deviceId&gt;]}
 * ou {@code [noise-check:&lt;propertyId&gt;]}) — pas de nouvelle intervention tant
 * qu'une intervention du meme type est OUVERTE pour ce device/logement. C'est ce
 * filet qui borne l'EPISODE (batterie critique, rafale d'alertes bruit) : une fois
 * l'intervention terminee, un nouvel episode pourra en recreer une.</p>
 */
@Service
public class CreateMaintenanceInterventionExecutor implements AutomationActionExecutor {

    /**
     * Type de sujet attendu par cet executeur (pose par les capteurs serrure).
     * Sujet STABLE (deviceId) : LOCK_BATTERY_CRITICAL est un declencheur
     * recurrent ({@code dedupePerSubject=false}), le moteur ne deduplique pas —
     * c'est le filet « intervention batterie OUVERTE » de cet executeur qui
     * porte l'idempotence par episode.
     */
    public static final String SUBJECT_SMART_LOCK_DEVICE = "SMART_LOCK_DEVICE";

    /** Cles de donnees optionnelles du sujet. */
    public static final String DATA_BATTERY_LEVEL = "batteryLevel";

    private static final Logger log = LoggerFactory.getLogger(CreateMaintenanceInterventionExecutor.class);

    private static final List<InterventionStatus> OPEN_STATUSES = List.of(
            InterventionStatus.PENDING,
            InterventionStatus.AWAITING_VALIDATION,
            InterventionStatus.AWAITING_PAYMENT,
            InterventionStatus.IN_PROGRESS);

    private static final LocalTime SCHEDULED_TIME = LocalTime.of(10, 0);
    private static final String MAINTENANCE_TYPE = "MAINTENANCE";

    private final SmartLockDeviceRepository deviceRepository;
    private final InterventionRepository interventionRepository;
    private final PropertyRepository propertyRepository;
    private final NoiseAlertRepository noiseAlertRepository;

    public CreateMaintenanceInterventionExecutor(SmartLockDeviceRepository deviceRepository,
                                                 InterventionRepository interventionRepository,
                                                 PropertyRepository propertyRepository,
                                                 NoiseAlertRepository noiseAlertRepository) {
        this.deviceRepository = deviceRepository;
        this.interventionRepository = interventionRepository;
        this.propertyRepository = propertyRepository;
        this.noiseAlertRepository = noiseAlertRepository;
    }

    /** Marqueur d'idempotence batterie (F7a) pose dans specialInstructions. */
    static String marker(Long deviceId) {
        return "[lock-battery:" + deviceId + "]";
    }

    /** Marqueur d'idempotence verification bruit (F6b) pose dans specialInstructions. */
    static String noiseMarker(Long propertyId) {
        return "[noise-check:" + propertyId + "]";
    }

    @Override
    public AutomationAction action() {
        return AutomationAction.CREATE_MAINTENANCE_INTERVENTION;
    }

    @Override
    public ExecutionResult execute(AutomationRule rule, AutomationActionContext ctx) {
        if (ctx.subjectId() == null) {
            throw new IllegalStateException(
                    "CREATE_MAINTENANCE_INTERVENTION sans sujet (regle " + rule.getId() + ")");
        }
        if (AutomationSubject.TYPE_NOISE_ALERT.equals(ctx.subjectType())) {
            return executeForNoiseAlert(ctx);
        }
        if (!SUBJECT_SMART_LOCK_DEVICE.equals(ctx.subjectType())) {
            // Regle mal configuree : echec explicite (statut FAILED cote moteur).
            throw new IllegalStateException("CREATE_MAINTENANCE_INTERVENTION attend un sujet "
                    + SUBJECT_SMART_LOCK_DEVICE + " ou " + AutomationSubject.TYPE_NOISE_ALERT
                    + ", recu : " + ctx.subjectType());
        }

        SmartLockDevice device = deviceRepository.findById(ctx.subjectId()).orElse(null);
        if (device == null) {
            throw new IllegalStateException("Serrure introuvable : " + ctx.subjectId());
        }
        // findById contourne le filtre Hibernate : verifier l'org (audit regle n°3).
        if (device.getOrganizationId() == null || !device.getOrganizationId().equals(ctx.orgId())) {
            throw new IllegalStateException("Serrure " + device.getId()
                    + " hors de l'organisation " + ctx.orgId());
        }
        if (device.getPropertyId() == null) {
            return ExecutionResult.skipped(
                    "Serrure " + device.getId() + " sans propriete associee");
        }

        String marker = marker(device.getId());
        if (interventionRepository.existsOpenByPropertyAndMarker(
                device.getPropertyId(), ctx.orgId(), OPEN_STATUSES, marker)) {
            return ExecutionResult.skipped("Intervention batterie deja ouverte pour la serrure "
                    + device.getId() + " (episode couvert)");
        }

        Property property = loadOwnedProperty(device.getPropertyId(), ctx.orgId());
        if (property.getOwner() == null) {
            return ExecutionResult.skipped("Propriete " + property.getId()
                    + " sans owner (requestor obligatoire)");
        }

        String deviceLabel = device.getName() != null && !device.getName().isBlank()
                ? device.getName()
                : "serrure #" + device.getId();
        Long batteryLevel = ctx.dataAsLong(DATA_BATTERY_LEVEL);

        Intervention intervention = newPendingIntervention(ctx.orgId(), property,
                "Batterie serrure critique — " + deviceLabel,
                "Maintenance preventive : la serrure connectee " + deviceLabel
                        + " (" + property.getName() + ") signale une batterie critique."
                        + " Remplacer les piles avant la panne pour ne pas bloquer les acces guests."
                        + (batteryLevel != null ? " Niveau releve : " + batteryLevel + "%." : ""),
                marker + " Intervention generee automatiquement (batterie critique serrure connectee).");

        interventionRepository.save(intervention);
        log.info("Batterie critique serrure {} : intervention preventive #{} creee (propriete {}, prevue {})",
                device.getId(), intervention.getId(), property.getId(), intervention.getScheduledDate());
        return ExecutionResult.executed();
    }

    /**
     * F6b — escalade bruit : intervention de VERIFICATION sur le logement de
     * l'alerte. Idempotence par episode : marqueur {@code [noise-check:&lt;propertyId&gt;]}
     * tant qu'une intervention bruit est ouverte (meme pattern que la batterie).
     */
    private ExecutionResult executeForNoiseAlert(AutomationActionContext ctx) {
        NoiseAlert alert = noiseAlertRepository.findById(ctx.subjectId()).orElse(null);
        if (alert == null) {
            throw new IllegalStateException("Alerte bruit introuvable : " + ctx.subjectId());
        }
        // findById contourne le filtre Hibernate : validation d'organisation explicite.
        if (!ctx.orgId().equals(alert.getOrganizationId())) {
            throw new IllegalStateException("Alerte bruit " + alert.getId()
                    + " hors de l'organisation " + ctx.orgId());
        }
        if (alert.getPropertyId() == null) {
            return ExecutionResult.skipped("Alerte " + alert.getId() + " sans propriete associee");
        }

        String marker = noiseMarker(alert.getPropertyId());
        if (interventionRepository.existsOpenByPropertyAndMarker(
                alert.getPropertyId(), ctx.orgId(), OPEN_STATUSES, marker)) {
            return ExecutionResult.skipped("Intervention de verification bruit deja ouverte "
                    + "pour la propriete " + alert.getPropertyId() + " (episode couvert)");
        }

        Property property = loadOwnedProperty(alert.getPropertyId(), ctx.orgId());
        if (property.getOwner() == null) {
            return ExecutionResult.skipped("Propriete " + property.getId()
                    + " sans owner (requestor obligatoire)");
        }

        Long alertsLast24h = ctx.dataAsLong(AutomationSubject.DATA_ALERTS_LAST_24H);
        Long measuredDb = ctx.dataAsLong(AutomationSubject.DATA_MEASURED_DB);

        Intervention intervention = newPendingIntervention(ctx.orgId(), property,
                "Verification bruit — " + property.getName(),
                "Escalade bruit : alertes repetees sur « " + property.getName() + " »"
                        + (alertsLast24h != null ? " (" + alertsLast24h + " alertes sur 24 h)" : "")
                        + (measuredDb != null ? ", dernier releve " + measuredDb + " dB" : "")
                        + ". Passer verifier sur place l'origine du bruit et l'etat du logement.",
                marker + " Intervention generee automatiquement (escalade alertes bruit).");

        interventionRepository.save(intervention);
        log.info("Escalade bruit propriete {} : intervention de verification #{} creee (prevue {})",
                property.getId(), intervention.getId(), intervention.getScheduledDate());
        return ExecutionResult.executed();
    }

    /** Charge la propriete et valide l'ownership org (audit regle n°3). */
    private Property loadOwnedProperty(Long propertyId, Long orgId) {
        Property property = propertyRepository.findById(propertyId).orElse(null);
        if (property == null) {
            throw new IllegalStateException("Propriete introuvable : " + propertyId);
        }
        if (!orgId.equals(property.getOrganizationId())) {
            throw new IllegalStateException("Propriete " + property.getId()
                    + " hors de l'organisation " + orgId);
        }
        return property;
    }

    /** Intervention MAINTENANCE PENDING planifiee au lendemain 10:00, fuseau du logement (audit n°9). */
    private Intervention newPendingIntervention(Long orgId, Property property,
                                                String title, String description,
                                                String specialInstructions) {
        ZoneId zone = StayTimes.zoneOf(property);
        LocalDateTime scheduledDate = LocalDate.now(zone).plusDays(1).atTime(SCHEDULED_TIME);

        Intervention intervention = new Intervention();
        intervention.setOrganizationId(orgId);
        intervention.setProperty(property);
        intervention.setRequestor(property.getOwner());
        intervention.setTitle(title);
        intervention.setDescription(description);
        intervention.setType(MAINTENANCE_TYPE);
        intervention.setStatus(InterventionStatus.PENDING);
        intervention.setPriority("HIGH");
        intervention.setScheduledDate(scheduledDate);
        intervention.setEstimatedDurationHours(1);
        intervention.setSpecialInstructions(specialInstructions);
        return intervention;
    }
}
