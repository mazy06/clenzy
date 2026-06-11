package com.clenzy.service;

import com.clenzy.model.PaymentTransaction;
import com.clenzy.model.TransactionStatus;
import com.clenzy.model.TransactionType;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Acces et transitions des {@link PaymentTransaction} pour la couche
 * presentation (refactor T-ARCH-01 : plus aucun repository dans les
 * controllers de paiement).
 *
 * <h2>Deux familles de lookups</h2>
 * <ul>
 *   <li>{@link #findByTransactionRef(String)} :
 *       SANS validation d'organisation — reserve aux flux publics
 *       (webhooks providers, redirect CMI) ou il n'y a pas de
 *       JWT donc pas de TenantContext ; l'authentification y est faite par la
 *       verification de signature cryptographique du provider, et la
 *       transaction resolue porte elle-meme son organizationId (utilise pour
 *       charger les credentials de la bonne org).</li>
 *   <li>{@link #findByTransactionRefInCurrentOrg(String)} : pour les flux
 *       utilisateur authentifies — la transaction d'une autre organisation
 *       est filtree (introuvable), car {@code findByTransactionRef} ne passe
 *       pas par le filtre Hibernate organizationFilter.</li>
 * </ul>
 */
@Service
public class PaymentTransactionService {

    private final PaymentTransactionRepository paymentTransactionRepository;
    private final TenantContext tenantContext;

    public PaymentTransactionService(PaymentTransactionRepository paymentTransactionRepository,
                                     TenantContext tenantContext) {
        this.paymentTransactionRepository = paymentTransactionRepository;
        this.tenantContext = tenantContext;
    }

    /**
     * Lookup brut par transactionRef — flux publics signes uniquement
     * (webhooks, redirect CMI). Voir javadoc de classe.
     */
    @Transactional(readOnly = true)
    public Optional<PaymentTransaction> findByTransactionRef(String transactionRef) {
        return paymentTransactionRepository.findByTransactionRef(transactionRef);
    }

    /**
     * Lookup par transactionRef restreint a l'organisation du requester :
     * une transaction d'une autre org est traitee comme introuvable.
     */
    @Transactional(readOnly = true)
    public Optional<PaymentTransaction> findByTransactionRefInCurrentOrg(String transactionRef) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return paymentTransactionRepository.findByTransactionRef(transactionRef)
            .filter(t -> t.getOrganizationId().equals(orgId));
    }

    /**
     * Transaction CHECKOUT/COMPLETED la plus recente pour une source donnee —
     * la transaction "originale" a rembourser dans le flux provider-agnostique.
     */
    @Transactional(readOnly = true)
    public Optional<PaymentTransaction> findCompletedCheckout(Long organizationId, String sourceType, Long sourceId) {
        return paymentTransactionRepository
            .findByOrganizationIdAndSourceTypeAndSourceId(organizationId, sourceType, sourceId)
            .stream()
            .filter(t -> t.getPaymentType() == TransactionType.CHECKOUT
                      && t.getStatus() == TransactionStatus.COMPLETED)
            .findFirst();
    }
}
