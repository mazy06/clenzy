package com.clenzy.service;

import com.itextpdf.kernel.pdf.*;
import com.itextpdf.kernel.pdf.canvas.parser.PdfTextExtractor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.web.client.RestTemplate;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.zip.*;
import static org.assertj.core.api.Assertions.*;

/** Conversion réelle de données fictives, sans base ni envoi de document. */
@EnabledIfSystemProperty(named="baitly.test.pdf-url",matches="http://(localhost|127\\.0\\.0\\.1):[0-9]+")
class BaitlyPdfRenderingIntegrationTest {
    @Test void longTablesRepeatTheirHeaderAndKeepAccentedAndRtlContent() throws Exception {
        var engine = new BaitlyPdfEngine(System.getProperty("baitly.test.pdf-url"), new RestTemplate());
        var rows = new StringBuilder();
        for (int n = 1; n <= 110; n++) rows.append("<tr><td>Prestation TEST ").append(n).append("</td><td>Été · 12,50 €</td></tr>");
        String body = "<h1>TEST Baitly · document multipage</h1><p dir=\"rtl\" lang=\"ar\">فاتورة تجريبية بدون قيمة قانونية</p>"
            + "<table><thead><tr><th>Description TEST</th><th>Montant</th></tr></thead><tbody>" + rows + "</tbody></table>";
        byte[] result = engine.html(BaitlyDocumentHtml.page("TEST", body));
        try (var pdf = new PdfDocument(new PdfReader(new ByteArrayInputStream(result)))) {
            assertThat(pdf.getNumberOfPages()).isGreaterThan(1);
            for (int n = 1; n <= pdf.getNumberOfPages(); n++)
                assertThat(PdfTextExtractor.getTextFromPage(pdf.getPage(n))).contains("Description TEST", "Montant");
        }
        assertThat(text(result)).contains("Prestation TEST 110", "Été", "12,50");
        save("baitly-test-multipage.pdf", result);
    }
    @Test void invoiceAndLegacyTemplateUseTheSharedHtmlEngineAndProduceReadablePdf() throws Exception {
        var engine=new BaitlyPdfEngine(System.getProperty("baitly.test.pdf-url"),new RestTemplate());
        var invoice=BaitlyDocumentVerificationTest.invoice();
        invoice.setInvoiceNumber("TEST-SANS-VALEUR-LEGALE");
        invoice.setSellerName("Baitly · échantillon de test");
        invoice.setBuyerName("Client <TEST> & associé");
        invoice.setLegalMentions("DOCUMENT DE TEST · AUCUNE VALEUR LÉGALE");
        byte[] pdf=new InvoicePdfService(engine).generatePdf(invoice);
        assertThat(text(pdf)).contains("Client <TEST> & associé","TEST-SANS-VALEUR-LEGALE","100,00","120,00");
        save("baitly-test-facture.pdf",pdf);

        byte[] office=engine.html(new String(BaitlyHtmlTemplates.render(BaitlyLegacyOdtImporter.html(odt()),
                java.util.Map.of("entreprise", java.util.Map.of("nom", "Baitly"))), StandardCharsets.UTF_8));
        assertThat(text(office)).contains("Baitly TEST ODT");save("baitly-test-office.pdf",office);

        byte[] report=engine.reportHtml("<html><body><h1>Baitly TEST rapport</h1><p>AUCUNE VALEUR LEGALE</p></body></html>");
        assertThat(text(report)).contains("Baitly TEST rapport");save("baitly-test-report.pdf",report);
    }
    private static String text(byte[] bytes)throws Exception {
        try(var pdf=new PdfDocument(new PdfReader(new ByteArrayInputStream(bytes)))) {
            var result=new StringBuilder();for(int n=1;n<=pdf.getNumberOfPages();n++)result.append(PdfTextExtractor.getTextFromPage(pdf.getPage(n)));
            return result.toString();
        }
    }
    private static void save(String name,byte[] content)throws Exception {
        Files.createDirectories(Path.of("target/pdf-review"));Files.write(Path.of("target/pdf-review",name),content);
    }
    private static byte[] odt()throws Exception {
        try(var bytes=new ByteArrayOutputStream();var zip=new ZipOutputStream(bytes)) {
            entry(zip,"mimetype","application/vnd.oasis.opendocument.text");
            entry(zip,"META-INF/manifest.xml","""
                <?xml version="1.0"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
                <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>
                <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>
                """);
            entry(zip,"content.xml","""
                <?xml version="1.0"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2">
                <office:body><office:text><text:p>Baitly TEST ODT</text:p><text:p>AUCUNE VALEUR LEGALE</text:p></office:text></office:body></office:document-content>
                """);
            zip.finish();return bytes.toByteArray();
        }
    }
    private static void entry(ZipOutputStream zip,String name,String text)throws Exception {
        zip.putNextEntry(new ZipEntry(name));zip.write(text.getBytes(StandardCharsets.UTF_8));zip.closeEntry();
    }
}
