package com.clenzy.service;

import com.clenzy.dto.HostBalanceSummaryDto;
import com.clenzy.dto.HostBalanceSummaryDto.PropertyBalanceDto;
import com.clenzy.dto.HostBalanceSummaryDto.UnpaidInterventionDto;
import com.clenzy.model.Intervention;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.User;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.UserRepository;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Service de gestion des paiements differes.
 * Permet de consulter le cumul des impayes d'un host et de creer
 * une session Stripe groupee pour recouvrement.
 */
@Service
@Transactional
public class DeferredPaymentService {

    private static final Logger logger = LoggerFactory.getLogger(DeferredPaymentService.class);

    private final InterventionRepository interventionRepository;
    private final UserRepository userRepository;
    private final TenantContext tenantContext;
    private final StripeGateway stripeGateway;
    /** Marquage PROCESSING atomique HORS de la transaction ambiante (règle #2 : Stripe hors tx). */
    private final TransactionTemplate transactionTemplate;

    @Value("${stripe.currency}")
    private String currency;

    @Value("${stripe.success-url}")
    private String successUrl;

    @Value("${stripe.cancel-url}")
    private String cancelUrl;

    public DeferredPaymentService(InterventionRepository interventionRepository,
                                   UserRepository userRepository,
                                   TenantContext tenantContext,
                                   StripeGateway stripeGateway,
                                   PlatformTransactionManager transactionManager) {
        this.interventionRepository = interventionRepository;
        this.userRepository = userRepository;
        this.tenantContext = tenantContext;
        this.stripeGateway = stripeGateway;
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
     * Cree une session Stripe groupee pour le paiement de toutes les interventions
     * impayees d'un host. Retourne l'URL de la session Stripe.
     *
     * <p>NOT_SUPPORTED (règle #2) : l'appel HTTP Stripe ne s'exécute PAS dans une
     * transaction DB. Les lectures et le marquage PROCESSING s'exécutent dans leurs
     * propres transactions courtes ; une clé d'idempotence dérivée du lot neutralise
     * la double création de session (double-clic / concurrence).</p>
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public String createGroupedPaymentSession(Long hostId) throws StripeException {
        User host = userRepository.findById(hostId)
                .orElseThrow(() -> new RuntimeException("Host non trouve: " + hostId));

        List<Intervention> unpaidInterventions = interventionRepository.findUnpaidByHostId(hostId, tenantContext.getRequiredOrganizationId());
        if (unpaidInterventions.isEmpty()) {
            throw new RuntimeException("Aucune intervention impayee pour ce host");
        }

        BigDecimal totalUnpaid = interventionRepository.sumUnpaidByHostId(hostId, tenantContext.getRequiredOrganizationId());
        long amountInCents = com.clenzy.payment.StripeAmounts.toMinorUnits(totalUnpaid);

        // Construire la liste d'IDs pour les metadata
        String interventionIds = unpaidInterventions.stream()
                .map(i -> i.getId().toString())
                .collect(Collectors.joining(","));

        // Description lisible
        int count = unpaidInterventions.size();
        String description = "Paiement groupe de " + count + " intervention(s) impayee(s) - " + host.getFullName();

        // Creer la session Stripe
        SessionCreateParams params = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.PAYMENT)
                .setSuccessUrl(successUrl)
                .setCancelUrl(cancelUrl)
                .addLineItem(
                        SessionCreateParams.LineItem.builder()
                                .setQuantity(1L)
                                .setPriceData(
                                        SessionCreateParams.LineItem.PriceData.builder()
                                                .setCurrency(currency.toLowerCase())
                                                .setUnitAmount(amountInCents)
                                                .setProductData(
                                                        SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                                                .setName("Baitly - Interventions impayees")
                                                                .setDescription(description)
                                                                .build()
                                                )
                                                .build()
                                )
                                .build()
                )
                .setCustomerEmail(host.getEmail())
                .putMetadata("type", "grouped_deferred")
                .putMetadata("host_id", hostId.toString())
                .putMetadata("intervention_ids", interventionIds)
                .build();

        // Clé d'idempotence stable pour ce lot (ids uniques → jamais de collision future).
        String idempotencyKey = "deferred-host-" + hostId + "-" + Integer.toHexString(interventionIds.hashCode());
        Session session = stripeGateway.createSession(params, idempotencyKey);

        // Marquer PROCESSING + session ID dans une transaction courte DÉDIÉE (hors de
        // l'appel Stripe ci-dessus). Le @Version des interventions protège la course.
        final String sessionId = session.getId();
        transactionTemplate.executeWithoutResult(status -> {
            for (Intervention intervention : unpaidInterventions) {
                intervention.setPaymentStatus(PaymentStatus.PROCESSING);
                intervention.setStripeSessionId(sessionId);
                interventionRepository.save(intervention);
            }
        });

        logger.info("Session Stripe groupee creee: sessionId={}, hostId={}, montant={} EUR, {} interventions",
                session.getId(), hostId, totalUnpaid, count);

        return session.getUrl();
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
     * Crée une session Stripe groupée pour régler les interventions impayées d'un LOGEMENT.
     * (Scope « logement supervisé » ; le demandeur peut différer de l'opérateur.)
     *
     * <p>NOT_SUPPORTED (règle #2) : l'appel Stripe est hors transaction DB ; marquage
     * PROCESSING en transaction courte dédiée + clé d'idempotence dérivée du lot.</p>
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public String createPropertyPaymentSession(Long propertyId) throws StripeException {
        List<Intervention> unpaid = interventionRepository.findUnpaidByProperty(
                propertyId, tenantContext.getRequiredOrganizationId());
        if (unpaid.isEmpty()) {
            throw new RuntimeException("Aucune intervention impayee pour ce logement");
        }
        BigDecimal total = unpaid.stream()
                .map(Intervention::getEstimatedCost)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        long amountInCents = com.clenzy.payment.StripeAmounts.toMinorUnits(total);
        String interventionIds = unpaid.stream().map(i -> i.getId().toString()).collect(Collectors.joining(","));
        String propName = unpaid.get(0).getProperty() != null ? unpaid.get(0).getProperty().getName() : "logement";
        String email = unpaid.get(0).getRequestor() != null ? unpaid.get(0).getRequestor().getEmail() : null;

        SessionCreateParams.Builder builder = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.PAYMENT)
                .setSuccessUrl(successUrl)
                .setCancelUrl(cancelUrl)
                .addLineItem(SessionCreateParams.LineItem.builder()
                        .setQuantity(1L)
                        .setPriceData(SessionCreateParams.LineItem.PriceData.builder()
                                .setCurrency(currency.toLowerCase())
                                .setUnitAmount(amountInCents)
                                .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                        .setName("Baitly - Interventions impayees")
                                        .setDescription("Paiement groupe de " + unpaid.size()
                                                + " intervention(s) impayee(s) - " + propName)
                                        .build())
                                .build())
                        .build())
                .putMetadata("type", "grouped_deferred")
                .putMetadata("property_id", propertyId.toString())
                .putMetadata("intervention_ids", interventionIds);
        if (email != null && !email.isBlank()) {
            builder.setCustomerEmail(email);
        }

        // Clé d'idempotence stable pour ce lot (ids uniques → pas de double session).
        String idempotencyKey = "deferred-property-" + propertyId + "-" + Integer.toHexString(interventionIds.hashCode());
        Session session = stripeGateway.createSession(builder.build(), idempotencyKey);

        // Marquage PROCESSING en transaction courte dédiée (hors appel Stripe).
        final String sessionId = session.getId();
        transactionTemplate.executeWithoutResult(status -> {
            for (Intervention intervention : unpaid) {
                intervention.setPaymentStatus(PaymentStatus.PROCESSING);
                intervention.setStripeSessionId(sessionId);
                interventionRepository.save(intervention);
            }
        });
        logger.info("Session Stripe groupee creee: sessionId={}, propertyId={}, montant={} EUR, {} interventions",
                session.getId(), propertyId, total, unpaid.size());
        return session.getUrl();
    }
}
