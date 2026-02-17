package com.clenzy.service;

import com.clenzy.config.KafkaConfig;
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

    public DocumentEventService(DocumentGeneratorService generatorService) {
        this.generatorService = generatorService;
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

            if (documentTypeStr == null || referenceIdObj == null) {
                log.warn("Invalid document generation event: missing documentType or referenceId. Event: {}", event);
                return;
            }

            DocumentType documentType = DocumentType.valueOf(documentTypeStr.toUpperCase());
            Long referenceId = referenceIdObj instanceof Number
                    ? ((Number) referenceIdObj).longValue()
                    : Long.parseLong(referenceIdObj.toString());

            ReferenceType referenceType = parseReferenceType(referenceTypeStr);

            log.info("Processing document generation event: type={}, ref={}#{}, emailTo={}",
                    documentType, referenceType, referenceId, emailTo);

            generatorService.generateFromEvent(documentType, referenceId, referenceType, emailTo);

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
