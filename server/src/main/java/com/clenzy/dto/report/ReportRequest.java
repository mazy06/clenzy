package com.clenzy.dto.report;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

/**
 * Demande de generation d'un ou plusieurs rapports.
 *
 * <p>Une seule demande peut produire N documents : c'est {@link #groupBy} qui
 * tranche. Une conciergerie qui veut envoyer son releve mensuel a ses vingt
 * proprietaires fait UN appel, pas vingt.</p>
 *
 * @param sections identifiants des sections retenues ; vide = le jeu complet du profil
 * @param withNarrative demander le commentaire de l'agent. Faux produit un
 *                      rapport entierement deterministe, qui reste lisible :
 *                      les constats calcules ne dependent jamais de l'agent.
 *
 * <p>Le TITRE ne figure pas ici, et c'est deliberé : il est etabli par
 * {@code ReportSnapshotBuilder} a partir du destinataire et de la periode. Un
 * titre libre laissait produire un « Releve de gestion » qui etait en fait un
 * dossier prospect anonymise — le document annoncait alors autre chose que ce
 * qu'il contenait.</p>
 */
public record ReportRequest(
        ReportProfile profile,
        ReportGroupBy groupBy,
        LocalDate from,
        LocalDate to,
        Set<Long> ownerIds,
        Set<Long> propertyIds,
        List<String> sections,
        boolean withNarrative
) {
    public ReportRequest {
        profile = profile == null ? ReportProfile.OWNER : profile;
        groupBy = groupBy == null ? ReportGroupBy.NONE : groupBy;
        ownerIds = ownerIds == null ? Set.of() : Set.copyOf(ownerIds);
        propertyIds = propertyIds == null ? Set.of() : Set.copyOf(propertyIds);
        sections = sections == null ? List.of() : List.copyOf(sections);
    }

    public boolean wants(String sectionId) {
        return sections.isEmpty() || sections.contains(sectionId);
    }
}
