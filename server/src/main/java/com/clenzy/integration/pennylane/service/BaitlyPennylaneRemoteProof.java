package com.clenzy.integration.pennylane.service;

import com.clenzy.util.BaitlyExternalIds;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

/** Preuve d'existence d'un export, jamais preuve de paiement ni d'acceptation fiscale. */
final class BaitlyPennylaneRemoteProof {
    private BaitlyPennylaneRemoteProof() {}
    record Totals(BigDecimal net, BigDecimal tax, BigDecimal gross) {}
    static String verify(Map<String, Object> remote, Map<String, Object> request,
                         BaitlyAccountingExportJournal.Kind kind, Number partyId, Totals totals) {
        try {
            if (!(request.get("external_reference") instanceof String reference)
                    || !reference.matches("baitly_export_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}")
                    || remote == null || remote.containsKey("error") || !"EUR".equals(request.get("currency"))
                    || !Objects.equals(request.get("external_reference"), remote.get("external_reference"))
                    || !Objects.equals(request.get("currency"), remote.get("currency"))
                    || !Objects.equals(request.get("date"), remote.get("date"))
                    || !Objects.equals(request.get("deadline"), remote.get("deadline"))
                    || !remote.containsKey("archived_at") || remote.get("archived_at") != null) throw invalid();
            String partyKey = kind == BaitlyAccountingExportJournal.Kind.INVOICE ? "customer" : "supplier";
            if (!(remote.get(partyKey) instanceof Map<?, ?> party)
                    || !(party.get("id") instanceof Number id)
                    || !BaitlyExternalIds.require(id, 50).equals(BaitlyExternalIds.require(partyId, 50))) throw invalid();
            if (kind == BaitlyAccountingExportJournal.Kind.INVOICE) {
                if (!remote.containsKey("credited_invoice") || remote.get("credited_invoice") != null
                        || !Set.of("draft", "incomplete", "upcoming", "late", "paid", "partially_paid").contains(remote.get("status"))) throw invalid();
            } else if (!Set.of("draft", "entry", "validation_needed", "complete").contains(remote.get("accounting_status"))) throw invalid();
            if (!(request.get("invoice_lines") instanceof List<?> lines) || lines.isEmpty()) throw invalid();
            BigDecimal net = BigDecimal.ZERO, tax = BigDecimal.ZERO;
            for (Object value : lines) {
                if (!(value instanceof Map<?, ?> line)) throw invalid();
                BigDecimal subtotal = decimal(line.get("quantity")).multiply(decimal(line.get("raw_currency_unit_price"))).setScale(2, RoundingMode.HALF_UP);
                BigDecimal rate = switch (Objects.toString(line.get("vat_rate"), "")) {
                    case "exempt" -> BigDecimal.ZERO;
                    case "FR_200" -> new BigDecimal("0.20");
                    case "FR_100" -> new BigDecimal("0.10");
                    case "FR_055" -> new BigDecimal("0.055");
                    default -> throw invalid();
                };
                net = net.add(subtotal);
                tax = tax.add(subtotal.multiply(rate).setScale(2, RoundingMode.HALF_UP));
            }
            if (totals == null || totals.net() == null || totals.tax() == null || totals.gross() == null
                    || totals.net().compareTo(net) != 0 || totals.tax().compareTo(tax) != 0 || totals.gross().compareTo(net.add(tax)) != 0
                    || net.signum() <= 0 || decimal(remote.get("currency_amount_before_tax")).compareTo(net) != 0
                    || decimal(remote.get("currency_tax")).compareTo(tax) != 0
                    || decimal(remote.get("currency_amount")).compareTo(net.add(tax)) != 0) throw invalid();
            if (!(remote.get("id") instanceof Number remoteId)) throw invalid();
            return BaitlyExternalIds.require(remoteId, 50);
        } catch (RuntimeException ignored) { throw invalid(); }
    }
    private static BigDecimal decimal(Object value) {
        if (!(value instanceof String text) || !text.matches("-?[0-9]{1,12}(\\.[0-9]{1,6})?")) throw invalid();
        return new BigDecimal(text);
    }
    private static BaitlyPennylaneDiagnostics.Failure invalid() { return BaitlyAccountingExportJournal.unconfirmed(); }
}
