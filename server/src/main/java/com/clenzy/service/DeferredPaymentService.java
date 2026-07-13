package com.clenzy.service;

import com.clenzy.dto.HostBalanceSummaryDto;
import com.clenzy.dto.HostBalanceSummaryDto.PropertyBalanceDto;
import com.clenzy.dto.HostBalanceSummaryDto.UnpaidInterventionDto;
import com.clenzy.dto.PaymentOrchestrationRequest;
import com.clenzy.dto.PaymentOrchestrationResult;
import com.clenzy.model.Intervention;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.User;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Service de gestion des paiements differes.
 * Permet de consulter le cumul des impayes d'un host et de creer
 * une session de paiement groupee (multi-provider) pour recouvrement.
 *
 * <p>ADR paiement multi-provider (Vague 2) : la creation de session passe par
 * {@link PaymentOrchestrationService#initiatePayment} — le provider (Stripe,
 * PayZone, CMI…) est resolu selon l'org + la devise. La reconciliation des
 * interventions (PROCESSING → PAID) est provider-agnostique : elle se fait via
 * l'event outbox {@code PAYMENT_COMPLETED} consomme par
 * {@link DeferredPaymentReconciliationService} (cle : {@code sourceType} +
 * {@code intervention_ids} portes par la {@code PaymentTransaction}), et non
 * plus via le {@code stripeSessionId} + le dispatch Stripe-direct.</p>
 */
@Service
@Transactional
public class DeferredPaymentService {

    private static final Logger logger = LoggerFactory.getLogger(DeferredPaymentService.class);

    /** Prefixe de {@code sourceType} des paiements differes groupes (reconnu par le consumer + le webhook). */
    public static final String SOURCE_TYPE_PREFIX = "DEFERRED_INTERVENTIONS";
    /** {@code sourceType} d'un lot d'interventions impayees regroupe par host. */
    public static final String SOURCE_TYPE_HOST = SOURCE_TYPE_PREFIX + "_HOST";
    /** {@code sourceType} d'un lot d'interventions impayees regroupe par logement. */
    public static final String SOURCE_TYPE_PROPERTY = SOURCE_TYPE_PREFIX + "_PROPERTY";

    private final InterventionRepository interventionRepository;
    private final UserRepository userRepository;
    private final TenantContext tenantContext;
    private final PaymentOrchestrationService orchestrationService;
    private final CurrencyConverterService currencyConverter;
    /** Marquage PROCESSING atomique HORS de la transaction ambiante (règle #2 : appel provider hors tx). */
    private final TransactionTemplate transactionTemplate;

    /** Devise de repli quand le lot n'a pas de devise déterminable (défaut plateforme). */
    @Value("${stripe.currency}")
    private String currency;

    @Value("${stripe.success-url}")
    private String successUrl;

    @Value("${stripe.cancel-url}")
    private String cancelUrl;

