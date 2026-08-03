package com.clenzy.service.agent.supervision;

import com.clenzy.model.Property;
import com.clenzy.model.SmartLockDevice;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.SmartLockDeviceRepository;
import com.clenzy.service.automation.CreateMaintenanceInterventionExecutor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

/**
 * Règles de scan DÉTERMINISTES maintenance (agent Opérations « ops », vague B) :
 * <ul>
 *   <li><b>Batterie serrure faible</b> (≤ {@value #BATTERY_THRESHOLD} %) sans épisode
 *       ouvert → carte {@code LOCK_BATTERY_REPLACE} « Planifier » — le chemin
 *       AutomationRule F7a couvre les orgs avec règle, la carte couvre les autres
 *       (même marqueur d'épisode : jamais de doublon entre les deux) ;</li>
 *   <li><b>Entretien préventif</b> : aucune maintenance TERMINÉE depuis
 *       {@value #PREVENTIVE_MONTHS} mois (logement assez ancien pour que ce soit un
 *       signal, pas un reproche) et aucune tournée ouverte → carte
 *       {@code PREVENTIVE_MAINTENANCE} « Planifier ».</li>
 * </ul>
 *
 * <p>Zéro coût token. Dédup par intitulé + marqueurs d'épisode. Best-effort.</p>
 */
@Service
public class OpsMaintenanceScanner {

    private static final Logger log = LoggerFactory.getLogger(OpsMaintenanceScanner.class);
    private static final String MODULE_OPS = "ops";

    static final int BATTERY_THRESHOLD = 20;
    static final int PREVENTIVE_MONTHS = 11;
    private static final Set<String> MAINTENANCE_TYPES = Set.of("MAINTENANCE", "PREVENTIVE_MAINTENANCE");

    private final SmartLockDeviceRepository smartLockDeviceRepository;
    private final InterventionRepository interventionRepository;
    private final PropertyRepository propertyRepository;
    private final com.clenzy.repository.ServiceQuoteRepository serviceQuoteRepository;
    private final SupervisionSuggestionService suggestionService;
    private final Clock clock;

    public OpsMaintenanceScanner(SmartLockDeviceRepository smartLockDeviceRepository,
                                 InterventionRepository interventionRepository,
                                 PropertyRepository propertyRepository,
                                 com.clenzy.repository.ServiceQuoteRepository serviceQuoteRepository,
                                 SupervisionSuggestionService suggestionService,
                                 Clock clock) {
        this.smartLockDeviceRepository = smartLockDeviceRepository;
        this.interventionRepository = interventionRepository;
        this.propertyRepository = propertyRepository;
        this.serviceQuoteRepository = serviceQuoteRepository;
        this.suggestionService = suggestionService;
        this.clock = clock;
    }

