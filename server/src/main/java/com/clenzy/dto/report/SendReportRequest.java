package com.clenzy.dto.report;

import java.util.List;

/**
 * A qui transmettre un rapport.
 *
 * <p>Vide ou absent, l'envoi part au seul destinataire du document. La liste
 * existe parce qu'un releve se copie souvent — un co-indivisaire, un comptable,
 * l'emetteur lui-meme — et que l'alternative etait de renvoyer le document a la
 * main depuis sa messagerie, hors de toute trace.</p>
 */
public record SendReportRequest(List<String> recipients) {

    public SendReportRequest {
        recipients = recipients == null ? List.of() : List.copyOf(recipients);
    }
}
