package com.clenzy.service;

import com.clenzy.exception.DocumentGenerationException;
import com.clenzy.util.StringUtils;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.zip.CRC32;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/** Export Baitly à partir de la décision persistée, sans relire le tarif courant de la mission. */
@Service
public class ServiceQuoteAmendmentPdfService {
    private final ServiceQuoteAmendmentService amendments;
    private final LibreOfficeConversionService conversion;
    private final ServiceQuoteAmendmentArchives archives;

    public ServiceQuoteAmendmentPdfService(ServiceQuoteAmendmentService amendments,
                                           LibreOfficeConversionService conversion, ServiceQuoteAmendmentArchives archives) {
        this.amendments = amendments;
        this.conversion = conversion;
        this.archives = archives;
    }

    // La courte transaction de lecture doit être terminée avant l'appel Gotenberg.
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public byte[] download(Long id, Long orgId, Jwt jwt) {
        var snapshot = amendments.acceptedDocument(id, orgId, jwt);
        // Autorisation toujours revérifiée, même pour un fichier déjà archivé.
        byte[] existing = archives.read(id, snapshot.organizationId());
        if (existing != null) return existing;
        var claim = archives.claimForDownload(id, snapshot.organizationId());
        if (claim != null) return generate(claim);
        existing = archives.read(id, snapshot.organizationId());
        if (existing != null) return existing;
        throw new ArchivePendingException();
    }

    public static class ArchivePendingException extends RuntimeException {
        public ArchivePendingException() { super("Le PDF de l'avenant est en cours de préparation"); }
    }

    /** Une unité de travail au plus ; les baux sont enregistrés avant l'appel externe. */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public boolean archiveNext() {
        var claim = archives.claimNext();
        if (claim == null) return false;
        generate(claim);
        return true;
    }

    private byte[] generate(ServiceQuoteAmendmentArchives.Claim claim) {
        try {
            var snapshot = archives.snapshot(claim);
            byte[] pdf = conversion.convertToPdf(toOdt(snapshot), "baitly-avenant-" + claim.id() + ".odt");
            if (archives.complete(claim, pdf)) return pdf;
            // Un worker plus récent peut avoir archivé pendant l'expiration de notre bail.
            byte[] winner = archives.read(claim.id(), claim.orgId());
            if (winner != null) return winner;
            throw new ArchivePendingException();
        } catch (RuntimeException failure) {
            archives.retry(claim);
            throw failure;
        }
    }

    static byte[] toOdt(ServiceQuoteAmendmentService.AcceptedDocument data) {
        String body = paragraph("Title", "Baitly · Avenant accepté n° " + data.id())
                + paragraph("Body", "Devis n° " + data.quoteId() + " · Intervention n° " + data.interventionId())
                + paragraph("Heading", "Accord enregistré")
                + paragraph("Body", "Montant avant cet avenant : " + data.originalAmount().toPlainString() + " " + data.currency())
                + paragraph("Body", "Montant accepté : " + data.proposedAmount().toPlainString() + " " + data.currency())
                + paragraph("Heading", "Motif")
                + paragraph("Body", data.reason())
                + paragraph("Heading", "Historique de la décision")
                + paragraph("Body", "Proposé par le compte n° " + data.proposedBy() + " le " + data.createdAt() + " (UTC)")
                + paragraph("Body", "Accepté par le compte n° " + data.decidedBy() + " le " + data.decidedAt() + " (UTC)")
                + paragraph("Body", "Cet avenant complète le devis initial, qui reste conservé. Les montants ci-dessus sont ceux de cette décision, même si un autre avenant est accepté ensuite.")
                + paragraph("Body", "Ce document restitue une acceptation enregistrée dans Baitly ; il ne constitue pas un certificat de signature électronique.");
        String content = """
                <?xml version="1.0" encoding="UTF-8"?>
                <office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
                  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
                  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
                  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.2">
                  <office:automatic-styles>
                    <style:style style:name="Body" style:family="paragraph"><style:paragraph-properties fo:margin-bottom="0.25cm"/><style:text-properties fo:font-size="11pt" fo:color="#1B2A35"/></style:style>
                    <style:style style:name="Title" style:family="paragraph"><style:paragraph-properties fo:margin-bottom="0.6cm"/><style:text-properties fo:font-size="20pt" fo:font-weight="bold" fo:color="#1B2A35"/></style:style>
                    <style:style style:name="Heading" style:family="paragraph"><style:paragraph-properties fo:margin-top="0.4cm" fo:margin-bottom="0.2cm" fo:keep-with-next="always"/><style:text-properties fo:font-size="13pt" fo:font-weight="bold" fo:color="#1B2A35"/></style:style>
                  </office:automatic-styles>
                  <office:body><office:text>%s</office:text></office:body>
                </office:document-content>
                """.formatted(body);
        try (var bytes = new ByteArrayOutputStream(); var zip = new ZipOutputStream(bytes)) {
            byte[] mime = "application/vnd.oasis.opendocument.text".getBytes(StandardCharsets.UTF_8);
            var entry = new ZipEntry("mimetype");
            entry.setMethod(ZipEntry.STORED); entry.setSize(mime.length);
            var crc = new CRC32(); crc.update(mime); entry.setCrc(crc.getValue());
            zip.putNextEntry(entry); zip.write(mime); zip.closeEntry();
            write(zip, "content.xml", content);
            write(zip, "META-INF/manifest.xml", """
                    <?xml version="1.0" encoding="UTF-8"?>
                    <manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
                      <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>
                      <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
                    </manifest:manifest>
                    """);
            zip.finish();
            return bytes.toByteArray();
        } catch (IOException failure) {
            throw new DocumentGenerationException("Impossible de préparer le PDF de l'avenant", failure);
        }
    }

    private static String paragraph(String style, String text) {
        return "<text:p text:style-name=\"" + style + "\">"
                + StringUtils.escapeHtml(text).replace("\r\n", "\n").replace("\r", "\n").replace("\n", "<text:line-break/>")
                + "</text:p>";
    }

    private static void write(ZipOutputStream zip, String name, String content) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(content.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }
}