    /** Évalue les deux règles pour un logement. */
    public void scanProperty(Long orgId, Long propertyId) {
        if (orgId == null || propertyId == null) {
            return;
        }
        try {
            scanLockBatteries(orgId, propertyId);
        } catch (Exception e) {
            log.debug("lock battery scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
        try {
            scanPreventiveMaintenance(orgId, propertyId);
        } catch (Exception e) {
            log.debug("preventive scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
        try {
            scanQuotesAwaitingApproval(orgId, propertyId);
        } catch (Exception e) {
            log.debug("quote scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
    }

    /**
     * Devis en attente (M4) : intervention encore OUVERTE avec ≥ 1 devis RECEIVED →
     * carte comparative. Recommandation : le MOINS CHER — l'opérateur voit tous les
     * devis (montant, dispo) dans le motif et peut passer par la fiche pour choisir
     * autrement. Dédup par intitulé (id d'intervention).
     */
    private void scanQuotesAwaitingApproval(Long orgId, Long propertyId) {
        final java.time.LocalDateTime now = java.time.LocalDateTime.now(clock);
        for (com.clenzy.model.Intervention intervention : interventionRepository
                .findByPropertyAndCreatedBetween(propertyId, orgId, now.minusDays(60), now)) {
            if (!com.clenzy.service.automation.CreateMaintenanceInterventionExecutor
                    .openStatuses().contains(intervention.getStatus())) {
                continue;
            }
            final var quotes = serviceQuoteRepository
                    .findByInterventionIdAndOrganizationIdOrderByAmountAsc(
                            intervention.getId(), orgId).stream()
                    .filter(q -> q.getStatus() == com.clenzy.model.ServiceQuote.Status.RECEIVED)
                    .toList();
            if (quotes.isEmpty()) {
                continue;
            }
            final var recommended = quotes.get(0); // tri par montant croissant
            final String comparison = quotes.stream()
                    .map(q -> q.getProviderName() + " — " + q.getAmount() + " " + q.getCurrency()
                            + (q.getEarliestStartDate() != null
                                ? " (dispo " + q.getEarliestStartDate() + ")" : ""))
                    .reduce((a, b) -> a + " · " + b).orElse("");
            suggestionService.recordActionable(
                    orgId, propertyId, MODULE_OPS,
                    "Devis à approuver (intervention #" + intervention.getId() + ")",
                    "« " + intervention.getTitle() + " » : " + quotes.size() + " devis reçu(s) — "
                            + comparison + ". « Approuver » retient le moins cher ("
                            + recommended.getProviderName() + "), écarte les autres et reporte le "
                            + "montant sur l'intervention ; pour un autre choix, passer par la fiche.",
                    SupervisionActionType.QUOTE_APPROVAL,
                    "{\"quoteId\":" + recommended.getId() + "}",
                    recommended.getAmount().movePointRight(2)
                            .setScale(0, java.math.RoundingMode.HALF_UP).longValueExact(),
                    "info");
        }
    }

    private void scanLockBatteries(Long orgId, Long propertyId) {
        final List<SmartLockDevice> devices = smartLockDeviceRepository.findByPropertyId(propertyId);
        for (SmartLockDevice device : devices) {
            if (device.getOrganizationId() == null || !device.getOrganizationId().equals(orgId)
                    || device.getBatteryLevel() == null
                    || device.getBatteryLevel() > BATTERY_THRESHOLD) {
                continue;
            }
            if (interventionRepository.existsOpenByPropertyAndMarker(propertyId, orgId,
                    CreateMaintenanceInterventionExecutor.openStatuses(),
                    CreateMaintenanceInterventionExecutor.marker(device.getId()))) {
                continue; // épisode déjà couvert (règle F7a ou carte précédente appliquée)
            }
            final String label = device.getName() != null && !device.getName().isBlank()
                    ? device.getName() : "serrure #" + device.getId();
            suggestionService.recordActionable(
                    orgId, propertyId, MODULE_OPS,
                    "Batterie serrure à " + device.getBatteryLevel() + " % — " + label,
                    "La serrure connectée risque la panne — un guest bloqué à l'arrivée est le "
                            + "pire scénario. « Planifier » crée l'intervention de remplacement "
                            + "des piles (priorité haute, dès demain).",
                    SupervisionActionType.LOCK_BATTERY_REPLACE,
                    "{\"deviceId\":" + device.getId() + "}", null, "warning");
        }
    }

    private void scanPreventiveMaintenance(Long orgId, Long propertyId) {
        final Property property = propertyRepository.findById(propertyId).orElse(null);
        if (property == null || property.getOrganizationId() == null
                || !property.getOrganizationId().equals(orgId)) {
            return;
        }
        final LocalDateTime cutoff = LocalDateTime.now(clock).minusMonths(PREVENTIVE_MONTHS);
        // Logement trop récent : « jamais entretenu » n'est pas encore un signal.
        if (property.getCreatedAt() == null || property.getCreatedAt().isAfter(cutoff)) {
            return;
        }
        final LocalDateTime lastCompleted = interventionRepository
                .findLastCompletedByPropertyAndTypes(propertyId, orgId, MAINTENANCE_TYPES);
        if (lastCompleted != null && lastCompleted.isAfter(cutoff)) {
            return; // entretenu récemment
        }
        if (interventionRepository.existsOpenByPropertyAndMarker(propertyId, orgId,
                CreateMaintenanceInterventionExecutor.openStatuses(),
                CreateMaintenanceInterventionExecutor.preventiveMarker(propertyId))) {
            return; // tournée déjà ouverte
        }
        suggestionService.recordActionable(
                orgId, propertyId, MODULE_OPS,
                "Entretien préventif à planifier",
                (lastCompleted == null
                        ? "Aucune maintenance terminée n'est enregistrée pour ce logement. "
                        : "Aucune maintenance terminée depuis plus de " + PREVENTIVE_MONTHS + " mois. ")
                        + "« Planifier » crée la tournée d'entretien préventif (climatisation, "
                        + "plomberie, équipements) avant qu'une panne ne tombe en plein séjour.",
                SupervisionActionType.PREVENTIVE_MAINTENANCE,
                "{}", null, "info");
    }
}
