package com.clenzy.service.tags;

import com.clenzy.model.ProviderExpense;
import com.clenzy.repository.ProviderExpenseRepository;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

import static com.clenzy.service.tags.TagFormatting.DATE_FORMAT;
import static com.clenzy.service.tags.TagFormatting.formatMoney;
import static com.clenzy.service.tags.TagFormatting.safeStr;

/**
 * Tags d'une depense prestataire : depense.*, prestataire.*, property.*, client.*.
 */
@Component
public class ProviderExpenseTagResolver implements ReferenceTagResolver {

    private final ProviderExpenseRepository providerExpenseRepository;
    private final EntityTagBuilders builders;

    public ProviderExpenseTagResolver(ProviderExpenseRepository providerExpenseRepository,
                                      EntityTagBuilders builders) {
        this.providerExpenseRepository = providerExpenseRepository;
        this.builders = builders;
    }

    @Override
    public String referenceType() {
        return "provider_expense";
    }

    @Override
    public void resolve(Long expenseId, Map<String, Object> context) {
        if (expenseId == null) return;

        providerExpenseRepository.findById(expenseId).ifPresent(expense -> {
            context.put("depense", expenseTags(expense));

            // Prestataire
            if (expense.getProvider() != null) {
                context.put("prestataire", builders.clientTags(expense.getProvider()));
            }

            // Logement
            if (expense.getProperty() != null) {
                context.put("property", builders.propertyTags(expense.getProperty()));

                // Proprietaire du logement
                if (expense.getProperty().getOwner() != null) {
                    context.put("client", builders.clientTags(expense.getProperty().getOwner()));
                }
            }
        });
    }

    private Map<String, Object> expenseTags(ProviderExpense expense) {
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("id", String.valueOf(expense.getId()));
        tags.put("description", safeStr(expense.getDescription()));
        tags.put("montant_ht", formatMoney(expense.getAmountHt()));
        tags.put("taux_tva", expense.getTaxRate() != null
                ? expense.getTaxRate().multiply(java.math.BigDecimal.valueOf(100)).stripTrailingZeros().toPlainString() + " %"
                : "0 %");
        tags.put("montant_tva", formatMoney(expense.getTaxAmount()));
        tags.put("montant_ttc", formatMoney(expense.getAmountTtc()));
        tags.put("devise", safeStr(expense.getCurrency()));
        tags.put("categorie", expense.getCategory() != null ? expense.getCategory().getLabel() : "");
        tags.put("date", expense.getExpenseDate() != null
                ? expense.getExpenseDate().format(DATE_FORMAT) : "");
        tags.put("statut", expense.getStatus() != null ? expense.getStatus().name() : "");
        tags.put("reference_facture", safeStr(expense.getInvoiceReference()));
        tags.put("notes", safeStr(expense.getNotes()));
        tags.put("reference_paiement", safeStr(expense.getPaymentReference()));
        return tags;
    }
}
