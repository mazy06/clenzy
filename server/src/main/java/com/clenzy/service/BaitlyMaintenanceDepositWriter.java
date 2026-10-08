package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import static com.clenzy.service.InterventionPaymentBatch.require;

/** Encaissement et affectation atomiques au devis, sans appel réseau. */
@Service
public class BaitlyMaintenanceDepositWriter {
    private final PaymentTransactionRepository payments;
    private final InterventionPaymentCoordination coordination;
    private final InterventionRepository missions;
    private final PaymentPersistence persistence;
    private final StripePaymentConfirmationService confirmation;
    public BaitlyMaintenanceDepositWriter(PaymentTransactionRepository payments,InterventionPaymentCoordination coordination,
            InterventionRepository missions,PaymentPersistence persistence,StripePaymentConfirmationService confirmation) {
        this.payments=payments;this.coordination=coordination;this.missions=missions;this.persistence=persistence;this.confirmation=confirmation;
    }
    @Transactional
    public void confirm(String ref,String session) {
        var tx=lock(ref,session);var mission=coordination.lockMission(tx.getOrganizationId(),tx.getSourceId());
        require(mission.getEstimatedCost()!=null && mission.getEstimatedCost().compareTo(tx.getAmount())>=0,"Acompte supérieur au prix de la mission");
        require(!tx.hasDisputeRisk(),"Acompte sous litige à rapprocher");
        persistence.completeTransaction(ref);
        // Un acompte à 100 % constitue un règlement intégral, sans réclamer une seconde session à zéro.
        if(mission.getEstimatedCost().compareTo(tx.getAmount())==0) {
            require(mission.getStripeSessionId()==null || session.equals(mission.getStripeSessionId()),"Autre règlement de mission à rapprocher");
            mission.setStripeSessionId(session);missions.saveAndFlush(mission);confirmation.confirmPayment(session);
        }
    }
    @Transactional
    public void expire(String ref,String session) {
        var tx=lock(ref,session);
        require(tx.getStatus()!=TransactionStatus.COMPLETED,"Cet acompte est déjà encaissé");
        var metadata=new HashMap<>(tx.getMetadata()==null?Map.<String,Object>of():tx.getMetadata());
        metadata.put("standaloneRetryAllowed",true);metadata.put("expiredSessionId",session);
        tx.setMetadata(metadata);tx.setStatus(TransactionStatus.FAILED);tx.setErrorMessage("Session d'acompte expirée sans encaissement");payments.save(tx);
    }
    private PaymentTransaction lock(String ref,String session) {
        var found=payments.findByTransactionRef(ref).orElseThrow();
        var tx=payments.lockByReference(found.getOrganizationId(),ref).orElseThrow();
        require(BaitlyMaintenanceDepositCheckout.handles(tx) && Objects.equals(session,tx.getProviderTxId())
                && tx.getProviderType()==PaymentProviderType.STRIPE && tx.getPaymentType()==TransactionType.CHECKOUT,"Acompte incompatible");
        return tx;
    }
}
