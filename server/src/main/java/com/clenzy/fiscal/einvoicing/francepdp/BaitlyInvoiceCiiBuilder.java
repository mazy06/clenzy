package com.clenzy.fiscal.einvoicing.francepdp;

import com.clenzy.model.Invoice;
import com.clenzy.model.InvoiceLine;
import com.clenzy.model.InvoiceStatus;
import org.springframework.stereotype.Component;
import javax.xml.stream.XMLOutputFactory;
import javax.xml.stream.XMLStreamWriter;
import java.io.StringWriter;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.format.DateTimeFormatter;
import java.util.*;

/** CII Baitly : facture FR B2B en EUR, TVA positive, sans remise ni acompte implicite. */
@Component
public class BaitlyInvoiceCiiBuilder {
    public static final String VERSION = "baitly-cii-fr-b2b-v1";
    private static final String RAM = "urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100";
    private static final String UDT = "urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100";
    private static final String RSM = "urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100";

    public List<String> issues(Invoice i) {
        var issues = new ArrayList<String>();
        if (!Set.of(InvoiceStatus.ISSUED, InvoiceStatus.SENT, InvoiceStatus.PAID, InvoiceStatus.OVERDUE).contains(i.getStatus())
            || i.getOriginalInvoiceId()!=null || i.getDuplicateOfId()!=null) issues.add("Préparation disponible pour les factures émises, hors avoirs et duplicatas.");
        if (!"FR".equals(i.getCountryCode()) || !"EUR".equals(i.getCurrency())) issues.add("Ce parcours couvre les factures B2B françaises en EUR.");
        if (blank(i.getInvoiceNumber()) || i.getInvoiceDate()==null || i.getDueDate()==null) issues.add("Numéro, date d’émission et échéance requis sur la facture source.");
        if (blank(i.getSellerName()) || blank(i.getSellerAddress()) || blank(i.getBuyerName()) || blank(i.getBuyerAddress())) issues.add("Noms et adresses manquants sur la facture émise : rectification requise avant préparation.");
        if (!vat(i.getSellerTaxId()) || !vat(i.getBuyerTaxId())) issues.add("Identifiants TVA français requis pour le vendeur et l’acheteur B2B.");
        if (i.getLines().isEmpty() || i.getLines().size()>500) issues.add("La facture doit comporter entre 1 et 500 lignes.");
        var seen = new HashSet<Integer>();
        BigDecimal ht=BigDecimal.ZERO, tax=BigDecimal.ZERO;
        for (var l:i.getLines()) {
            if (l.getLineNumber()==null || l.getLineNumber()<1 || !seen.add(l.getLineNumber()) || blank(l.getDescription())
                || !positive(l.getQuantity()) || !positive(l.getUnitPriceHt()) || !positive(l.getTaxRate())
                || l.getTaxRate().compareTo(BigDecimal.ONE)>0 || "TOURIST_TAX".equals(l.getTaxCategory())
                || l.getTotalHt()==null || l.getTaxAmount()==null || l.getTotalTtc()==null) {
                issues.add("Ligne fiscale incomplète ou hors périmètre (TVA positive, sans remise ni taxe de séjour)."); continue;
            }
            if (!same(round(l.getQuantity().multiply(l.getUnitPriceHt())),l.getTotalHt())
                || !same(round(l.getTotalHt().multiply(l.getTaxRate())),l.getTaxAmount())
                || !same(l.getTotalHt().add(l.getTaxAmount()),l.getTotalTtc())) issues.add("Montants incohérents sur la ligne "+l.getLineNumber()+" ; rectification de la facture requise.");
            ht=ht.add(l.getTotalHt());tax=tax.add(l.getTaxAmount());
        }
        if (!same(ht,i.getTotalHt()) || !same(tax,i.getTotalTax()) || !same(ht.add(tax),i.getTotalTtc())) issues.add("Les totaux de la facture ne correspondent pas à ses lignes.");
        return issues.stream().distinct().toList();
    }

