package com.clenzy.service;

import com.clenzy.model.DocumentTemplate;
import com.clenzy.model.DocumentType;
import com.itextpdf.kernel.pdf.*;
import com.itextpdf.kernel.pdf.canvas.parser.PdfTextExtractor;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import org.jsoup.Jsoup;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.web.client.RestTemplate;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyDocumentPreviewTest {
    static java.util.stream.Stream<Path> templates() throws Exception { return BaitlyTemplateInventoryTest.templates(); }

    @ParameterizedTest(name="{0}") @MethodSource("templates")
    void everyNativeAndLegacySourceHasRichFictionalDataAndSharedDesign(Path source) throws Exception {
        var renderer = new DocumentTemplateRenderer(null);
        var template = new DocumentTemplate();
        byte[] original = Files.readAllBytes(source);
        template.setFileContent(original); template.setDocumentType(DocumentType.BON_INTERVENTION);
        template.setTags(new TemplateParserService().parseTemplate(original));
        var engine = mock(BaitlyPdfEngine.class);
        when(engine.html(anyString())).thenAnswer(call -> {
            String html = call.getArgument(0);
            var document = Jsoup.parse(html);
            String text = document.text();
            assertThat(text).contains("Camille Exemple", "APERÇU · DOCUMENT FICTIF", "Aucune valeur légale");
            assertThat(html).doesNotContain("${", "<#", "[#");
            BaitlyHtmlTemplates.validateResources(html);
            BaitlyDocumentPresentation.apply(document);
            assertThat(document.select("#baitly-document-design")).hasSize(1);
            assertThat(document.text().replaceAll("\\s*:\\s*", " : "))
                    .isEqualTo(text.replaceAll("\\s*:\\s*", " : "));
            if (!document.select("h2").isEmpty()) assertThat(document.select(".baitly-doc-section")).isNotEmpty();
            return new byte[]{1};
        });
        new DocumentPreviewService(engine, renderer, new InvoicePdfService(engine)).generatePreview(template);
        verify(engine).html(anyString());
        assertThat(template.getFileContent()).isEqualTo(original);
    }

    @Test void presentationPreservesValuesAndMentionsWhileGroupingIdentityBlocks() {
        var document = Jsoup.parse("<html><body><p style='font-size:18pt;font-weight:bold'>Autorisation</p>"
            + "<p style='font-size:13pt;font-weight:bold'>PROPRIETAIRE</p><p>Nom : Camille Exemple</p>"
            + "<p style='font-size:13pt;font-weight:bold'>GESTIONNAIRE</p><p>Nom : Horizon</p>"
            + "<p style='font-size:13pt;font-weight:bold'>AUTORISATION</p><p>Consentement conservé &amp; identité.</p></body></html>");
        BaitlyDocumentPresentation.apply(document);
        assertThat(document.select("h1").text()).isEqualTo("Autorisation");
        assertThat(document.select(".baitly-doc-grid > section")).hasSize(2);
        assertThat(document.select(".baitly-doc-field")).hasSize(2);
        assertThat(document.text()).contains("Camille Exemple", "Horizon", "Consentement conservé & identité.");
        String html = document.outerHtml();
        BaitlyDocumentPresentation.apply(document);
        assertThat(document.outerHtml()).isEqualTo(html);
    }

    @Test void contextsAreIndependentAndNeverShareMutatedValues() {
        var first = BaitlyPreviewData.context(); first.put("client", "changed");
        assertThat(BaitlyPreviewData.context().get("client")).isInstanceOf(java.util.Map.class);
    }

    @Test void legacyHeaderAndColoursFollowTheSameHierarchyWithoutLosingMixedText() {
        String paragraphs = "<p style='font-size:9pt;color:#6B645C'>Coordonnées fictives</p>".repeat(8);
        var document = Jsoup.parse("<html><body><table><tr><td><p style='font-size:27pt;font-weight:bold'>Société exemple</p>"
                + "</td><td><p style='font-size:22pt;font-weight:bold'>DEVIS</p></td></tr></table>"
                + "<p style='font-size:9pt;font-weight:bold;border-bottom:.5pt solid #8C7B6B'>Logement</p>"
                + "Type : <span>Appartement</span> • Surface : <span>78 m²</span>" + paragraphs + "</body></html>");
        BaitlyDocumentPresentation.apply(document);
        assertThat(document.select("h1").text()).isEqualTo("DEVIS");
        assertThat(document.select(".baitly-doc-issuer").text()).isEqualTo("Société exemple");
        assertThat(document.select("h2").text()).isEqualTo("Logement");
        assertThat(document.body().html()).doesNotContain("#6B645C", "#8C7B6B");
        assertThat(document.text()).contains("Type : Appartement • Surface : 78 m²");
    }

    @Test void surfaceUnitIsNotRepeatedButNumericValuesKeepTheTemplateUnit() {
        byte[] source = "<html><body>${property.surface} m²</body></html>".getBytes(StandardCharsets.UTF_8);
        var context = java.util.Map.<String, Object>of("property", java.util.Map.of("surface", "78 m²"));
        assertThat(new String(BaitlyHtmlTemplates.render(source, context), StandardCharsets.UTF_8)).contains("78 m²").doesNotContain("m² m²");
        assertThat(new String(BaitlyHtmlTemplates.render(source, java.util.Map.of("property", java.util.Map.of("surface", 78))), StandardCharsets.UTF_8)).contains("78 m²");
    }

    @Test @EnabledIfSystemProperty(named="baitly.test.pdf-url", matches="http://(localhost|127\\.0\\.0\\.1):[0-9]+")
    void realPdfRepeatsWatermarkOnEveryPageAndRendersEveryDocumentFamily() throws Exception {
        var engine = new BaitlyPdfEngine(System.getProperty("baitly.test.pdf-url"), new RestTemplate());
        var renderer = new DocumentTemplateRenderer(null);
        var previews = new DocumentPreviewService(engine, renderer, new InvoicePdfService(engine));
        Path output = Path.of("target/preview-design-review"); Files.createDirectories(output);
        try (var sources = templates()) {
            for (Path source : sources.toList()) {
                var template = new DocumentTemplate(); template.setFileContent(Files.readAllBytes(source));
                template.setTags(new TemplateParserService().parseTemplate(template.getFileContent()));
                template.setDocumentType(source.getFileName().toString().contains("facture") ? DocumentType.FACTURE : DocumentType.BON_INTERVENTION);
                byte[] bytes = previews.generatePreview(template);
                assertWatermark(bytes);
                Files.write(output.resolve(source.getParent().getFileName() + "-" + source.getFileName() + ".pdf"), bytes);
            }
        }
        String longHtml = "<html><body><h1>Exemple multipage</h1>" + "<p>Paragraphe fictif de contrôle de la pagination.</p>".repeat(200) + "</body></html>";
        byte[] multi = engine.html(BaitlyPreviewData.watermark(longHtml)); assertWatermark(multi);
        try (var pdf = new PdfDocument(new PdfReader(new ByteArrayInputStream(multi)))) { assertThat(pdf.getNumberOfPages()).isGreaterThan(2); }
        Files.write(output.resolve("multipage.pdf"), multi);
    }

    private static void assertWatermark(byte[] bytes) throws Exception {
        try (var pdf = new PdfDocument(new PdfReader(new ByteArrayInputStream(bytes)))) {
            for (int n = 1; n <= pdf.getNumberOfPages(); n++)
                assertThat(PdfTextExtractor.getTextFromPage(pdf.getPage(n))).contains("APERÇU", "DOCUMENT FICTIF", "Aucune valeur légale");
        }
    }
}
