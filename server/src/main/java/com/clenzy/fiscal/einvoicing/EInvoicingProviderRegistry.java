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

/**
 * Registry des {@link EInvoicingProvider} par code (CLZ-P0-04), sur le modele de
 * {@code TaxCalculatorRegistry}. Resout le provider d'un pays via
 * {@code Country.einvoicingProvider}.
 *
 * <p><b>Fail-safe</b> (et non fail-fast) : un pays sans provider configure, ou referencant un
 * code dont l'implementation n'existe pas encore (ex. {@code factur_x}/{@code zatca} avant
 * leur livraison), retombe sur le {@link NoOpEInvoicingProvider} — le flux de facturation
 * n'est jamais casse. Le cas "code configure mais sans impl" est logge (warn) pour visibilite.</p>
 */
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

    /** Resout le provider d'un pays ; NoOp si pays null. */
    public EInvoicingProvider resolve(Country country) {
        return country == null ? noOp : resolveByCode(country.getEinvoicingProvider());
    }

    /** Resout par code provider ; NoOp si code vide ou sans implementation. */
    public EInvoicingProvider resolveByCode(String providerCode) {
        if (providerCode == null || providerCode.isBlank()) {
            return noOp;
        }
        EInvoicingProvider provider = byCode.get(providerCode.trim().toLowerCase(Locale.ROOT));
        if (provider == null) {
            log.warn("Aucun EInvoicingProvider pour le code '{}' — repli NoOp (provider a implementer)", providerCode);
            return noOp;
        }
        return provider;
    }
}
