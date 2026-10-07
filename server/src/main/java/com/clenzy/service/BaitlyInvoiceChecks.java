package com.clenzy.service;

import com.clenzy.fiscal.einvoicing.BaitlyEInvoiceStore;
import com.clenzy.model.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

/** Contrôle interne du document, distinct des contrôles CII et des accusés du partenaire. */
public final class BaitlyInvoiceChecks {
    public static final String VERSION = "baitly-document-2026.10.07-1";
    private BaitlyInvoiceChecks() {}
    public record Issue(String code, String message) {}

    public static List<Issue> issues(Invoice i) {
        var issues = new ArrayList<Issue>();
        if (i.getOrganizationId() == null) add(issues,"ORGANIZATION","Organisation manquante");
        if (blank(i.getCountryCode()) || !i.getCountryCode().matches("[A-Z]{2}")) add(issues,"COUNTRY","Pays fiscal manquant ou invalide");
        try { Currency.getInstance(i.getCurrency()); } catch (Exception e) { add(issues,"CURRENCY","Devise manquante ou invalide"); }
        if (blank(i.getSellerName()) || blank(i.getSellerAddress()) || blank(i.getSellerTaxId())) add(issues,"SELLER","Identité légale du vendeur incomplète");
        if (blank(i.getBuyerName())) add(issues,"BUYER","Nom du destinataire manquant");
        // L'adresse B2C n'est pas arbitrairement assimilée à une obligation B2B.
        if (!blank(i.getBuyerTaxId()) && blank(i.getBuyerAddress())) add(issues,"BUYER_ADDRESS","Adresse de facturation du destinataire professionnel manquante");
        if (i.getInvoiceDate() == null) add(issues,"DATE","Date du document manquante");
        if (i.getDueDate()!=null && i.getInvoiceDate()!=null && i.getDueDate().isBefore(i.getInvoiceDate())) add(issues,"DUE_DATE","Échéance antérieure à la date du document");
        if (blank(i.getLegalMentions())) add(issues,"TERMS","Mentions et conditions de facturation manquantes");
        boolean credit=i.getStatus()==InvoiceStatus.CREDIT_NOTE || i.getOriginalInvoiceId()!=null;
        if (credit && i.getOriginalInvoiceId()==null) add(issues,"ORIGINAL","Facture d'origine de l'avoir manquante");
        var numbers = new HashSet<Integer>();
        BigDecimal ht=BigDecimal.ZERO, tax=BigDecimal.ZERO, ttc=BigDecimal.ZERO;
        if (i.getLines()==null || i.getLines().isEmpty()) add(issues,"LINES","Aucune ligne de facturation");
        else for (var l:i.getLines()) {
            if(l.getLineNumber()==null || l.getLineNumber()<1 || !numbers.add(l.getLineNumber())) add(issues,"LINE_NUMBER","Numérotation des lignes incohérente");
            if(blank(l.getDescription()) || blank(l.getTaxCategory())) add(issues,"LINE_DESCRIPTION","Description ou catégorie fiscale d'une ligne manquante");
            if(l.getQuantity()==null || l.getUnitPriceHt()==null || l.getTaxRate()==null || l.getTaxAmount()==null || l.getTotalHt()==null || l.getTotalTtc()==null) {
                add(issues,"LINE_AMOUNT","Montants d'une ligne incomplets");continue;
            }
            if(l.getTaxRate().signum()<0 || l.getTaxRate().compareTo(BigDecimal.ONE)>0) add(issues,"TAX_RATE","Taux de taxe invalide");
            if(!equal(l.getQuantity().multiply(l.getUnitPriceHt()),l.getTotalHt())
                || !taxMatches(i,l)
                || !equal(l.getTotalHt().add(l.getTaxAmount()),l.getTotalTtc())) add(issues,"LINE_TOTAL","Calcul des montants d'une ligne incohérent");
            ht=ht.add(l.getTotalHt());tax=tax.add(l.getTaxAmount());ttc=ttc.add(l.getTotalTtc());
        }
        if(!equal(ht,i.getTotalHt()) || !equal(tax,i.getTotalTax()) || !equal(ttc,i.getTotalTtc())) add(issues,"TOTAL","Totaux différents de la somme des lignes");
        if(i.getTotalTtc()!=null && (credit?i.getTotalTtc().signum()>0:i.getTotalTtc().signum()<0)) add(issues,"SIGN","Signe du montant incompatible avec le type de document");
        return issues.stream().distinct().toList();
    }
    public static void requireReady(Invoice invoice) {
        var issues=issues(invoice);
        if(!issues.isEmpty()) throw new IllegalStateException("Document à compléter : "+String.join(" ; ",issues.stream().map(Issue::message).toList()));
    }
    public static String fingerprint(Invoice i) {
        return hash((BaitlyEInvoiceStore.fingerprint(i)+"|"+i.getDueDate()+"|"+i.getOriginalInvoiceId()+"|"+i.getDuplicateOfId()+"|"+i.getInvoiceType()).getBytes(StandardCharsets.UTF_8));
    }
    public static String hash(byte[] bytes) {
        try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));}
        catch(Exception e){throw new IllegalStateException(e);}
    }
    private static boolean equal(BigDecimal a,BigDecimal b){return a!=null && b!=null && a.setScale(2,RoundingMode.HALF_UP).compareTo(b.setScale(2,RoundingMode.HALF_UP))==0;}
    private static boolean taxMatches(Invoice invoice,InvoiceLine line) {
        BigDecimal expected=line.getTotalHt().multiply(line.getTaxRate()).setScale(2,RoundingMode.HALF_UP);
        if(equal(expected,line.getTaxAmount()))return true;
        // Un avoir de remboursement répartit la TVA historique cumulativement : un centime
        // d'arrondi peut différer du recalcul indépendant. Les sommes HT+TVA=TTC restent exactes.
        return invoice.getOriginalInvoiceId()!=null && invoice.getRefundTransactionId()!=null
            && expected.subtract(line.getTaxAmount()).abs().compareTo(new BigDecimal("0.01"))<=0;
    }
    private static boolean blank(String s){return s==null || s.isBlank();}
    private static void add(List<Issue> issues,String code,String message){issues.add(new Issue(code,message));}
}