    public String build(Invoice invoice, BaitlyCiiPreparation data) {
        var issues=issues(invoice);
        if (!issues.isEmpty()) throw new IllegalArgumentException(String.join(" ",issues));
        check(data==null?null:data.seller());check(data==null?null:data.buyer());
        if(!invoice.getSellerTaxId().endsWith(data.seller().legalId()) || !invoice.getBuyerTaxId().endsWith(data.buyer().legalId()))
            throw new IllegalArgumentException("Le SIREN doit correspondre à l’identifiant TVA de la facture.");
        var terms=data.terms();
        if(terms==null || terms.processCode()==null || !Set.of("B1","S1","M1").contains(terms.processCode()))
            throw new IllegalArgumentException("Précisez la nature de la facture commerciale (biens, services ou mixte).");
        for(String note:Arrays.asList(terms.recoveryCosts(),terms.latePenalties(),terms.discount()))
            if(blank(note) || note.length()>2000 || blank(invoice.getLegalMentions()) || !invoice.getLegalMentions().contains(note))
                throw new IllegalArgumentException("Chaque mention structurée doit être reprise à l’identique des mentions déjà émises. Une mention absente nécessite une rectification de la facture.");
        try {
            var output=new StringWriter();var w=XMLOutputFactory.newFactory().createXMLStreamWriter(output);
            w.writeStartDocument("UTF-8","1.0"); w.writeStartElement("rsm","CrossIndustryInvoice",RSM);
            w.writeNamespace("rsm",RSM);w.writeNamespace("ram",RAM);w.writeNamespace("udt",UDT);
            w.writeStartElement("rsm","ExchangedDocumentContext",RSM);
            start(w,"BusinessProcessSpecifiedDocumentContextParameter");text(w,"ID",terms.processCode());end(w);
            start(w,"GuidelineSpecifiedDocumentContextParameter");text(w,"ID","urn:cen.eu:en16931:2017");end(w);end(w);
            w.writeStartElement("rsm","ExchangedDocument",RSM);text(w,"ID",invoice.getInvoiceNumber());text(w,"TypeCode","380");date(w,"IssueDateTime",invoice.getInvoiceDate());
            if (!blank(invoice.getLegalMentions())) {start(w,"IncludedNote");text(w,"Content",invoice.getLegalMentions());end(w);}
            note(w,"PMT",terms.recoveryCosts());note(w,"PMD",terms.latePenalties());note(w,"AAB",terms.discount());note(w,"BAR","B2B");end(w);
            w.writeStartElement("rsm","SupplyChainTradeTransaction",RSM);
            var lines=invoice.getLines().stream().sorted(Comparator.comparing(InvoiceLine::getLineNumber)).toList();
            for (var l:lines) line(w,l);
            start(w,"ApplicableHeaderTradeAgreement");
            party(w,"SellerTradeParty",invoice.getSellerName(),invoice.getSellerAddress(),invoice.getSellerTaxId(),data.seller());
            party(w,"BuyerTradeParty",invoice.getBuyerName(),invoice.getBuyerAddress(),invoice.getBuyerTaxId(),data.buyer());end(w);
            start(w,"ApplicableHeaderTradeDelivery");end(w);
            start(w,"ApplicableHeaderTradeSettlement");text(w,"InvoiceCurrencyCode",invoice.getCurrency());
            var rates=new TreeMap<BigDecimal,BigDecimal>();
            for(var l:lines) rates.merge(l.getTaxRate(),l.getTotalHt(),BigDecimal::add);
            for(var rate:rates.entrySet()) {
                start(w,"ApplicableTradeTax");text(w,"CalculatedAmount",decimal(round(rate.getValue().multiply(rate.getKey()))));
                text(w,"TypeCode","VAT");text(w,"BasisAmount",decimal(rate.getValue()));text(w,"CategoryCode","S");text(w,"RateApplicablePercent",decimal(rate.getKey().movePointRight(2)));end(w);
            }
            start(w,"SpecifiedTradePaymentTerms");date(w,"DueDateDateTime",invoice.getDueDate());end(w);
            start(w,"SpecifiedTradeSettlementHeaderMonetarySummation");text(w,"LineTotalAmount",decimal(invoice.getTotalHt()));
            text(w,"TaxBasisTotalAmount",decimal(invoice.getTotalHt()));start(w,"TaxTotalAmount");w.writeAttribute("currencyID",invoice.getCurrency());w.writeCharacters(decimal(invoice.getTotalTax()));end(w);
            text(w,"GrandTotalAmount",decimal(invoice.getTotalTtc()));text(w,"DuePayableAmount",decimal(invoice.getTotalTtc()));end(w);
            end(w);end(w);end(w);w.writeEndDocument();w.close();return output.toString();
        } catch(javax.xml.stream.XMLStreamException e) {throw new IllegalStateException("Préparation CII indisponible",e);}
    }
    private static void check(BaitlyCiiPreparation.Party p) {
        if(p==null || p.postcode()==null || !p.postcode().matches("[0-9]{5}") || blank(p.city()) || p.city().length()>100
            || p.legalId()==null || !p.legalId().matches("[0-9]{9}") || p.routingId()==null || p.routingId().length()>100
            || !p.routingId().matches(p.legalId()+"(_[A-Za-z0-9_-]+)?")) throw new IllegalArgumentException("Adresse structurée, SIREN et adresse de routage cohérente requis pour chaque partie.");
    }
    private static void line(XMLStreamWriter w,InvoiceLine l) throws javax.xml.stream.XMLStreamException {
        start(w,"IncludedSupplyChainTradeLineItem");start(w,"AssociatedDocumentLineDocument");text(w,"LineID",l.getLineNumber().toString());end(w);
        start(w,"SpecifiedTradeProduct");text(w,"Name",l.getDescription());end(w);
        start(w,"SpecifiedLineTradeAgreement");start(w,"NetPriceProductTradePrice");text(w,"ChargeAmount",decimal(l.getUnitPriceHt()));end(w);end(w);
        start(w,"SpecifiedLineTradeDelivery");start(w,"BilledQuantity");w.writeAttribute("unitCode","C62");w.writeCharacters(decimal(l.getQuantity()));end(w);end(w);
        start(w,"SpecifiedLineTradeSettlement");start(w,"ApplicableTradeTax");text(w,"TypeCode","VAT");text(w,"CategoryCode","S");text(w,"RateApplicablePercent",decimal(l.getTaxRate().movePointRight(2)));end(w);
        start(w,"SpecifiedTradeSettlementLineMonetarySummation");text(w,"LineTotalAmount",decimal(l.getTotalHt()));end(w);end(w);end(w);
    }
    private static void party(XMLStreamWriter w,String node,String name,String address,String vat,BaitlyCiiPreparation.Party p) throws javax.xml.stream.XMLStreamException {
        start(w,node);text(w,"Name",name);start(w,"SpecifiedLegalOrganization");start(w,"ID");w.writeAttribute("schemeID","0002");w.writeCharacters(p.legalId());end(w);end(w);
        start(w,"PostalTradeAddress");text(w,"PostcodeCode",p.postcode());text(w,"LineOne",address);text(w,"CityName",p.city().trim());text(w,"CountryID","FR");end(w);
        start(w,"URIUniversalCommunication");start(w,"URIID");w.writeAttribute("schemeID","0225");w.writeCharacters(p.routingId());end(w);end(w);
        start(w,"SpecifiedTaxRegistration");start(w,"ID");w.writeAttribute("schemeID","VA");w.writeCharacters(vat);end(w);end(w);end(w);
    }
    private static void date(XMLStreamWriter w,String name,java.time.LocalDate date) throws javax.xml.stream.XMLStreamException {
        start(w,name);w.writeStartElement("udt","DateTimeString",UDT);w.writeAttribute("format","102");w.writeCharacters(date.format(DateTimeFormatter.BASIC_ISO_DATE));end(w);end(w);
    }
    private static void note(XMLStreamWriter w,String code,String content) throws javax.xml.stream.XMLStreamException {
        start(w,"IncludedNote");text(w,"Content",content);text(w,"SubjectCode",code);end(w);
    }
    private static void start(XMLStreamWriter w,String name) throws javax.xml.stream.XMLStreamException {w.writeStartElement("ram",name,RAM);}
    private static void end(XMLStreamWriter w) throws javax.xml.stream.XMLStreamException {w.writeEndElement();}
    private static void text(XMLStreamWriter w,String name,String value) throws javax.xml.stream.XMLStreamException {start(w,name);w.writeCharacters(value);end(w);}
    private static boolean blank(String s){return s==null || s.isBlank();}
    private static boolean vat(String s){return s!=null && s.matches("FR[A-Z0-9]{2}[0-9]{9}");}
    private static boolean positive(BigDecimal n){return n!=null && n.signum()>0;}
    private static boolean same(BigDecimal a,BigDecimal b){return a!=null && b!=null && a.compareTo(b)==0;}
    private static BigDecimal round(BigDecimal n){return n.setScale(2,RoundingMode.HALF_UP);}
    private static String decimal(BigDecimal n){return n.stripTrailingZeros().toPlainString();}
}
