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
 *   <li><b>Demande sans prestataire</b> : projection sur le logement du signal
 *       déjà porté par la liste d'actions du tableau de bord — même requête,
 *       même seuil, aucune divergence possible.</li>
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
    private final com.clenzy.repository.ServiceRequestRepository serviceRequestRepository;
    private final SupervisionSuggestionService suggestionService;
    private final Clock clock;

    public OpsMaintenanceScanner(SmartLockDeviceRepository smartLockDeviceRepository,
                                 InterventionRepository interventionRepository,
                                 PropertyRepository propertyRepository,
                                 com.clenzy.repository.ServiceQuoteRepository serviceQuoteRepository,
                                 com.clenzy.repository.PropertyStockItemRepository propertyStockItemRepository,
                                 com.clenzy.repository.ServiceRequestRepository serviceRequestRepository,
                                 SupervisionSuggestionService suggestionService,
                                 Clock clock) {
        this.smartLockDeviceRepository = smartLockDeviceRepository;
        this.interventionRepository = interventionRepository;
        this.propertyRepository = propertyRepository;
        this.serviceQuoteRepository = serviceQuoteRepository;
        this.propertyStockItemRepository = propertyStockItemRepository;
        this.serviceRequestRepository = serviceRequestRepository;
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
            scanWorkAwaitingReview(orgId, propertyId);
        } catch (Exception e) {
            log.debug("work review scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
        try {
            scanUnassignedServiceRequests(orgId, propertyId);
        } catch (Exception e) {
            log.debug("unassigned service request scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
        try {
            // L'acompte ne fait plus l'objet d'une carte : il est devenu une
            // étape de l'échéancier de la carte de paiement, sur l'agent Finance.
            // Ici on ne fait que retirer celles déjà sorties.
            withdrawDepositCards(orgId, propertyId);
        } catch (Exception e) {
            log.debug("deposit card withdrawal failed org={} property={}: {}",
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
     * Travail soumis, qui attend son contrôle.
     *
     * <p>L'intervenant a rendu : photos, durée réelle, horodatage de fin. Tant
     * que personne n'a regardé, le chantier est fini pour lui mais le solde ne
     * peut pas devenir exigible — et rien ne le signalait côté gestion.</p>
     */
    private void scanWorkAwaitingReview(Long orgId, Long propertyId) {
        final java.time.LocalDateTime now = java.time.LocalDateTime.now(clock);
        for (com.clenzy.model.Intervention intervention : interventionRepository
                .findByPropertyAndCreatedBetween(propertyId, orgId, now.minusDays(60), now)) {
            if (intervention.getStatus() != com.clenzy.model.InterventionStatus.AWAITING_VALIDATION) {
                continue;
            }
            final String intervenant = intervention.getAssignedUser() != null
                    ? intervention.getAssignedUser().getFullName() : null;
            suggestionService.recordActionable(
                    orgId, propertyId, MODULE_OPS,
                    "Travail a controler (intervention #" + intervention.getId() + ")",
                    "« " + intervention.getTitle() + " » a ete rendu"
                            + (intervenant != null ? " par " + intervenant : "")
                            + ". Examiner les photos, la duree reelle et le respect du creneau"
                            + " avant de rendre le solde exigible.",
                    SupervisionActionType.WORK_REVIEW,
                    "{\"interventionId\":" + intervention.getId() + "}",
                    null, "warning");
        }
    }

    /**
     * Retire les cartes d'acompte, devenues redondantes.
     *
     * <p>L'acompte avait sa propre carte, sur l'agent Operations. L'exploitant
     * voyait donc « Regler 220 EUR » cote Finance et « Acompte a regler 40 EUR »
     * cote Operations pour LE MEME chantier, sans que rien ne dise que les 40
     * font partie des 220 — et regler l'un laissait l'autre en place.</p>
     *
     * <p>L'acompte est desormais une etape de l'echeancier porte par la carte de
     * paiement. Cesser d'emettre ne suffit pas : les cartes deja sorties
     * resteraient des jours a reclamer une somme deja demandee ailleurs.</p>
     */
    private void withdrawDepositCards(Long orgId, Long propertyId) {
        final java.time.LocalDateTime now = java.time.LocalDateTime.now(clock);
        for (com.clenzy.model.Intervention intervention : interventionRepository
                .findByPropertyAndCreatedBetween(propertyId, orgId, now.minusDays(60), now)) {
            suggestionService.dismissObsolete(orgId, propertyId, MODULE_OPS,
                    "Acompte a regler (intervention #" + intervention.getId() + ")");
        }
    }

    /**
     * Demande de service que personne n'a prise.
     *
     * <p><b>Projection, pas second détecteur.</b> Le signal existe déjà sur la
     * liste d'actions du tableau de bord ({@code ServiceRequestActionSource}) ;
     * on réutilise ici SA requête et SON seuil, pour le poser sur le logement,
     * là où vit la constellation. Deux surfaces, une seule vérité : elles ne
     * peuvent pas diverger.</p>
     *
     * <p>Le critère est volontairement {@code createdAt} et non
     * {@code autoAssignStatus = 'exhausted'} : filtrer sur l'épuisement laisse
     * passer le cas le plus courant — une recherche « en cours » depuis des
     * jours, qui n'escalade jamais et que rien ne signale.</p>
     */
    private void scanUnassignedServiceRequests(Long orgId, Long propertyId) {
        final java.time.LocalDateTime staleBefore = java.time.LocalDateTime.now(clock)
                .minusMinutes(com.clenzy.service.dashboard.ServiceRequestActionSource
                        .ASSIGNMENT_GRACE_MINUTES);
        for (com.clenzy.model.ServiceRequest request
                : serviceRequestRepository.findStuckUnassignedForOrg(orgId, staleBefore)) {
            if (request.getProperty() == null
                    || !propertyId.equals(request.getProperty().getId())) {
                continue;
            }
            // Une date déjà passée ne se rattrape pas : le dire, plutôt que de
            // laisser croire qu'un geste suffit encore.
            final boolean overdue = request.getDesiredDate() != null
                    && request.getDesiredDate().isBefore(java.time.LocalDateTime.now(clock));
            // ACTIONNABLE : la carte ne se contente plus de signaler, elle ouvre
            // la reprise en main. L'automatique a eu sa chance et a echoue —
            // constater sans pouvoir agir laissait la demande orpheline.
            suggestionService.recordActionable(
                    orgId, propertyId, MODULE_OPS,
                    "Demande sans prestataire (demande #" + request.getId() + ")",
                    "« " + request.getTitle() + " » n'a toujours personne. "
                            + (overdue
                                ? "La date souhaitee est passee : la prestation n'aura pas lieu."
                                : "La recherche automatique a eu sa chance ; il faut assigner a la main."),
                    com.clenzy.service.agent.supervision.SupervisionActionType.REASSIGN_MANUAL,
                    "{\"serviceRequestId\":" + request.getId() + "}",
                    null,
                    overdue ? "critical" : "warning");
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
            final var allQuotes = serviceQuoteRepository
                    .findByInterventionIdAndOrganizationIdOrderByAmountAsc(intervention.getId(), orgId);
            // Un devis DEJA approuve clot la decision. Le prestataire peut
            // continuer d'en resoumettre — l'intervention 97 en portait quatre
            // apres coup — mais proposer d'approuver serait promettre un geste
            // que `ServiceQuoteService.approve` refuse : il exige une
            // intervention encore sans approbation. La carte ne pouvait
            // qu'echouer, et rien ne le disait avant le clic.
            final boolean dejaApprouve = allQuotes.stream()
                    .anyMatch(q -> q.getStatus() == com.clenzy.model.ServiceQuote.Status.APPROVED);
            if (dejaApprouve) {
                // Cesser d'emettre ne suffit pas : une carte deja sortie reste
                // des jours a proposer un geste voue au refus. On la retire.
                suggestionService.dismissObsolete(orgId, propertyId, MODULE_OPS,
                        "Devis à approuver (intervention #" + intervention.getId() + ")");
                continue;
            }
            final var quotes = allQuotes.stream()
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
