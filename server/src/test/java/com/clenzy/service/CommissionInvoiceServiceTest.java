package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.FiscalProfileRepository;
import com.clenzy.repository.InvoiceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CommissionInvoiceServiceTest {

    @Mock private InvoiceGeneratorService invoiceGeneratorService;
    @Mock private InvoiceNumberingService numberingService;
    @Mock private InvoiceRepository invoiceRepository;
    @Mock private FiscalProfileRepository fiscalProfileRepository;
    @Mock private ManagementContractService managementContractService;

    @InjectMocks private CommissionInvoiceService service;

    private static final Long ORG_ID = 7L;
    private static final Long PROP_ID = 70L;
    private static final Long RES_ID = 700L;

    @BeforeEach
    void setUp() {
        lenient().when(invoiceRepository.save(any(Invoice.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private Reservation reservation() {
        Property p = new Property();
        p.setId(PROP_ID);
        Reservation r = new Reservation();
        r.setId(RES_ID);
        r.setOrganizationId(ORG_ID);
        r.setProperty(p);
        return r;
    }

    private ManagementContract contract(ManagementContract.PaymentModel model, String rate) {
        ManagementContract c = new ManagementContract();
        c.setOrganizationId(ORG_ID);
        c.setPropertyId(PROP_ID);
        c.setPaymentModel(model);
        c.setCommissionRate(rate != null ? new BigDecimal(rate) : null);
        return c;
    }

    private FiscalProfile fiscalProfile() {
        FiscalProfile fp = new FiscalProfile();
        fp.setOrganizationId(ORG_ID);
        return fp;
    }

    private Invoice generated() {
        Invoice i = new Invoice();
        i.setOrganizationId(ORG_ID);
        i.setReservationId(RES_ID);
        i.setInvoiceType(InvoiceType.COMMISSION);
        i.setTotalTtc(new BigDecimal("240.00"));
        return i;
    }

    @Test
    void skips_whenNoActiveContract() {
        when(managementContractService.getActiveContract(PROP_ID, ORG_ID)).thenReturn(Optional.empty());

        assertThat(service.generateForReservation(reservation())).isNull();
        verifyNoInteractions(invoiceGeneratorService);
    }

    @Test
    void skips_whenDirect() {
        when(managementContractService.getActiveContract(PROP_ID, ORG_ID))
            .thenReturn(Optional.of(contract(ManagementContract.PaymentModel.DIRECT, "0.20")));

        assertThat(service.generateForReservation(reservation())).isNull();
        verifyNoInteractions(invoiceGeneratorService);
    }

    @Test
    void skips_whenCohostSplit() {
        when(managementContractService.getActiveContract(PROP_ID, ORG_ID))
            .thenReturn(Optional.of(contract(ManagementContract.PaymentModel.OTA_COHOST_SPLIT, "0.15")));

        assertThat(service.generateForReservation(reservation())).isNull();
        verifyNoInteractions(invoiceGeneratorService);
    }

    @Test
    void skips_whenRateZero() {
        when(managementContractService.getActiveContract(PROP_ID, ORG_ID))
            .thenReturn(Optional.of(contract(ManagementContract.PaymentModel.OWNER_COLLECTS, "0")));

        assertThat(service.generateForReservation(reservation())).isNull();
        verifyNoInteractions(invoiceGeneratorService);
    }

    @Test
    void skips_whenCommissionInvoiceAlreadyExists() {
        when(managementContractService.getActiveContract(PROP_ID, ORG_ID))
            .thenReturn(Optional.of(contract(ManagementContract.PaymentModel.OWNER_COLLECTS, "0.20")));
        when(invoiceRepository.findByReservationIdAndInvoiceType(RES_ID, InvoiceType.COMMISSION))
            .thenReturn(Optional.of(new Invoice()));

        assertThat(service.generateForReservation(reservation())).isNull();
        verifyNoInteractions(invoiceGeneratorService);
    }

    @Test
    void ownerCollects_producesIssuedReceivable() {
        Reservation r = reservation();
        ManagementContract c = contract(ManagementContract.PaymentModel.OWNER_COLLECTS, "0.20");
        when(managementContractService.getActiveContract(PROP_ID, ORG_ID)).thenReturn(Optional.of(c));
        when(invoiceRepository.findByReservationIdAndInvoiceType(RES_ID, InvoiceType.COMMISSION))
            .thenReturn(Optional.empty());
        when(fiscalProfileRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(fiscalProfile()));
        when(invoiceGeneratorService.generateCommissionFromReservation(r, c, ORG_ID)).thenReturn(generated());
        when(numberingService.generateNextNumber(ORG_ID)).thenReturn("FA-2026-00010");

        Invoice result = service.generateForReservation(r);

        assertThat(result).isNotNull();
        assertThat(result.getInvoiceNumber()).isEqualTo("FA-2026-00010");
        assertThat(result.getStatus()).isEqualTo(InvoiceStatus.ISSUED);
        assertThat(result.getPaidAt()).isNull();
    }

    @Test
    void conciergeCollects_producesPaidInvoice() {
        Reservation r = reservation();
        ManagementContract c = contract(ManagementContract.PaymentModel.CONCIERGE_COLLECTS, "0.18");
        when(managementContractService.getActiveContract(PROP_ID, ORG_ID)).thenReturn(Optional.of(c));
        when(invoiceRepository.findByReservationIdAndInvoiceType(RES_ID, InvoiceType.COMMISSION))
            .thenReturn(Optional.empty());
        when(fiscalProfileRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(fiscalProfile()));
        when(invoiceGeneratorService.generateCommissionFromReservation(r, c, ORG_ID)).thenReturn(generated());
        when(numberingService.generateNextNumber(ORG_ID)).thenReturn("FA-2026-00011");

        Invoice result = service.generateForReservation(r);

        assertThat(result).isNotNull();
        assertThat(result.getStatus()).isEqualTo(InvoiceStatus.PAID);
        assertThat(result.getPaidAt()).isNotNull();
        assertThat(result.getPaymentMethod()).isEqualTo("RETENUE_REVERSEMENT");
    }

    @Test
    void skips_whenGeneratedCommissionIsZero() {
        Reservation r = reservation();
        ManagementContract c = contract(ManagementContract.PaymentModel.OWNER_COLLECTS, "0.20");
        Invoice zero = generated();
        zero.setTotalTtc(BigDecimal.ZERO);
        when(managementContractService.getActiveContract(PROP_ID, ORG_ID)).thenReturn(Optional.of(c));
        when(invoiceRepository.findByReservationIdAndInvoiceType(RES_ID, InvoiceType.COMMISSION))
            .thenReturn(Optional.empty());
        when(fiscalProfileRepository.findByOrganizationId(ORG_ID)).thenReturn(Optional.of(fiscalProfile()));
        when(invoiceGeneratorService.generateCommissionFromReservation(r, c, ORG_ID)).thenReturn(zero);

        assertThat(service.generateForReservation(r)).isNull();
        verify(numberingService, never()).generateNextNumber(anyLong());
    }
}
