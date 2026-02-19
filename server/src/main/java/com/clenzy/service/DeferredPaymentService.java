package com.clenzy.service;

import com.clenzy.dto.HostBalanceSummaryDto;
import com.clenzy.dto.HostBalanceSummaryDto.PropertyBalanceDto;
import com.clenzy.dto.HostBalanceSummaryDto.UnpaidInterventionDto;
import com.clenzy.model.Intervention;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.User;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.UserRepository;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    @Value("${stripe.secret-key}")
    private String stripeSecretKey;

    @Value("${stripe.currency}")
    private String currency;

    @Value("${stripe.success-url}")
    private String successUrl;

    @Value("${stripe.cancel-url}")
    private String cancelUrl;

    public DeferredPaymentService(InterventionRepository interventionRepository,
                                   UserRepository userRepository,
                                   TenantContext tenantContext) {
        this.interventionRepository = interventionRepository;
        this.userRepository = userRepository;
        this.tenantContext = tenantContext;
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
     */
    public String createGroupedPaymentSession(Long hostId) throws StripeException {
        Stripe.apiKey = stripeSecretKey;

        User host = userRepository.findById(hostId)
                .orElseThrow(() -> new RuntimeException("Host non trouve: " + hostId));

        List<Intervention> unpaidInterventions = interventionRepository.findUnpaidByHostId(hostId, tenantContext.getRequiredOrganizationId());
        if (unpaidInterventions.isEmpty()) {
            throw new RuntimeException("Aucune intervention impayee pour ce host");
        }

        BigDecimal totalUnpaid = interventionRepository.sumUnpaidByHostId(hostId, tenantContext.getRequiredOrganizationId());
        long amountInCents = totalUnpaid.multiply(BigDecimal.valueOf(100)).longValue();

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
                                                                .setName("Clenzy - Interventions impayees")
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

        Session session = Session.create(params);

        // Marquer toutes les interventions comme PROCESSING et sauvegarder le session ID
        for (Intervention intervention : unpaidInterventions) {
            intervention.setPaymentStatus(PaymentStatus.PROCESSING);
            intervention.setStripeSessionId(session.getId());
            interventionRepository.save(intervention);
        }

        logger.info("Session Stripe groupee creee: sessionId={}, hostId={}, montant={} EUR, {} interventions",
                session.getId(), hostId, totalUnpaid, count);

        return session.getUrl();
    }
}
