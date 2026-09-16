package com.clenzy.service;

import com.clenzy.config.KafkaConfig;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.util.Map;

/** Enregistre la génération documentaire dans la transaction métier Baitly. */
@Service
public class DocumentGenerationOutbox {
    private final OutboxPublisher publisher;
    private final ObjectMapper mapper;

    public DocumentGenerationOutbox(OutboxPublisher publisher, ObjectMapper mapper) {
        this.publisher = publisher;
        this.mapper = mapper;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void requestRefundReceipt(Long interventionId, Long organizationId, String email) {
        publish(interventionId, organizationId, email, "JUSTIFICATIF_REMBOURSEMENT",
                "intervention", "INTERVENTION", "INTERVENTION_REFUND_RECEIPT_REQUESTED", "justif-remboursement-int-");
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void requestInvoice(Long requestId, Long organizationId, String email) {
        publish(requestId, organizationId, email, "FACTURE", "service_request", "SERVICE_REQUEST",
                "SERVICE_REQUEST_INVOICE_REQUESTED", "facture-sr-");
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void requestPaymentDocuments(Long referenceId, Long organizationId, String referenceType, String email) {
        if (!"intervention".equals(referenceType) && !"reservation".equals(referenceType)) {
            throw new IllegalArgumentException("Référence de paiement non prise en charge");
        }
        String aggregate = referenceType.toUpperCase(java.util.Locale.ROOT);
        String suffix = "intervention".equals(referenceType) ? "int-" : "resa-";
        publish(referenceId, organizationId, email, "FACTURE", referenceType, aggregate,
                aggregate + "_INVOICE_REQUESTED", "facture-" + suffix);
        publish(referenceId, organizationId, email, "JUSTIFICATIF_PAIEMENT", referenceType, aggregate,
                aggregate + "_PAYMENT_RECEIPT_REQUESTED", "justif-paiement-" + suffix);
    }

    private void publish(Long requestId, Long organizationId, String email, String documentType,
                         String referenceType, String aggregateType, String eventType, String keyPrefix) {
        if (requestId == null || organizationId == null) {
            throw new IllegalArgumentException("Référence et organisation requises pour le document");
        }
        try {
            String payload = mapper.writeValueAsString(Map.of(
                    "documentType", documentType, "referenceId", requestId,
                    "referenceType", referenceType, "organizationId", organizationId,
                    "emailTo", email == null ? "" : email));
            publisher.publish(aggregateType, requestId.toString(), eventType,
                    KafkaConfig.TOPIC_DOCUMENT_GENERATE, keyPrefix + requestId, payload, organizationId);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Impossible de préparer la génération du document", e);
        }
    }
}
