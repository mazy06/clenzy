package com.clenzy.service;

import com.clenzy.dto.VatSummaryDto;
import com.clenzy.model.Invoice;
import com.clenzy.model.InvoiceLine;
import com.clenzy.model.InvoiceStatus;
import com.clenzy.repository.InvoiceRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FiscalReportingServiceTest {

    @Mock
    private InvoiceRepository invoiceRepository;

    @Mock
    private CurrencyConverterService currencyConverter;

    @Mock
    private TenantContext tenantContext;

    private FiscalReportingService reportingService;

    @BeforeEach
    void setUp() {
        reportingService = new FiscalReportingService(invoiceRepository, currencyConverter, tenantContext);
    }

    private Invoice createInvoice(InvoiceStatus status, BigDecimal totalHt,
                                   BigDecimal totalTax, BigDecimal totalTtc,
                                   String taxCategory, BigDecimal taxRate) {
        Invoice invoice = new Invoice();
        invoice.setOrganizationId(1L);
        invoice.setInvoiceNumber("FA-TEST");
        invoice.setInvoiceDate(LocalDate.of(2026, 1, 15));
        invoice.setCurrency("EUR");
        invoice.setCountryCode("FR");
        invoice.setStatus(status);
        invoice.setTotalHt(totalHt);
        invoice.setTotalTax(totalTax);
        invoice.setTotalTtc(totalTtc);

        InvoiceLine line = new InvoiceLine();
        line.setLineNumber(1);
        line.setDescription("Test");
        line.setQuantity(BigDecimal.ONE);
        line.setUnitPriceHt(totalHt);
        line.setTaxCategory(taxCategory);
        line.setTaxRate(taxRate);
        line.setTaxAmount(totalTax);
        line.setTotalHt(totalHt);
        line.setTotalTtc(totalTtc);
        invoice.addLine(line);

        return invoice;
    }

    @Test void fiscalCurrencyIgnoresDisplayPreferenceAndSeparatesIssuers() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        when(tenantContext.getCountryCode()).thenReturn("FR");
        org.mockito.Mockito.lenient().when(tenantContext.getDefaultCurrency()).thenReturn("SAR");
        var first=createInvoice(InvoiceStatus.PAID,new BigDecimal("100"),new BigDecimal("20"),new BigDecimal("120"),"STANDARD",new BigDecimal("0.20"));
        first.setSellerName("Société A");first.setSellerTaxId("FR-A");
        var second=createInvoice(InvoiceStatus.PAID,new BigDecimal("200"),new BigDecimal("40"),new BigDecimal("240"),"STANDARD",new BigDecimal("0.20"));
        second.setSellerName("Société B");second.setSellerTaxId("FR-B");
        when(invoiceRepository.findByOrganizationIdAndDateRange(eq(1L),any(),any())).thenReturn(List.of(first,second));
        var summary=reportingService.getVatSummary(LocalDate.of(2026,1,1),LocalDate.of(2026,1,31));
        assertThat(summary.currency()).isEqualTo("EUR");assertThat(summary.issuers()).hasSize(2);
        assertThat(summary.issuers()).extracting(VatSummaryDto.IssuerSummary::sellerName).containsExactlyInAnyOrder("Société A","Société B");
        assertThat(summary.issuers()).allMatch(i->i.summary().invoiceCount()==1);
        org.mockito.Mockito.verifyNoInteractions(currencyConverter);
    }


    @Test void countriesAndCurrenciesAreNeverAddedIntoTheSameDeclaration() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
        var fr=createInvoice(InvoiceStatus.PAID,new BigDecimal("100"),new BigDecimal("20"),new BigDecimal("120"),"STANDARD",new BigDecimal("0.20"));
        var ma=createInvoice(InvoiceStatus.PAID,new BigDecimal("200"),new BigDecimal("40"),new BigDecimal("240"),"STANDARD",new BigDecimal("0.20"));ma.setCountryCode("MA");ma.setCurrency("MAD");
        var sa=createInvoice(InvoiceStatus.CREDIT_NOTE,new BigDecimal("-50"),new BigDecimal("-7.50"),new BigDecimal("-57.50"),"STANDARD",new BigDecimal("0.15"));sa.setCountryCode("SA");sa.setCurrency("SAR");
        when(invoiceRepository.findByOrganizationIdAndDateRange(eq(1L),any(),any())).thenReturn(List.of(fr,ma,sa));
        var summaries=reportingService.getVatSummariesByCountry(LocalDate.of(2026,1,1),LocalDate.of(2026,1,31));
        assertThat(summaries).hasSize(3);
        assertThat(summaries.stream().map(VatSummaryDto::countryCode)).containsExactly("FR","MA","SA");
        assertThat(summaries.get(0).totalTtc()).isEqualByComparingTo("120");
        assertThat(summaries.get(1).totalTtc()).isEqualByComparingTo("240");
        assertThat(summaries.get(2).totalTtc()).isEqualByComparingTo("-57.50");
        org.mockito.Mockito.verifyNoInteractions(currencyConverter);
        var selected=reportingService.getVatSummary(LocalDate.of(2026,1,1),LocalDate.of(2026,1,31),"MA");
        assertThat(selected.invoiceCount()).isEqualTo(1);assertThat(selected.currency()).isEqualTo("MAD");
    }

    @Nested
    class GetVatSummary {

        @Test
        void shouldReturnSummaryForPeriod() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.getCountryCode()).thenReturn("FR");

            Invoice issued = createInvoice(InvoiceStatus.ISSUED,
                new BigDecimal("100.00"), new BigDecimal("10.00"), new BigDecimal("110.00"),
                "ACCOMMODATION", new BigDecimal("0.1000"));

            Invoice paid = createInvoice(InvoiceStatus.PAID,
                new BigDecimal("200.00"), new BigDecimal("40.00"), new BigDecimal("240.00"),
                "STANDARD", new BigDecimal("0.2000"));

            LocalDate from = LocalDate.of(2026, 1, 1);
            LocalDate to = LocalDate.of(2026, 1, 31);

            when(invoiceRepository.findByOrganizationIdAndDateRange(1L, from, to))
                .thenReturn(List.of(issued, paid));

            VatSummaryDto summary = reportingService.getVatSummary(from, to);

            assertThat(summary.countryCode()).isEqualTo("FR");
            assertThat(summary.currency()).isEqualTo("EUR");
            assertThat(summary.totalHt()).isEqualByComparingTo("300.00");
            assertThat(summary.totalTax()).isEqualByComparingTo("50.00");
            assertThat(summary.totalTtc()).isEqualByComparingTo("350.00");
            assertThat(summary.invoiceCount()).isEqualTo(2);
            assertThat(summary.breakdown()).hasSize(2);
        }

        @Test
        void shouldExcludeDraftButRetainCancelledOriginalAlongsideItsCreditNote() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.getCountryCode()).thenReturn("FR");

            Invoice draft = createInvoice(InvoiceStatus.DRAFT,
                new BigDecimal("50.00"), new BigDecimal("5.00"), new BigDecimal("55.00"),
                "ACCOMMODATION", new BigDecimal("0.1000"));

            Invoice cancelled = createInvoice(InvoiceStatus.CANCELLED,
                new BigDecimal("100.00"), new BigDecimal("10.00"), new BigDecimal("110.00"),
                "ACCOMMODATION", new BigDecimal("0.1000"));

            Invoice issued = createInvoice(InvoiceStatus.ISSUED,
                new BigDecimal("200.00"), new BigDecimal("20.00"), new BigDecimal("220.00"),
                "ACCOMMODATION", new BigDecimal("0.1000"));

            Invoice copy = createInvoice(InvoiceStatus.ISSUED,
                new BigDecimal("200.00"), new BigDecimal("20.00"), new BigDecimal("220.00"),
                "ACCOMMODATION", new BigDecimal("0.1000"));
            copy.setDuplicateOfId(50L);

            LocalDate from = LocalDate.of(2026, 1, 1);
            LocalDate to = LocalDate.of(2026, 1, 31);

            when(invoiceRepository.findByOrganizationIdAndDateRange(1L, from, to))
                .thenReturn(List.of(draft, cancelled, issued, copy));

            VatSummaryDto summary = reportingService.getVatSummary(from, to);

            // Une facture annulée reste comptée ; son avoir effectue la compensation.
            assertThat(summary.invoiceCount()).isEqualTo(2);
            assertThat(summary.totalHt()).isEqualByComparingTo("300.00");
        }

        @Test
        void shouldIncludeCreditNoteInvoices() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.getCountryCode()).thenReturn("FR");

            Invoice creditNote = createInvoice(InvoiceStatus.CREDIT_NOTE,
                new BigDecimal("-100.00"), new BigDecimal("-10.00"), new BigDecimal("-110.00"),
                "ACCOMMODATION", new BigDecimal("0.1000"));

            LocalDate from = LocalDate.of(2026, 1, 1);
            LocalDate to = LocalDate.of(2026, 1, 31);

            when(invoiceRepository.findByOrganizationIdAndDateRange(1L, from, to))
                .thenReturn(List.of(creditNote));

            VatSummaryDto summary = reportingService.getVatSummary(from, to);

            assertThat(summary.invoiceCount()).isEqualTo(1);
            assertThat(summary.totalHt()).isEqualByComparingTo("-100.00");
        }

        @Test
        void shouldReturnEmptySummaryForNoInvoices() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.getCountryCode()).thenReturn("FR");

            LocalDate from = LocalDate.of(2026, 1, 1);
            LocalDate to = LocalDate.of(2026, 1, 31);

            when(invoiceRepository.findByOrganizationIdAndDateRange(1L, from, to))
                .thenReturn(List.of());

            VatSummaryDto summary = reportingService.getVatSummary(from, to);

            assertThat(summary.invoiceCount()).isEqualTo(0);
            assertThat(summary.totalHt()).isEqualByComparingTo("0.00");
            assertThat(summary.totalTax()).isEqualByComparingTo("0.00");
            assertThat(summary.totalTtc()).isEqualByComparingTo("0.00");
            assertThat(summary.breakdown()).isEmpty();
        }

        @Test
        void shouldGroupBreakdownByTaxCategoryAndRate() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.getCountryCode()).thenReturn("FR");

            Invoice invoice = new Invoice();
            invoice.setOrganizationId(1L);
            invoice.setInvoiceNumber("FA-001");
            invoice.setInvoiceDate(LocalDate.of(2026, 1, 15));
            invoice.setCurrency("EUR");
            invoice.setCountryCode("FR");
            invoice.setStatus(InvoiceStatus.ISSUED);
            invoice.setTotalHt(new BigDecimal("300.00"));
            invoice.setTotalTax(new BigDecimal("35.00"));
            invoice.setTotalTtc(new BigDecimal("335.00"));

            InvoiceLine line1 = new InvoiceLine();
            line1.setLineNumber(1);
            line1.setDescription("Hebergement");
            line1.setQuantity(BigDecimal.ONE);
            line1.setUnitPriceHt(new BigDecimal("200.00"));
            line1.setTaxCategory("ACCOMMODATION");
            line1.setTaxRate(new BigDecimal("0.1000"));
            line1.setTaxAmount(new BigDecimal("20.00"));
            line1.setTotalHt(new BigDecimal("200.00"));
            line1.setTotalTtc(new BigDecimal("220.00"));
            invoice.addLine(line1);

            InvoiceLine line2 = new InvoiceLine();
            line2.setLineNumber(2);
            line2.setDescription("Menage");
            line2.setQuantity(BigDecimal.ONE);
            line2.setUnitPriceHt(new BigDecimal("100.00"));
            line2.setTaxCategory("CLEANING");
            line2.setTaxRate(new BigDecimal("0.2000"));
            line2.setTaxAmount(new BigDecimal("20.00"));
            line2.setTotalHt(new BigDecimal("100.00"));
            line2.setTotalTtc(new BigDecimal("120.00"));
            invoice.addLine(line2);

            LocalDate from = LocalDate.of(2026, 1, 1);
            LocalDate to = LocalDate.of(2026, 1, 31);

            when(invoiceRepository.findByOrganizationIdAndDateRange(1L, from, to))
                .thenReturn(List.of(invoice));

            VatSummaryDto summary = reportingService.getVatSummary(from, to);

            assertThat(summary.breakdown()).hasSize(2);
            // Sorted by taxRate descending: CLEANING 20% first, then ACCOMMODATION 10%
            assertThat(summary.breakdown().get(0).taxCategory()).isEqualTo("CLEANING");
            assertThat(summary.breakdown().get(1).taxCategory()).isEqualTo("ACCOMMODATION");
        }

        @Test
        void shouldConvertForeignCurrencyInvoicesToBaseCurrency() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.getCountryCode()).thenReturn("FR");

            // Invoice in EUR — no conversion needed
            Invoice eurInvoice = createInvoice(InvoiceStatus.ISSUED,
                new BigDecimal("100.00"), new BigDecimal("10.00"), new BigDecimal("110.00"),
                "ACCOMMODATION", new BigDecimal("0.1000"));

            // Invoice in MAD — needs conversion
            Invoice madInvoice = createInvoice(InvoiceStatus.ISSUED,
                new BigDecimal("1000.00"), new BigDecimal("100.00"), new BigDecimal("1100.00"),
                "ACCOMMODATION", new BigDecimal("0.1000"));
            madInvoice.setCurrency("MAD");

            LocalDate from = LocalDate.of(2026, 1, 1);
            LocalDate to = LocalDate.of(2026, 1, 31);

            when(invoiceRepository.findByOrganizationIdAndDateRange(1L, from, to))
                .thenReturn(List.of(eurInvoice, madInvoice));

            // Mock conversion: 1000 MAD → ~91 EUR (rate ~0.091)
            when(currencyConverter.convertToBase(new BigDecimal("1000.00"), "MAD", "EUR", madInvoice.getInvoiceDate()))
                .thenReturn(new BigDecimal("91.00"));
            when(currencyConverter.convertToBase(new BigDecimal("100.00"), "MAD", "EUR", madInvoice.getInvoiceDate()))
                .thenReturn(new BigDecimal("9.10"));
            when(currencyConverter.convertToBase(new BigDecimal("1100.00"), "MAD", "EUR", madInvoice.getInvoiceDate()))
                .thenReturn(new BigDecimal("100.10"));

            VatSummaryDto summary = reportingService.getVatSummary(from, to);

            // EUR invoice (100) + converted MAD invoice (91) = 191
            assertThat(summary.totalHt()).isEqualByComparingTo("191.00");
            assertThat(summary.totalTax()).isEqualByComparingTo("19.10");
            assertThat(summary.totalTtc()).isEqualByComparingTo("210.10");
            assertThat(summary.currency()).isEqualTo("EUR");
            assertThat(summary.invoiceCount()).isEqualTo(2);
        }
    }

    @Nested
    class GetMonthlyVatSummary {

        @Test
        void shouldCalculateCorrectPeriodForMonth() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.getCountryCode()).thenReturn("FR");

            when(invoiceRepository.findByOrganizationIdAndDateRange(
                eq(1L),
                eq(LocalDate.of(2026, 2, 1)),
                eq(LocalDate.of(2026, 2, 28))))
                .thenReturn(List.of());

            VatSummaryDto summary = reportingService.getMonthlyVatSummary(2026, 2);

            assertThat(summary.period()).contains("2026-02-01");
            assertThat(summary.period()).contains("2026-02-28");
        }
    }

    @Nested
    class GetQuarterlyVatSummary {

        @Test
        void shouldCalculateQ1Period() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.getCountryCode()).thenReturn("FR");

            when(invoiceRepository.findByOrganizationIdAndDateRange(
                eq(1L),
                eq(LocalDate.of(2026, 1, 1)),
                eq(LocalDate.of(2026, 3, 31))))
                .thenReturn(List.of());

            VatSummaryDto summary = reportingService.getQuarterlyVatSummary(2026, 1);

            assertThat(summary.period()).contains("2026-01-01");
            assertThat(summary.period()).contains("2026-03-31");
        }

        @Test
        void shouldCalculateQ4Period() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.getCountryCode()).thenReturn("FR");

            when(invoiceRepository.findByOrganizationIdAndDateRange(
                eq(1L),
                eq(LocalDate.of(2026, 10, 1)),
                eq(LocalDate.of(2026, 12, 31))))
                .thenReturn(List.of());

            VatSummaryDto summary = reportingService.getQuarterlyVatSummary(2026, 4);

            assertThat(summary.period()).contains("2026-10-01");
            assertThat(summary.period()).contains("2026-12-31");
        }
    }

    @Nested
    class GetAnnualVatSummary {

        @Test
        void shouldCalculateFullYearPeriod() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(1L);
            when(tenantContext.getCountryCode()).thenReturn("FR");

            when(invoiceRepository.findByOrganizationIdAndDateRange(
                eq(1L),
                eq(LocalDate.of(2026, 1, 1)),
                eq(LocalDate.of(2026, 12, 31))))
                .thenReturn(List.of());

            VatSummaryDto summary = reportingService.getAnnualVatSummary(2026);

            assertThat(summary.period()).contains("2026-01-01");
            assertThat(summary.period()).contains("2026-12-31");
        }
    }
}
