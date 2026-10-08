package com.clenzy.service.signature;

import com.itextpdf.kernel.colors.Color;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfReader;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.kernel.utils.PdfMerger;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.borders.Border;
import com.itextpdf.layout.borders.SolidBorder;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.UnitValue;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Appose le certificat de signature électronique sur le mandat PDF : le document
 * original est conservé tel quel, une page « Certificat de signature » est ajoutée
 * en fin de document (signataire, horodatage, IP, user-agent, SHA-256 de l'original,
 * référence de la demande, consentement, mention SES eIDAS).
 *
 * <p>On fusionne (PdfMerger) plutôt que d'écrire sur les pages existantes : la mise
 * en page du mandat varie selon le template .odt, un encart posé en absolu risquerait
 * de chevaucher le contenu.</p>
 */
@Component
public class SignatureCertificateStamper {

    private final com.clenzy.service.BaitlyPdfEngine engine;
    public SignatureCertificateStamper(com.clenzy.service.BaitlyPdfEngine engine){this.engine=engine;}

    private static final Color BRAND = new DeviceRgb(107, 138, 154);   // #6B8A9A
    private static final Color TEXT_MUTED = new DeviceRgb(100, 116, 139);
    private static final DateTimeFormatter SIGNED_AT_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy 'à' HH:mm:ss");

    /** Données de preuve apposées sur la page certificat. */
    public record CertificateData(
            String contractNumber,
            String signerName,
            String signerEmail,
            LocalDateTime signedAt,
            String signerIp,
            String signerUserAgent,
            String documentSha256,
            String requestReference,
            String consentText
    ) {}

    /** Retourne le PDF original suivi de la page certificat. */
    public byte[] appendCertificate(byte[] originalPdf, CertificateData data) throws Exception {
        byte[] certificatePage = buildCertificatePage(data);

        return engine.merge(java.util.List.of(originalPdf, certificatePage));
    }

    private byte[] buildCertificatePage(CertificateData data) {
        String body = "<h1>Certificat de signature électronique</h1>"
                + com.clenzy.service.BaitlyDocumentHtml.paragraph("Mandat de gestion " + safe(data.contractNumber()))
                + com.clenzy.service.BaitlyDocumentHtml.paragraph("Ce document a été signé électroniquement via la plateforme Baitly. Signature électronique simple au sens de l'article 25 du règlement (UE) n°910/2014 (eIDAS) : le présent certificat constitue le dossier de preuve associé au document qui précède.")
                + "<h2>Signataire</h2><table>"
                + htmlRow("Nom saisi", data.signerName()) + htmlRow("Email", data.signerEmail())
                + htmlRow("Date et heure (serveur)", data.signedAt() == null ? null : data.signedAt().format(SIGNED_AT_FMT))
                + "</table><h2>Éléments de preuve</h2><table>"
                + htmlRow("Référence de la demande", data.requestReference())
                + htmlRow("Adresse IP", data.signerIp())
                + htmlRow("Navigateur (user-agent)", truncate(safe(data.signerUserAgent()), 220))
                + htmlRow("Empreinte SHA-256 du document original", data.documentSha256())
                + "</table><h2>Consentement</h2>"
                + com.clenzy.service.BaitlyDocumentHtml.paragraph(safe(data.consentText()))
                + com.clenzy.service.BaitlyDocumentHtml.paragraph("Vérification d'intégrité : l'empreinte SHA-256 ci-dessus est celle du document original présenté au signataire (pages précédant ce certificat, avant son ajout).");
        return engine.html(com.clenzy.service.BaitlyDocumentHtml.page("Certificat de signature", body));
    }

    private static String htmlRow(String label, String value) {
        return com.clenzy.service.BaitlyDocumentHtml.row(label, safe(value));
    }

    private Table proofTable(String[][] rows) {
        Table table = new Table(UnitValue.createPercentArray(new float[] { 32, 68 }))
                .useAllAvailableWidth();
        for (String[] row : rows) {
            table.addCell(labelCell(row[0]));
            table.addCell(valueCell(row[1]));
        }
        return table;
    }

    private Cell labelCell(String text) {
        return new Cell().add(new Paragraph(text).setFontSize(8.5f).setFontColor(TEXT_MUTED))
                .setBorder(Border.NO_BORDER)
                .setBorderBottom(new SolidBorder(new DeviceRgb(226, 232, 240), 0.5f))
                .setPaddingTop(5).setPaddingBottom(5);
    }

    private Cell valueCell(String text) {
        return new Cell().add(new Paragraph(text).setFontSize(8.5f))
                .setBorder(Border.NO_BORDER)
                .setBorderBottom(new SolidBorder(new DeviceRgb(226, 232, 240), 0.5f))
                .setPaddingTop(5).setPaddingBottom(5);
    }

    private static String safe(String s) {
        return s == null || s.isBlank() ? "—" : s;
    }

    private static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }
}
