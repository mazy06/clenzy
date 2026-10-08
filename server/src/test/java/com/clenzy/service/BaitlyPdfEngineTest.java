package com.clenzy.service;

import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.*;
import com.itextpdf.kernel.pdf.canvas.parser.PdfTextExtractor;
import com.itextpdf.layout.element.Paragraph;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestTemplate;
import java.io.ByteArrayInputStream;
import java.nio.file.*;
import java.util.List;
import static org.assertj.core.api.Assertions.*;

class BaitlyPdfEngineTest {
    static byte[] pdf(String text){
        var out = new java.io.ByteArrayOutputStream();
        try (var pdf = new com.itextpdf.kernel.pdf.PdfDocument(new com.itextpdf.kernel.pdf.PdfWriter(out));
             var document = new com.itextpdf.layout.Document(pdf)) { document.add(new Paragraph(text)); }
        return out.toByteArray();
    }
    @Test void allPdfWritersAndConversionEndpointsAreCentralized()throws Exception {
        try(var files=Files.walk(Path.of("src/main/java"))){
            var bypass=files.filter(p->p.toString().endsWith(".java") && !p.getFileName().toString().equals("BaitlyPdfEngine.java"))
                .filter(p->{try{String s=Files.readString(p);return s.contains("new PdfWriter(") || s.contains("HtmlConverter.convertTo") || s.contains("/forms/libreoffice/") || s.contains("fr.opensagres") || s.contains("org.jodconverter") || s.contains("restTemplate.exchange(\n                    url, HttpMethod.POST") && s.contains("/forms/");}catch(Exception e){throw new IllegalStateException(e);}}).toList();
            assertThat(bypass).isEmpty();
        }
    }
    @Test void enginePreservesSourceAndValidatesPagesForMergeAndEdit()throws Exception {
        var engine=new BaitlyPdfEngine("http://unused",new RestTemplate());var source=pdf("Baitly TEST document original");String hash=BaitlyInvoiceChecks.hash(source);
        var combined=engine.merge(List.of(source,pdf("TEST certificat")));
        try(var doc=new PdfDocument(new PdfReader(new ByteArrayInputStream(combined)))){
            assertThat(doc.getNumberOfPages()).isEqualTo(2);assertThat(PdfTextExtractor.getTextFromPage(doc.getPage(1))).contains("original");
        }
        assertThat(BaitlyInvoiceChecks.hash(source)).isEqualTo(hash);
        assertThatThrownBy(()->BaitlyPdfEngine.validate("%PDF-invalid".getBytes())).isInstanceOf(RuntimeException.class);
        Files.createDirectories(Path.of("target/pdf-review"));Files.write(Path.of("target/pdf-review/baitly-central-engine.pdf"),combined);
    }
}
