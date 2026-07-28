package com.clenzy.service;

import com.clenzy.exception.NotFoundException;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.RequestStatus;
import com.clenzy.model.ServiceRequest;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

/**
 * Accès transactionnel aux demandes de service dans le flux de paiement — extrait de
 * {@link ServiceRequestPaymentService} (audit d'isolation RLS, plan REM-T-01).
 *
 * <h2>Pourquoi ce bean séparé</h2>
 * <p>{@link ServiceRequestPaymentService} ne peut pas être {@code @Transactional} : il
 * appelle un provider de paiement en HTTP, et une transaction DB ne doit jamais rester
 * ouverte pendant un appel externe (règle CLAUDE.md n°2). Ses accès base passaient donc
 * soit par un repository appelé directement, soit par un {@code TransactionTemplate} —
 * deux formes qui ouvrent leur transaction <b>hors</b> du pointcut de
 * {@link com.clenzy.tenant.RlsTenantGucAspect}
 * ({@code @Transactional && within(com.clenzy..*)}, l'AOP ne voyant pas une transaction
 * ouverte programmatiquement). Aucune GUC {@code app.current_org} n'était posée : sous
 * Row-Level Security active, ces requêtes renverraient zéro ligne <b>sans lever
 * d'erreur</b> — trois chemins remontés par l'inventaire {@code rls_audit_findings}.</p>
 *
 * <p>Chaque méthode publique porte sa propre {@link Transactional} et est appelée depuis un
 * <b>autre</b> bean : elle passe donc par le proxy Spring, l'aspect pose la GUC, et la
 * frontière transactionnelle reste courte — l'appel provider s'intercale entre deux
 * méthodes, jamais dedans. Même pattern que {@link PaymentPersistence}.</p>
 */
@Service
public class ServiceRequestPaymentPersistence {

    /** Champs nécessaires à l'initiation, lisibles une fois la transaction refermée. */
    public record PayableServiceRequest(Long id, Long organizationId, String title, BigDecimal amount) {}

    /** État de paiement nécessaire au filet de secours, lisible hors transaction. */
    public record ServiceRequestPaymentState(PaymentStatus paymentStatus, String stripeSessionId) {}

    private final ServiceRequestRepository serviceRequestRepository;
    private final OrganizationAccessGuard organizationAccessGuard;

    public ServiceRequestPaymentPersistence(ServiceRequestRepository serviceRequestRepository,
                                            OrganizationAccessGuard organizationAccessGuard) {
        this.serviceRequestRepository = serviceRequestRepository;
        this.organizationAccessGuard = organizationAccessGuard;
    }

    /**
     * Charge une demande payable et valide qu'elle l'est réellement.
     *
     * @throws NotFoundException        si la demande n'existe pas
     * @throws IllegalStateException    si elle n'est pas en {@link RequestStatus#AWAITING_PAYMENT}
     * @throws IllegalArgumentException si le montant serveur est absent ou non strictement positif
     */
    @Transactional(readOnly = true)
    public PayableServiceRequest loadPayable(Long serviceRequestId) {
        ServiceRequest sr = require(serviceRequestId);
        if (sr.getStatus() != RequestStatus.AWAITING_PAYMENT) {
            throw new IllegalStateException(
                "La demande de service doit etre en statut AWAITING_PAYMENT pour proceder au paiement. "
                + "Statut actuel: " + sr.getStatus());
        }
        // Z3-SEC-01 : montant TOUJOURS serveur (estimatedCost de l'entité).
        BigDecimal amount = sr.getEstimatedCost();
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Montant invalide pour la demande de service: " + amount);
        }
        return new PayableServiceRequest(sr.getId(), sr.getOrganizationId(), sr.getTitle(), amount);
    }

    /** État de paiement courant, pour le filet de secours qui interroge le provider. */
    @Transactional(readOnly = true)
    public ServiceRequestPaymentState loadPaymentState(Long serviceRequestId) {
        ServiceRequest sr = require(serviceRequestId);
        return new ServiceRequestPaymentState(sr.getPaymentStatus(), sr.getStripeSessionId());
    }

    /**
     * Marque la demande PROCESSING et mémorise la référence de session du provider.
     *
     * <p>Échoue explicitement si la demande est introuvable. À ce stade la session existe
     * déjà chez le provider : perdre sa référence en silence — ce que faisait le
     * {@code if (fresh != null)} d'origine — laisserait la demande en AWAITING_PAYMENT sans
     * corrélation, rendant le filet de secours inopérant, et sans la moindre trace
     * (règle CLAUDE.md n°7).</p>
     */
    @Transactional
    public void markProcessing(Long serviceRequestId, String providerTxId) {
        ServiceRequest sr = require(serviceRequestId);
        sr.setStripeSessionId(providerTxId);
        sr.setPaymentStatus(PaymentStatus.PROCESSING);
        serviceRequestRepository.save(sr);
    }

    /**
     * Charge la demande et refuse l'accès cross-organisation.
     *
     * <p>{@code findById} contourne le filtre Hibernate (audit 2026-07 F1-08) : cette garde
     * fail-closed reste le rempart d'isolation tant que la RLS n'est pas activée.</p>
     */
    private ServiceRequest require(Long serviceRequestId) {
        ServiceRequest sr = serviceRequestRepository.findById(serviceRequestId)
            .orElseThrow(() -> new NotFoundException("Demande de service non trouvee: " + serviceRequestId));
        organizationAccessGuard.requireSameOrganization(
            sr.getOrganizationId(), "Demande hors de votre organisation");
        return sr;
    }
}
