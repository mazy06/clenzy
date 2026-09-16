package com.clenzy.service;

import com.clenzy.model.OutboxEvent;
import com.clenzy.repository.OutboxEventRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;

/** Frontière transactionnelle réelle ; stockage JDBC réduit à la place du mapping JPA. */
class DocumentGenerationOutboxTest {
    JdbcTemplate jdbc;
    TransactionTemplate transaction;
    DocumentGenerationOutbox service;
    boolean failOnReceipt;

    @BeforeEach
    void setup() {
        var source = new DriverManagerDataSource("jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1", "sa", "");
        jdbc = new JdbcTemplate(source);
        jdbc.execute("CREATE TABLE pending_documents (payload varchar(4000))");
        var manager = new DataSourceTransactionManager(source);
        transaction = new TransactionTemplate(manager);
        var repository = mock(OutboxEventRepository.class);
        when(repository.save(any())).thenAnswer(invocation -> {
            OutboxEvent event = invocation.getArgument(0);
            if (failOnReceipt && event.getPayload().contains("JUSTIFICATIF_PAIEMENT")) {
                throw new IllegalStateException("receipt storage failed");
            }
            jdbc.update("INSERT INTO pending_documents VALUES (?)", event.getPayload());
            return event;
        });
        var proxy = new ProxyFactory(new DocumentGenerationOutbox(new OutboxPublisher(repository), new ObjectMapper()));
        proxy.addAdvice(new TransactionInterceptor(manager, new AnnotationTransactionAttributeSource()));
        service = (DocumentGenerationOutbox) proxy.getProxy();
    }

    @Test
    void rollbackRemovesInvoiceIntent() {
        assertThatThrownBy(() -> transaction.executeWithoutResult(status -> {
            service.requestInvoice(12L, 3L, "host@example.com");
            throw new IllegalStateException("business rollback");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM pending_documents", Integer.class)).isZero();
    }

    @Test
    void paymentDocumentsCommitTogetherForEachSupportedReference() throws Exception {
        for (String reference : java.util.List.of("reservation", "intervention")) {
            transaction.executeWithoutResult(status -> service.requestPaymentDocuments(12L, 3L, reference, null));
        }
        var payloads = jdbc.queryForList("SELECT payload FROM pending_documents", String.class);
        assertThat(payloads).hasSize(4);
        for (String reference : java.util.List.of("reservation", "intervention")) {
            var types = new java.util.HashSet<String>();
            for (String raw : payloads) {
                var payload = new ObjectMapper().readTree(raw);
                if (reference.equals(payload.path("referenceType").asText())) {
                    types.add(payload.path("documentType").asText());
                    assertThat(payload.path("organizationId").asLong()).isEqualTo(3L);
                }
            }
            assertThat(types).containsExactlyInAnyOrder("FACTURE", "JUSTIFICATIF_PAIEMENT");
        }
    }

    @Test
    void secondDocumentFailureRollsBackInvoiceEvenWhenCallerCatchesError() {
        failOnReceipt = true;
        assertThatThrownBy(() -> transaction.executeWithoutResult(status -> {
            try {
                service.requestPaymentDocuments(12L, 3L, "intervention", null);
            } catch (IllegalStateException ignored) {
                // Reproduit le traitement groupé : le proxy a déjà marqué la transaction rollback-only.
            }
        })).isInstanceOf(org.springframework.transaction.UnexpectedRollbackException.class);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM pending_documents", Integer.class)).isZero();
    }

    @Test
    void commitPersistsInvoiceContractWithOrganization() throws Exception {
        transaction.executeWithoutResult(status -> service.requestInvoice(12L, 3L, null));
        var payload = new ObjectMapper().readTree(jdbc.queryForObject("SELECT payload FROM pending_documents", String.class));
        assertThat(payload.path("documentType").asText()).isEqualTo("FACTURE");
        assertThat(payload.path("referenceId").asLong()).isEqualTo(12L);
        assertThat(payload.path("organizationId").asLong()).isEqualTo(3L);
        assertThat(payload.path("emailTo").asText()).isEmpty();
    }

    @Test
    void standalonePublicationIsRejected() {
        assertThatThrownBy(() -> service.requestInvoice(12L, 3L, null))
                .isInstanceOf(IllegalTransactionStateException.class);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM pending_documents", Integer.class)).isZero();
    }

    @Test
    void refundReceiptUsesInterventionReferenceAndRollsBackWithTransaction() throws Exception {
        transaction.executeWithoutResult(status -> {
            service.requestRefundReceipt(42L, 7L, "owner@example.com");
            status.setRollbackOnly();
        });
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM pending_documents", Integer.class)).isZero();
        transaction.executeWithoutResult(status -> service.requestRefundReceipt(42L, 7L, "owner@example.com"));
        var payload = new ObjectMapper().readTree(jdbc.queryForObject("SELECT payload FROM pending_documents", String.class));
        assertThat(payload.path("documentType").asText()).isEqualTo("JUSTIFICATIF_REMBOURSEMENT");
        assertThat(payload.path("referenceType").asText()).isEqualTo("intervention");
        assertThat(payload.path("referenceId").asLong()).isEqualTo(42L);
        assertThat(payload.path("organizationId").asLong()).isEqualTo(7L);
    }
}
