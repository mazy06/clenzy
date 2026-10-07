package com.clenzy.fiscal.einvoicing.francepdp;

import com.clenzy.model.Invoice;
import org.w3c.dom.Document;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.SAXParseException;
import org.xml.sax.helpers.DefaultHandler;

import javax.xml.XMLConstants;
import javax.xml.namespace.NamespaceContext;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.xpath.XPath;
import javax.xml.xpath.XPathConstants;
import javax.xml.xpath.XPathFactory;
import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.Iterator;
import java.util.Map;
import java.util.Objects;

/** Cohérence avec la facture source ; complétée par le validateur EN 16931 local. */
final class BaitlyCiiPreflight {
    private static final Map<String, String> NAMESPACES = Map.of(
        "rsm", "urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100",
        "ram", "urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100",
        "udt", "urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100");
    private static final String ROOT = "/rsm:CrossIndustryInvoice/";
    private static final String TRADE = ROOT + "rsm:SupplyChainTradeTransaction/";
    private static final String SETTLEMENT = TRADE + "ram:ApplicableHeaderTradeSettlement/";

    private BaitlyCiiPreflight() {}

    static String issue(Invoice invoice, byte[] bytes) {
        try {
            if (bytes == null || bytes.length == 0 || bytes.length > 2_000_000) return "Document CII absent ou trop volumineux";
            var document = parse(bytes);
            var xpath = xpath();
            equal(value(xpath, document, ROOT + "rsm:ExchangedDocument/ram:ID"), invoice.getInvoiceNumber());
            equal(value(xpath, document, ROOT + "rsm:ExchangedDocument/ram:TypeCode"), invoice.getOriginalInvoiceId() == null ? "380" : "381");
            equal(value(xpath, document, ROOT + "rsm:ExchangedDocument/ram:IssueDateTime/udt:DateTimeString"),
                invoice.getInvoiceDate().format(DateTimeFormatter.BASIC_ISO_DATE));
            equal(value(xpath, document, SETTLEMENT + "ram:InvoiceCurrencyCode"), invoice.getCurrency());
            party(xpath, document, "SellerTradeParty", invoice.getSellerName(), invoice.getSellerTaxId(), invoice.getSellerAddress());
            party(xpath, document, "BuyerTradeParty", invoice.getBuyerName(), invoice.getBuyerTaxId(), invoice.getBuyerAddress());
            String totals = SETTLEMENT + "ram:SpecifiedTradeSettlementHeaderMonetarySummation/";
            amount(value(xpath, document, totals + "ram:TaxBasisTotalAmount"), invoice.getTotalHt());
            amount(value(xpath, document, totals + "ram:TaxTotalAmount"), invoice.getTotalTax());
            amount(value(xpath, document, totals + "ram:GrandTotalAmount"), invoice.getTotalTtc());
            equal(value(xpath, document, totals + "ram:TaxTotalAmount/@currencyID"), invoice.getCurrency());
            if (invoice.getOriginalInvoiceId() != null) required(value(xpath, document, SETTLEMENT + "ram:InvoiceReferencedDocument/ram:IssuerAssignedID"));
            lines(xpath, document, invoice);
            return null;
        } catch (Exception e) {
            // Ne jamais retourner le contenu du XML, les identifiants fiscaux ou une erreur du parseur.
            return "Document CII incomplet ou différent de la facture émise ; préparation fiscale requise";
        }
    }

    static Document parse(byte[] bytes) throws Exception {
        var factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
        factory.setXIncludeAware(false);
        var builder = factory.newDocumentBuilder();
        builder.setErrorHandler(new DefaultHandler() {
            @Override public void error(SAXParseException e) throws SAXParseException { throw e; }
            @Override public void fatalError(SAXParseException e) throws SAXParseException { throw e; }
        });
        return builder.parse(new ByteArrayInputStream(bytes));
    }

