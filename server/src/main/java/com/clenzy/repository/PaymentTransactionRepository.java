package com.clenzy.repository;

import com.clenzy.model.PaymentProviderType;
import com.clenzy.model.PaymentTransaction;
import com.clenzy.model.TransactionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, Long> {

    Optional<PaymentTransaction> findByTransactionRef(String transactionRef);

    Optional<PaymentTransaction> findByIdempotencyKey(String idempotencyKey);

    /**
     * Transaction identifiée par sa référence chez le fournisseur.
     *
     * <p>Seule voie pour rattacher à une organisation un événement qui ne porte
     * que l'identifiant Stripe — litige, session expirée. L'organisation vient
     * ainsi de NOTRE base, jamais du message reçu.</p>
     */
    Optional<PaymentTransaction> findByProviderTxId(String providerTxId);

    /**
     * Passe la transaction en COMPLETED par UPDATE conditionnel (compare-and-set).
     *
     * <p>Audit 2026-07 (P6-05) : la transition etait un check-then-act — SELECT sans verrou,
     * test du statut, puis {@code save} inconditionnel. Sous READ COMMITTED, deux rejeux
     * concurrents du meme webhook lisaient tous deux PROCESSING et publiaient chacun un
     * evenement PAYMENT_COMPLETED dans l'outbox. Avec le CAS, un seul appel modifie une
     * ligne ; les autres obtiennent 0 et n'ont rien a publier.</p>
     *
     * @return 1 si la transition a eu lieu, 0 si la transaction etait deja COMPLETED
     *         ou n'existe pas
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE PaymentTransaction t SET t.status = com.clenzy.model.TransactionStatus.COMPLETED "
         + "WHERE t.transactionRef = :transactionRef "
         + "AND t.status <> com.clenzy.model.TransactionStatus.COMPLETED")
    int markCompleted(@Param("transactionRef") String transactionRef);

    /**
     * Passe la transaction en FAILED par UPDATE conditionnel, <b>sans jamais degrader</b>
     * une transaction deja COMPLETED.
     *
     * <p>Audit 2026-07 (P6-12) : {@code failTransaction} n'avait aucune garde d'etat. Le rejeu
     * d'un webhook d'echec signe, apres un succes, faisait repasser en FAILED une transaction
     * encaissee et publiait PAYMENT_FAILED — desynchronisant le ledger de l'entite metier
     * restee PAID, avec relances de recouvrement a la cle.</p>
     *
     * @return 1 si la transition a eu lieu, 0 si la transaction etait COMPLETED (transition
     *         refusee), deja FAILED, ou inexistante
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE PaymentTransaction t SET t.status = com.clenzy.model.TransactionStatus.FAILED, "
         + "t.errorMessage = :errorMessage "
         + "WHERE t.transactionRef = :transactionRef "
         + "AND t.status <> com.clenzy.model.TransactionStatus.COMPLETED "
         + "AND t.status <> com.clenzy.model.TransactionStatus.FAILED")
    int markFailed(@Param("transactionRef") String transactionRef,
                   @Param("errorMessage") String errorMessage);

    List<PaymentTransaction> findByOrganizationIdAndSourceTypeAndSourceId(
        Long organizationId, String sourceType, Long sourceId);

    Page<PaymentTransaction> findByOrganizationId(Long organizationId, Pageable pageable);

    Page<PaymentTransaction> findByOrganizationIdAndStatus(
        Long organizationId, TransactionStatus status, Pageable pageable);

    Page<PaymentTransaction> findByOrganizationIdAndProviderType(
        Long organizationId, PaymentProviderType providerType, Pageable pageable);

    List<PaymentTransaction> findByOrganizationIdAndStatus(
        Long organizationId, TransactionStatus status);
}