    public DeferredPaymentService(InterventionRepository interventionRepository,
                                   UserRepository userRepository,
                                   TenantContext tenantContext,
                                   PaymentOrchestrationService orchestrationService,
                                   CurrencyConverterService currencyConverter,
                                   PlatformTransactionManager transactionManager) {
        this.interventionRepository = interventionRepository;
        this.userRepository = userRepository;
        this.tenantContext = tenantContext;
        this.orchestrationService = orchestrationService;
        this.currencyConverter = currencyConverter;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    /**
     * Retourne le cumul des impayes d'un host, groupe par propriete.
     */
    @Transactional(readOnly = true)
    public HostBalanceSummaryDto getHostBalance(Long hostId) {
        User host = userRepository.findById(hostId)
                .orElseThrow(() -> new RuntimeException("Host non trouve: " + hostId));

        List<Intervention> unpaidInterventions = interventionRepository.findUnpaidByHostId(hostId, tenantContext.getRequiredOrganizationId());
        BigDecimal totalUnpaid = interventionRepository.sumUnpaidByHostId(hostId, tenantContext.getRequiredOrganizationId());

        // Grouper par propriete (LinkedHashMap pour garder l'ordre)
        Map<Long, List<Intervention>> byProperty = new LinkedHashMap<>();
        for (Intervention i : unpaidInterventions) {
            Long propId = i.getProperty() != null ? i.getProperty().getId() : 0L;
            byProperty.computeIfAbsent(propId, k -> new ArrayList<>()).add(i);
        }

        List<PropertyBalanceDto> propertyBalances = new ArrayList<>();
        for (Map.Entry<Long, List<Intervention>> entry : byProperty.entrySet()) {
            List<Intervention> interventions = entry.getValue();

            PropertyBalanceDto pb = new PropertyBalanceDto();
            pb.setPropertyId(entry.getKey());
            pb.setPropertyName(
                    interventions.get(0).getProperty() != null
                            ? interventions.get(0).getProperty().getName()
                            : "Propriete inconnue"
            );
            pb.setInterventionCount(interventions.size());

            BigDecimal propTotal = interventions.stream()
                    .map(Intervention::getEstimatedCost)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            pb.setUnpaidAmount(propTotal);

            List<UnpaidInterventionDto> dtos = interventions.stream().map(iv -> {
                UnpaidInterventionDto dto = new UnpaidInterventionDto();
                dto.setId(iv.getId());
                dto.setTitle(iv.getTitle());
                dto.setScheduledDate(iv.getStartTime() != null ? iv.getStartTime().toString() : null);
                dto.setEstimatedCost(iv.getEstimatedCost());
                dto.setStatus(iv.getStatus() != null ? iv.getStatus().name() : null);
                dto.setPaymentStatus(iv.getPaymentStatus() != null ? iv.getPaymentStatus().name() : null);
                return dto;
            }).collect(Collectors.toList());

            pb.setInterventions(dtos);
            propertyBalances.add(pb);
        }

        HostBalanceSummaryDto summary = new HostBalanceSummaryDto();
        summary.setHostId(hostId);
        summary.setHostName(host.getFullName());
        summary.setHostEmail(host.getEmail());
        summary.setTotalUnpaid(totalUnpaid);
        summary.setTotalInterventions(unpaidInterventions.size());
        summary.setProperties(propertyBalances);

        return summary;
    }

    /**
     * Cree une session de paiement groupee (multi-provider) pour toutes les
     * interventions impayees d'un host. Retourne l'URL de checkout du provider.
     *
     * <p>NOT_SUPPORTED (règle #2) : l'appel HTTP provider ne s'exécute PAS dans une
     * transaction DB (l'orchestration ouvre ses propres transactions courtes). Le
     * marquage PROCESSING s'exécute dans une transaction courte dédiée. La clé
     * d'idempotence dérivée du lot neutralise la double création (double-clic /
     * concurrence) au niveau de l'orchestrateur.</p>
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public String createGroupedPaymentSession(Long hostId) {
        User host = userRepository.findById(hostId)
                .orElseThrow(() -> new RuntimeException("Host non trouve: " + hostId));

        List<Intervention> unpaidInterventions = interventionRepository.findUnpaidByHostId(hostId, tenantContext.getRequiredOrganizationId());
        if (unpaidInterventions.isEmpty()) {
            throw new RuntimeException("Aucune intervention impayee pour ce host");
        }

        // Devise du lot : celle des interventions si elles sont homogènes, sinon repli plateforme.
        // C'est elle qui pilote la résolution multi-provider (MAD → PayZone/CMI, EUR → Stripe…).
        String batchCurrency = firstNonBlank(commonCurrency(unpaidInterventions), currency);
        // Z3-SEC-01 : montant TOUJOURS recalcule cote serveur, jamais fourni par le client.
        BigDecimal totalUnpaid = computeBatchAmount(unpaidInterventions, batchCurrency);

        String interventionIds = unpaidInterventions.stream()
                .map(i -> i.getId().toString())
                .collect(Collectors.joining(","));
        int count = unpaidInterventions.size();
        String description = "Paiement groupe de " + count + " intervention(s) impayee(s) - " + host.getFullName();

        // Clé d'idempotence stable pour ce lot (ids uniques → jamais de collision future).
        String idempotencyKey = "deferred-host-" + hostId + "-" + Integer.toHexString(interventionIds.hashCode());

        Map<String, String> metadata = new HashMap<>();
        metadata.put("host_id", hostId.toString());
        metadata.put("intervention_ids", interventionIds);

        PaymentOrchestrationResult result = initiateGroupedPayment(
                totalUnpaid, batchCurrency, SOURCE_TYPE_HOST, hostId, description, host.getEmail(), metadata, idempotencyKey);

        markInterventionsProcessing(unpaidInterventions, result.paymentResult().providerTxId());

        logger.info("Session de paiement groupee (differe host) creee via orchestrateur: tx={}, provider={}, "
                        + "hostId={}, montant={} {}, {} interventions",
                result.transaction() != null ? result.transaction().getTransactionRef() : "?",
                result.providerUsed(), hostId, totalUnpaid, batchCurrency, count);

        return result.paymentResult().redirectUrl();
    }

    /**
     * Solde des interventions NON RÉGLÉES d'un LOGEMENT (scope « logement supervisé » de
     * l'assistant, quel que soit le demandeur). Read-only, org-scopé.
     */
    @Transactional(readOnly = true)
    public HostBalanceSummaryDto getPropertyBalance(Long propertyId) {
        List<Intervention> unpaid = interventionRepository.findUnpaidByProperty(
                propertyId, tenantContext.getRequiredOrganizationId());
        BigDecimal total = unpaid.stream()
                .map(Intervention::getEstimatedCost)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        HostBalanceSummaryDto summary = new HostBalanceSummaryDto();
        summary.setTotalUnpaid(total);
        summary.setTotalInterventions(unpaid.size());
        if (!unpaid.isEmpty()) {
            PropertyBalanceDto pb = new PropertyBalanceDto();
            pb.setPropertyId(propertyId);
            pb.setPropertyName(unpaid.get(0).getProperty() != null ? unpaid.get(0).getProperty().getName() : "Logement");
            pb.setInterventionCount(unpaid.size());
            pb.setUnpaidAmount(total);
            pb.setInterventions(unpaid.stream().map(iv -> {
                UnpaidInterventionDto dto = new UnpaidInterventionDto();
                dto.setId(iv.getId());
                dto.setTitle(iv.getTitle());
                // Champ nommé scheduledDate → priorité au champ scheduledDate (cohérent avec
                // l'ORDER BY de findUnpaidByProperty), repli sur startTime si absent.
                java.time.LocalDateTime when = iv.getScheduledDate() != null
                        ? iv.getScheduledDate() : iv.getStartTime();
                dto.setScheduledDate(when != null ? when.toString() : null);
                dto.setEstimatedCost(iv.getEstimatedCost());
                dto.setStatus(iv.getStatus() != null ? iv.getStatus().name() : null);
                dto.setPaymentStatus(iv.getPaymentStatus() != null ? iv.getPaymentStatus().name() : null);
                return dto;
            }).collect(Collectors.toList()));
            summary.setProperties(List.of(pb));
        }
        return summary;
    }

    /**
     * Crée une session de paiement groupée (multi-provider) pour régler les
     * interventions impayées d'un LOGEMENT. (Scope « logement supervisé » ; le
     * demandeur peut différer de l'opérateur.)
     *
     * <p>NOT_SUPPORTED (règle #2) : l'appel provider est hors transaction DB ;
     * marquage PROCESSING en transaction courte dédiée + clé d'idempotence dérivée
     * du lot.</p>
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public String createPropertyPaymentSession(Long propertyId) {
        List<Intervention> unpaid = interventionRepository.findUnpaidByProperty(
                propertyId, tenantContext.getRequiredOrganizationId());
        if (unpaid.isEmpty()) {
            throw new RuntimeException("Aucune intervention impayee pour ce logement");
        }
        // Devise du lot : défaut du logement en priorité, sinon devise homogène des
        // interventions, sinon repli plateforme. Pilote la résolution multi-provider.
        String propDefaultCurrency = unpaid.get(0).getProperty() != null
                ? unpaid.get(0).getProperty().getDefaultCurrency() : null;
        String batchCurrency = firstNonBlank(propDefaultCurrency, commonCurrency(unpaid), currency);
        // Z3-SEC-01 : montant recalcule cote serveur (somme convertie dans la devise du lot).
        BigDecimal total = computeBatchAmount(unpaid, batchCurrency);
        String interventionIds = unpaid.stream().map(i -> i.getId().toString()).collect(Collectors.joining(","));
        String propName = unpaid.get(0).getProperty() != null ? unpaid.get(0).getProperty().getName() : "logement";
        String email = unpaid.get(0).getRequestor() != null ? unpaid.get(0).getRequestor().getEmail() : null;
        String description = "Paiement groupe de " + unpaid.size() + " intervention(s) impayee(s) - " + propName;

        String idempotencyKey = "deferred-property-" + propertyId + "-" + Integer.toHexString(interventionIds.hashCode());

        Map<String, String> metadata = new HashMap<>();
        metadata.put("property_id", propertyId.toString());
        metadata.put("intervention_ids", interventionIds);

        PaymentOrchestrationResult result = initiateGroupedPayment(
                total, batchCurrency, SOURCE_TYPE_PROPERTY, propertyId, description, email, metadata, idempotencyKey);

        markInterventionsProcessing(unpaid, result.paymentResult().providerTxId());

        logger.info("Session de paiement groupee (differe logement) creee via orchestrateur: tx={}, provider={}, "
                        + "propertyId={}, montant={} {}, {} interventions",
                result.transaction() != null ? result.transaction().getTransactionRef() : "?",
                result.providerUsed(), propertyId, total, batchCurrency, unpaid.size());

        return result.paymentResult().redirectUrl();
    }

    /**
     * Construit la requête d'orchestration et initie le paiement groupé.
     * Le montant fourni est déjà recalculé côté serveur par l'appelant.
     *
     * @throws RuntimeException si l'orchestrateur échoue (aucune session créée)
     */
    private PaymentOrchestrationResult initiateGroupedPayment(BigDecimal amount, String batchCurrency,
                                                              String sourceType, Long sourceId,
                                                              String description, String customerEmail,
                                                              Map<String, String> metadata, String idempotencyKey) {
        PaymentOrchestrationRequest request = new PaymentOrchestrationRequest(
                amount,
                batchCurrency,
                sourceType,
                sourceId,
                description,
                customerEmail,
                null,        // preferredProvider : résolu par l'orchestrateur (org + devise)
                successUrl,
                cancelUrl,
                metadata,
                idempotencyKey);

        PaymentOrchestrationResult result = orchestrationService.initiatePayment(request);
        if (!result.isSuccess()) {
            String err = result.paymentResult() != null ? result.paymentResult().errorMessage() : "erreur inconnue";
            throw new RuntimeException("Echec de creation de la session de paiement groupee: " + err);
        }
        return result;
    }

    /**
     * Marque le lot d'interventions en PROCESSING dans une transaction courte dédiée
     * (hors appel provider). Stocke la référence de session provider pour la traçabilité
     * (le {@code @Version} des interventions protège la course). La réconciliation
     * PROCESSING → PAID est portée par {@link DeferredPaymentReconciliationService}.
     */
    private void markInterventionsProcessing(List<Intervention> interventions, String providerTxId) {
        transactionTemplate.executeWithoutResult(status -> {
            for (Intervention intervention : interventions) {
                intervention.setPaymentStatus(PaymentStatus.PROCESSING);
                intervention.setStripeSessionId(providerTxId);
                interventionRepository.save(intervention);
            }
        });
    }

    /**
     * Somme les coûts des interventions convertis dans la devise cible du lot.
     * Pour un lot mono-devise (cas courant), la conversion est un no-op
     * ({@code from == to}) : aucun taux n'est requis. Les lots multi-devises sont
     * consolidés via {@link CurrencyConverterService} (taux du jour).
     */
    private BigDecimal computeBatchAmount(List<Intervention> interventions, String targetCurrency) {
        LocalDate today = LocalDate.now();
        return interventions.stream()
                .map(i -> currencyConverter.convert(
                        i.getEstimatedCost(),
                        firstNonBlank(i.getCurrency(), targetCurrency),
                        targetCurrency,
                        today))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * Devise commune à toutes les interventions du lot, ou {@code null} si le lot
     * est vide, contient une devise absente, ou mélange plusieurs devises.
     */
    private String commonCurrency(List<Intervention> interventions) {
        String common = null;
        for (Intervention i : interventions) {
            String c = i.getCurrency();
            if (c == null || c.isBlank()) return null;
            if (common == null) {
                common = c;
            } else if (!common.equalsIgnoreCase(c)) {
                return null;
            }
        }
        return common;
    }

    /** Première valeur non vide (null/blank ignorés). */
    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }
}
