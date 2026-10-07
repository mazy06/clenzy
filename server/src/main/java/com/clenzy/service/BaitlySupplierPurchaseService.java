package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.tenant.TenantContext;
import com.clenzy.util.StringUtils;
import java.math.*;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Deux parcours exclusifs : une dette PSP nominative, ou un paiement externe documenté. */
@Service @Transactional(readOnly=true)
public class BaitlySupplierPurchaseService {
    public record Request(UUID requestId,Long propertyId,String supplierName,String supplierEmail,String invoiceReference,
            String description,LocalDate expenseDate,BigDecimal amountHt,BigDecimal taxRate) {}
    public record ExternalReceipt(String reference,LocalDate paidOn,BigDecimal amount,String currency) {}
    private final NamedParameterJdbcTemplate jdbc;
    private final UserRepository users;
    private final PropertyRepository properties;
    private final ProviderExpenseRepository expenses;
    private final TenantContext tenant;
    private final com.fasterxml.jackson.databind.ObjectMapper json;
    private final BaitlySupplierWorkspace workspace;
    public BaitlySupplierPurchaseService(NamedParameterJdbcTemplate jdbc,UserRepository users,PropertyRepository properties,
            ProviderExpenseRepository expenses,TenantContext tenant,com.fasterxml.jackson.databind.ObjectMapper json,BaitlySupplierWorkspace workspace) {
        this.jdbc=jdbc;this.users=users;this.properties=properties;this.expenses=expenses;this.tenant=tenant;this.json=json;this.workspace=workspace;
    }
    private User user(String subject) { return users.findByKeycloakId(subject).orElseThrow(()->new AccessDeniedException("Utilisateur inconnu.")); }
    private long staff(String subject) { var u=user(subject);if(u.getRole()==null||!u.getRole().isPlatformStaff()) throw new AccessDeniedException("Décision réservée à la plateforme.");return u.getId(); }
    private Map<String,Object> scope(long id) { var p=new HashMap<String,Object>();p.put("org",tenant.getRequiredOrganizationId());p.put("id",id);return p; }
    public List<Map<String,Object>> list(String subject) {
        staff(subject);
        return jdbc.queryForList("""
            SELECT p.id,p.property_id,h.name AS property_name,p.supplier_name,p.invoice_reference,p.description,p.expense_date,
              p.amount_ttc,p.currency,p.mode,p.beneficiary_user_id,p.expense_id,p.external_url,p.external_reference,
              p.external_received_on,p.invitation_expires_at,e.status AS expense_status
            FROM baitly_supplier_purchases p JOIN properties h ON h.id=p.property_id AND h.organization_id=p.organization_id
            LEFT JOIN provider_expenses e ON e.id=p.expense_id AND e.organization_id=p.organization_id
            WHERE p.organization_id=:org ORDER BY p.id DESC
            """,scope(0));
    }
    @Transactional public long create(Request r,BaitlyFinancialDocument invoice,String subject) {
        long actor=staff(subject);validate(r);require(invoice!=null,"Facture fournisseur requise.");
        var property=properties.findById(r.propertyId()).orElseThrow(()->new IllegalArgumentException("Logement introuvable."));
        require(Objects.equals(property.getOrganizationId(),tenant.getRequiredOrganizationId()),"Logement hors organisation.");
        var p=scope(0);p.put("property",r.propertyId());p.put("request",r.requestId());p.put("name",r.supplierName().trim());
        p.put("emailHash",StringUtils.computeEmailHash(r.supplierEmail().trim().toLowerCase(Locale.ROOT)));p.put("invoiceRef",r.invoiceReference().trim());
        p.put("description",r.description().trim());p.put("date",r.expenseDate());p.put("ht",r.amountHt().setScale(2));p.put("tax",r.taxRate().setScale(4));
        p.put("ttc",r.amountHt().add(r.amountHt().multiply(r.taxRate()).setScale(2,RoundingMode.HALF_UP)));
        p.put("invoice",invoice.bytes());p.put("invoiceHash",invoice.sha256());p.put("actor",actor);
        var canonical=new TreeMap<>(p);canonical.remove("invoice");canonical.remove("actor");canonical.remove("id");
        String fingerprint;
        try { fingerprint=hash(json.writeValueAsString(canonical)); }catch(java.io.IOException e){throw new IllegalStateException(e);}
        p.put("fingerprint",fingerprint);
        var known=jdbc.queryForList("SELECT id,fingerprint FROM baitly_supplier_purchases WHERE organization_id=:org AND request_id=:request",p);
        if(!known.isEmpty()) {require(fingerprint.equals(known.getFirst().get("fingerprint")),"Cette demande existe avec une autre facture.");return ((Number)known.getFirst().get("id")).longValue();}
        return jdbc.queryForObject("""
            INSERT INTO baitly_supplier_purchases(organization_id,property_id,request_id,fingerprint,supplier_name,supplier_email_hash,invoice_reference,
              description,expense_date,amount_ht,tax_rate,amount_ttc,currency,invoice,invoice_sha256,created_by)
            VALUES(:org,:property,:request,:fingerprint,:name,:emailHash,:invoiceRef,:description,:date,:ht,:tax,:ttc,'EUR',:invoice,:invoiceHash,:actor) RETURNING id
            """,p,Long.class);
    }
    private Map<String,Object> locked(long id) {
        var rows=jdbc.queryForList("SELECT * FROM baitly_supplier_purchases WHERE id=:id AND organization_id=:org FOR UPDATE",scope(id));
        require(rows.size()==1,"Achat inaccessible.");return rows.getFirst();
    }
    /** Lien à transmettre au fournisseur. N'ajoute ni membre ni droit dans l'organisation cliente. */
    @Transactional public String invite(long id,String subject) {
        staff(subject);var row=locked(id);require(row.get("mode")==null || "BAITLY".equals(row.get("mode")),"Cet achat utilise déjà le parcours fournisseur externe.");
        require(row.get("beneficiary_user_id")==null && row.get("expense_id")==null,"Le fournisseur a déjà accepté cette invitation.");
        String token=UUID.randomUUID()+"."+UUID.randomUUID();var p=scope(id);p.put("hash",hash(token));
        jdbc.update("UPDATE baitly_supplier_purchases SET mode='BAITLY',invitation_hash=:hash,invitation_expires_at=CURRENT_TIMESTAMP+interval '7 days' WHERE id=:id AND organization_id=:org",p);
        return "/supplier-invitation?token="+token;
    }
    @Transactional public Map<String,Object> claim(String token,String subject) {
        var actor=user(subject);
        require(Boolean.TRUE.equals(actor.isEmailVerified()) && actor.getStatus()==UserStatus.ACTIVE && actor.getEmail()!=null,"Un compte actif avec adresse email vérifiée est requis.");
        require(token!=null && token.matches("[a-f0-9-]{36}\\.[a-f0-9-]{36}"),"Invitation invalide.");
        var p=new HashMap<String,Object>();p.put("hash",hash(token));p.put("actor",actor.getId());
        jdbc.queryForObject("SELECT set_config('app.supplier_claim',:hash,true)",p,String.class);
        jdbc.queryForObject("SELECT set_config('app.supplier_actor',CAST(:actor AS text),true)",p,String.class);
        var rows=jdbc.queryForList("SELECT * FROM baitly_supplier_purchases WHERE invitation_hash=:hash AND invitation_expires_at>CURRENT_TIMESTAMP AND mode='BAITLY' FOR UPDATE",p);
        require(rows.size()==1,"Invitation expirée ou introuvable.");var row=rows.getFirst();
        if(!Objects.equals(row.get("supplier_email_hash"),StringUtils.computeEmailHash(actor.getEmail().trim().toLowerCase(Locale.ROOT))))
            throw new AccessDeniedException("Connectez-vous avec l'adresse du fournisseur invité.");
        require(row.get("beneficiary_user_id")==null || Objects.equals(((Number)row.get("beneficiary_user_id")).longValue(),actor.getId()),"Invitation déjà acceptée par un autre compte.");
        if(row.get("beneficiary_user_id")==null) jdbc.update("UPDATE baitly_supplier_purchases SET beneficiary_user_id=:actor WHERE invitation_hash=:hash AND beneficiary_user_id IS NULL",p);
        workspace.ensure(actor.getId());
        return Map.of("supplierName",row.get("supplier_name"),"invoiceReference",row.get("invoice_reference"),"amount",row.get("amount_ttc"),"currency",row.get("currency"));
    }
    /** Lecture minimale par secret d'invitation ; aucune adhésion ni acceptation automatique. */
    @Transactional public String registrationOperation(String token,String email) {
        require(token!=null && token.matches("[a-f0-9-]{36}\\.[a-f0-9-]{36}") && email!=null,"Invitation invalide.");
        var p=Map.of("hash",hash(token),"email",StringUtils.computeEmailHash(email.trim().toLowerCase(Locale.ROOT)));
        jdbc.queryForObject("SELECT set_config('app.supplier_claim',:hash,true)",p,String.class);
        var rows=jdbc.queryForList("""
            SELECT registration_operation FROM baitly_supplier_purchases
            WHERE invitation_hash=:hash AND invitation_expires_at>CURRENT_TIMESTAMP AND mode='BAITLY'
              AND supplier_email_hash=:email AND beneficiary_user_id IS NULL
            """,p);
        require(rows.size()==1,"Invitation expirée ou adresse différente de celle du fournisseur invité.");
        return rows.getFirst().get("registration_operation").toString();
    }
    @Transactional public long prepareExpense(long id,String subject) {
        staff(subject);var row=locked(id);
        require("BAITLY".equals(row.get("mode")) && row.get("beneficiary_user_id")!=null,"Le fournisseur doit accepter son invitation avant le règlement Baitly.");
        if(row.get("expense_id")!=null) return ((Number)row.get("expense_id")).longValue();
        var provider=users.findById(((Number)row.get("beneficiary_user_id")).longValue()).orElseThrow();
        require(Boolean.TRUE.equals(provider.isEmailVerified()) && provider.getStatus()==UserStatus.ACTIVE
                && Objects.equals(row.get("supplier_email_hash"),StringUtils.computeEmailHash(provider.getEmail().trim().toLowerCase(Locale.ROOT))),"Identité du fournisseur à rapprocher.");
        var duplicate=scope(id);duplicate.put("provider",provider.getId());duplicate.put("reference",row.get("invoice_reference"));
        require(jdbc.queryForObject("SELECT count(*) FROM provider_expenses WHERE organization_id=:org AND provider_id=:provider AND invoice_reference=:reference",duplicate,Long.class)==0,
                "Une dépense porte déjà cette facture fournisseur. Rapprochez le dossier existant.");
        var expense=new ProviderExpense();expense.setOrganizationId(tenant.getRequiredOrganizationId());expense.setProvider(provider);
        expense.setProperty(properties.findById(((Number)row.get("property_id")).longValue()).orElseThrow());
        expense.setDescription((String)row.get("description"));expense.setAmountHt((BigDecimal)row.get("amount_ht"));expense.setTaxRate((BigDecimal)row.get("tax_rate"));
        expense.setAmountTtc((BigDecimal)row.get("amount_ttc"));expense.setTaxAmount(expense.getAmountTtc().subtract(expense.getAmountHt()));
        expense.setCurrency("EUR");expense.setExpenseDate(((java.sql.Date)row.get("expense_date")).toLocalDate());expense.setCategory(ExpenseCategory.SUPPLIES);
        expense.setInvoiceReference((String)row.get("invoice_reference"));expense.setStatus(ExpenseStatus.DRAFT);
        expense.setNotes("Achat fournisseur Baitly #"+id+". Justificatif conservé dans le dossier fournisseur.");
        expense=expenses.saveAndFlush(expense);var p=scope(id);p.put("expense",expense.getId());
        jdbc.update("UPDATE baitly_supplier_purchases SET expense_id=:expense WHERE id=:id AND organization_id=:org",p);return expense.getId();
    }
    @Transactional public void chooseExternal(long id,String url,String subject) {
        staff(subject);require(url!=null && url.length()<=2000,"Adresse fournisseur requise.");
        var uri=java.net.URI.create(url);require(uri.getRawUserInfo()==null && uri.getFragment()==null,"Adresse fournisseur invalide.");
        ICalUrlValidator.validateAndResolve(url); // Lecture DNS seule, aucun paiement ni requête vers le fournisseur.
        var row=locked(id);require(row.get("mode")==null || "EXTERNAL".equals(row.get("mode")),"Cet achat est déjà destiné au compte Baitly du fournisseur.");
        require(row.get("external_reference")==null,"Le règlement de cet achat est déjà documenté.");
        var p=scope(id);p.put("url",url.trim());jdbc.update("UPDATE baitly_supplier_purchases SET mode='EXTERNAL',external_url=:url WHERE id=:id AND organization_id=:org",p);
    }
    @Transactional public void recordExternal(long id,ExternalReceipt proof,BaitlyFinancialDocument document,String subject) {
        long actor=staff(subject);var row=locked(id);
        require("EXTERNAL".equals(row.get("mode")) && row.get("expense_id")==null,"Le parcours de règlement est incompatible.");
        require(proof!=null && proof.reference()!=null && !proof.reference().isBlank() && proof.reference().length()<=160
                && proof.paidOn()!=null && !proof.paidOn().isAfter(LocalDate.now()) && "EUR".equals(proof.currency())
                && proof.amount()!=null && proof.amount().compareTo((BigDecimal)row.get("amount_ttc"))==0 && document!=null,
                "Justificatif, référence, date et montant exact de la facture sont requis.");
        require(!document.sha256().equals(row.get("invoice_sha256")),"Une facture seule ne prouve pas le paiement. Ajoutez le justificatif PSP ou bancaire.");
        if(row.get("external_reference")!=null) {
            require(proof.reference().trim().equals(row.get("external_reference")) && document.sha256().equals(row.get("external_receipt_sha256"))
                && proof.paidOn().equals(((java.sql.Date)row.get("external_received_on")).toLocalDate()),"Une autre preuve est déjà enregistrée.");return;
        }
        var p=scope(id);p.put("ref",proof.reference().trim());p.put("date",proof.paidOn());p.put("receipt",document.bytes());p.put("hash",document.sha256());p.put("actor",actor);
        jdbc.update("UPDATE baitly_supplier_purchases SET external_reference=:ref,external_received_on=:date,external_receipt=:receipt,external_receipt_sha256=:hash,external_recorded_by=:actor WHERE id=:id AND organization_id=:org",p);
    }
    public BaitlyFinancialDocument document(long id,boolean receipt,String subject) {
        staff(subject);var rows=jdbc.queryForList("SELECT invoice,external_receipt FROM baitly_supplier_purchases WHERE id=:id AND organization_id=:org",scope(id));
        require(rows.size()==1 && rows.getFirst().get(receipt?"external_receipt":"invoice") instanceof byte[],"Justificatif inaccessible.");
        return BaitlyFinancialDocument.checked((byte[])rows.getFirst().get(receipt?"external_receipt":"invoice"));
    }
    static void validate(Request r) {
        require(r!=null && r.requestId()!=null && r.propertyId()!=null && r.propertyId()>0
                && text(r.supplierName(),200) && text(r.invoiceReference(),160) && text(r.description(),500)
                && r.supplierEmail()!=null && r.supplierEmail().length()<=320 && r.supplierEmail().trim().matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")
                && r.expenseDate()!=null && !r.expenseDate().isAfter(LocalDate.now()) && r.amountHt()!=null && r.amountHt().signum()>0
                && r.amountHt().stripTrailingZeros().scale()<=2 && r.amountHt().precision()<=10 && r.taxRate()!=null
                && r.taxRate().signum()>=0 && r.taxRate().compareTo(BigDecimal.ONE)<=0 && r.taxRate().stripTrailingZeros().scale()<=4,"Facture fournisseur incomplète ou montant invalide.");
    }
    private static boolean text(String s,int max){return s!=null&&!s.isBlank()&&s.length()<=max;}
    private static String hash(String value) {
        try{return HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)));}
        catch(java.security.NoSuchAlgorithmException e){throw new IllegalStateException(e);}
    }
    private static void require(boolean value,String message){if(!value)throw new IllegalArgumentException(message);}
}
