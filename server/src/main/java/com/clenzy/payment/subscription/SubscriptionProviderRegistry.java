package com.clenzy.payment.subscription;

import com.clenzy.model.PaymentProviderType;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Registry des {@link SubscriptionProvider} (même patron que
 * {@code PaymentProviderRegistry}). Spring injecte tous les beans découverts ;
 * on indexe par {@link PaymentProviderType}.
 *
 * <p>Résolution : Stripe Billing est aujourd'hui le seul provider récurrent
 * (fallback). Quand PayZone récurrent (Maroc) arrivera, {@link #resolve(String)}
 * pourra trancher par devise — sans toucher les appelants.</p>
 */
@Component
public class SubscriptionProviderRegistry {

    private final Map<PaymentProviderType, SubscriptionProvider> byType;

    public SubscriptionProviderRegistry(List<SubscriptionProvider> providers) {
        Map<PaymentProviderType, SubscriptionProvider> map = new HashMap<>();
        for (SubscriptionProvider provider : providers) {
            if (map.containsKey(provider.getProviderType())) {
                throw new IllegalStateException(
                    "Multiple SubscriptionProvider beans for " + provider.getProviderType());
            }
            map.put(provider.getProviderType(), provider);
        }
        this.byType = Map.copyOf(map);
    }

    public SubscriptionProvider get(PaymentProviderType type) {
        SubscriptionProvider provider = byType.get(type);
        if (provider == null) {
            throw new IllegalStateException("Aucun SubscriptionProvider pour " + type);
        }
        return provider;
    }

    /**
     * Résout le provider d'abonnement pour une devise donnée. Fallback Stripe
     * (seul provider récurrent actuel).
     */
    public SubscriptionProvider resolve(String currency) {
        // Extension future : MAD → PayZone récurrent s'il est enregistré et capable.
        return get(PaymentProviderType.STRIPE);
    }
}
