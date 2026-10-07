package com.clenzy.service;

import com.itextpdf.html2pdf.HtmlConverter;
import org.springframework.web.client.RestTemplate;
import java.io.ByteArrayOutputStream;

/** Double local pour les tests métier ; les tests d'intégration activent le véritable Chromium. */
public class BaitlyPdfTestEngine extends BaitlyPdfEngine {
    public BaitlyPdfTestEngine() { super(System.getProperty("baitly.test.pdf-url", "http://unused"), new RestTemplate()); }
    @Override public byte[] html(String html) {
        if (System.getProperty("baitly.test.pdf-url") != null) return super.html(html);
        BaitlyHtmlTemplates.validateResources(html);
        var out = new ByteArrayOutputStream();
        HtmlConverter.convertToPdf(html, out);
        return validate(out.toByteArray());
    }
}
