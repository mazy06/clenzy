package com.clenzy.service;

import com.clenzy.model.Invoice;
import com.clenzy.model.InvoiceLine;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Currency;
import java.util.Map;

/**
 * Service de generation de PDF de factures.
 *
 * Fournit le contenu canonique au moteur PDF commun Baitly.
 * L'archivage est assuré par BaitlyInvoicePdfStore, partagé avec Documents.
 */
@Service
public class InvoicePdfService {

    private static final Logger log = LoggerFactory.getLogger(InvoicePdfService.class);
    private static final DateTimeFormatter DATE_FR = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final Map<String, String> CURRENCY_SYMBOLS = Map.of(
        "EUR", "€", "MAD", "MAD", "SAR", "SAR", "USD", "$", "GBP", "£"
    );

    private final BaitlyPdfEngine engine;
    public InvoicePdfService(BaitlyPdfEngine engine) { this.engine=engine; }

    /**
     * Rend la facture ; le demandeur archive ensuite ce fichier exact.
     *
     * @param invoice Facture avec ses lignes chargees
     * @return Contenu du PDF en bytes
     */
    public byte[] generatePdf(Invoice invoice) {
        log.info("Generating PDF for invoice {} (id={})", invoice.getInvoiceNumber(), invoice.getId());

        String html = renderHtml(invoice);
        return engine.html(html);
    }

    /** Aperçu sans lecture de dossier réel, sans numéro légal et sans archivage. */
    public byte[] preview() {
        Invoice invoice = new Invoice();
        invoice.setInvoiceNumber("EXEMPLE-001");
        invoice.setInvoiceDate(LocalDate.of(2026, 6, 15));
        invoice.setDueDate(LocalDate.of(2026, 7, 15));
        invoice.setSellerName("Conciergerie Horizon (exemple)");
        invoice.setSellerAddress("8 avenue des Horizons\n00000 Ville Exemple (adresse fictive)");
        invoice.setSellerTaxId("DÉMO · NON ATTRIBUÉ");
        invoice.setBuyerName("Camille Exemple");
        invoice.setBuyerAddress("12 allée des Nuages\n00000 Ville Exemple (adresse fictive)");
        invoice.setCurrency("EUR");
        var lines = new java.util.ArrayList<InvoiceLine>();
        String[] descriptions = { "Nettoyage et préparation du logement", "Préparation des lits et du linge", "Réassort des produits d’accueil" };
        String[] quantities = { "3", "2", "1" };
        String[] prices = { "35.00", "15.00", "15.00" };
        for (int index = 0; index < descriptions.length; index++) {
            InvoiceLine line = new InvoiceLine();
            line.setLineNumber(index + 1); line.setDescription(descriptions[index]);
            line.setQuantity(new BigDecimal(quantities[index])); line.setUnitPriceHt(new BigDecimal(prices[index]));
            line.setTaxRate(new BigDecimal("0.20"));
            line.setTotalHt(line.getQuantity().multiply(line.getUnitPriceHt()));
            line.setTaxAmount(line.getTotalHt().multiply(line.getTaxRate()));
            line.setTotalTtc(line.getTotalHt().add(line.getTaxAmount()));
            lines.add(line);
        }
        invoice.setLines(lines);
        invoice.setTotalHt(new BigDecimal("150.00"));
        invoice.setTotalTax(new BigDecimal("30.00"));
        invoice.setTotalTtc(new BigDecimal("180.00"));
        invoice.setLegalMentions("APERÇU DE MISE EN PAGE · AUCUNE VALEUR LÉGALE. Identités, coordonnées, montants et taxes fictifs. Aucun paiement ni engagement.");
        return engine.html(BaitlyPreviewData.watermark(renderHtml(invoice)));
    }

