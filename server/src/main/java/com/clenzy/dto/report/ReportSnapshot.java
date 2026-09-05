package com.clenzy.dto.report;

import java.util.List;

/**
 * Photographie CHIFFREE et FIGEE d'un rapport.
 *
 * <p>C'est le contrat central du module : un seul snapshot alimente les TROIS
 * rendus — l'ecran, le PDF, et le commentaire de l'agent. Ce qu'on voit est
 * exactement ce qu'on envoie, par construction, sans qu'aucun des trois n'ait
 * a recalculer quoi que ce soit.</p>
 *
 * <p><b>Immuable.</b> Un rapport transmis ne doit jamais changer sous les pieds
 * de son destinataire : le snapshot est persiste tel quel avec le document,
 * comme les lignes d'une facture. Sans cela, deux personnes discutent de deux
 * documents differents portant le meme numero.</p>
 *
 * <p><b>Deja formate.</b> Les valeurs portent leur forme d'affichage (montant
 * avec devise, taux avec pourcent) EN PLUS de leur valeur brute. Les trois
 * rendus affichent donc le meme texte, et l'agent lit des nombres exploitables.</p>
 */
public record ReportSnapshot(
        ReportMeta meta,
        List<ReportKpi> kpis,
        List<ReportSection> sections
) {
    public ReportSnapshot {
        kpis = kpis == null ? List.of() : List.copyOf(kpis);
        sections = sections == null ? List.of() : List.copyOf(sections);
    }

    /** Section par identifiant, pour rattacher un commentaire a sa place. */
    public ReportSection section(String id) {
        return sections.stream().filter(s -> s.id().equals(id)).findFirst().orElse(null);
    }
}
