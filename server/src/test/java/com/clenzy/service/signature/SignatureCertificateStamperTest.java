package com.clenzy.service.signature;

import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfReader;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.kernel.pdf.canvas.parser.PdfTextExtractor;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.AreaBreak;
import com.itextpdf.layout.element.Paragraph;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * Tests dedies a {@link SignatureCertificateStamper} (audit T-BP-10) : le maillon
 * d'apposition du certificat de preuve SES sur le mandat PDF n'avait aucune classe
 * de test malgre sa criticite juridique (integrite du document + dossier de preuve).
 */
class SignatureCertificateStamperTest {

    private final SignatureCertificateStamper stamper = new SignatureCertificateStamper();

    // -- Helpers --------------------------------------------------------------

    private byte[] samplePdf(int pages) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (PdfDocument pdf = new PdfDocument(new PdfWriter(out));
             Document doc = new Document(pdf)) {
            for (int i = 1; i <= pages; i++) {
                doc.add(new Paragraph("Page " + i + " du mandat de gestion"));
                if (i < pages) {
                    doc.add(new AreaBreak());
                }
            }
        }
        return out.toByteArray();
    }

    private SignatureCertificateStamper.CertificateData fullData() {
        return new SignatureCertificateStamper.CertificateData(
                "CTR-2026-0042",
                "Jean Dupont",
                "jean.dupont@test.com",
                LocalDateTime.of(2026, 6, 10, 14, 30, 5),
                "203.0.113.42",
                "Mozilla/5.0 (Macintosh) TestAgent/1.0",
                "a3f5c9e1b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a2c4e6b8d0f2a4c6e8b0d2f4a6",
                "REQ-7f3a2b1c",
                "Je consens a signer electroniquement le present mandat de gestion."
        );
    }

    // -- Tests ----------------------------------------------------------------

    @Test
    @DisplayName("appendCertificate preserves the original pages and appends exactly one certificate page")
    void appendCertificate_preservesOriginalPages_andAppendsOne() throws Exception {
        // Arrange
        byte[] original = samplePdf(2);

        // Act
        byte[] merged = stamper.appendCertificate(original, fullData());

        // Assert
        try (PdfDocument result = new PdfDocument(new PdfReader(new ByteArrayInputStream(merged)))) {
            assertThat(result.getNumberOfPages()).isEqualTo(3);
            assertThat(PdfTextExtractor.getTextFromPage(result.getPage(1)))
                    .contains("Page 1 du mandat de gestion");
            assertThat(PdfTextExtractor.getTextFromPage(result.getPage(2)))
                    .contains("Page 2 du mandat de gestion");
        }
    }

    @Test
    @DisplayName("certificate page carries the full proof bundle (signer, IP, SHA-256, reference, consent)")
    void appendCertificate_certificatePageContainsProofData() throws Exception {
        // Arrange
        byte[] original = samplePdf(1);

        // Act
        byte[] merged = stamper.appendCertificate(original, fullData());

        // Assert : tous les elements de preuve SES sont sur la derniere page
        try (PdfDocument result = new PdfDocument(new PdfReader(new ByteArrayInputStream(merged)))) {
            String certificatePage = PdfTextExtractor.getTextFromPage(
                    result.getPage(result.getNumberOfPages()));
            assertThat(certificatePage)
                    .contains("CTR-2026-0042")
                    .contains("Jean Dupont")
                    .contains("jean.dupont@test.com")
                    .contains("203.0.113.42")
                    .contains("a3f5c9e1b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a2c4e6b8d0f2a4c6e8b0d2f4a6")
                    .contains("REQ-7f3a2b1c")
                    .contains("Je consens");
        }
    }

    @Test
    @DisplayName("null or blank proof fields fall back to a placeholder without failing")
    void appendCertificate_nullFields_doNotFail() throws Exception {
        // Arrange : dossier de preuve entierement vide (champs nullables)
        byte[] original = samplePdf(1);
        SignatureCertificateStamper.CertificateData emptyData =
                new SignatureCertificateStamper.CertificateData(
                        null, null, null, null, null, "", null, null, null);

        // Act & Assert : pas d'exception, le certificat est tout de meme appose
        assertThatCode(() -> {
            byte[] merged = stamper.appendCertificate(original, emptyData);
            try (PdfDocument result = new PdfDocument(new PdfReader(new ByteArrayInputStream(merged)))) {
                assertThat(result.getNumberOfPages()).isEqualTo(2);
            }
        }).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("oversized user-agent is truncated on the certificate page")
    void appendCertificate_longUserAgent_isTruncated() throws Exception {
        // Arrange : user-agent de 500 caracteres (le certificat tronque a 220)
        String longUserAgent = "X".repeat(500);
        SignatureCertificateStamper.CertificateData data =
                new SignatureCertificateStamper.CertificateData(
                        "CTR-1", "Jean", "j@test.com", LocalDateTime.now(),
                        "127.0.0.1", longUserAgent, "sha", "ref", "consent");

        // Act
        byte[] merged = stamper.appendCertificate(samplePdf(1), data);

        // Assert : la page certificat ne contient pas le user-agent complet
        try (PdfDocument result = new PdfDocument(new PdfReader(new ByteArrayInputStream(merged)))) {
            String certificatePage = PdfTextExtractor.getTextFromPage(
                    result.getPage(result.getNumberOfPages()));
            assertThat(certificatePage).doesNotContain(longUserAgent);
            assertThat(certificatePage).contains("X".repeat(50));
        }
    }
}
