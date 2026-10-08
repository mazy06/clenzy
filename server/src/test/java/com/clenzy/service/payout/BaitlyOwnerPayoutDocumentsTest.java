package com.clenzy.service.payout;

import com.clenzy.fiscal.*;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.*;
import com.clenzy.service.commission.ManagementCommissionCalculator;
import com.clenzy.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static com.clenzy.service.payout.ReservationPayoutFundingTest.*;

/** Calcul réel de commission, facture et génération du reversement ; aucun paiement externe. */
class BaitlyOwnerPayoutDocumentsTest {
    final InvoiceRepository invoices=mock(InvoiceRepository.class);
    final ReservationRepository reservations=mock(ReservationRepository.class);
    final OwnerPayoutRepository payouts=mock(OwnerPayoutRepository.class);
    final OwnerPayoutReservationRepository claims=mock(OwnerPayoutReservationRepository.class);
    final InvoiceNumberingService numbers=mock(InvoiceNumberingService.class);
    final ManagementContractService contracts=mock(ManagementContractService.class);
    final EntityManager em=mock(EntityManager.class);
    final FiscalProfileRepository profiles=mock(FiscalProfileRepository.class);
    final FiscalEngine taxes=mock(FiscalEngine.class);
    final ManagementCommissionCalculator calculator=new ManagementCommissionCalculator();
    BaitlyOwnerPayoutDocuments documents;
    Invoice commission;

    @BeforeEach void setup() {
        var generator=new InvoiceGeneratorService(invoices,reservations,mock(InterventionRepository.class),profiles,taxes,
                mock(TouristTaxService.class),numbers,mock(TenantContext.class),em,calculator);
        documents=new BaitlyOwnerPayoutDocuments(invoices,generator,numbers,claims,em);
        var profile=new FiscalProfile();profile.setCountryCode("FR");profile.setLegalEntityName("Baitly Test");
        when(profiles.findByOrganizationId(7L)).thenReturn(Optional.of(profile));
        when(taxes.calculateTax(eq("FR"),any(),any())).thenAnswer(c->{
            TaxableItem item=c.getArgument(1); BigDecimal amount=item.amount();
            BigDecimal vat=amount.multiply(new BigDecimal("0.20"));
            return new TaxResult(amount,vat,amount.add(vat),new BigDecimal("0.20"),"TVA test","STANDARD");
        });
        when(invoices.save(any())).thenAnswer(c->{commission=c.getArgument(0);commission.setId(30L);return commission;});
        when(numbers.generateNextNumberFor(org.mockito.ArgumentMatchers.any(com.clenzy.model.Invoice.class))).thenReturn("TEST-COMMISSION-30");
    }

