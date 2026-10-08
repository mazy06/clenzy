package com.clenzy.service;

import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;


/** Export Baitly à partir de la décision persistée, sans relire le tarif courant de la mission. */
@Service
public class ServiceQuoteAmendmentPdfService {
    private final ServiceQuoteAmendmentService amendments;
    private final BaitlyPdfEngine conversion;
    private final ServiceQuoteAmendmentArchives archives;
    private final BaitlyDocumentIdentity identity;

    public ServiceQuoteAmendmentPdfService(ServiceQuoteAmendmentService amendments,
                                           BaitlyPdfEngine conversion, ServiceQuoteAmendmentArchives archives,
                                           BaitlyDocumentIdentity identity) {
        this.amendments = amendments;
        this.conversion = conversion;
        this.archives = archives;
        this.identity = identity;
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
            byte[] pdf = conversion.html(toHtml(snapshot, identity.name(snapshot.organizationId(), null)));
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

    static String toHtml(ServiceQuoteAmendmentService.AcceptedDocument data, String issuer) {
        String body = paragraph("Body", issuer)
                + paragraph("Title", "Avenant accepté n° " + data.id())
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
        return BaitlyDocumentHtml.page(issuer + " · Avenant accepté", body);
    }

    private static String paragraph(String style, String text) {
        String tag = switch (style) { case "Title" -> "h1"; case "Heading" -> "h2"; default -> "p"; };
        return "<" + tag + ">" + BaitlyDocumentHtml.escape(text).replace("\n", "<br>") + "</" + tag + ">";
    }
}
