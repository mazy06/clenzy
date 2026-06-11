package com.clenzy.service;

import com.clenzy.model.DocumentTemplate;
import com.clenzy.model.DocumentType;
import com.clenzy.model.ReferenceType;
import com.clenzy.repository.DocumentGenerationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("DocumentEmailDispatcher")
class DocumentEmailDispatcherTest {

    @Mock private EmailService emailService;
    @Mock private DocumentGenerationRepository generationRepository;

    private DocumentEmailDispatcher dispatcher;

    @BeforeEach
    void setUp() {
        dispatcher = new DocumentEmailDispatcher(emailService, generationRepository);
    }

    // ─── sendDocumentByEmail ────────────────────────────────────────────────

    @Nested
    @DisplayName("sendDocumentByEmail")
    class SendDocumentByEmail {

        @Test
        void whenDevis_thenSendsProspectEmailAndInternalCopy() {
            // Arrange
            DocumentTemplate template = new DocumentTemplate();
            template.setDocumentType(DocumentType.DEVIS);
            byte[] pdf = new byte[]{1, 2};

            // Act
            dispatcher.sendDocumentByEmail(template, "prospect@example.com", "devis.pdf", pdf,
                    "Objet custom", "Corps custom");

            // Assert
            verify(emailService).sendQuoteToProspect("prospect@example.com", pdf, "devis.pdf",
                    "Objet custom", "Corps custom");
            verify(emailService).sendQuoteInternalCopy("prospect@example.com", pdf, "devis.pdf");
            verifyNoMoreInteractions(emailService);
        }

        @Test
        void whenNonDevisWithTemplateSubjectAndBody_thenUsesTemplateContent() {
            // Arrange
            DocumentTemplate template = new DocumentTemplate();
            template.setDocumentType(DocumentType.FACTURE);
            template.setEmailSubject("Votre facture");
            template.setEmailBody("<p>Bonjour</p>");
            byte[] pdf = new byte[]{1};

            // Act
            dispatcher.sendDocumentByEmail(template, "client@example.com", "facture.pdf", pdf, null, null);

            // Assert
            verify(emailService).sendDocumentEmail("client@example.com", "Votre facture",
                    "<p>Bonjour</p>", "facture.pdf", pdf);
        }

        @Test
        void whenNonDevisWithoutTemplateContent_thenFallsBackToDefaults() {
            // Arrange
            DocumentTemplate template = new DocumentTemplate();
            template.setDocumentType(DocumentType.FACTURE);
            template.setEmailSubject("  ");
            template.setEmailBody(null);
            byte[] pdf = new byte[]{1};

            // Act
            dispatcher.sendDocumentByEmail(template, "client@example.com", "facture.pdf", pdf, null, null);

            // Assert
            ArgumentCaptor<String> subjectCaptor = ArgumentCaptor.forClass(String.class);
            ArgumentCaptor<String> bodyCaptor = ArgumentCaptor.forClass(String.class);
            verify(emailService).sendDocumentEmail(eq("client@example.com"),
                    subjectCaptor.capture(), bodyCaptor.capture(), eq("facture.pdf"), eq(pdf));
            assertThat(subjectCaptor.getValue())
                    .contains("Votre document Clenzy")
                    .contains(DocumentType.FACTURE.getLabel());
            assertThat(bodyCaptor.getValue()).contains(DocumentType.FACTURE.getLabel());
        }
    }

    // ─── isEmailAlreadySent ─────────────────────────────────────────────────

    @Nested
    @DisplayName("isEmailAlreadySent")
    class IsEmailAlreadySent {

        @Test
        void whenForceResend_thenFalseWithoutQueryingRepository() {
            // Act
            boolean result = dispatcher.isEmailAlreadySent(
                    true, ReferenceType.RECEIVED_FORM, 12L, DocumentType.DEVIS, "p@example.com");

            // Assert
            assertThat(result).isFalse();
            verify(generationRepository, never())
                    .existsSentEmailForReference(anyString(), anyString(), anyLong(), anyString());
        }

        @Test
        void whenReferenceTypeNull_thenFalseWithoutQueryingRepository() {
            // Act
            boolean result = dispatcher.isEmailAlreadySent(
                    false, null, 12L, DocumentType.DEVIS, "p@example.com");

            // Assert
            assertThat(result).isFalse();
            verify(generationRepository, never())
                    .existsSentEmailForReference(anyString(), anyString(), anyLong(), anyString());
        }

        @Test
        void whenAlreadySentForReference_thenTrue() {
            // Arrange
            when(generationRepository.existsSentEmailForReference(
                    "DEVIS", "RECEIVED_FORM", 12L, "p@example.com")).thenReturn(true);

            // Act
            boolean result = dispatcher.isEmailAlreadySent(
                    false, ReferenceType.RECEIVED_FORM, 12L, DocumentType.DEVIS, "p@example.com");

            // Assert
            assertThat(result).isTrue();
        }

        @Test
        void whenNotYetSent_thenFalse() {
            // Arrange
            when(generationRepository.existsSentEmailForReference(
                    "DEVIS", "RECEIVED_FORM", 12L, "p@example.com")).thenReturn(false);

            // Act
            boolean result = dispatcher.isEmailAlreadySent(
                    false, ReferenceType.RECEIVED_FORM, 12L, DocumentType.DEVIS, "p@example.com");

            // Assert
            assertThat(result).isFalse();
        }
    }

    // ─── getQuoteEmailDefaults ──────────────────────────────────────────────

    @Nested
    @DisplayName("getQuoteEmailDefaults")
    class GetQuoteEmailDefaults {

        @Test
        void whenCalled_thenDelegatesToEmailService() {
            // Arrange
            when(emailService.resolveQuoteEmailContent())
                    .thenReturn(Map.of("subject", "Devis", "body", "Bonjour"));

            // Act
            Map<String, String> defaults = dispatcher.getQuoteEmailDefaults();

            // Assert
            assertThat(defaults).containsEntry("subject", "Devis").containsEntry("body", "Bonjour");
        }
    }
}
