package com.clenzy.service.tags;

import com.clenzy.repository.ManagementContractRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.UserRepository;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

import static com.clenzy.service.tags.TagFormatting.DATE_FORMAT;
import static com.clenzy.service.tags.TagFormatting.formatDateTime;
import static com.clenzy.service.tags.TagFormatting.safeStr;

/**
 * Tags d'un contrat de gestion (MANDAT_GESTION). Renseigne les groupes :
 *  - contrat.* / mandat.*  (numero, type, dates, taux, options, statut)
 *  - bien.* / property.*  (rempli en plus via propertyTags si dispo)
 *  - proprietaire.* / client.*  (rempli en plus via clientTags si dispo)
 *  - commission.*  (taux + repartition propriétaire / plateforme / conciergerie)
 */
@Component
public class ManagementContractTagResolver implements ReferenceTagResolver {

    private final ManagementContractRepository managementContractRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final EntityTagBuilders builders;

    public ManagementContractTagResolver(ManagementContractRepository managementContractRepository,
                                         PropertyRepository propertyRepository,
                                         UserRepository userRepository,
                                         EntityTagBuilders builders) {
        this.managementContractRepository = managementContractRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.builders = builders;
    }

    @Override
    public String referenceType() {
        return "management_contract";
    }

    @Override
    public void resolve(Long contractId, Map<String, Object> context) {
        if (contractId == null) return;

        managementContractRepository.findById(contractId).ifPresent(contract -> {
            // ── Tags contrat.* ──
            Map<String, Object> c = new LinkedHashMap<>();
            c.put("id", String.valueOf(contract.getId()));
            c.put("numero", safeStr(contract.getContractNumber()));
            c.put("type", contract.getContractType() != null ? contract.getContractType().name() : "");
            c.put("type_label", contract.getContractType() != null ? contractTypeLabel(contract.getContractType().name()) : "");
            c.put("statut", contract.getStatus() != null ? contract.getStatus().name() : "");
            c.put("date_debut", contract.getStartDate() != null ? contract.getStartDate().format(DATE_FORMAT) : "");
            c.put("date_fin", contract.getEndDate() != null ? contract.getEndDate().format(DATE_FORMAT) : "Indéterminée");
            double taux = contract.getCommissionRate() != null ? contract.getCommissionRate().doubleValue() * 100 : 0;
            c.put("taux_commission", String.format(Locale.FRANCE, "%.2f %%", taux));
            c.put("nuits_minimum", contract.getMinimumStayNights() != null ? contract.getMinimumStayNights().toString() : "Aucun");
            c.put("preavis_jours", contract.getNoticePeriodDays() != null ? contract.getNoticePeriodDays() + " jours" : "30 jours");
            c.put("renouvellement_auto", Boolean.TRUE.equals(contract.getAutoRenew()) ? "Oui" : "Non");
            c.put("menage_inclus", Boolean.TRUE.equals(contract.getCleaningFeeIncluded()) ? "Oui" : "Non");
            c.put("maintenance_incluse", Boolean.TRUE.equals(contract.getMaintenanceIncluded()) ? "Oui" : "Non");
            c.put("notes", safeStr(contract.getNotes()));
            c.put("date_signature", contract.getSignedAt() != null ? formatDateTime(LocalDateTime.ofInstant(contract.getSignedAt(), java.time.ZoneId.systemDefault())) : "");
            context.put("contrat", c);
            // Alias FR/EN pour les templates qui utiliseraient un autre nom
            context.put("mandat", c);

            // ── Tags commission.* (repartition complete) ──
            double commissionPct = taux;
            double ownerPct = 100 - commissionPct;
            double platformPct = commissionPct * 0.25; // 25% de la commission par défaut
            double conciergePct = commissionPct * 0.75; // 75% de la commission par défaut
            Map<String, Object> com = new LinkedHashMap<>();
            com.put("taux", String.format(Locale.FRANCE, "%.2f %%", commissionPct));
            com.put("part_proprietaire", String.format(Locale.FRANCE, "%.2f %%", ownerPct));
            com.put("part_plateforme", String.format(Locale.FRANCE, "%.2f %%", platformPct));
            com.put("part_conciergerie", String.format(Locale.FRANCE, "%.2f %%", conciergePct));
            context.put("commission", com);

            // ── Tags bien.* / property.* (depuis Property) ──
            if (contract.getPropertyId() != null) {
                propertyRepository.findById(contract.getPropertyId()).ifPresent(property -> {
                    context.put("property", builders.propertyTags(property));
                    context.put("bien", builders.propertyTags(property));
                });
            }

            // ── Tags proprietaire.* / client.* (depuis User) ──
            if (contract.getOwnerId() != null) {
                userRepository.findById(contract.getOwnerId()).ifPresent(owner -> {
                    Map<String, Object> ownerTags = builders.clientTags(owner);
                    context.put("client", ownerTags);
                    context.put("proprietaire", ownerTags);
                });
            }
        });
    }

    private String contractTypeLabel(String type) {
        return switch (type) {
            case "FULL_MANAGEMENT" -> "Gestion complète";
            case "BOOKING_ONLY" -> "Réservations uniquement";
            case "MAINTENANCE_ONLY" -> "Maintenance uniquement";
            case "CUSTOM" -> "Personnalisé";
            default -> type;
        };
    }
}
