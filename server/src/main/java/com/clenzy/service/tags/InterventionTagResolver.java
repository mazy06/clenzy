package com.clenzy.service.tags;

import com.clenzy.model.Intervention;
import com.clenzy.repository.InterventionRepository;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

import static com.clenzy.service.tags.TagFormatting.DATE_FORMAT;
import static com.clenzy.service.tags.TagFormatting.formatDateTime;
import static com.clenzy.service.tags.TagFormatting.formatMoney;
import static com.clenzy.service.tags.TagFormatting.safeStr;

/**
 * Tags d'une intervention : intervention.*, property.*, client.*, technicien.*,
 * paiement.*, ligne.*, nf.*.
 */
@Component
public class InterventionTagResolver implements ReferenceTagResolver {

    private final InterventionRepository interventionRepository;
    private final EntityTagBuilders builders;

    public InterventionTagResolver(InterventionRepository interventionRepository,
                                   EntityTagBuilders builders) {
        this.interventionRepository = interventionRepository;
        this.builders = builders;
    }

    @Override
    public String referenceType() {
        return "intervention";
    }

    @Override
    public void resolve(Long interventionId, Map<String, Object> context) {
        if (interventionId == null) return;

        interventionRepository.findById(interventionId).ifPresent(intervention -> {
            context.put("intervention", builders.interventionTags(intervention));

            // Resoudre aussi property, client (requestor), assigned
            if (intervention.getProperty() != null) {
                context.put("property", builders.propertyTags(intervention.getProperty()));

                if (intervention.getProperty().getOwner() != null) {
                    context.put("client", builders.clientTags(intervention.getProperty().getOwner()));
                }
            }

            if (intervention.getRequestor() != null) {
                context.putIfAbsent("client", builders.clientTags(intervention.getRequestor()));
            }

            if (intervention.getAssignedUser() != null) {
                context.put("technicien", builders.clientTags(intervention.getAssignedUser()));
            } else {
                context.put("technicien", builders.emptyClientTags());
            }

            // Tags paiement
            context.put("paiement", paymentTags(intervention));

            // Tags ligne de facturation (top-level pour les templates FACTURE)
            context.put("ligne", ligneTags(intervention));

            // Numero de facture (tag nf.*)
            context.put("nf", nfTags(intervention));
        });
    }

    private Map<String, Object> paymentTags(Intervention intervention) {
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("statut", intervention.getPaymentStatus() != null ? intervention.getPaymentStatus().name() : "PENDING");
        tags.put("montant", formatMoney(intervention.getActualCost() != null
                ? intervention.getActualCost() : intervention.getEstimatedCost()));
        tags.put("date_paiement", formatDateTime(intervention.getPaidAt()));
        tags.put("reference_stripe", safeStr(intervention.getStripePaymentIntentId()));
        return tags;
    }

    /**
     * Tags ligne de facturation pour une intervention (top-level ${ligne.*}).
     * Utilise le cout reel ou estime comme montant.
     */
    private Map<String, Object> ligneTags(Intervention intervention) {
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("description", safeStr(intervention.getDescription()));
        tags.put("quantite", "1");
        BigDecimal cost = intervention.getActualCost() != null
                ? intervention.getActualCost() : intervention.getEstimatedCost();
        tags.put("prix_unitaire", formatMoney(cost));
        tags.put("total", formatMoney(cost));
        return tags;
    }

    /**
     * Tags numero de facture pour une intervention (top-level ${nf.*}).
     * Le vrai numero est attribue par DocumentNumberingService, ici on fournit des fallbacks.
     */
    private Map<String, Object> nfTags(Intervention intervention) {
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("numero", "");
        tags.put("date", LocalDateTime.now().format(DATE_FORMAT));
        return tags;
    }
}