    /**
     * Rend la facture en HTML professionnel, pret pour conversion PDF.
     */
    private String renderHtml(Invoice invoice) {
        StringBuilder sb = new StringBuilder();
        sb.append("<!DOCTYPE html><html lang=\"fr\"><head><meta charset=\"UTF-8\">");
        sb.append("<title>").append(esc(invoice.getSellerName())).append(" · ")
                .append(invoice.getStatus() == com.clenzy.model.InvoiceStatus.CREDIT_NOTE ? "Avoir " : "Facture ")
                .append(esc(invoice.getInvoiceNumber())).append("</title>");
        sb.append("<style>");
        sb.append(CSS);
        sb.append("</style></head><body>");

        // En-tete
        sb.append("<div class=\"header\">");
        sb.append("<div class=\"seller\">");
        if (invoice.getSellerName() != null) {
            sb.append("<h2>").append(esc(invoice.getSellerName())).append("</h2>");
        }
        if (invoice.getSellerAddress() != null) {
            sb.append("<p>").append(esc(invoice.getSellerAddress()).replace("\n", "<br>")).append("</p>");
        }
        if (invoice.getSellerTaxId() != null) {
            sb.append("<p class=\"tax-id\">TVA: ").append(esc(invoice.getSellerTaxId())).append("</p>");
        }
        sb.append("</div>");

        sb.append("<div class=\"invoice-info\">");
        sb.append(invoice.getStatus() == com.clenzy.model.InvoiceStatus.CREDIT_NOTE
            ? "<h1>AVOIR</h1>" : "<h1>FACTURE</h1>");
        sb.append("<table class=\"info-table\">");
        sb.append("<tr><td>Numero</td><td><strong>").append(esc(invoice.getInvoiceNumber())).append("</strong></td></tr>");
        sb.append("<tr><td>Date</td><td>").append(formatDate(invoice.getInvoiceDate())).append("</td></tr>");
        if (invoice.getDueDate() != null) {
            sb.append("<tr><td>Echeance</td><td>").append(formatDate(invoice.getDueDate())).append("</td></tr>");
        }
        sb.append("<tr><td>Devise</td><td>").append(esc(invoice.getCurrency())).append("</td></tr>");
        sb.append("</table>");
        sb.append("</div></div>");

        // Acheteur
        sb.append("<div class=\"buyer\">");
        sb.append("<h3>Facture a</h3>");
        if (invoice.getBuyerName() != null) {
            sb.append("<p><strong>").append(esc(invoice.getBuyerName())).append("</strong></p>");
        }
        if (invoice.getBuyerAddress() != null) {
            sb.append("<p>").append(esc(invoice.getBuyerAddress()).replace("\n", "<br>")).append("</p>");
        }
        if (invoice.getBuyerTaxId() != null) {
            sb.append("<p class=\"tax-id\">TVA: ").append(esc(invoice.getBuyerTaxId())).append("</p>");
        }
        sb.append("</div>");

        // Lignes
        sb.append("<table class=\"lines\">");
        sb.append("<thead><tr>");
        sb.append("<th>#</th><th>Description</th><th>Qte</th>");
        sb.append("<th>PU HT</th><th>TVA %</th><th>TVA</th>");
        sb.append("<th>Total HT</th><th>Total TTC</th>");
        sb.append("</tr></thead><tbody>");

        String cur = invoice.getCurrency() != null ? invoice.getCurrency() : "EUR";

        if (invoice.getLines() != null) {
            for (InvoiceLine line : invoice.getLines()) {
                sb.append("<tr>");
                sb.append("<td class=\"center\">").append(line.getLineNumber()).append("</td>");
                sb.append("<td>").append(esc(line.getDescription())).append("</td>");
                sb.append("<td class=\"right\">").append(formatQty(line.getQuantity())).append("</td>");
                sb.append("<td class=\"right\">").append(formatMoney(line.getUnitPriceHt(), cur)).append("</td>");
                sb.append("<td class=\"right\">").append(formatPercent(line.getTaxRate())).append("</td>");
                sb.append("<td class=\"right\">").append(formatMoney(line.getTaxAmount(), cur)).append("</td>");
                sb.append("<td class=\"right\">").append(formatMoney(line.getTotalHt(), cur)).append("</td>");
                sb.append("<td class=\"right\">").append(formatMoney(line.getTotalTtc(), cur)).append("</td>");
                sb.append("</tr>");
            }
        }
        sb.append("</tbody></table>");

        // Totaux
        sb.append("<div class=\"totals\">");
        sb.append("<table class=\"totals-table\">");
        sb.append("<tr><td>Total HT</td><td>").append(formatMoney(invoice.getTotalHt(), cur)).append("</td></tr>");
        sb.append("<tr><td>Total TVA</td><td>").append(formatMoney(invoice.getTotalTax(), cur)).append("</td></tr>");
        sb.append("<tr class=\"grand-total\"><td>Total TTC</td><td>").append(formatMoney(invoice.getTotalTtc(), cur)).append("</td></tr>");
        sb.append("</table></div>");

        // Mentions legales
        if (invoice.getLegalMentions() != null && !invoice.getLegalMentions().isBlank()) {
            sb.append("<div class=\"legal\"><p>").append(esc(invoice.getLegalMentions())).append("</p></div>");
        }

        sb.append("</body></html>");
        return sb.toString();
    }

