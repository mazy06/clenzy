package com.clenzy.service;

import com.clenzy.dto.ImportAffiliateEarningRequest;
import com.clenzy.model.ActivityProvider;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Lit un export de conversions d'affiliation et le traduit en lignes a importer.
 *
 * <p>Le CSV est le seul canal commun aux trois programmes : Viator expose bien
 * une API de reporting ({@code /bookings/modified-since}), mais GetYourGuide et
 * Klook ne publient leurs conversions que via un tableau de bord exportable.
 * Un parseur tolerant couvre donc les trois d'un coup, la ou trois clients HTTP
 * n'en couvriraient qu'un.</p>
 *
 * <p><b>Tolerance assumee</b> : separateur, casse et libelles d'en-tetes varient
 * d'un programme a l'autre — et d'une version d'export a l'autre. Exiger un
 * format unique obligerait l'utilisateur a retravailler chaque fichier a la
 * main, ce que l'import est precisement cense eviter.</p>
 */
@Component
public class AffiliateEarningsCsvParser {

    /** Libelles rencontres selon les programmes, normalises avant comparaison. */
    private static final List<String> REFERENCE_HEADERS = List.of(
        "bookingreference", "bookingref", "reference", "orderid", "bookingid",
        "reservationid", "transactionid", "referencedereservation");

    private static final List<String> AMOUNT_HEADERS = List.of(
        "commission", "commissionamount", "earnings", "payout", "revenue",
        "montantcommission", "commissiongagnee");

    private static final List<String> CURRENCY_HEADERS = List.of("currency", "devise");

    private static final List<String> PROPERTY_HEADERS = List.of(
        "propertyid", "property", "logement", "logementid");

    /**
     * @param provider programme d'origine du fichier — le CSV ne le porte pas
     * @throws IllegalArgumentException si les colonnes indispensables manquent,
     *         plutot que d'importer silencieusement zero ligne
     */
    public List<ImportAffiliateEarningRequest> parse(String content, ActivityProvider provider) {
        List<String> lines = content.lines()
            .filter(l -> !l.isBlank())
            .toList();
        if (lines.isEmpty()) {
            throw new IllegalArgumentException("Fichier vide");
        }

        char separator = detectSeparator(lines.get(0));
        Map<String, Integer> columns = indexHeaders(splitLine(lines.get(0), separator));

        Integer refIndex = firstMatch(columns, REFERENCE_HEADERS);
        Integer amountIndex = firstMatch(columns, AMOUNT_HEADERS);
        if (refIndex == null || amountIndex == null) {
            throw new IllegalArgumentException(
                "Colonnes introuvables : une reference de reservation et un montant de "
                + "commission sont requis. En-tetes lus : " + columns.keySet());
        }
        Integer currencyIndex = firstMatch(columns, CURRENCY_HEADERS);
        Integer propertyIndex = firstMatch(columns, PROPERTY_HEADERS);

        List<ImportAffiliateEarningRequest> rows = new ArrayList<>();
        for (String line : lines.subList(1, lines.size())) {
            List<String> cells = splitLine(line, separator);
            String reference = cellAt(cells, refIndex);
            BigDecimal amount = parseAmount(cellAt(cells, amountIndex));
            // Une ligne sans reference ou sans montant exploitable n'est pas une
            // erreur de fichier : les exports portent des lignes de total et des
            // conversions en attente, qui n'ont rien a crediter.
            if (reference == null || amount == null || amount.signum() <= 0) {
                continue;
            }
            rows.add(new ImportAffiliateEarningRequest(
                provider,
                reference,
                amount,
                cellAt(cells, currencyIndex),
                parseLong(cellAt(cells, propertyIndex))));
        }
        return rows;
    }

    /** Les exports europeens utilisent le point-virgule, les anglo-saxons la virgule. */
    private char detectSeparator(String header) {
        return header.chars().filter(c -> c == ';').count()
             > header.chars().filter(c -> c == ',').count() ? ';' : ',';
    }

    private Map<String, Integer> indexHeaders(List<String> headerCells) {
        Map<String, Integer> columns = new java.util.LinkedHashMap<>();
        for (int i = 0; i < headerCells.size(); i++) {
            columns.putIfAbsent(normalize(headerCells.get(i)), i);
        }
        return columns;
    }

    private Integer firstMatch(Map<String, Integer> columns, List<String> candidates) {
        for (String candidate : candidates) {
            Integer index = columns.get(candidate);
            if (index != null) {
                return index;
            }
        }
        return null;
    }

    /** Minuscules sans accents, espaces ni ponctuation : « Booking Ref. » → « bookingref ». */
    private String normalize(String raw) {
        String stripped = java.text.Normalizer.normalize(raw == null ? "" : raw,
                java.text.Normalizer.Form.NFD)
            .replaceAll("\\p{M}", "");
        return stripped.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    /** Découpe en respectant les guillemets : un libelle peut contenir le separateur. */
    private List<String> splitLine(String line, char separator) {
        List<String> cells = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                boolean escapedQuote = quoted && i + 1 < line.length() && line.charAt(i + 1) == '"';
                if (escapedQuote) {
                    current.append('"');
                    i++;
                } else {
                    quoted = !quoted;
                }
            } else if (c == separator && !quoted) {
                cells.add(current.toString().trim());
                current.setLength(0);
            } else {
                current.append(c);
            }
        }
        cells.add(current.toString().trim());
        return cells;
    }

    private String cellAt(List<String> cells, Integer index) {
        if (index == null || index >= cells.size()) {
            return null;
        }
        String value = cells.get(index);
        return value == null || value.isBlank() ? null : value;
    }

    /**
     * Accepte « 12.34 », « 12,34 » et « 1 234,56 », avec ou sans symbole monetaire :
     * un export francais et un export anglo-saxon ne s'ecrivent pas pareil.
     */
    private BigDecimal parseAmount(String raw) {
        if (raw == null) {
            return null;
        }
        String cleaned = raw.replaceAll("[^0-9,.\\-]", "");
        if (cleaned.isBlank()) {
            return null;
        }
        int lastComma = cleaned.lastIndexOf(',');
        int lastDot = cleaned.lastIndexOf('.');
        if (lastComma > lastDot) {
            // Virgule decimale : les points restants sont des separateurs de milliers.
            cleaned = cleaned.replace(".", "").replace(',', '.');
        } else {
            cleaned = cleaned.replace(",", "");
        }
        try {
            return new BigDecimal(cleaned);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Long parseLong(String raw) {
        if (raw == null) {
            return null;
        }
        try {
            return Long.parseLong(raw.replaceAll("[^0-9]", ""));
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
