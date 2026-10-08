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
        String country=BaitlyFiscalJurisdictions.country(tenantContext.getCountryCode());
        return getVatSummary(from,to,country,switch(country){case "MA"->"MAD";case "SA"->"SAR";default->"EUR";});
    }

    public VatSummaryDto getVatSummary(LocalDate from,LocalDate to,String country) {
        if(country==null || country.isBlank())return getVatSummary(from,to);
        country=BaitlyFiscalJurisdictions.country(country);
        return getVatSummary(from,to,country,switch(country){case "MA"->"MAD";case "SA"->"SAR";default->"EUR";});
    }

    /** Ventilation sans addition de pays ni conversion implicite de leurs déclarations. */
    public List<VatSummaryDto> getVatSummariesByCountry(LocalDate from,LocalDate to) {
        var invoices=invoiceRepository.findByOrganizationIdAndDateRange(tenantContext.getRequiredOrganizationId(),from,to);
        var scopes=new TreeMap<String,String[]>();
        for(var invoice:invoices) {
            if(!isCanonicalFiscalDocument(invoice))continue;
            String country=BaitlyFiscalJurisdictions.country(invoice.getCountryCode());
            String currency=invoice.getCurrency();
            if(currency==null)throw new IllegalStateException("Devise de facture à rapprocher avant reporting");
            currency=currency.toUpperCase(Locale.ROOT);
            scopes.put(country+":"+currency,new String[]{country,currency});
        }
        return scopes.values().stream().map(scope->summarize(from,to,scope[0],scope[1],invoices.stream()
                .filter(i->scope[1].equalsIgnoreCase(i.getCurrency())).toList())).toList();
    }

    public VatSummaryDto getVatSummary(LocalDate from,LocalDate to,String countryCode,String currency) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        List<Invoice> invoices = invoiceRepository.findByOrganizationIdAndDateRange(orgId, from, to);
        return summarize(from,to,BaitlyFiscalJurisdictions.country(countryCode),currency,invoices);
    }

    private VatSummaryDto summarize(LocalDate from,LocalDate to,String countryCode,String currency,List<Invoice> invoices) {
        return summarize(from,to,countryCode,currency,invoices,true);
    }

    private VatSummaryDto summarize(LocalDate from,LocalDate to,String countryCode,String currency,List<Invoice> invoices,boolean splitIssuers) {
        Long orgId=tenantContext.getRequiredOrganizationId();
        if(from==null || to==null || to.isBefore(from))throw new IllegalArgumentException("Période fiscale invalide");

        // Pièces émises, originaux annulés et avoirs à leur date ; aucun duplicata.
        List<Invoice> activeInvoices = invoices.stream()
            .filter(FiscalReportingService::isCanonicalFiscalDocument)
            .filter(inv->countryCode.equals(BaitlyFiscalJurisdictions.country(inv.getCountryCode())))
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

        List<VatSummaryDto.IssuerSummary> issuers=List.of();
        if(splitIssuers) {
            var groups=new TreeMap<String,List<Invoice>>();
            for(var invoice:activeInvoices) {
                String key=issuerIdentity(invoice)+":"+invoice.getCurrency();
                groups.computeIfAbsent(key,ignored->new ArrayList<>()).add(invoice);
            }
            issuers=groups.entrySet().stream().map(entry->{
                var first=entry.getValue().getFirst();
                return new VatSummaryDto.IssuerSummary(entry.getKey(),first.getSellerName(),
                    summarize(from,to,countryCode,first.getCurrency(),entry.getValue(),false));
            }).toList();
        }
        return new VatSummaryDto(
            countryCode,
            currency,
            period,
            MoneyUtils.round(totalHt),
            MoneyUtils.round(totalTax),
            MoneyUtils.round(totalTtc),
            activeInvoices.size(),
            breakdown,
            issuers
        );
    }

    private static String issuerIdentity(Invoice invoice) {
        if(invoice.getIssuerKey()!=null)return invoice.getIssuerKey();
        // Anciennes pièces : identité figée dans le document, jamais celle du profil actuel.
        String identity=invoice.getCountryCode()+":"+Objects.toString(invoice.getSellerTaxId(),"").replaceAll("[\\s.-]", "").toUpperCase(Locale.ROOT);
        if(invoice.getSellerTaxId()==null || invoice.getSellerTaxId().isBlank())
            identity+=":"+Objects.toString(invoice.getSellerName(),"")+":"+Objects.toString(invoice.getSellerAddress(),"");
        return BaitlyInvoiceChecks.hash(identity.getBytes(java.nio.charset.StandardCharsets.UTF_8));
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

    /** L'annulation n'efface pas la vente : l'avoir compte à sa propre date. */
    static boolean isCanonicalFiscalDocument(Invoice invoice) {
        return invoice.getDuplicateOfId()==null && invoice.getInvoiceNumber()!=null
            && !invoice.getInvoiceNumber().startsWith("DRAFT")
            && Set.of(InvoiceStatus.ISSUED,InvoiceStatus.SENT,InvoiceStatus.OVERDUE,
                InvoiceStatus.PAID,InvoiceStatus.CANCELLED,InvoiceStatus.CREDIT_NOTE).contains(invoice.getStatus());
    }

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
