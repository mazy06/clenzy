package com.clenzy.fiscal.einvoicing.moroccodgi;

import com.clenzy.model.Invoice;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * Mappe une facture Clenzy vers un XML UBL 2.1 pour la clearance DGI Maroc (Simpl-TVA) — CLZ-P0-MA.
 *
 * <p>Le Maroc adopte un modèle CTC (clearance / pré-validation) au format UBL 2.1 via le portail
 * centralisé Simpl-TVA. Ce mapper génère la structure de données (devise MAD par défaut, TVA 20%,
 * ICE vendeur en {@code CompanyID}). Le raccordement réel à l'API Simpl-TVA (auth, soumission,
 * attente de clearance) relève de {@link DgiClearanceClient} (différé tant que l'API DGI n'est pas
 * publiée). Champs texte échappés (XML-safe).</p>
 */
@Component
public class MoroccoUblMapper {

    private static final DateTimeFormatter ISO_DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    /** Code type document : 388 = facture fiscale (UBL standard). */
    private static final String INVOICE_TYPE_CODE = "388";
    private static final String DEFAULT_CURRENCY = "MAD";

    public String toUbl(Invoice invoice) {
        String currency = (invoice.getCurrency() != null && !invoice.getCurrency().isBlank())
            ? invoice.getCurrency() : DEFAULT_CURRENCY;
        String issueDate = (invoice.getInvoiceDate() != null ? invoice.getInvoiceDate() : LocalDate.now())
            .format(ISO_DATE);
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
        // ICE (Identifiant Commun de l'Entreprise) du vendeur porté par le tax id.
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
