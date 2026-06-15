package com.clenzy.fiscal.einvoicing;

import com.clenzy.model.Country;
import com.clenzy.model.EInvoiceSubmission;
import com.clenzy.model.Invoice;
import com.clenzy.repository.EInvoiceSubmissionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Orchestration e-invoicing (CLZ-P0-04) : repli NoOp, idempotence, clearance.
 */
@ExtendWith(MockitoExtension.class)
class EInvoicingServiceTest {

    @Mock EInvoicingProviderRegistry registry;
    @Mock EInvoiceSubmissionRepository submissionRepository;
    @Mock Invoice invoice;

    @InjectMocks EInvoicingService service;

    private final NoOpEInvoicingProvider noOp = new NoOpEInvoicingProvider();

    private EInvoicingProvider clearanceProvider() {
        return new EInvoicingProvider() {
            @Override public String providerCode() { return "zatca"; }
            @Override public EInvoicingMode mode() { return EInvoicingMode.ZATCA_CLEARANCE; }
            @Override public EInvoiceResult clear(Invoice i) { return EInvoiceResult.cleared("Z-REF"); }
            @Override public EInvoiceResult report(Invoice i) { return EInvoiceResult.reported("X"); }
            @Override public byte[] renderCompliantArtifact(Invoice i) { return new byte[0]; }
        };
    }

    @Test
    void noOpProvider_persistsNotRequired() {
        when(invoice.getOrganizationId()).thenReturn(1L);
        when(invoice.getInvoiceNumber()).thenReturn("INV-1");
        when(submissionRepository.findByOrganizationIdAndInvoiceNumber(1L, "INV-1")).thenReturn(Optional.empty());
        when(registry.resolve(any())).thenReturn(noOp);
        when(submissionRepository.save(any())).thenAnswer(a -> a.getArgument(0));

        EInvoiceSubmission s = service.process(invoice, null);

        assertThat(s.getStatus()).isEqualTo(EInvoiceStatus.NOT_REQUIRED);
        assertThat(s.getMode()).isEqualTo(EInvoicingMode.NONE);
        assertThat(s.getProviderCode()).isEqualTo("noop");
    }

    @Test
    void idempotent_returnsExistingWithoutSaving() {
        when(invoice.getOrganizationId()).thenReturn(1L);
        when(invoice.getInvoiceNumber()).thenReturn("INV-1");
        EInvoiceSubmission existing = new EInvoiceSubmission();
        when(submissionRepository.findByOrganizationIdAndInvoiceNumber(1L, "INV-1"))
                .thenReturn(Optional.of(existing));

        EInvoiceSubmission s = service.process(invoice, null);

        assertThat(s).isSameAs(existing);
        verify(submissionRepository, never()).save(any());
        verifyNoInteractions(registry);
    }

    @Test
    void clearanceProvider_persistsCleared() {
        when(invoice.getOrganizationId()).thenReturn(2L);
        when(invoice.getInvoiceNumber()).thenReturn("INV-9");
        when(submissionRepository.findByOrganizationIdAndInvoiceNumber(2L, "INV-9")).thenReturn(Optional.empty());
        when(registry.resolve(any())).thenReturn(clearanceProvider());
        when(submissionRepository.save(any())).thenAnswer(a -> a.getArgument(0));

        Country sa = new Country();
        sa.setCountryCode("SA");
        sa.setEinvoicingProvider("zatca");

        EInvoiceSubmission s = service.process(invoice, sa);

        assertThat(s.getStatus()).isEqualTo(EInvoiceStatus.CLEARED);
        assertThat(s.getExternalRef()).isEqualTo("Z-REF");
        assertThat(s.getCountryCode()).isEqualTo("SA");
        assertThat(s.getMode()).isEqualTo(EInvoicingMode.ZATCA_CLEARANCE);
    }
}
