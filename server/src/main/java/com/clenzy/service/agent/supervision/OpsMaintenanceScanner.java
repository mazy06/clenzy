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
    private final com.clenzy.repository.PropertyStockItemRepository propertyStockItemRepository;
    private final SupervisionSuggestionService suggestionService;
    private final Clock clock;

    public OpsMaintenanceScanner(SmartLockDeviceRepository smartLockDeviceRepository,
                                 InterventionRepository interventionRepository,
                                 PropertyRepository propertyRepository,
                                 com.clenzy.repository.ServiceQuoteRepository serviceQuoteRepository,
                                 com.clenzy.repository.PropertyStockItemRepository propertyStockItemRepository,
                                 SupervisionSuggestionService suggestionService,
                                 Clock clock) {
        this.smartLockDeviceRepository = smartLockDeviceRepository;
        this.interventionRepository = interventionRepository;
        this.propertyRepository = propertyRepository;
        this.serviceQuoteRepository = serviceQuoteRepository;
        this.propertyStockItemRepository = propertyStockItemRepository;
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
        try {
            scanLowStock(orgId, propertyId);
        } catch (Exception e) {
            log.debug("stock scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
        try {
            scanMissionsToConfirm(orgId, propertyId);
        } catch (Exception e) {
            log.debug("mission confirmation scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
        try {
            scanDepositsToCollect(orgId, propertyId);
        } catch (Exception e) {
            log.debug("deposit scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
    }

    /**
     * Missions proposees qui attendent la reponse de l'intervenant.
     *
     * <p>Une intervention assignee mais non confirmee ne se voit que sur le
     * tableau de bord de CELUI a qui elle est proposee. Cote gestion, elle
     * ressemble a une mission planifiee — jusqu'au jour ou personne ne vient.
     * La carte la remonte tant qu'elle reste sans reponse.</p>
     */
    private void scanMissionsToConfirm(Long orgId, Long propertyId) {
        final java.time.LocalDateTime now = java.time.LocalDateTime.now(clock);
        for (com.clenzy.model.Intervention intervention : interventionRepository
                .findByPropertyAndCreatedBetween(propertyId, orgId, now.minusDays(60), now)) {
            if (!com.clenzy.service.automation.CreateMaintenanceInterventionExecutor
                    .openStatuses().contains(intervention.getStatus())) {
                continue;
            }
            if (intervention.getAssignedUser() == null
                    || intervention.getAssignmentResponse()
                        != com.clenzy.model.InterventionAssignmentResponse.PENDING) {
                continue;
            }
            final String intervenant = intervention.getAssignedUser().getFullName();
            suggestionService.record(
                    orgId, propertyId, MODULE_OPS,
                    "mission_to_confirm",
                    "Mission a confirmer (intervention #" + intervention.getId() + ")",
                    "« " + intervention.getTitle() + " » est proposee a "
                            + (intervenant != null ? intervenant : "un intervenant")
                            + " et attend sa reponse. Tant qu'elle n'est pas acceptee, "
                            + "aucune date n'est tenue.");
        }
    }

    /**
     * Acomptes exigibles, non encaisses.
     *
     * <p>L'intervenant bloque sa date des l'acompte regle : tant qu'il ne l'est
     * pas, le chantier n'avance pas et rien ne le signalait cote gestion.</p>
     */
    private void scanDepositsToCollect(Long orgId, Long propertyId) {
        final java.time.LocalDateTime now = java.time.LocalDateTime.now(clock);
        for (com.clenzy.model.Intervention intervention : interventionRepository
                .findByPropertyAndCreatedBetween(propertyId, orgId, now.minusDays(60), now)) {
            if (!com.clenzy.service.automation.CreateMaintenanceInterventionExecutor
                    .openStatuses().contains(intervention.getStatus())) {
                continue;
            }
            serviceQuoteRepository
                    .findByInterventionIdAndOrganizationIdOrderByAmountAsc(intervention.getId(), orgId)
                    .stream()
                    .filter(q -> q.getStatus() == com.clenzy.model.ServiceQuote.Status.APPROVED)
                    .filter(q -> q.getDepositAmount() != null
                            && q.getDepositAmount().compareTo(java.math.BigDecimal.ZERO) > 0)
                    // Deja encaisse : la carte n'aurait plus d'objet.
                    .filter(q -> q.getDepositPaidAt() == null)
                    .findFirst()
                    .ifPresent(quote -> suggestionService.record(
                            orgId, propertyId, MODULE_OPS,
                            "deposit_to_collect",
                            "Acompte a regler (intervention #" + intervention.getId() + ")",
                            "Le devis de " + quote.getProviderName() + " est approuve : "
                                    + quote.getDepositAmount() + " " + quote.getCurrency()
                                    + " d'acompte restent a verser. "
                                    + "L'intervenant bloque sa date des reception."));
        }
    }

    /**
     * Stock sous le seuil (M5) : avec un fournisseur configuré → carte ACTIONNABLE
     * « Commander » (bon de commande par email) ; sans fournisseur → carte info
     * « stock bas » (rien d'honnête à commander). Seuil 0 = article non suivi.
     */
    private void scanLowStock(Long orgId, Long propertyId) {
        for (com.clenzy.model.PropertyStockItem item : propertyStockItemRepository
                .findByPropertyIdAndOrganizationIdOrderByNameAsc(propertyId, orgId)) {
            if (item.getReorderThreshold() <= 0 || item.getQuantity() > item.getReorderThreshold()) {
                continue;
            }
            final boolean orderable = item.getSupplierEmail() != null
                    && !item.getSupplierEmail().isBlank() && item.getReorderQuantity() > 0;
            if (orderable) {
                suggestionService.recordActionable(
                        orgId, propertyId, MODULE_OPS,
                        "Stock bas : " + item.getName() + " (" + item.getQuantity() + " restant)",
                        "Seuil de " + item.getReorderThreshold() + " atteint. « Commander » envoie "
                                + "le bon de commande (" + item.getReorderQuantity()
                                + (item.getUnit() != null ? " " + item.getUnit() : "") + ") à "
                                + item.getSupplierName() + " — le réassort se confirme ensuite "
                                + "dans la fiche du logement.",
                        SupervisionActionType.LINEN_STOCK_ORDER,
                        "{\"stockItemId\":" + item.getId() + "}", null, "warning");
            } else {
                suggestionService.record(orgId, propertyId, MODULE_OPS, "stock_low",
                        "Stock bas : " + item.getName() + " (" + item.getQuantity() + " restant)",
                        "Seuil de " + item.getReorderThreshold() + " atteint et aucun fournisseur "
                                + "configuré — renseigner le fournisseur dans la fiche du logement "
                                + "pour que la commande devienne un clic.");
            }
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
