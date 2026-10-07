package com.clenzy.fiscal.einvoicing;

import com.clenzy.model.*;
import jakarta.persistence.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;
import static com.clenzy.service.BaitlyRefundSeries.require;

@Service @Transactional
public class BaitlyEInvoiceStore {
    private final EntityManager em;
    public BaitlyEInvoiceStore(EntityManager em){this.em=em;}
    public record Candidate(Long org,Long invoice){}
    public record Prepared(Invoice invoice,EInvoiceSubmission submission,boolean send,boolean reconcile){
        public Prepared(Invoice invoice,EInvoiceSubmission submission,boolean send){this(invoice,submission,send,false);}
    }
    public List<Candidate> candidates(){
        @SuppressWarnings("unchecked") List<Object[]> rows=em.createNativeQuery("""
            SELECT i.organization_id,i.id FROM invoices i LEFT JOIN einvoice_submissions s
              ON s.organization_id=i.organization_id AND s.invoice_number=i.invoice_number
            WHERE i.status IN ('ISSUED','SENT','PAID','OVERDUE','CREDIT_NOTE') AND i.duplicate_of_id IS NULL
              AND i.invoice_number IS NOT NULL AND (s.id IS NULL OR s.retry_at<=now()
                AND (s.submission_started_at IS NULL AND s.status IN ('PENDING','FAILED')
                  OR s.submission_started_at IS NOT NULL AND s.external_ref IS NOT NULL AND s.status='PENDING'))
            ORDER BY COALESCE(s.retry_at,'epoch'),i.id LIMIT 30
            """).getResultList();
        return rows.stream().map(v->new Candidate(((Number)v[0]).longValue(),((Number)v[1]).longValue())).toList();
    }
    public Invoice invoice(Long org,Long id){var i=em.find(Invoice.class,id);require(i!=null && org.equals(i.getOrganizationId()),"Facture inaccessible");i.getLines().size();return i;}
    public Prepared prepare(Long org,Long id,String country,EInvoicingProvider provider){
        var invoice=em.find(Invoice.class,id,LockModeType.PESSIMISTIC_WRITE);
        require(invoice!=null && org.equals(invoice.getOrganizationId()) && invoice.isImmutable() && invoice.getDuplicateOfId()==null,"Facture non émise ou inaccessible");
        invoice.getLines().size();String hash=fingerprint(invoice);
        var found=em.createQuery("from EInvoiceSubmission where organizationId=:org and invoiceNumber=:number",EInvoiceSubmission.class)
            .setParameter("org",org).setParameter("number",invoice.getInvoiceNumber()).getResultList();
        EInvoiceSubmission s;
        if(found.isEmpty()){s=new EInvoiceSubmission();s.setOrganizationId(org);s.setInvoiceNumber(invoice.getInvoiceNumber());s.setInvoiceId(id);s.setCountryCode(country);s.setDocumentHash(hash);}
        else {s=found.getFirst();
            if(s.getDocumentHash()!=null && !s.getDocumentHash().equals(hash)) {
                s.setMessage("La facture émise a changé : rapprochement requis");s.setRetryAt(Instant.now().plusSeconds(86400));
                return new Prepared(invoice,s,false);
            }
            if(Set.of(EInvoiceStatus.CLEARED,EInvoiceStatus.REPORTED,EInvoiceStatus.NOT_REQUIRED).contains(s.getStatus())
                || s.getRetryAt()!=null && s.getRetryAt().isAfter(Instant.now()))return new Prepared(invoice,s,false);
            if(s.getSubmissionStartedAt()!=null){
                boolean reconcile=s.getStatus()==EInvoiceStatus.PENDING && s.getExternalRef()!=null && !s.getExternalRef().isBlank()
                    && Objects.equals(s.getProviderCode(),provider.providerCode()) && provider.configured() && provider.supportsReconciliation();
                s.setRetryAt(Instant.now().plusSeconds(300));
                return new Prepared(invoice,s,false,reconcile);
            }
            s.setInvoiceId(id);s.setDocumentHash(hash);
        }
        s.setProviderCode(provider.providerCode());s.setMode(provider.mode());s.setStatus(EInvoiceStatus.PENDING);s.setRetryAt(Instant.now().plusSeconds(3600));
        String issue=provider.configured()?provider.readinessIssue(invoice):null;
        boolean ready=provider.configured() && issue==null;
        if(ready)s.setSubmissionStartedAt(Instant.now());
        s.setMessage(issue!=null?issue:ready?"Transmission préparée : réception à confirmer":"Raccordement déclaratif non configuré ; aucune transmission confirmée");
        if(s.getId()==null)em.persist(s);
        em.flush();return new Prepared(invoice,s,ready);
    }
    public EInvoiceSubmission finish(Long org,Long id,EInvoiceResult result){
        var s=em.find(EInvoiceSubmission.class,id,LockModeType.PESSIMISTIC_WRITE);require(s!=null && org.equals(s.getOrganizationId()) && s.getSubmissionStartedAt()!=null,"Soumission inaccessible");
        if(Set.of(EInvoiceStatus.CLEARED,EInvoiceStatus.REPORTED,EInvoiceStatus.NOT_REQUIRED,EInvoiceStatus.FAILED).contains(s.getStatus()))return s;
        require(result!=null && result.status()!=null,"Réponse déclarative absente");
        if(Set.of(EInvoiceStatus.CLEARED,EInvoiceStatus.REPORTED).contains(result.status()))require(result.externalRef()!=null && !result.externalRef().isBlank(),"Accusé de réception absent");
        if(s.getExternalRef()!=null && result.externalRef()!=null)require(s.getExternalRef().equals(result.externalRef()),"Référence déclarative différente");
        s.setStatus(result.status());if(result.externalRef()!=null)s.setExternalRef(result.externalRef());
        s.setRetryAt(Instant.now().plusSeconds(300));
        s.setMessage(result.message()==null?null:result.message().substring(0,Math.min(512,result.message().length())));return s;
    }
    public List<EInvoiceSubmission> list(Long org){return em.createQuery("from EInvoiceSubmission where organizationId=:org order by id desc",EInvoiceSubmission.class).setParameter("org",org).setMaxResults(100).getResultList();}
    public static String fingerprint(Invoice invoice){
        var values=new ArrayList<String>();Collections.addAll(values,invoice.getInvoiceNumber(),invoice.getCountryCode(),invoice.getCurrency(),Objects.toString(invoice.getInvoiceDate()),
            invoice.getSellerName(),invoice.getSellerAddress(),invoice.getSellerTaxId(),invoice.getBuyerName(),invoice.getBuyerAddress(),invoice.getBuyerTaxId(),Objects.toString(invoice.getTotalHt()),Objects.toString(invoice.getTotalTax()),Objects.toString(invoice.getTotalTtc()),invoice.getLegalMentions());
        for(var l:invoice.getLines().stream().sorted(Comparator.comparing(InvoiceLine::getLineNumber,Comparator.nullsFirst(Integer::compareTo))).toList())values.add(l.getLineNumber()+":"+l.getDescription()+":"+l.getQuantity()+":"+l.getUnitPriceHt()+":"+l.getTaxCategory()+":"+l.getTaxRate()+":"+l.getTaxAmount()+":"+l.getTotalHt()+":"+l.getTotalTtc());
        if(invoice.getXmlContent()!=null && !invoice.getXmlContent().isBlank())values.add("CII:"+invoice.getXmlContent());
        try{return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsBytes(values)));}
        catch(Exception e){throw new IllegalStateException("Empreinte du document indisponible",e);}
    }
}