    private static XPath xpath() {
        var xpath = XPathFactory.newInstance().newXPath();
        xpath.setNamespaceContext(new NamespaceContext() {
            public String getNamespaceURI(String prefix) { return NAMESPACES.getOrDefault(prefix, XMLConstants.NULL_NS_URI); }
            public String getPrefix(String uri) { return NAMESPACES.entrySet().stream().filter(e -> e.getValue().equals(uri)).map(Map.Entry::getKey).findFirst().orElse(null); }
            public Iterator<String> getPrefixes(String uri) { return NAMESPACES.keySet().stream().filter(k -> NAMESPACES.get(k).equals(uri)).iterator(); }
        });
        return xpath;
    }

    private static void party(XPath xpath, Document document, String party, String name, String taxId, String address) throws Exception {
        String base = TRADE + "ram:ApplicableHeaderTradeAgreement/ram:" + party + "/";
        equal(value(xpath, document, base + "ram:Name"), name);
        equal(value(xpath, document, base + "ram:SpecifiedTaxRegistration/ram:ID[@schemeID='VA']"), taxId);
        equal(value(xpath, document, base + "ram:PostalTradeAddress/ram:LineOne"), address);
        equal(value(xpath, document, base + "ram:PostalTradeAddress/ram:CountryID"), "FR");
        required(value(xpath, document, base + "ram:PostalTradeAddress/ram:PostcodeCode"));
        required(value(xpath, document, base + "ram:PostalTradeAddress/ram:CityName"));
        required(value(xpath, document, base + "ram:SpecifiedLegalOrganization/ram:ID"));
        required(value(xpath, document, base + "ram:URIUniversalCommunication/ram:URIID"));
    }

    private static void lines(XPath xpath, Document document, Invoice invoice) throws Exception {
        var nodes = (NodeList) xpath.evaluate(TRADE + "ram:IncludedSupplyChainTradeLineItem", document, XPathConstants.NODESET);
        if (invoice.getLines().isEmpty() || nodes.getLength() != invoice.getLines().size()) throw new IllegalArgumentException();
        var seen = new java.util.HashSet<Integer>();
        for (int n = 0; n < nodes.getLength(); n++) {
            Node node = nodes.item(n);
            int number = Integer.parseInt(value(xpath, node, "ram:AssociatedDocumentLineDocument/ram:LineID"));
            if (!seen.add(number)) throw new IllegalArgumentException();
            var line = invoice.getLines().stream().filter(l -> Objects.equals(l.getLineNumber(), number)).findFirst().orElseThrow();
            equal(value(xpath, node, "ram:SpecifiedTradeProduct/ram:Name"), line.getDescription());
            amount(value(xpath, node, "ram:SpecifiedLineTradeDelivery/ram:BilledQuantity"), line.getQuantity());
            amount(value(xpath, node, "ram:SpecifiedLineTradeAgreement/ram:NetPriceProductTradePrice/ram:ChargeAmount"), line.getUnitPriceHt());
            amount(value(xpath, node, "ram:SpecifiedLineTradeSettlement/ram:SpecifiedTradeSettlementLineMonetarySummation/ram:LineTotalAmount"), line.getTotalHt());
            amount(value(xpath, node, "ram:SpecifiedLineTradeSettlement/ram:ApplicableTradeTax/ram:RateApplicablePercent"),
                line.getTaxRate() == null ? null : line.getTaxRate().movePointRight(2));
        }
    }

    private static String value(XPath xpath, Node node, String path) throws Exception { return xpath.evaluate(path, node).trim(); }
    private static void required(String value) { if (value == null || value.isBlank()) throw new IllegalArgumentException(); }
    private static void equal(String actual, String expected) { required(expected); if (!expected.trim().equals(actual)) throw new IllegalArgumentException(); }
    private static void amount(String actual, BigDecimal expected) {
        if (expected == null || new BigDecimal(actual).compareTo(expected) != 0) throw new IllegalArgumentException();
    }
}
