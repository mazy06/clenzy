package com.clenzy.fiscal.einvoicing;

import com.clenzy.model.Country;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Résolution explicite : une configuration manquante reste en attente, jamais exemptée par défaut. */
@Component
public class EInvoicingProviderRegistry {

    private static final Logger log = LoggerFactory.getLogger(EInvoicingProviderRegistry.class);

    private final Map<String, EInvoicingProvider> byCode;
    private final NoOpEInvoicingProvider noOp;

    public EInvoicingProviderRegistry(List<EInvoicingProvider> providers, NoOpEInvoicingProvider noOp) {
        this.noOp = noOp;
        this.byCode = providers.stream()
                .collect(Collectors.toMap(p -> p.providerCode().toLowerCase(Locale.ROOT), Function.identity()));
        log.info("EInvoicingProviderRegistry: {} provider(s) enregistre(s): {}", byCode.size(), byCode.keySet());
    }

    /** Resout le provider d'un pays ; En attente si pays absent. */
    public EInvoicingProvider resolve(Country country) {
        return country == null ? new BaitlyUnconfiguredEInvoicing() : resolveByCode(country.getEinvoicingProvider());
    }

    /** Resout par code provider ; En attente si code vide ou sans implémentation. */
    public EInvoicingProvider resolveByCode(String providerCode) {
        if (providerCode == null || providerCode.isBlank()) {
            return new BaitlyUnconfiguredEInvoicing();
        }
        EInvoicingProvider provider = byCode.get(providerCode.trim().toLowerCase(Locale.ROOT));
        if (provider == null) {
            log.warn("Aucun EInvoicingProvider pour le code '{}' — raccordement déclaratif non configuré", providerCode);
            return new BaitlyUnconfiguredEInvoicing();
        }
        return provider;
    }
}
