package com.clenzy.service;

import com.clenzy.dto.VatSummaryDto;
import com.clenzy.dto.VatSummaryDto.VatBreakdownDto;
import com.clenzy.fiscal.MoneyUtils;
import com.clenzy.model.Invoice;
import com.clenzy.model.InvoiceLine;
import com.clenzy.model.InvoiceStatus;
import com.clenzy.repository.InvoiceRepository;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;

/**
 * Service de reporting fiscal.
 *
 * Responsabilites :
 * - Resume TVA par periode (mensuel/trimestriel/annuel)
 * - Ventilation par taux de TVA et categorie
 * - Consolidation multi-devises vers la devise de base
 * - Preparation des donnees pour les declarations fiscales
 */
@Service
@Transactional(readOnly = true)
public class FiscalReportingService {

    private static final Logger log = LoggerFactory.getLogger(FiscalReportingService.class);

    private final InvoiceRepository invoiceRepository;
    private final CurrencyConverterService currencyConverter;
    private final TenantContext tenantContext;

    public FiscalReportingService(InvoiceRepository invoiceRepository,
                                   CurrencyConverterService currencyConverter,
                                   TenantContext tenantContext) {
        this.invoiceRepository = invoiceRepository;
        this.currencyConverter = currencyConverter;
        this.tenantContext = tenantContext;
    }

    /**
     * Resume TVA pour une periode donnee.
     *
     * @param from Date de debut
     * @param to   Date de fin
     * @return Resume avec ventilation par taux
     */
    public VatSummaryDto getVatSummary(LocalDate from, LocalDate to) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        String countryCode = tenantContext.getCountryCode();
        String currency = tenantContext.getDefaultCurrency();

        List<Invoice> invoices = invoiceRepository.findByOrganizationIdAndDateRange(orgId, from, to);

        // Filtrer : uniquement ISSUED et PAID (pas DRAFT ni CANCELLED)
        List<Invoice> activeInvoices = invoices.stream()
            .filter(inv -> inv.getStatus() == InvoiceStatus.ISSUED
                        || inv.getStatus() == InvoiceStatus.PAID
                        || inv.getStatus() == InvoiceStatus.CREDIT_NOTE)
            .toList();

        BigDecimal totalHt = BigDecimal.ZERO;
        BigDecimal totalTax = BigDecimal.ZERO;
        BigDecimal totalTtc = BigDecimal.ZERO;

        // Ventilation par (taxCategory, taxRate)
        Map<String, VatAccumulator> breakdownMap = new LinkedHashMap<>();

        for (Invoice invoice : activeInvoices) {
            // Conversion multi-devise : si la facture n'est pas dans la devise de reporting,
            // convertir les montants vers la devise de base de l'organisation
            boolean needsConversion = !currency.equalsIgnoreCase(invoice.getCurrency());
            LocalDate conversionDate = invoice.getInvoiceDate();

            BigDecimal invHt = needsConversion
                ? currencyConverter.convertToBase(invoice.getTotalHt(), invoice.getCurrency(), currency, conversionDate)
                : invoice.getTotalHt();
            BigDecimal invTax = needsConversion
                ? currencyConverter.convertToBase(invoice.getTotalTax(), invoice.getCurrency(), currency, conversionDate)
                : invoice.getTotalTax();
            BigDecimal invTtc = needsConversion
                ? currencyConverter.convertToBase(invoice.getTotalTtc(), invoice.getCurrency(), currency, conversionDate)
                : invoice.getTotalTtc();

            totalHt = totalHt.add(invHt);
            totalTax = totalTax.add(invTax);
            totalTtc = totalTtc.add(invTtc);

            for (InvoiceLine line : invoice.getLines()) {
                BigDecimal lineHt = needsConversion
                    ? currencyConverter.convertToBase(line.getTotalHt(), invoice.getCurrency(), currency, conversionDate)
                    : line.getTotalHt();
                BigDecimal lineTax = needsConversion
                    ? currencyConverter.convertToBase(line.getTaxAmount(), invoice.getCurrency(), currency, conversionDate)
                    : line.getTaxAmount();

                String key = line.getTaxCategory() + "|" + line.getTaxRate().toPlainString();
                breakdownMap.computeIfAbsent(key, k -> new VatAccumulator(
                    line.getTaxCategory(), line.getTaxRate()
                ));
                VatAccumulator acc = breakdownMap.get(key);
                acc.baseAmount = acc.baseAmount.add(lineHt);
                acc.taxAmount = acc.taxAmount.add(lineTax);
                acc.lineCount++;
            }
        }

        List<VatBreakdownDto> breakdown = breakdownMap.values().stream()
            .map(acc -> new VatBreakdownDto(
                acc.taxCategory,
                formatTaxName(acc.taxCategory, acc.taxRate),
                acc.taxRate,
                MoneyUtils.round(acc.baseAmount),
                MoneyUtils.round(acc.taxAmount),
                acc.lineCount
            ))
            .sorted(Comparator.comparing(VatBreakdownDto::taxRate).reversed())
            .toList();

        String period = formatPeriod(from, to);

        log.info("VAT summary for org={}, period={}: {} invoices, totalTTC={}",
            orgId, period, activeInvoices.size(), MoneyUtils.round(totalTtc));

        return new VatSummaryDto(
            countryCode,
            currency,
            period,
            MoneyUtils.round(totalHt),
            MoneyUtils.round(totalTax),
            MoneyUtils.round(totalTtc),
            activeInvoices.size(),
            breakdown
        );
    }

    /**
     * Resume TVA mensuel.
     */
    public VatSummaryDto getMonthlyVatSummary(int year, int month) {
        YearMonth ym = YearMonth.of(year, month);
        return getVatSummary(ym.atDay(1), ym.atEndOfMonth());
    }

    /**
     * Resume TVA trimestriel.
     */
    public VatSummaryDto getQuarterlyVatSummary(int year, int quarter) {
        int startMonth = (quarter - 1) * 3 + 1;
        LocalDate from = LocalDate.of(year, startMonth, 1);
        LocalDate to = from.plusMonths(3).minusDays(1);
        return getVatSummary(from, to);
    }

    /**
     * Resume TVA annuel.
     */
    public VatSummaryDto getAnnualVatSummary(int year) {
        return getVatSummary(
            LocalDate.of(year, 1, 1),
            LocalDate.of(year, 12, 31)
        );
    }

    // --- Helpers ---

    private String formatPeriod(LocalDate from, LocalDate to) {
        return from.toString() + " / " + to.toString();
    }

    private String formatTaxName(String category, BigDecimal rate) {
        if (rate.compareTo(BigDecimal.ZERO) == 0) {
            return category + " (exonere)";
        }
        BigDecimal pct = rate.multiply(BigDecimal.valueOf(100)).stripTrailingZeros();
        return category + " " + pct.toPlainString() + "%";
    }

    private static class VatAccumulator {
        String taxCategory;
        BigDecimal taxRate;
        BigDecimal baseAmount = BigDecimal.ZERO;
        BigDecimal taxAmount = BigDecimal.ZERO;
        int lineCount = 0;

        VatAccumulator(String taxCategory, BigDecimal taxRate) {
            this.taxCategory = taxCategory;
            this.taxRate = taxRate;
        }
    }
}
