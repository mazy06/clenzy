package com.clenzy.fiscal.einvoicing.francepdp;

import com.clenzy.model.Invoice;
import com.clenzy.model.InvoiceLine;
import com.clenzy.model.InvoiceStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/** Données locales de contrat HTTP, jamais soumises à un partenaire. */
final class BaitlyIopoleFixture {
    static final UUID CUSTOMER = UUID.fromString("11111111-1111-4111-8111-111111111111");
    static final UUID REMOTE = UUID.fromString("22222222-2222-4222-8222-222222222222");
    static final String REFERENCE = "iopole:SANDBOX:" + CUSTOMER + ":" + REMOTE;

    static BaitlyIopoleProperties config() {
        var p = new BaitlyIopoleProperties();
        p.setEnabled(true); p.setClientId("test-client"); p.setClientSecret("test-secret");
        var c = new BaitlyIopoleProperties.Customer(); c.setCustomerId(CUSTOMER); c.setSellerTaxId("FR-TEST-SELLER");
        c.setPullModeConfirmed(true);
        p.getCustomers().put(2L, c); return p;
    }

    static Invoice invoice() {
        var i = new Invoice(); i.setId(8L); i.setOrganizationId(2L); i.setInvoiceNumber("BAITLY-TEST-1");
        i.setStatus(InvoiceStatus.ISSUED); i.setInvoiceDate(LocalDate.of(2026, 10, 7));
        i.setCurrency("EUR"); i.setCountryCode("FR");
        i.setSellerName("Vendeur test"); i.setSellerTaxId("FR-TEST-SELLER"); i.setSellerAddress("Adresse vendeur test");
        i.setBuyerName("Acheteur test"); i.setBuyerTaxId("FR-TEST-BUYER"); i.setBuyerAddress("Adresse acheteur test");
        i.setTotalHt(new BigDecimal("100.00")); i.setTotalTax(new BigDecimal("20.00")); i.setTotalTtc(new BigDecimal("120.00"));
        var line = new InvoiceLine(); line.setLineNumber(1); line.setDescription("Service test"); line.setQuantity(BigDecimal.ONE);
        line.setUnitPriceHt(new BigDecimal("100.00")); line.setTotalHt(new BigDecimal("100.00"));
        line.setTaxRate(new BigDecimal("0.20")); line.setTaxAmount(new BigDecimal("20.00")); line.setTotalTtc(new BigDecimal("120.00"));
        i.addLine(line); i.setXmlContent(cii()); return i;
    }

    static String cii() {
        return """
            <rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
              xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
              xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
              <rsm:ExchangedDocument><ram:ID>BAITLY-TEST-1</ram:ID><ram:TypeCode>380</ram:TypeCode>
                <ram:IssueDateTime><udt:DateTimeString format="102">20261007</udt:DateTimeString></ram:IssueDateTime>
              </rsm:ExchangedDocument>
              <rsm:SupplyChainTradeTransaction>
                <ram:IncludedSupplyChainTradeLineItem>
                  <ram:AssociatedDocumentLineDocument><ram:LineID>1</ram:LineID></ram:AssociatedDocumentLineDocument>
                  <ram:SpecifiedTradeProduct><ram:Name>Service test</ram:Name></ram:SpecifiedTradeProduct>
                  <ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>100</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>
                  <ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="C62">1</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>
                  <ram:SpecifiedLineTradeSettlement><ram:ApplicableTradeTax><ram:RateApplicablePercent>20</ram:RateApplicablePercent></ram:ApplicableTradeTax>
                    <ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>100</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>
                  </ram:SpecifiedLineTradeSettlement>
                </ram:IncludedSupplyChainTradeLineItem>
                <ram:ApplicableHeaderTradeAgreement>
            """ + party("SellerTradeParty", "Vendeur test", "FR-TEST-SELLER", "Adresse vendeur test")
                + party("BuyerTradeParty", "Acheteur test", "FR-TEST-BUYER", "Adresse acheteur test") + """
                </ram:ApplicableHeaderTradeAgreement>
                <ram:ApplicableHeaderTradeSettlement><ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
                  <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
                    <ram:TaxBasisTotalAmount>100.00</ram:TaxBasisTotalAmount><ram:TaxTotalAmount currencyID="EUR">20.00</ram:TaxTotalAmount>
                    <ram:GrandTotalAmount>120.00</ram:GrandTotalAmount>
                  </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
                </ram:ApplicableHeaderTradeSettlement>
              </rsm:SupplyChainTradeTransaction>
            </rsm:CrossIndustryInvoice>
            """;
    }

    private static String party(String node, String name, String taxId, String address) {
        return """
            <ram:%s><ram:Name>%s</ram:Name><ram:SpecifiedLegalOrganization><ram:ID>TEST-ONLY</ram:ID></ram:SpecifiedLegalOrganization>
            <ram:PostalTradeAddress><ram:PostcodeCode>75001</ram:PostcodeCode><ram:LineOne>%s</ram:LineOne><ram:CityName>Paris</ram:CityName><ram:CountryID>FR</ram:CountryID></ram:PostalTradeAddress>
            <ram:URIUniversalCommunication><ram:URIID schemeID="0225">TEST-ONLY</ram:URIID></ram:URIUniversalCommunication>
            <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">%s</ram:ID></ram:SpecifiedTaxRegistration></ram:%s>
            """.formatted(node, name, address, taxId, node);
    }

    static String metadata() {
        return """
            {"invoiceId":"%s","way":"EMITTED","businessData":{
              "invoiceId":"BAITLY-TEST-1","invoiceDate":"2026-10-07","type":"380",
              "seller":{"vatNumber":"FR-TEST-SELLER"},"buyer":{"vatNumber":"FR-TEST-BUYER"},
              "monetary":{"invoiceAmount":{"amount":120,"currency":"EUR"},
                "taxBasisTotalAmount":{"amount":100,"currency":"EUR"},"taxTotalAmount":{"amount":20,"currency":"EUR"}}}}
            """.formatted(REMOTE);
    }

    static String history(String status) {
        return """
            [{"invoiceId":"%s","destType":"OPERATOR","date":"2026-10-07T10:00:00Z","status":{"code":"%s"}}]
            """.formatted(REMOTE, status);
    }
}
