package com.clenzy.fiscal.einvoicing.francepdp;

import com.clenzy.model.*;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.LocalDate;
import static org.assertj.core.api.Assertions.*;

public class BaitlyInvoiceCiiTest {
    static final BaitlyCiiValidator VALIDATOR=new BaitlyCiiValidator();
    final BaitlyInvoiceCiiBuilder builder=new BaitlyInvoiceCiiBuilder();
    @Test void officialRulesArePinnedAndUnmodifiedWithTheirLicenses() throws Exception {
        for(String dir:java.util.List.of("en16931-1.3.16","fr-1.4.0.04")) {
            var prefix="/fiscal/cii/"+dir+"/";
            try(var manifest=getClass().getResourceAsStream(prefix+"sources.json")) {
                var items=new com.fasterxml.jackson.databind.ObjectMapper().readTree(manifest);
                for(var item:items)try(var file=getClass().getResourceAsStream(prefix+item.path("file").asText())) {
                    assertThat(file).isNotNull();
                    var hash=java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(file.readAllBytes()));
                    assertThat(hash).isEqualTo(item.path("sha256").asText());
                }
            }
        }
    }
    public static Invoice invoice() {
        var i=new Invoice();i.setOrganizationId(2L);i.setInvoiceNumber("BAITLY-TEST-CII");i.setInvoiceDate(LocalDate.of(2026,10,7));i.setDueDate(LocalDate.of(2026,11,7));i.setStatus(InvoiceStatus.ISSUED);
        i.setCurrency("EUR");i.setCountryCode("FR");i.setSellerName("Vendeur TEST <&>");i.setSellerAddress("Adresse fictive vendeur");i.setSellerTaxId("FR00123456789");
        i.setBuyerName("Acheteur TEST");i.setBuyerAddress("Adresse fictive acheteur");i.setBuyerTaxId("FR00987654321");
        i.setLegalMentions("TEST : frais de recouvrement. TEST : pénalités de retard. TEST : aucun escompte.");
        i.setTotalHt(new BigDecimal("100.00"));i.setTotalTax(new BigDecimal("20.00"));i.setTotalTtc(new BigDecimal("120.00"));
        var l=new InvoiceLine();l.setTaxCategory("STANDARD");l.setLineNumber(1);l.setDescription("Service TEST <&>");l.setQuantity(BigDecimal.ONE);l.setUnitPriceHt(new BigDecimal("100.00"));l.setTotalHt(new BigDecimal("100.00"));l.setTaxRate(new BigDecimal("0.20"));l.setTaxAmount(new BigDecimal("20.00"));l.setTotalTtc(new BigDecimal("120.00"));i.addLine(l);return i;
    }
    public static BaitlyCiiPreparation data(){return new BaitlyCiiPreparation(new BaitlyCiiPreparation.Party("75001","Paris","123456789","123456789"),new BaitlyCiiPreparation.Party("69001","Lyon","987654321","987654321_TEST"),new BaitlyCiiPreparation.Terms("S1","TEST : frais de recouvrement.","TEST : pénalités de retard.","TEST : aucun escompte."));}
    @Test void completeDocumentPassesOfficialSchemaAndBusinessRules() {
        var i=invoice();var xml=builder.build(i,data());assertThat(VALIDATOR.validate(xml)).isEmpty();
        assertThat(VALIDATOR.validateFrance(xml)).isEmpty();
        assertThat(BaitlyCiiPreflight.issue(i,xml.getBytes(java.nio.charset.StandardCharsets.UTF_8))).isNull();
        assertThat(xml).contains("RateApplicablePercent>20<","&lt;&amp;&gt;").doesNotContain("RateApplicablePercent>0.2<");
        assertThat(i.getXmlContent()).isNull();
    }
    @Test void officialRulesDetectMissingDueDateAndWrongTotals() {
        var xml=builder.build(invoice(),data()).replace("<ram:DuePayableAmount>120</ram:DuePayableAmount>","<ram:DuePayableAmount>121</ram:DuePayableAmount>");
        assertThat(VALIDATOR.validate(xml)).anySatisfy(i->assertThat(i.code()).isEqualTo("BR-CO-16"));
    }
    @Test void incompleteLegacyDocumentAndExternalEntitiesAreRejected() {
        assertThat(VALIDATOR.validate(new FacturXCiiBuilder().build(invoice()))).isNotEmpty();
        assertThat(VALIDATOR.validate("<!DOCTYPE foo [<!ENTITY xxe SYSTEM 'file:///etc/passwd'>]><foo>&xxe;</foo>")).isNotEmpty();
        assertThat(VALIDATOR.validate("x".repeat(2_000_001))).isNotEmpty();
    }
    @Test void incompleteSnapshotsAndUnsupportedTaxCasesNeverInventData() {
        var i=invoice();i.setBuyerTaxId(null);assertThat(builder.issues(i)).anyMatch(s->s.contains("Identifiants TVA"));
        var incomplete=i;assertThatThrownBy(()->builder.build(incomplete,data())).isInstanceOf(IllegalArgumentException.class);
        i=invoice();i.getLines().getFirst().setTaxRate(BigDecimal.ZERO);assertThat(builder.issues(i)).isNotEmpty();
        i=invoice();i.setOriginalInvoiceId(1L);assertThat(builder.issues(i)).isNotEmpty();
    }
    @Test void frozenAmountsAreCheckedAndRoutingCannotIdentifyAnotherParty() {
        var i=invoice();i.getLines().getFirst().setTaxAmount(new BigDecimal("30"));assertThat(builder.issues(i)).isNotEmpty();
        assertThatThrownBy(()->builder.build(invoice(),new BaitlyCiiPreparation(data().seller(),new BaitlyCiiPreparation.Party("69001","Lyon","987654321","123456789"),data().terms()))).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void frenchRulesBlockMissingLegalCodesAndNoNewTermsMayBeInvented() {
        var xml=builder.build(invoice(),data()).replace("<ram:SubjectCode>PMT</ram:SubjectCode>","");
        assertThat(VALIDATOR.validate(xml)).isEmpty();assertThat(VALIDATOR.validateFrance(xml)).anyMatch(issue->issue.code().contains("PMT"));
        var i=invoice();i.setLegalMentions("Autre texte émis");assertThatThrownBy(()->builder.build(i,data())).hasMessageContaining("à l’identique");
    }
    @Test void vatBreakdownGroupsRatesAndDoesNotHideRoundingDifferences() {
        var i=invoice();var l=new InvoiceLine();l.setLineNumber(2);l.setDescription("Service deuxième taux");l.setQuantity(BigDecimal.ONE);l.setUnitPriceHt(new BigDecimal("100"));l.setTaxRate(new BigDecimal("0.10"));l.setTotalHt(new BigDecimal("100"));l.setTaxAmount(new BigDecimal("10"));l.setTotalTtc(new BigDecimal("110"));i.addLine(l);
        i.setTotalHt(new BigDecimal("200"));i.setTotalTax(new BigDecimal("30"));i.setTotalTtc(new BigDecimal("230"));assertThat(VALIDATOR.validate(builder.build(i,data()))).isEmpty();
    }
}
