package com.clenzy.integration.pennylane.service;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.Arguments;
import java.util.*;
import java.util.stream.Stream;
import static org.assertj.core.api.Assertions.*;
import static com.clenzy.integration.pennylane.service.BaitlyAccountingExportJournal.Kind;

class BaitlyPennylaneRemoteProofTest {
    static final String REF = "baitly_export_12345678-1234-1234-1234-123456789abc";
    static Map<String,Object> request() {
        return Map.of("external_reference",REF,"currency","EUR","date","2026-10-23","deadline","2026-11-22",
                "invoice_lines",List.of(Map.of("quantity","2","raw_currency_unit_price","10.00","vat_rate","FR_200")));
    }
    static Map<String,Object> remote(Kind kind) {
        var r = new HashMap<String,Object>();
        r.putAll(Map.of("id",42,"external_reference",REF,"currency","EUR","date","2026-10-23","deadline","2026-11-22",
                "currency_amount_before_tax","20.00","currency_tax","4.00","currency_amount","24.00"));
        r.put("archived_at",null);r.put("credited_invoice",null);r.put("status","draft");r.put("accounting_status","complete");
        r.put(kind==Kind.INVOICE?"customer":"supplier",Map.of("id",7));return r;
    }
    @ParameterizedTest @EnumSource(Kind.class)
    void exactProofConfirmsOnlyExistenceOfTheCorrectExport(Kind kind) {
        assertThat(BaitlyPennylaneRemoteProof.verify(remote(kind),request(),kind,7,new BaitlyPennylaneRemoteProof.Totals(new java.math.BigDecimal("20"),new java.math.BigDecimal("4"),new java.math.BigDecimal("24")))).isEqualTo("42");
    }
    static Stream<Arguments> invalid() {
        return Arrays.stream(Kind.values()).flatMap(kind -> Stream.of("id","reference","currency","date","deadline","net","tax","total","party","archived","missing-archive","credit","status","private-error","empty","numeric-money")
                .map(caseName -> Arguments.of(kind,caseName)));
    }
    @ParameterizedTest @MethodSource("invalid")
    void insufficientOrDifferentEvidenceNeverConfirms(Kind kind, String scenario) {
        var r=remote(kind);
        switch(scenario) {
            case "id" -> r.put("id",0);
            case "reference" -> r.put("external_reference","other-reference");
            case "currency" -> r.put("currency","USD");
            case "date" -> r.put("date","2026-10-22");
            case "deadline" -> r.put("deadline","2026-11-23");
            case "net" -> r.put("currency_amount_before_tax","19.99");
            case "tax" -> r.put("currency_tax","3.99");
            case "total" -> r.put("currency_amount","23.99");
            case "party" -> r.put(kind==Kind.INVOICE?"customer":"supplier",Map.of("id",8));
            case "archived" -> r.put("archived_at","2026-10-23");
            case "missing-archive" -> r.remove("archived_at");
            case "credit" -> {if(kind==Kind.INVOICE) r.put("credited_invoice",Map.of("id",8));else r.put("accounting_status","archived");}
            case "status" -> {r.put("status","credit_note");r.put("accounting_status","unknown");}
            case "private-error" -> r.put("error","synthetic-private@example.invalid");
            case "empty" -> r.clear();
            default -> r.put("currency_amount",24.0);
        }
        assertThatThrownBy(() -> BaitlyPennylaneRemoteProof.verify(r,request(),kind,7,new BaitlyPennylaneRemoteProof.Totals(new java.math.BigDecimal("20"),new java.math.BigDecimal("4"),new java.math.BigDecimal("24"))))
                .hasMessage("Synchronisation non confirmée ; vérifier le résultat avant de relancer").hasNoCause()
                .satisfies(error -> {assertThat(error.getSuppressed()).isEmpty();assertThat(error.getMessage()).doesNotContain("synthetic-private");});
    }
    @ParameterizedTest @EnumSource(Kind.class)
    void internallyConsistentRemoteTotalsCannotOverrideDifferentLocalTotals(Kind kind) {
        var local = new BaitlyPennylaneRemoteProof.Totals(new java.math.BigDecimal("19.99"),new java.math.BigDecimal("4.00"),new java.math.BigDecimal("23.99"));
        assertThatThrownBy(() -> BaitlyPennylaneRemoteProof.verify(remote(kind),request(),kind,7,local)).hasNoCause();
        var request = new HashMap<>(request());request.put("external_reference","clenzy_inv_legacy");
        var remote = remote(kind);remote.put("external_reference","clenzy_inv_legacy");
        assertThatThrownBy(() -> BaitlyPennylaneRemoteProof.verify(remote,request,kind,7,local)).hasNoCause();
    }
}
