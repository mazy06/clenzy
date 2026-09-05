package com.clenzy.service.report.snapshot;

import com.clenzy.dto.report.*;

import java.util.*;

/**
 * Retire d'un rapport ce qui identifie ses biens et ses proprietaires.
 *
 * <p>Un dossier prospect prouve une qualite de gestion ; il n'a aucune raison
 * de nommer les logements ni les personnes dont il expose les revenus.
 * Diffuser « Villa Cauderan a rapporte 7 465 € en aout » a un tiers est une
 * fuite de donnees, quelle que soit l'intention commerciale — et ce tiers est
 * par definition quelqu'un avec qui aucun contrat ne lie encore.</p>
 *
 * <p>La substitution est STABLE dans tout le document : « Villa Cauderan »
 * devient « Bien 1 » partout — page de garde, tableaux, axes, constats. Deux
 * pseudonymes differents pour le meme bien rendraient le rapport incoherent, et
 * un pseudonyme reutilise le rendrait faux.</p>
 *
 * <p>Les MONTANTS sont conserves : ce sont eux qui font la preuve. C'est le
 * lien vers une personne qu'on coupe, pas la performance.</p>
 */
public final class ReportAnonymiser {

    private ReportAnonymiser() {
    }

    public static ReportSnapshot anonymise(ReportSnapshot snapshot) {
        if (snapshot.meta().profile() != ReportProfile.PROSPECT) {
            return snapshot;
        }

        final Map<String, String> aliases = aliasesOf(snapshot);

        final ReportMeta meta = snapshot.meta();
        final ReportMeta cleaned = new ReportMeta(
                meta.documentNumber(), meta.version(), meta.profile(), meta.title(),
                meta.issuerName(), meta.issuerLogoUrl(),
                // Le destinataire est le prospect lui-meme : son nom reste.
                meta.recipientName(),
                meta.periodStart(), meta.periodEnd(),
                meta.comparePeriodStart(), meta.comparePeriodEnd(),
                meta.lastYearPeriodStart(), meta.lastYearPeriodEnd(),
                meta.dataAsOf(), meta.currency(),
                meta.scopeLabels().stream().map(label -> alias(aliases, label)).toList(),
                meta.scopeNote());

        return new ReportSnapshot(cleaned, snapshot.kpis(),
                snapshot.sections().stream().map(section -> anonymise(section, aliases)).toList());
    }

    /** Le repertoire des pseudonymes, construit une fois sur les biens du perimetre. */
    private static Map<String, String> aliasesOf(ReportSnapshot snapshot) {
        final Map<String, String> aliases = new LinkedHashMap<>();
        int index = 1;
        for (String label : snapshot.meta().scopeLabels()) {
            if (label != null && !label.isBlank() && !aliases.containsKey(label)) {
                aliases.put(label, "Bien " + index++);
            }
        }
        return aliases;
    }

    private static ReportSection anonymise(ReportSection section, Map<String, String> aliases) {
        return new ReportSection(
                section.id(), section.title(), section.subtitle(), section.kind(),
                anonymise(section.table(), aliases),
                anonymise(section.chart(), aliases),
                section.notes().stream().map(note -> anonymise(note, aliases)).toList(),
                replaceAll(section.body(), aliases),
                replaceAll(section.narrative(), aliases));
    }

    private static ReportTable anonymise(ReportTable table, Map<String, String> aliases) {
        if (table == null) {
            return null;
        }
        return new ReportTable(table.columns(), table.aligns(),
                table.rows().stream()
                        .map(row -> row.stream().map(cell -> alias(aliases, cell)).toList())
                        .toList(),
                table.totals().stream().map(cell -> alias(aliases, cell)).toList());
    }

    private static ReportChart anonymise(ReportChart chart, Map<String, String> aliases) {
        if (chart == null) {
            return null;
        }
        return new ReportChart(chart.type(),
                chart.categories().stream().map(label -> alias(aliases, label)).toList(),
                chart.series(), chart.valueUnit());
    }

    private static ReportNote anonymise(ReportNote note, Map<String, String> aliases) {
        return new ReportNote(note.tone(),
                replaceAll(note.label(), aliases),
                replaceAll(note.detail(), aliases),
                note.impact());
    }

    /** Substitution EXACTE : une cellule qui est un nom de bien devient son pseudonyme. */
    private static String alias(Map<String, String> aliases, String value) {
        if (value == null) {
            return null;
        }
        final String direct = aliases.get(value);
        return direct != null ? direct : replaceAll(value, aliases);
    }

    /**
     * Substitution DANS un texte libre.
     *
     * <p>Les noms les plus longs d'abord : sans cela « Duplex » remplacerait le
     * debut de « Duplex Croisette » et laisserait « Bien 3 Croisette » — le nom
     * resterait donc lisible a moitie.</p>
     */
    private static String replaceAll(String text, Map<String, String> aliases) {
        if (text == null || text.isBlank()) {
            return text;
        }
        final List<String> names = new ArrayList<>(aliases.keySet());
        names.sort(Comparator.comparingInt(String::length).reversed());
        String result = text;
        for (String name : names) {
            result = result.replace(name, aliases.get(name));
        }
        return result;
    }
}
