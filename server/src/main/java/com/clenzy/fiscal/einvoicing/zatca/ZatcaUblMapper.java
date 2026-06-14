package com.clenzy.fiscal.einvoicing.zatca;

import com.clenzy.model.Invoice;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * Mappe une facture Clenzy vers un XML UBL 2.1 ZATCA (sous-ensemble) — CLZ-P0-20.
 *
 * <p>Génère la structure de données. La signature XAdES, le hash, le QR (tags 6-9), la
 * chaîne PIH/ICV et l'onboarding CSID relèvent de la phase cryptographique (HP-10,
 * {@code tech/ZATCA-implementation-spec.md}). Champs texte échappés (XML-safe).</p>
 */
@Component
public class ZatcaUblMapper {

    private static final DateTimeFormatter ISO_DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    /** Code type document KSA : 388 = facture fiscale. */
    private static final String INVOICE_TYPE_CODE = "388";

    public String toUbl(Invoice invoice) {
        String currency = (invoice.getCurrency() != null && !invoice.getCurrency().isBlank())
            ? invoice.getCurrency() : "SAR";
        String issueDate = (invoice.getInvoiceDate() != null ? invoice.getInvoiceDate() : LocalDate.now()).format(ISO_DATE);
        String ht = amount(invoice.getTotalHt());
        String tax = amount(invoice.getTotalTax());
        String ttc = amount(invoice.getTotalTtc());

        StringBuilder sb = new StringBuilder(1024);
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<Invoice xmlns=\"urn:oasis:names:specification:ubl:schema:xsd:Invoice-2\"")
          .append(" xmlns:cac=\"urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2\"")
          .append(" xmlns:cbc=\"urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2\">\n");
        sb.append("  <cbc:ID>").append(esc(invoice.getInvoiceNumber())).append("</cbc:ID>\n");
        sb.append("  <cbc:IssueDate>").append(issueDate).append("</cbc:IssueDate>\n");
        sb.append("  <cbc:InvoiceTypeCode>").append(INVOICE_TYPE_CODE).append("</cbc:InvoiceTypeCode>\n");
        sb.append("  <cbc:DocumentCurrencyCode>").append(esc(currency)).append("</cbc:DocumentCurrencyCode>\n");
        sb.append(party("AccountingSupplierParty", invoice.getSellerName(), invoice.getSellerTaxId()));
        sb.append(party("AccountingCustomerParty", invoice.getBuyerName(), invoice.getBuyerTaxId()));
        sb.append("  <cac:TaxTotal>\n")
          .append("    <cbc:TaxAmount currencyID=\"").append(esc(currency)).append("\">").append(tax)
          .append("</cbc:TaxAmount>\n")
          .append("  </cac:TaxTotal>\n");
        sb.append("  <cac:LegalMonetaryTotal>\n")
          .append("    <cbc:LineExtensionAmount currencyID=\"").append(esc(currency)).append("\">").append(ht)
          .append("</cbc:LineExtensionAmount>\n")
          .append("    <cbc:TaxExclusiveAmount currencyID=\"").append(esc(currency)).append("\">").append(ht)
          .append("</cbc:TaxExclusiveAmount>\n")
          .append("    <cbc:TaxInclusiveAmount currencyID=\"").append(esc(currency)).append("\">").append(ttc)
          .append("</cbc:TaxInclusiveAmount>\n")
          .append("    <cbc:PayableAmount currencyID=\"").append(esc(currency)).append("\">").append(ttc)
          .append("</cbc:PayableAmount>\n")
          .append("  </cac:LegalMonetaryTotal>\n");
        sb.append("</Invoice>\n");
        return sb.toString();
    }

    private String party(String element, String name, String taxId) {
        StringBuilder p = new StringBuilder();
        p.append("  <cac:").append(element).append(">\n")
         .append("    <cac:Party>\n")
         .append("      <cac:PartyLegalEntity><cbc:RegistrationName>").append(esc(name))
         .append("</cbc:RegistrationName></cac:PartyLegalEntity>\n");
        if (taxId != null && !taxId.isBlank()) {
            p.append("      <cac:PartyTaxScheme><cbc:CompanyID>").append(esc(taxId))
             .append("</cbc:CompanyID></cac:PartyTaxScheme>\n");
        }
        p.append("    </cac:Party>\n")
         .append("  </cac:").append(element).append(">\n");
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
