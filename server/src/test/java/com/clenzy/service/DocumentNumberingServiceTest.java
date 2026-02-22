package com.clenzy.service;

import com.clenzy.model.DocumentNumberSequence;
import com.clenzy.model.DocumentType;
import com.clenzy.repository.DocumentNumberSequenceRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DocumentNumberingServiceTest {

    @Mock private DocumentNumberSequenceRepository sequenceRepository;

    private TenantContext tenantContext;
    private DocumentNumberingService service;
    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);
        service = new DocumentNumberingService(sequenceRepository, tenantContext);
    }

    // ===== REQUIRES LEGAL NUMBER =====

    @Nested
    class RequiresLegalNumber {

        @Test
        void whenFacture_thenTrue() {
            assertThat(service.requiresLegalNumber(DocumentType.FACTURE)).isTrue();
        }

        @Test
        void whenDevis_thenTrue() {
            assertThat(service.requiresLegalNumber(DocumentType.DEVIS)).isTrue();
        }

        @Test
        void whenOtherType_thenFalse() {
            // Types other than FACTURE and DEVIS should return false
            for (DocumentType type : DocumentType.values()) {
                if (type != DocumentType.FACTURE && type != DocumentType.DEVIS) {
                    assertThat(service.requiresLegalNumber(type)).isFalse();
                }
            }
        }
    }

    // ===== GENERATE NEXT NUMBER =====

    @Nested
    class GenerateNextNumber {

        @Test
        void whenSequenceExists_thenIncrementsAndFormats() {
            int currentYear = LocalDate.now().getYear();
            DocumentNumberSequence sequence = new DocumentNumberSequence("FACTURE", currentYear, "FAC");
            // Simulate lastNumber = 5 via incrementAndGet returning 6
            sequence.setLastNumber(5);
            when(sequenceRepository.findByDocumentTypeAndYearForUpdate("FACTURE", currentYear, ORG_ID))
                    .thenReturn(Optional.of(sequence));

            String result = service.generateNextNumber(DocumentType.FACTURE);

            assertThat(result).isEqualTo("FAC-" + currentYear + "-00006");
            verify(sequenceRepository).save(sequence);
        }

        @Test
        void whenSequenceDoesNotExist_thenCreatesNewAndReturns00001() {
            int currentYear = LocalDate.now().getYear();
            when(sequenceRepository.findByDocumentTypeAndYearForUpdate("DEVIS", currentYear, ORG_ID))
                    .thenReturn(Optional.empty());
            // When creating new sequence, save is called; simulate fresh sequence
            DocumentNumberSequence newSeq = new DocumentNumberSequence("DEVIS", currentYear, "DEV");
            when(sequenceRepository.save(any(DocumentNumberSequence.class))).thenReturn(newSeq);

            String result = service.generateNextNumber(DocumentType.DEVIS);

            assertThat(result).startsWith("DEV-" + currentYear + "-0000");
        }

        @Test
        void whenTypeDoesNotRequireLegalNumber_thenThrows() {
            // Use a type that is NOT FACTURE or DEVIS
            for (DocumentType type : DocumentType.values()) {
                if (type != DocumentType.FACTURE && type != DocumentType.DEVIS) {
                    assertThatThrownBy(() -> service.generateNextNumber(type))
                            .isInstanceOf(IllegalArgumentException.class)
                            .hasMessageContaining("ne requiert pas de numerotation");
                    break; // Only need to test one
                }
            }
        }
    }

    // ===== GET LAST NUMBER =====

    @Nested
    class GetLastNumber {

        @Test
        void whenSequenceExists_thenReturnsLastNumber() {
            DocumentNumberSequence seq = new DocumentNumberSequence("FACTURE", 2025, "FAC");
            seq.setLastNumber(42);
            when(sequenceRepository.findByDocumentTypeAndYear("FACTURE", 2025))
                    .thenReturn(Optional.of(seq));

            int result = service.getLastNumber(DocumentType.FACTURE, 2025);

            assertThat(result).isEqualTo(42);
        }

        @Test
        void whenNoSequence_thenReturnsZero() {
            when(sequenceRepository.findByDocumentTypeAndYear("DEVIS", 2025))
                    .thenReturn(Optional.empty());

            int result = service.getLastNumber(DocumentType.DEVIS, 2025);

            assertThat(result).isEqualTo(0);
        }
    }
}