    @Test void refundIsDeductedBeforeCommissionAndInvoiceVatIsIncludedInRetention() {
        var stay=partiallyRefundedStay(); stay.getProperty().setCountryCode("FR");
        var original=receipt(1,"100");original.setTransactionRef("TX-original");
        var refund=confirmedRefund();
        var transactions=mock(PaymentTransactionRepository.class);
        when(transactions.findReservationFunding(eq(7L),anyList(),anySet())).thenReturn(List.of(original,refund));
        var funding=new OwnerPayoutFundingService(transactions,claims,payouts,reservations,documents,mock(BaitlyExpenseRetention.class), org.mockito.Mockito.mock(com.clenzy.booking.service.BaitlyReservationCredit.class));
        ReflectionTestUtils.setField(funding,"em",em);
        var users=mock(UserRepository.class);when(users.lockPayoutOwner(10L,7L)).thenReturn(Optional.of(new User()));
        when(reservations.findByOwnerIdAndDateRange(eq(10L),any(),any(),eq(7L))).thenReturn(List.of(stay));
        var contract=new ManagementContract();contract.setPaymentModel(ManagementContract.PaymentModel.DIRECT);contract.setCommissionRate(new BigDecimal("0.20"));
        when(contracts.getActiveContract(50L,7L)).thenReturn(Optional.of(contract));
        var guest=invoice(10L,InvoiceType.GUEST,InvoiceStatus.PAID,"100");
        var credit=invoice(11L,InvoiceType.GUEST,InvoiceStatus.CREDIT_NOTE,"-40");credit.setOriginalInvoiceId(10L);credit.setRefundTransactionId(2L);
        when(invoices.findByReservationIdAndInvoiceType(1L,InvoiceType.GUEST)).thenReturn(Optional.of(guest));
        when(invoices.findByOrganizationIdAndRefundTransactionId(7L,2L)).thenReturn(Optional.of(credit));
        when(payouts.save(any())).thenAnswer(c->{OwnerPayout p=c.getArgument(0);p.setId(20L);return p;});
        var accounting=new AccountingService(payouts,mock(ChannelCommissionRepository.class),reservations,mock(PropertyRepository.class),
                mock(ProviderExpenseRepository.class),contracts,mock(NotificationService.class),users,calculator,funding,documents,mock(ObjectProvider.class));
        var payout=accounting.generatePayout(10L,7L,LocalDate.of(2025,9,1),LocalDate.of(2025,9,30));
        assertThat(payout.getGrossRevenue()).isEqualByComparingTo("60");
        assertThat(payout.getCommissionAmount()).isEqualByComparingTo("14.40");
        assertThat(payout.getNetAmount()).isEqualByComparingTo("45.60");
        assertThat(commission.getTotalHt()).isEqualByComparingTo("12");
        assertThat(commission.getTotalTax()).isEqualByComparingTo("2.40");
        assertThat(commission.getPayoutId()).isEqualTo(20L);
        assertThat(commission.getStatus()).isEqualTo(InvoiceStatus.ISSUED);
        assertThat(commission.getPaidAt()).isNull();
        assertThat(commission.getDueDate()).isNull();
        assertThat(stay.getTotalPrice()).isEqualByComparingTo("100");

        when(invoices.findAllByPayoutIdAndOrganizationIdOrderById(20L,7L)).thenReturn(List.of(commission));
        when(claims.findByPayoutIdAndOrganizationId(20L,7L)).thenReturn(List.of(new OwnerPayoutReservation(1L,7L,20L,
                new BigDecimal("60"),"EUR",List.of(1L,2L))));
        when(em.find(OwnerPayout.class,20L)).thenReturn(payout);
        var proof=new PayoutTransfer();
        ReflectionTestUtils.setField(proof,"source",PayoutTransfer.Source.OWNER_PAYOUT);
        ReflectionTestUtils.setField(proof,"sourceId",20L);ReflectionTestUtils.setField(proof,"organizationId",7L);
        ReflectionTestUtils.setField(proof,"amount",new BigDecimal("45.60"));ReflectionTestUtils.setField(proof,"currency","EUR");
        assertThatThrownBy(()->documents.settle(proof)).hasMessageContaining("non confirmé");
        assertThat(commission.getPaidAt()).isNull();
        proof.transferred("tr_sandbox_proof");documents.settle(proof);
        assertThat(commission.getStatus()).isEqualTo(InvoiceStatus.PAID);
        var paidAt=commission.getPaidAt();documents.settle(proof);
        assertThat(commission.getPaidAt()).isEqualTo(paidAt);
        verify(numbers,times(1)).generateNextNumber(7L);
    }

    @Test void existingCommissionCannotBeIssuedAgainOrSilentlyReduced() {
        when(invoices.findByReservationIdAndInvoiceType(1L,InvoiceType.COMMISSION))
                .thenReturn(Optional.of(invoice(30L,InvoiceType.COMMISSION,InvoiceStatus.ISSUED,"24")));
        assertThatThrownBy(()->documents.prepare(stay(),new ManagementCommissionCalculator.Commission(
                new BigDecimal("60"),new BigDecimal("0.2"),new BigDecimal("12"),BigDecimal.ZERO))).hasMessageContaining("déjà");
        verify(invoices,never()).save(any());
    }

    @ParameterizedTest @ValueSource(strings={"missing","amount","currency","original","status","tenant"})
    void cannotAllocateResidualWithoutItsExactGuestCreditNote(String defect) {
        var guest=invoice(10L,InvoiceType.GUEST,InvoiceStatus.PAID,"100");
        var credit=invoice(11L,InvoiceType.GUEST,InvoiceStatus.CREDIT_NOTE,"-40");credit.setOriginalInvoiceId(10L);credit.setRefundTransactionId(2L);
        switch(defect) {
            case "amount" -> credit.setTotalTtc(new BigDecimal("-41"));
            case "currency" -> credit.setCurrency("MAD");
            case "original" -> credit.setOriginalInvoiceId(999L);
            case "status" -> credit.setStatus(InvoiceStatus.DRAFT);
            case "tenant" -> credit.setOrganizationId(8L);
        }
        when(invoices.findByReservationIdAndInvoiceType(1L,InvoiceType.GUEST)).thenReturn(Optional.of(guest));
        when(invoices.findByOrganizationIdAndRefundTransactionId(7L,2L)).thenReturn("missing".equals(defect)?Optional.empty():Optional.of(credit));
        assertThatThrownBy(()->documents.validateRefund(partiallyRefundedStay(),List.of(confirmedRefund()))).isInstanceOf(IllegalStateException.class);
    }

    private Invoice invoice(Long id,InvoiceType type,InvoiceStatus status,String total) {
        var i=new Invoice();i.setId(id);i.setOrganizationId(7L);i.setReservationId(1L);i.setInvoiceType(type);i.setStatus(status);
        i.setTotalTtc(new BigDecimal(total));i.setCurrency("EUR");return i;
    }
}
