package com.clenzy.service;

import com.clenzy.exception.DocumentGenerationException;
import com.clenzy.model.Invoice;
import com.clenzy.model.InvoiceLine;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * Service de generation de PDF de factures.
 *
 * Utilise Gotenberg (endpoint Chromium) pour convertir le HTML genere en PDF.
 * Reutilise la meme instance Gotenberg que le moteur de documents existant.
 *
 * Pipeline :
 * 1. Rendre le HTML a partir des donnees de la facture
 * 2. POST /forms/chromium/convert/html → PDF
 * 3. Stocker via DocumentStorageService
 */
@Service
public class InvoicePdfService {

    private static final Logger log = LoggerFactory.getLogger(InvoicePdfService.class);
    private static final DateTimeFormatter DATE_FR = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final NumberFormat MONEY_FR;

    static {
        MONEY_FR = NumberFormat.getCurrencyInstance(Locale.FRANCE);
        MONEY_FR.setMinimumFractionDigits(2);
        MONEY_FR.setMaximumFractionDigits(2);
    }

    private final String gotenbergUrl;
    private final RestTemplate restTemplate;
    private final DocumentStorageService documentStorageService;

    public InvoicePdfService(
            @Value("${clenzy.libreoffice.url:http://clenzy-libreoffice:3000}") String gotenbergUrl,
            RestTemplate restTemplate,
            DocumentStorageService documentStorageService) {
        this.gotenbergUrl = gotenbergUrl;
        this.restTemplate = restTemplate;
        this.documentStorageService = documentStorageService;
    }

    /**
     * Genere le PDF d'une facture et le stocke.
     *
     * @param invoice Facture avec ses lignes chargees
     * @return Contenu du PDF en bytes
     */
    @CircuitBreaker(name = "gotenberg")
    @Retry(name = "gotenberg")
    public byte[] generatePdf(Invoice invoice) {
        log.info("Generating PDF for invoice {} (id={})", invoice.getInvoiceNumber(), invoice.getId());

        String html = renderHtml(invoice);
        byte[] pdfBytes = convertHtmlToPdf(html, invoice.getInvoiceNumber());

        // Stocker le PDF
        String filename = buildFilename(invoice);
        String storagePath = documentStorageService.store("FACTURE", filename, pdfBytes);
        log.info("Invoice PDF stored: {} ({} bytes, path={})",
            filename, pdfBytes.length, storagePath);

        return pdfBytes;
    }

    /**
     * Convertit du HTML en PDF via Gotenberg Chromium.
     */
    private byte[] convertHtmlToPdf(String html, String identifier) {
        try {
            String url = gotenbergUrl + "/forms/chromium/convert/html";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();

            // Fichier HTML principal
            ByteArrayResource htmlResource = new ByteArrayResource(
                    html.getBytes(StandardCharsets.UTF_8)) {
                @Override
                public String getFilename() {
                    return "index.html";
                }
            };
            body.add("files", htmlResource);

            // Options Gotenberg
            body.add("marginTop", "0.6");
            body.add("marginBottom", "0.6");
            body.add("marginLeft", "0.5");
            body.add("marginRight", "0.5");
            body.add("paperWidth", "8.27");  // A4
            body.add("paperHeight", "11.69");
            body.add("printBackground", "true");

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
            ResponseEntity<byte[]> response = restTemplate.exchange(
                url, HttpMethod.POST, requestEntity, byte[].class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                log.debug("PDF generated for {}: {} bytes", identifier, response.getBody().length);
                return response.getBody();
            }

            throw new DocumentGenerationException(
                "Gotenberg a retourne un statut non-200: " + response.getStatusCode());

        } catch (DocumentGenerationException e) {
            throw e;
        } catch (Exception e) {
            throw new DocumentGenerationException(
                "Erreur lors de la conversion HTML vers PDF: " + e.getMessage(), e);
        }
    }

    /**
     * Rend la facture en HTML professionnel, pret pour conversion PDF.
     */
    private String renderHtml(Invoice invoice) {
        StringBuilder sb = new StringBuilder();
        sb.append("<!DOCTYPE html><html lang=\"fr\"><head><meta charset=\"UTF-8\">");
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
        sb.append("<h1>FACTURE</h1>");
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

        if (invoice.getLines() != null) {
            for (InvoiceLine line : invoice.getLines()) {
                sb.append("<tr>");
                sb.append("<td class=\"center\">").append(line.getLineNumber()).append("</td>");
                sb.append("<td>").append(esc(line.getDescription())).append("</td>");
                sb.append("<td class=\"right\">").append(formatQty(line.getQuantity())).append("</td>");
                sb.append("<td class=\"right\">").append(formatMoney(line.getUnitPriceHt())).append("</td>");
                sb.append("<td class=\"right\">").append(formatPercent(line.getTaxRate())).append("</td>");
                sb.append("<td class=\"right\">").append(formatMoney(line.getTaxAmount())).append("</td>");
                sb.append("<td class=\"right\">").append(formatMoney(line.getTotalHt())).append("</td>");
                sb.append("<td class=\"right\">").append(formatMoney(line.getTotalTtc())).append("</td>");
                sb.append("</tr>");
            }
        }
        sb.append("</tbody></table>");

        // Totaux
        sb.append("<div class=\"totals\">");
        sb.append("<table class=\"totals-table\">");
        sb.append("<tr><td>Total HT</td><td>").append(formatMoney(invoice.getTotalHt())).append("</td></tr>");
        sb.append("<tr><td>Total TVA</td><td>").append(formatMoney(invoice.getTotalTax())).append("</td></tr>");
        sb.append("<tr class=\"grand-total\"><td>Total TTC</td><td>").append(formatMoney(invoice.getTotalTtc())).append("</td></tr>");
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

    private String formatMoney(BigDecimal amount) {
        if (amount == null) return "0,00";
        return String.format("%,.2f", amount).replace(",", " ").replace(".", ",");
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
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }

    private String buildFilename(Invoice invoice) {
        return "Facture_" + invoice.getInvoiceNumber().replace("/", "-")
            + "_" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")) + ".pdf";
    }

    // --- CSS ---

    private static final String CSS = """
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #1e293b; padding: 40px; }
        .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .seller h2 { font-size: 18px; color: #0f172a; margin-bottom: 6px; }
        .seller p { color: #475569; line-height: 1.5; }
        .tax-id { font-size: 10px; color: #94a3b8; margin-top: 4px; }
        .invoice-info { text-align: right; }
        .invoice-info h1 { font-size: 28px; color: #0f172a; letter-spacing: 2px; margin-bottom: 12px; }
        .info-table { margin-left: auto; }
        .info-table td { padding: 2px 0; }
        .info-table td:first-child { color: #64748b; padding-right: 16px; text-align: right; }
        .info-table td:last-child { text-align: right; }
        .buyer { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin-bottom: 30px; max-width: 300px; }
        .buyer h3 { font-size: 10px; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px; margin-bottom: 8px; }
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
        .legal p { font-size: 9px; color: #94a3b8; line-height: 1.5; }
    """;
}
