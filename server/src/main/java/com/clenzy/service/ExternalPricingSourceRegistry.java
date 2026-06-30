package com.clenzy.service;

import com.clenzy.model.PricingProvider;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Registry des sources de données de marché / pricing externe (P2-11).
 *
 * <p>Auto-wiring de tous les beans {@link ExternalPricingService} (PriceLabs,
 * Beyond, Wheelhouse…), indexés par {@link PricingProvider}. Permet de
 * <b>switcher</b> d'une source à l'autre et de les utiliser <b>en concurrence</b>
 * (plusieurs sources interrogées côte à côte). Pattern repris de
 * {@code WhatsAppProviderResolver} / {@code SmartLockProviderRegistry}.</p>
 *
 * <p>Ajouter une source = un nouveau bean {@code @Service implements
 * ExternalPricingService} avec son {@code getProvider()} — zéro modification ici.</p>
 */
@Component
public class ExternalPricingSourceRegistry {

    private final Map<PricingProvider, ExternalPricingService> byProvider;

    public ExternalPricingSourceRegistry(List<ExternalPricingService> services) {
        this.byProvider = services.stream()
                .collect(Collectors.toMap(ExternalPricingService::getProvider, s -> s));
    }

    /** Source pour ce provider ; lève si non implémenté/enregistré. */
    public ExternalPricingService resolve(PricingProvider provider) {
        ExternalPricingService service = byProvider.get(provider);
        if (service == null) {
            throw new IllegalArgumentException("Aucune source de données de marché enregistrée pour " + provider);
        }
        return service;
    }

    /** Providers effectivement disponibles (beans présents). */
    public Set<PricingProvider> available() {
        return byProvider.keySet();
    }
}
