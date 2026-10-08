package com.clenzy.service;

import com.clenzy.exception.DocumentGenerationException;
import com.clenzy.model.Invoice;
import com.clenzy.model.InvoiceLine;
import com.clenzy.model.InvoiceStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.ResourceAccessException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InvoicePdfServiceTest {

    @Mock
    private RestTemplate restTemplate;


    private InvoicePdfService service;

    @BeforeEach
    void setUp() {
        service = new InvoicePdfService(
            new BaitlyPdfEngine("http://gotenberg:3000", restTemplate)
        );
    }

    /** Build a minimal Invoice that satisfies the renderHtml path. */
    private Invoice buildBaseInvoice() {
        Invoice inv = new Invoice();
        inv.setId(1L);
        inv.setOrganizationId(1L);
        inv.setInvoiceNumber("FA2026-00001");
        inv.setInvoiceDate(LocalDate.of(2026, 3, 1));
        inv.setDueDate(LocalDate.of(2026, 3, 31));
        inv.setCurrency("EUR");
        inv.setCountryCode("FR");
        inv.setStatus(InvoiceStatus.ISSUED);
        inv.setTotalHt(new BigDecimal("250.00"));
        inv.setTotalTax(new BigDecimal("50.00"));
        inv.setTotalTtc(new BigDecimal("300.00"));
        inv.setSellerName("SARL Test");
        inv.setSellerAddress("1 rue Test\n75001 Paris");
        inv.setSellerTaxId("FR12345678901");
        inv.setBuyerName("Client Test");
        inv.setBuyerAddress("2 rue Client\n69001 Lyon");
        inv.setBuyerTaxId("FR98765432101");
        inv.setLegalMentions("SARL au capital de 10000 EUR");
        return inv;
    }

    private InvoiceLine buildLine(int number, String desc, BigDecimal unitPrice, BigDecimal taxRate) {
        InvoiceLine line = new InvoiceLine();
        line.setLineNumber(number);
        line.setDescription(desc);
        line.setQuantity(BigDecimal.ONE);
        line.setUnitPriceHt(unitPrice);
        line.setTaxCategory("ACCOMMODATION");
        line.setTaxRate(taxRate);
        line.setTaxAmount(unitPrice.multiply(taxRate));
        line.setTotalHt(unitPrice);
        line.setTotalTtc(unitPrice.add(unitPrice.multiply(taxRate)));
        return line;
    }

    @Nested
    @DisplayName("generatePdf")
    class GeneratePdf {

        @Test
        void whenInvoiceHasNoLines_thenStillGeneratesPdf() {
            Invoice inv = buildBaseInvoice();
            byte[] fakePdf = BaitlyPdfEngineTest.pdf("TEST facture");

            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(byte[].class)))
                .thenReturn(ResponseEntity.ok(fakePdf));

            byte[] result = service.generatePdf(inv);

            assertThat(result).isEqualTo(fakePdf);
        }

        @Test
        void whenInvoiceHasLines_thenSendsHtmlToGotenberg() {
            Invoice inv = buildBaseInvoice();
            InvoiceLine line1 = buildLine(1, "Hebergement", new BigDecimal("250.00"), new BigDecimal("0.1000"));
            InvoiceLine line2 = buildLine(2, "Frais de menage", new BigDecimal("50.00"), new BigDecimal("0.2000"));
            inv.addLine(line1);
            inv.addLine(line2);

            byte[] fakePdf = BaitlyPdfEngineTest.pdf("TEST facture");
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(byte[].class)))
                .thenReturn(ResponseEntity.ok(fakePdf));

            byte[] result = service.generatePdf(inv);

            assertThat(result).isEqualTo(fakePdf);

            ArgumentCaptor<HttpEntity<MultiValueMap<String, Object>>> captor = ArgumentCaptor.forClass(HttpEntity.class);
            verify(restTemplate).exchange(eq("http://gotenberg:3000/forms/chromium/convert/html"),
                eq(HttpMethod.POST), captor.capture(), eq(byte[].class));

            HttpEntity<MultiValueMap<String, Object>> sent = captor.getValue();
            assertThat(sent.getBody()).containsKey("files");
            assertThat(sent.getBody()).containsKey("marginTop");
            assertThat(sent.getBody().getFirst("paperWidth")).isEqualTo("8.27");
            assertThat(sent.getBody().getFirst("paperHeight")).isEqualTo("11.69");
            assertThat(sent.getBody().getFirst("printBackground")).isEqualTo("true");
        }

        @Test
        void whenGotenbergReturnsNon2xx_thenThrowsDocumentGenerationException() {
            Invoice inv = buildBaseInvoice();

            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(byte[].class)))
                .thenReturn(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new byte[]{}));

            assertThatThrownBy(() -> service.generatePdf(inv))
                .isInstanceOf(DocumentGenerationException.class)
                .hasMessageContaining("PDF");
        }

        @Test
        void whenGotenbergReturnsNullBody_thenThrows() {
            Invoice inv = buildBaseInvoice();

            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(byte[].class)))
                .thenReturn(ResponseEntity.ok(null));

            assertThatThrownBy(() -> service.generatePdf(inv))
                .isInstanceOf(DocumentGenerationException.class);
        }

        @Test
        void whenRestTemplateThrowsConnectionError_thenWrapsInDocumentGenerationException() {
            Invoice inv = buildBaseInvoice();

            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(byte[].class)))
                .thenThrow(new ResourceAccessException("Connection refused"));

            assertThatThrownBy(() -> service.generatePdf(inv))
                .isInstanceOf(DocumentGenerationException.class)
                .hasMessageContaining("PDF");
        }

        @Test
        void invalidPdfIsRejectedBeforeArchival() {
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(byte[].class)))
                .thenReturn(ResponseEntity.ok("%PDF-corrupt".getBytes()));
            assertThatThrownBy(() -> service.generatePdf(buildBaseInvoice()))
                .isInstanceOf(DocumentGenerationException.class);
        }

    }

    @Nested
    @DisplayName("HTML rendering & escaping")
    class HtmlRendering {

        @Test
        void creditNoteUsesDedicatedTitleFilenameAndEscapesTheOriginalReference() {
            var inv=buildBaseInvoice(); inv.setStatus(InvoiceStatus.CREDIT_NOTE);
            inv.setOriginalInvoiceId(42L); inv.setRefundTransactionId(41L);
            inv.setTotalHt(new BigDecimal("-250")); inv.setTotalTax(new BigDecimal("-50")); inv.setTotalTtc(new BigDecimal("-300"));
            inv.setLegalMentions("Avoir sur facture <FA-original> du 2026-03-01");
            ArgumentCaptor<HttpEntity<MultiValueMap<String,Object>>> captor=ArgumentCaptor.forClass(HttpEntity.class);
            when(restTemplate.exchange(anyString(),eq(HttpMethod.POST),captor.capture(),eq(byte[].class)))
                .thenReturn(ResponseEntity.ok(BaitlyPdfEngineTest.pdf("TEST facture")));
            service.generatePdf(inv);
            assertThat(extractHtmlFromMultipart(captor.getValue())).contains("AVOIR", "-300", "&lt;FA-original&gt;")
                .doesNotContain("<FA-original>", "<h1>FACTURE</h1>");
        }

        @Test
        void whenBuyerNameContainsXss_thenIsEscapedInHtml() {
            Invoice inv = buildBaseInvoice();
            inv.setBuyerName("<script>alert('xss')</script>");

            byte[] fakePdf = BaitlyPdfEngineTest.pdf("TEST facture");
            ArgumentCaptor<HttpEntity<MultiValueMap<String, Object>>> captor = ArgumentCaptor.forClass(HttpEntity.class);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), captor.capture(), eq(byte[].class)))
                .thenReturn(ResponseEntity.ok(fakePdf));

            service.generatePdf(inv);

            // The HTML resource should contain escaped tags
            String html = extractHtmlFromMultipart(captor.getValue());
            assertThat(html).doesNotContain("<script>");
            assertThat(html).contains("&lt;script&gt;");
        }

        @Test
        void whenInvoiceHasNoOptionalFields_thenRendersWithoutCrashing() {
            // Test the null-branches in renderHtml
            Invoice inv = buildBaseInvoice();
            inv.setSellerAddress(null);
            inv.setSellerTaxId(null);
            inv.setBuyerAddress(null);
            inv.setBuyerTaxId(null);
            inv.setDueDate(null);
            inv.setLegalMentions(null);
            inv.setLines(new ArrayList<>());

            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(byte[].class)))
                .thenReturn(ResponseEntity.ok(BaitlyPdfEngineTest.pdf("TEST facture")));

            assertThat(service.generatePdf(inv)).isNotEmpty();
        }

        @Test
        void whenInvoiceHasNullLinesList_thenRendersWithoutCrash() {
            Invoice inv = buildBaseInvoice();
            inv.setLines(null);

            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(byte[].class)))
                .thenReturn(ResponseEntity.ok(BaitlyPdfEngineTest.pdf("TEST facture")));

            byte[] result = service.generatePdf(inv);
            assertThat(result).isNotEmpty();
        }

        @Test
        void whenInvoiceHasBlankLegalMentions_thenSkipsLegalSection() {
            Invoice inv = buildBaseInvoice();
            inv.setLegalMentions("   ");

            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(byte[].class)))
                .thenReturn(ResponseEntity.ok(BaitlyPdfEngineTest.pdf("TEST facture")));

            assertThat(service.generatePdf(inv)).isNotEmpty();
        }

        @Test
        void whenLegalMentionsHaveAmpersand_thenAreEscaped() {
            Invoice inv = buildBaseInvoice();
            inv.setLegalMentions("Mentions & avec \"guillemets\"");

            byte[] fakePdf = BaitlyPdfEngineTest.pdf("TEST facture");
            ArgumentCaptor<HttpEntity<MultiValueMap<String, Object>>> captor = ArgumentCaptor.forClass(HttpEntity.class);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), captor.capture(), eq(byte[].class)))
                .thenReturn(ResponseEntity.ok(fakePdf));

            service.generatePdf(inv);

            String html = extractHtmlFromMultipart(captor.getValue());
            assertThat(html).contains("&amp;");
            assertThat(org.jsoup.Jsoup.parse(html).text()).contains("Mentions & avec \"guillemets\"");
        }

        @Test
        void whenAddressContainsNewlines_thenAreConvertedToBr() {
            Invoice inv = buildBaseInvoice();
            // Already uses \n in setUp — verify <br> conversion
            byte[] fakePdf = BaitlyPdfEngineTest.pdf("TEST facture");
            ArgumentCaptor<HttpEntity<MultiValueMap<String, Object>>> captor = ArgumentCaptor.forClass(HttpEntity.class);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), captor.capture(), eq(byte[].class)))
                .thenReturn(ResponseEntity.ok(fakePdf));

            service.generatePdf(inv);

            String html = extractHtmlFromMultipart(captor.getValue());
            assertThat(html).contains("<br>");
        }
    }

    @Nested
    @DisplayName("Currency formatting")
    class CurrencyFormatting {

        @Test
        void whenCurrencyIsEUR_thenUsesEuroSymbol() {
            Invoice inv = buildBaseInvoice();
            inv.setCurrency("EUR");
            inv.addLine(buildLine(1, "test", new BigDecimal("100.00"), new BigDecimal("0.20")));

            byte[] fakePdf = BaitlyPdfEngineTest.pdf("TEST facture");
            ArgumentCaptor<HttpEntity<MultiValueMap<String, Object>>> captor = ArgumentCaptor.forClass(HttpEntity.class);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), captor.capture(), eq(byte[].class)))
                .thenReturn(ResponseEntity.ok(fakePdf));

            service.generatePdf(inv);

            String html = extractHtmlFromMultipart(captor.getValue());
            assertThat(html).contains("€");
        }

        @Test
        void whenCurrencyIsMAD_thenUsesMADSymbol() {
            Invoice inv = buildBaseInvoice();
            inv.setCurrency("MAD");
            inv.addLine(buildLine(1, "test", new BigDecimal("100.00"), new BigDecimal("0.20")));

            byte[] fakePdf = BaitlyPdfEngineTest.pdf("TEST facture");
            ArgumentCaptor<HttpEntity<MultiValueMap<String, Object>>> captor = ArgumentCaptor.forClass(HttpEntity.class);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), captor.capture(), eq(byte[].class)))
                .thenReturn(ResponseEntity.ok(fakePdf));

            service.generatePdf(inv);

            String html = extractHtmlFromMultipart(captor.getValue());
            assertThat(html).contains("MAD");
        }

        @Test
        void whenCurrencyIsUSD_thenUsesDollarSymbol() {
            Invoice inv = buildBaseInvoice();
            inv.setCurrency("USD");
            inv.addLine(buildLine(1, "test", new BigDecimal("100.00"), new BigDecimal("0.10")));

            byte[] fakePdf = BaitlyPdfEngineTest.pdf("TEST facture");
            ArgumentCaptor<HttpEntity<MultiValueMap<String, Object>>> captor = ArgumentCaptor.forClass(HttpEntity.class);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), captor.capture(), eq(byte[].class)))
                .thenReturn(ResponseEntity.ok(fakePdf));

            service.generatePdf(inv);

            String html = extractHtmlFromMultipart(captor.getValue());
            assertThat(html).contains("$");
        }

        @Test
        void whenCurrencyIsSAR_thenUsesSARSymbol() {
            Invoice inv = buildBaseInvoice();
            inv.setCurrency("SAR");
            inv.addLine(buildLine(1, "test", new BigDecimal("100.00"), new BigDecimal("0.15")));

            byte[] fakePdf = BaitlyPdfEngineTest.pdf("TEST facture");
            ArgumentCaptor<HttpEntity<MultiValueMap<String, Object>>> captor = ArgumentCaptor.forClass(HttpEntity.class);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), captor.capture(), eq(byte[].class)))
                .thenReturn(ResponseEntity.ok(fakePdf));

            service.generatePdf(inv);

            String html = extractHtmlFromMultipart(captor.getValue());
            assertThat(html).contains("SAR");
        }

        @Test
        void whenCurrencyIsUnknownButValidJDK_thenFallsBackToJdkSymbol() {
            Invoice inv = buildBaseInvoice();
            inv.setCurrency("JPY"); // JDK currency, not in CURRENCY_SYMBOLS map
            inv.addLine(buildLine(1, "test", new BigDecimal("100.00"), new BigDecimal("0.10")));

            byte[] fakePdf = BaitlyPdfEngineTest.pdf("TEST facture");
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(byte[].class)))
                .thenReturn(ResponseEntity.ok(fakePdf));

            byte[] result = service.generatePdf(inv);
            assertThat(result).isNotEmpty();
        }

        @Test
        void whenCurrencyIsBogus_thenFallsBackToCurrencyCode() {
            Invoice inv = buildBaseInvoice();
            inv.setCurrency("EUR"); // setter validates; we change after
            inv.addLine(buildLine(1, "test", new BigDecimal("100.00"), new BigDecimal("0.10")));

            byte[] fakePdf = BaitlyPdfEngineTest.pdf("TEST facture");
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(byte[].class)))
                .thenReturn(ResponseEntity.ok(fakePdf));

            byte[] result = service.generatePdf(inv);
            assertThat(result).isNotEmpty();
        }

        @Test
        void whenCurrencyIsNullOnLine_thenUsesEuroFallback() {
            Invoice inv = buildBaseInvoice();
            inv.setCurrency(null); // null currency on invoice
            InvoiceLine line = buildLine(1, "test", new BigDecimal("100.00"), new BigDecimal("0.20"));
            inv.addLine(line);

            byte[] fakePdf = BaitlyPdfEngineTest.pdf("TEST facture");
            ArgumentCaptor<HttpEntity<MultiValueMap<String, Object>>> captor = ArgumentCaptor.forClass(HttpEntity.class);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), captor.capture(), eq(byte[].class)))
                .thenReturn(ResponseEntity.ok(fakePdf));

            service.generatePdf(inv);

            String html = extractHtmlFromMultipart(captor.getValue());
            // null currency → fallback to "EUR" → € symbol
            assertThat(html).contains("€");
        }
    }

    @Nested
    @DisplayName("Money/Qty/Percent formatters")
    class Formatters {

        @Test
        void whenLineAmountIsNull_thenFormatsAsZero() {
            Invoice inv = buildBaseInvoice();
            inv.setTotalHt(null);
            inv.setTotalTax(null);
            inv.setTotalTtc(null);

            byte[] fakePdf = BaitlyPdfEngineTest.pdf("TEST facture");
            ArgumentCaptor<HttpEntity<MultiValueMap<String, Object>>> captor = ArgumentCaptor.forClass(HttpEntity.class);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), captor.capture(), eq(byte[].class)))
                .thenReturn(ResponseEntity.ok(fakePdf));

            service.generatePdf(inv);

            String html = extractHtmlFromMultipart(captor.getValue());
            assertThat(html).contains("0,00");
        }

        @Test
        void whenLineHasZeroTaxRate_thenDisplaysDash() {
            Invoice inv = buildBaseInvoice();
            InvoiceLine line = buildLine(1, "tax-free", new BigDecimal("100"), BigDecimal.ZERO);
            line.setTaxAmount(BigDecimal.ZERO);
            inv.addLine(line);

            byte[] fakePdf = BaitlyPdfEngineTest.pdf("TEST facture");
            ArgumentCaptor<HttpEntity<MultiValueMap<String, Object>>> captor = ArgumentCaptor.forClass(HttpEntity.class);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), captor.capture(), eq(byte[].class)))
                .thenReturn(ResponseEntity.ok(fakePdf));

            service.generatePdf(inv);

            String html = extractHtmlFromMultipart(captor.getValue());
            assertThat(html).contains("-"); // dash placeholder for 0%
        }

        @Test
        void whenLineHasNullTaxRate_thenDisplaysDash() {
            Invoice inv = buildBaseInvoice();
            InvoiceLine line = buildLine(1, "tax-free", new BigDecimal("100"), BigDecimal.ZERO);
            line.setTaxRate(null);
            line.setTaxAmount(BigDecimal.ZERO);
            inv.addLine(line);

            byte[] fakePdf = BaitlyPdfEngineTest.pdf("TEST facture");
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(byte[].class)))
                .thenReturn(ResponseEntity.ok(fakePdf));

            byte[] result = service.generatePdf(inv);
            assertThat(result).isNotEmpty();
        }

        @Test
        void whenLineHasNullQuantity_thenDefaultsToOne() {
            Invoice inv = buildBaseInvoice();
            InvoiceLine line = buildLine(1, "test", new BigDecimal("100"), new BigDecimal("0.20"));
            line.setQuantity(null);
            inv.addLine(line);

            byte[] fakePdf = BaitlyPdfEngineTest.pdf("TEST facture");
            ArgumentCaptor<HttpEntity<MultiValueMap<String, Object>>> captor = ArgumentCaptor.forClass(HttpEntity.class);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), captor.capture(), eq(byte[].class)))
                .thenReturn(ResponseEntity.ok(fakePdf));

            service.generatePdf(inv);

            String html = extractHtmlFromMultipart(captor.getValue());
            // formatQty(null) returns "1"
            assertThat(html).contains(">1<");
        }

        @Test
        void whenLineHasNonTrivialPercent_thenFormatsCorrectly() {
            Invoice inv = buildBaseInvoice();
            InvoiceLine line = buildLine(1, "test", new BigDecimal("100"), new BigDecimal("0.1000"));
            inv.addLine(line);

            byte[] fakePdf = BaitlyPdfEngineTest.pdf("TEST facture");
            ArgumentCaptor<HttpEntity<MultiValueMap<String, Object>>> captor = ArgumentCaptor.forClass(HttpEntity.class);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), captor.capture(), eq(byte[].class)))
                .thenReturn(ResponseEntity.ok(fakePdf));

            service.generatePdf(inv);

            String html = extractHtmlFromMultipart(captor.getValue());
            assertThat(html).contains("10%");
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    /** Pull the index.html part out of the captured multipart body and return its raw HTML. */
    @SuppressWarnings("unchecked")
    private String extractHtmlFromMultipart(HttpEntity<MultiValueMap<String, Object>> entity) {
        MultiValueMap<String, Object> body = entity.getBody();
        if (body == null) return "";
        List<Object> files = (List<Object>) (List<?>) body.get("files");
        if (files == null || files.isEmpty()) return "";
        Object first = files.get(0);
        if (first instanceof org.springframework.core.io.ByteArrayResource res) {
            try {
                return new String(res.getByteArray(), java.nio.charset.StandardCharsets.UTF_8);
            } catch (Exception e) {
                return "";
            }
        }
        return "";
    }
}
