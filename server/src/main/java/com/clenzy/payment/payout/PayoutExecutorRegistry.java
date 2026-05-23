package com.clenzy.payment.payout;

import com.clenzy.model.PayoutMethod;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Registry pour découverte automatique des {@link PayoutExecutor}.
 *
 * <p>Mêmes principes que le {@code PaymentProviderRegistry} : Spring injecte
 * la liste de tous les beans {@code PayoutExecutor} découverts, on construit
 * une map indexée par {@link PayoutMethod}. L'ajout d'un nouveau provider
 * payout (ex: Mangopay, Lemonway) = créer un bean qui implémente l'interface,
 * sans toucher ce registry.</p>
 */
@Component
public class PayoutExecutorRegistry {

    private final Map<PayoutMethod, PayoutExecutor> executorsByMethod;

    public PayoutExecutorRegistry(List<PayoutExecutor> executors) {
        Map<PayoutMethod, PayoutExecutor> map = new HashMap<>();
        for (PayoutExecutor executor : executors) {
            PayoutMethod method = executor.getSupportedMethod();
            if (map.containsKey(method)) {
                throw new IllegalStateException(
                    "Multiple PayoutExecutor beans for method " + method
                  + " : " + map.get(method).getClass().getName()
                  + " and " + executor.getClass().getName());
            }
            map.put(method, executor);
        }
        this.executorsByMethod = Map.copyOf(map);
    }

    /**
     * @return l'exécuteur pour la méthode demandée
     * @throws PayoutExecutor.PayoutExecutionException si aucun exécuteur enregistré
     */
    public PayoutExecutor get(PayoutMethod method) {
        PayoutExecutor executor = executorsByMethod.get(method);
        if (executor == null) {
            throw new PayoutExecutor.PayoutExecutionException(
                "Aucun exécuteur de payout enregistré pour la méthode " + method);
        }
        return executor;
    }

    /** Liste des méthodes supportées (pour endpoints d'introspection). */
    public java.util.Set<PayoutMethod> getSupportedMethods() {
        return executorsByMethod.keySet();
    }
}
