package com.clenzy.service;

import com.clenzy.config.KafkaConfig;
import com.clenzy.service.document.DocumentReferenceOrgResolver;
import com.clenzy.tenant.KafkaTenantScope;
import com.clenzy.model.DocumentType;
import com.clenzy.model.ReferenceType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Service d'ecoute des evenements Kafka pour la generation automatique de documents.
 * <p>
 * Ecoute le topic documents.generate et declenche la generation via DocumentGeneratorService.
 * <p>
 * Format du message Kafka attendu :
 * {
 *   "documentType": "BON_INTERVENTION",
 *   "referenceId": 42,
 *   "referenceType": "INTERVENTION",
 *   "emailTo": "client@example.com"
 * }
 */
@Service
public class DocumentEventService {

    private static final Logger log = LoggerFactory.getLogger(DocumentEventService.class);

    private final DocumentGeneratorService generatorService;
    private final DocumentReferenceOrgResolver referenceOrgResolver;
    private final KafkaTenantScope kafkaTenantScope;

    public DocumentEventService(DocumentGeneratorService generatorService,
                                DocumentReferenceOrgResolver referenceOrgResolver,
                                KafkaTenantScope kafkaTenantScope) {
        this.generatorService = generatorService;
        this.referenceOrgResolver = referenceOrgResolver;
        this.kafkaTenantScope = kafkaTenantScope;
    }

    @KafkaListener(
            topics = KafkaConfig.TOPIC_DOCUMENT_GENERATE,
            groupId = "clenzy-document-generator",
            containerFactory = "kafkaListenerContainerFactory"
    )
    public void handleDocumentGenerationEvent(Map<String, Object> event) {
        try {
            String documentTypeStr = castToString(event.get("documentType"));
            Object referenceIdObj = event.get("referenceId");
            String referenceTypeStr = castToString(event.get("referenceType"));
            String emailTo = castToString(event.get("emailTo"));
            Object organizationIdObj = event.get("organizationId");

            if (documentTypeStr == null || referenceIdObj == null) {
                log.warn("Invalid document generation event: missing documentType or referenceId. Event: {}", event);
                return;
            }

            DocumentType documentType = DocumentType.valueOf(documentTypeStr.toUpperCase());
            Long referenceId = referenceIdObj instanceof Number
                    ? ((Number) referenceIdObj).longValue()
                    : Long.parseLong(referenceIdObj.toString());

            Long payloadOrganizationId = null;
            if (organizationIdObj instanceof Number n) {
                payloadOrganizationId = n.longValue();
            } else if (organizationIdObj != null) {
                payloadOrganizationId = Long.parseLong(organizationIdObj.toString());
            }

            ReferenceType referenceType = parseReferenceType(referenceTypeStr);

            // Audit 2026-07 (P1-03) : l'organisation est RE-DERIVEE de l'entite referencee,
            // jamais lue dans le payload. Sans cela, un evenement forge faisait generer le
            // document d'un autre tenant et l'expediait a l'adresse de son choix — le broker
            // etant en PLAINTEXT sans ACL. La politique (refus si introuvable, refus si le
            // payload contredit, pose du contexte tenant) est portee par KafkaTenantScope.
            final Long organizationId =
                    referenceOrgResolver.resolve(referenceType, referenceId).orElse(null);

            log.info("Processing document generation event: type={}, ref={}#{}, emailTo={}, orgId={}",
                    documentType, referenceType, referenceId,
                    com.clenzy.util.PiiMasker.maskEmail(emailTo), organizationId);

            kafkaTenantScope.run(KafkaConfig.TOPIC_DOCUMENT_GENERATE, organizationId,
                    payloadOrganizationId,
                    () -> generatorService.generateFromEvent(
                            documentType, referenceId, referenceType, emailTo, organizationId));

        } catch (ClassCastException e) {
            log.error("Invalid field type in document generation event: {}", event, e);
        } catch (IllegalArgumentException e) {
            log.error("Invalid document type in event: {}", event, e);
        } catch (Exception e) {
            log.error("Failed to process document generation event: {}", event, e);
            throw e;
        }
    }

    private String castToString(Object value) {
        if (value == null) return null;
        if (value instanceof String s) return s;
        return value.toString();
    }

    private ReferenceType parseReferenceType(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return ReferenceType.valueOf(value.toUpperCase());
        } catch (IllegalArgumentException e) {
            log.warn("Unknown reference type '{}', defaulting to null", value);
            return null;
        }
    }
}
