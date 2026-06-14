package com.clenzy.fiscal.einvoicing.francepdp;

import com.clenzy.model.Invoice;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * Génère le XML Factur-X (CrossIndustryInvoice / CII, profil EN 16931 — sous-ensemble)
 * à partir d'une facture NF Clenzy (CLZ-P0-19).
 *
 * <p>Le XML est destiné à être embarqué dans un PDF/A-3 (embarquement iText =
 * sous-tâche reportée, HORS-PERIMETRE) puis transmis via une PDP. Tous les champs
 * texte sont échappés (XML-safe). La conformité EN 16931 stricte (ordre/champs
 * obligatoires complets) sera durcie lors du branchement PDP réel.</p>
 */
@Component
public class FacturXCiiBuilder {

    private static final DateTimeFormatter CII_DATE = DateTimeFormatter.ofPattern("yyyyMMdd");
    /** Identifiant de spécification Factur-X « EN 16931 ». */
    private static final String GUIDELINE = "urn:cen.eu:en16931:2017";
    /** Code type document : 380 = facture commerciale. */
    private static final String TYPE_CODE_INVOICE = "380";

    public String build(Invoice invoice) {
        String currency = (invoice.getCurrency() != null && !invoice.getCurrency().isBlank())
            ? invoice.getCurrency() : "EUR";
        LocalDate date = invoice.getInvoiceDate() != null ? invoice.getInvoiceDate() : LocalDate.now();
        String issueDate = date.format(CII_DATE);
        String ht = amount(invoice.getTotalHt());
        String tax = amount(invoice.getTotalTax());
        String ttc = amount(invoice.getTotalTtc());

        StringBuilder sb = new StringBuilder(1024);
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<rsm:CrossIndustryInvoice")
          .append(" xmlns:rsm=\"urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100\"")
          .append(" xmlns:ram=\"urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100\"")
          .append(" xmlns:udt=\"urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100\">\n");
        sb.append("  <rsm:ExchangedDocumentContext>\n")
          .append("    <ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>").append(GUIDELINE)
          .append("</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>\n")
          .append("  </rsm:ExchangedDocumentContext>\n");
        sb.append("  <rsm:ExchangedDocument>\n")
          .append("    <ram:ID>").append(esc(invoice.getInvoiceNumber())).append("</ram:ID>\n")
          .append("    <ram:TypeCode>").append(TYPE_CODE_INVOICE).append("</ram:TypeCode>\n")
          .append("    <ram:IssueDateTime><udt:DateTimeString format=\"102\">").append(issueDate)
          .append("</udt:DateTimeString></ram:IssueDateTime>\n")
          .append("  </rsm:ExchangedDocument>\n");
        sb.append("  <rsm:SupplyChainTradeTransaction>\n");
        sb.append("    <ram:ApplicableHeaderTradeAgreement>\n")
          .append(party("SellerTradeParty", invoice.getSellerName(), invoice.getSellerTaxId()))
          .append(party("BuyerTradeParty", invoice.getBuyerName(), invoice.getBuyerTaxId()))
          .append("    </ram:ApplicableHeaderTradeAgreement>\n");
        sb.append("    <ram:ApplicableHeaderTradeDelivery/>\n");
        sb.append("    <ram:ApplicableHeaderTradeSettlement>\n")
          .append("      <ram:InvoiceCurrencyCode>").append(esc(currency)).append("</ram:InvoiceCurrencyCode>\n")
          .append("      <ram:ApplicableTradeTax>\n")
          .append("        <ram:CalculatedAmount>").append(tax).append("</ram:CalculatedAmount>\n")
          .append("        <ram:TypeCode>VAT</ram:TypeCode>\n")
          .append("        <ram:BasisAmount>").append(ht).append("</ram:BasisAmount>\n")
          .append("      </ram:ApplicableTradeTax>\n")
          .append("      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>\n")
          .append("        <ram:LineTotalAmount>").append(ht).append("</ram:LineTotalAmount>\n")
          .append("        <ram:TaxBasisTotalAmount>").append(ht).append("</ram:TaxBasisTotalAmount>\n")
          .append("        <ram:TaxTotalAmount currencyID=\"").append(esc(currency)).append("\">").append(tax)
          .append("</ram:TaxTotalAmount>\n")
          .append("        <ram:GrandTotalAmount>").append(ttc).append("</ram:GrandTotalAmount>\n")
          .append("        <ram:DuePayableAmount>").append(ttc).append("</ram:DuePayableAmount>\n")
          .append("      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>\n")
          .append("    </ram:ApplicableHeaderTradeSettlement>\n");
        sb.append("  </rsm:SupplyChainTradeTransaction>\n");
        sb.append("</rsm:CrossIndustryInvoice>\n");
        return sb.toString();
    }

    private String party(String element, String name, String taxId) {
        StringBuilder p = new StringBuilder();
        p.append("      <ram:").append(element).append(">\n")
         .append("        <ram:Name>").append(esc(name)).append("</ram:Name>\n");
        if (taxId != null && !taxId.isBlank()) {
            p.append("        <ram:SpecifiedTaxRegistration><ram:ID schemeID=\"VA\">")
             .append(esc(taxId)).append("</ram:ID></ram:SpecifiedTaxRegistration>\n");
        }
        p.append("      </ram:").append(element).append(">\n");
        return p.toString();
    }

    private String amount(BigDecimal value) {
        return (value != null ? value : BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    private String esc(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&apos;");
    }
}