    // --- Formatters ---

    private String formatDate(LocalDate date) {
        return date != null ? date.format(DATE_FR) : "";
    }

    private String formatMoney(BigDecimal amount, String currencyCode) {
        if (amount == null) return "0,00 " + getCurrencySymbol(currencyCode);
        var formatter=java.text.NumberFormat.getNumberInstance(java.util.Locale.FRANCE);
        formatter.setMinimumFractionDigits(2);
        formatter.setMaximumFractionDigits(2);
        String formatted = formatter.format(amount);
        return formatted + " " + getCurrencySymbol(currencyCode);
    }

    private String getCurrencySymbol(String currencyCode) {
        if (currencyCode == null) return "€";
        String symbol = CURRENCY_SYMBOLS.get(currencyCode.toUpperCase());
        if (symbol != null) return symbol;
        try {
            return Currency.getInstance(currencyCode.toUpperCase()).getSymbol();
        } catch (IllegalArgumentException e) {
            return currencyCode;
        }
    }

    private String formatPercent(BigDecimal rate) {
        if (rate == null || rate.compareTo(BigDecimal.ZERO) == 0) return "-";
        return rate.multiply(BigDecimal.valueOf(100)).stripTrailingZeros().toPlainString() + "%";
    }

    private String formatQty(BigDecimal qty) {
        if (qty == null) return "1";
        return qty.stripTrailingZeros().toPlainString();
    }

    private String esc(String s) {
        if (s == null) return "";
        return com.clenzy.util.StringUtils.escapeHtml(s);
    }

    // --- CSS ---

    private static final String CSS = """
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #1e293b; padding: 40px; }
        .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .seller h2 { font-size: 18px; color: #0f172a; margin-bottom: 6px; }
        .seller p { color: #475569; line-height: 1.5; }
        .tax-id { font-size: 10px; color: #526979; margin-top: 4px; }
        .invoice-info { text-align: right; }
        .invoice-info h1 { font-size: 28px; color: #0f172a; letter-spacing: 2px; margin-bottom: 12px; }
        .info-table { margin-left: auto; }
        .info-table td { padding: 2px 0; }
        .info-table td:first-child { color: #64748b; padding-right: 16px; text-align: right; }
        .info-table td:last-child { text-align: right; }
        .buyer { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin-bottom: 30px; max-width: 300px; }
        .buyer h3 { font-size: 10px; text-transform: uppercase; color: #526979; letter-spacing: 1px; margin-bottom: 8px; }
        .buyer p { line-height: 1.5; }
        .lines { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .lines thead { background: #0f172a; color: white; }
        .lines th { padding: 10px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
        .lines td { padding: 10px 8px; border-bottom: 1px solid #e2e8f0; }
        .lines tbody tr:last-child td { border-bottom: 2px solid #0f172a; }
        .right { text-align: right; }
        .center { text-align: center; }
        .totals { display: flex; justify-content: flex-end; margin-bottom: 30px; }
        .totals-table { min-width: 250px; }
        .totals-table td { padding: 6px 0; }
        .totals-table td:first-child { color: #64748b; padding-right: 24px; }
        .totals-table td:last-child { text-align: right; font-weight: 500; }
        .grand-total td { font-size: 16px; font-weight: 700; color: #0f172a; border-top: 2px solid #0f172a; padding-top: 10px; }
        .legal { border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 20px; }
        .legal p { font-size: 9px; color: #526979; line-height: 1.5; }
    """;
}
