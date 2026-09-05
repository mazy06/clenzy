package com.clenzy.dto.report;

import java.util.List;
import java.util.Map;

/**
 * Le commentaire redige par l'agent, structure.
 *
 * <p>Structure et non texte libre : un rapport dont on devrait deviner ou
 * commence le commentaire d'une section serait ingerable. L'agent renvoie du
 * JSON, on le place.</p>
 *
 * @param executiveSummary les quelques phrases de la page de synthese
 * @param sectionComments  commentaire par identifiant de section
 * @param risks            points de vigilance, formules en clair
 * @param model            le modele qui a redige — tracabilite d'un texte diffuse
 * @param rejected         vrai si la validation a ecarte le texte (chiffre invente)
 */
public record ReportNarrative(
        String executiveSummary,
        Map<String, String> sectionComments,
        List<String> risks,
        String model,
        boolean rejected,
        String rejectionReason
) {
    public ReportNarrative {
        sectionComments = sectionComments == null ? Map.of() : Map.copyOf(sectionComments);
        risks = risks == null ? List.of() : List.copyOf(risks);
    }

    public static ReportNarrative empty() {
        return new ReportNarrative(null, Map.of(), List.of(), null, false, null);
    }

    public static ReportNarrative rejectedBecause(String reason, String model) {
        return new ReportNarrative(null, Map.of(), List.of(), model, true, reason);
    }
}
