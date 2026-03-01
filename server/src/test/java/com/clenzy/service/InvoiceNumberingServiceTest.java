package com.clenzy.service;

import com.clenzy.model.InvoiceNumberSequence;
import com.clenzy.repository.InvoiceNumberSequenceRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InvoiceNumberingServiceTest {

    @Mock
    private InvoiceNumberSequenceRepository sequenceRepository;

    @Mock
    private TenantContext tenantContext;

    private InvoiceNumberingService numberingService;

    @BeforeEach
    void setUp() {
        numberingService = new InvoiceNumberingService(sequenceRepository, tenantContext);
    }

    @Nested
    class GenerateNextNumber {

        @Test
        void shouldGenerateFirstNumberForNewSequence() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(sequenceRepository.findAndLock(anyLong(), anyInt())).thenReturn(Optional.empty());

            InvoiceNumberSequence newSeq = new InvoiceNumberSequence();
            newSeq.setOrganizationId(1L);
            newSeq.setPrefix("FA");
            newSeq.setCurrentYear(2026);
            newSeq.setLastNumber(0);

            // First save (creation) returns the new sequence
            when(sequenceRepository.save(any(InvoiceNumberSequence.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

            String number = numberingService.generateNextNumber();

            assertThat(number).matches("FA\\d{4}-\\d{5}");
        }

        @Test
        void shouldIncrementExistingSequence() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);

            InvoiceNumberSequence existing = new InvoiceNumberSequence();
            existing.setOrganizationId(1L);
            existing.setPrefix("FA");
            existing.setCurrentYear(2026);
            existing.setLastNumber(5);

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

            InvoiceNumberSequence existing = new InvoiceNumberSequence();
            existing.setOrganizationId(1L);
            existing.setPrefix("FA");
            existing.setCurrentYear(2026);
            existing.setLastNumber(0);

            when(sequenceRepository.findAndLock(1L, 2026)).thenReturn(Optional.of(existing));
            when(sequenceRepository.save(any(InvoiceNumberSequence.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

            numberingService.generateNextNumber();

            ArgumentCaptor<InvoiceNumberSequence> captor = ArgumentCaptor.forClass(InvoiceNumberSequence.class);
            verify(sequenceRepository).save(captor.capture());
            assertThat(captor.getValue().getLastNumber()).isEqualTo(1);
        }

        @Test
        void shouldCreateSequenceWithPrefixFA() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(42L);
            when(sequenceRepository.findAndLock(anyLong(), anyInt())).thenReturn(Optional.empty());
            when(sequenceRepository.save(any(InvoiceNumberSequence.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

            numberingService.generateNextNumber();

            ArgumentCaptor<InvoiceNumberSequence> captor = ArgumentCaptor.forClass(InvoiceNumberSequence.class);
            // save is called twice: once for create, once after increment
            verify(sequenceRepository, atLeast(1)).save(captor.capture());
            InvoiceNumberSequence created = captor.getAllValues().get(0);
            assertThat(created.getPrefix()).isEqualTo("FA");
            assertThat(created.getOrganizationId()).isEqualTo(42L);
        }
    }
}
