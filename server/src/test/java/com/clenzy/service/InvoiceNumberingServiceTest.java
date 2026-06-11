package com.clenzy.service;

import com.clenzy.model.InvoiceNumberSequence;
import com.clenzy.repository.InvoiceNumberSequenceRepository;
import com.clenzy.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InvoiceNumberingServiceTest {

    @Mock
    private InvoiceNumberSequenceRepository sequenceRepository;

    @Mock
    private TenantContext tenantContext;

    @Mock
    private EntityManager entityManager;

    @Mock
    private Query nativeQuery;

    private InvoiceNumberingService numberingService;

    @BeforeEach
    void setUp() {
        numberingService = new InvoiceNumberingService(sequenceRepository, tenantContext, entityManager);
    }

    private void stubUpsert() {
        when(entityManager.createNativeQuery(anyString())).thenReturn(nativeQuery);
        when(nativeQuery.setParameter(anyString(), any())).thenReturn(nativeQuery);
        when(nativeQuery.executeUpdate()).thenReturn(1);
    }

    private InvoiceNumberSequence sequence(Long orgId, int year, int lastNumber) {
        InvoiceNumberSequence seq = new InvoiceNumberSequence();
        seq.setOrganizationId(orgId);
        seq.setPrefix("FA");
        seq.setCurrentYear(year);
        seq.setLastNumber(lastNumber);
        return seq;
    }

    @Nested
    class GenerateNextNumber {

        @Test
        void shouldGenerateFirstNumberForNewSequence() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            stubUpsert();
            // 1er findAndLock : sequence absente ; 2e (apres upsert) : sequence initialisee
            when(sequenceRepository.findAndLock(anyLong(), anyInt()))
                .thenReturn(Optional.empty(), Optional.of(sequence(1L, 2026, 0)));
            when(sequenceRepository.save(any(InvoiceNumberSequence.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

            String number = numberingService.generateNextNumber();

            assertThat(number).matches("FA\\d{4}-\\d{5}");
        }

        @Test
        void shouldIncrementExistingSequence() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            InvoiceNumberSequence existing = sequence(1L, 2026, 5);

            when(sequenceRepository.findAndLock(1L, 2026)).thenReturn(Optional.of(existing));
            when(sequenceRepository.save(any(InvoiceNumberSequence.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

            String number = numberingService.generateNextNumber();

            assertThat(number).isEqualTo("FA2026-00006");
            assertThat(existing.getLastNumber()).isEqualTo(6);
        }

        @Test
        void shouldSaveSequenceAfterIncrement() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            InvoiceNumberSequence existing = sequence(1L, 2026, 0);

            when(sequenceRepository.findAndLock(1L, 2026)).thenReturn(Optional.of(existing));
            when(sequenceRepository.save(any(InvoiceNumberSequence.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

            numberingService.generateNextNumber();

            ArgumentCaptor<InvoiceNumberSequence> captor = ArgumentCaptor.forClass(InvoiceNumberSequence.class);
            verify(sequenceRepository).save(captor.capture());
            assertThat(captor.getValue().getLastNumber()).isEqualTo(1);
        }

        @Test
        void whenSequenceMissing_thenInitializedViaUpsertWithPrefixFA() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(42L);
            stubUpsert();
            when(sequenceRepository.findAndLock(anyLong(), anyInt()))
                .thenReturn(Optional.empty(), Optional.of(sequence(42L, 2026, 0)));
            when(sequenceRepository.save(any(InvoiceNumberSequence.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

            numberingService.generateNextNumber();

            // Creation via INSERT ... ON CONFLICT DO NOTHING (course d'initialisation fermee)
            verify(entityManager).createNativeQuery(contains("ON CONFLICT (organization_id, current_year) DO NOTHING"));
            verify(nativeQuery).setParameter("prefix", "FA");
            verify(nativeQuery).setParameter("orgId", 42L);
            // Le verrou pessimiste est re-acquis apres initialisation
            verify(sequenceRepository, times(2)).findAndLock(anyLong(), anyInt());
        }

        @Test
        void whenSequenceStillMissingAfterUpsert_thenThrowsIllegalState() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            stubUpsert();
            when(sequenceRepository.findAndLock(anyLong(), anyInt()))
                .thenReturn(Optional.empty(), Optional.empty());

            assertThatThrownBy(() -> numberingService.generateNextNumber())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("introuvable apres initialisation");
        }
    }

    /**
     * Regression Z3-BUGS-08 : la numerotation etait en REQUIRES_NEW, le compteur
     * etait donc committe independamment — un rollback de la transaction de creation
     * de la facture consommait le numero a vide (trou dans la sequence NF).
     * Le numero DOIT etre attribue dans la transaction appelante (REQUIRED).
     */
    @Nested
    class TransactionPropagation {

        @Test
        void whenNumberingWithOrgId_thenJoinsCallerTransaction() throws NoSuchMethodException {
            Transactional tx = InvoiceNumberingService.class
                .getMethod("generateNextNumber", Long.class)
                .getAnnotation(Transactional.class);

            assertThat(tx).isNotNull();
            assertThat(tx.propagation())
                .as("generateNextNumber(orgId) ne doit PAS etre REQUIRES_NEW (trous sur rollback)")
                .isEqualTo(Propagation.REQUIRED);
        }

        @Test
        void whenNumberingWithTenantContext_thenJoinsCallerTransaction() throws NoSuchMethodException {
            Transactional tx = InvoiceNumberingService.class
                .getMethod("generateNextNumber")
                .getAnnotation(Transactional.class);

            assertThat(tx).isNotNull();
            assertThat(tx.propagation())
                .as("generateNextNumber() ne doit PAS etre REQUIRES_NEW (trous sur rollback)")
                .isEqualTo(Propagation.REQUIRED);
        }
    }
}
