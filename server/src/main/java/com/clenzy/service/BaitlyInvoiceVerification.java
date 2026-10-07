package com.clenzy.service;

import com.clenzy.dto.InvoiceDto;
import com.clenzy.model.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;
import static com.clenzy.service.BaitlyRefundSeries.require;

@Service @Transactional
public class BaitlyInvoiceVerification {
    private static final ObjectMapper JSON=new ObjectMapper();
    private final EntityManager em;
    public BaitlyInvoiceVerification(EntityManager em){this.em=em;}
    public record Review(Long id,String state,String sourceHash,String version,List<BaitlyInvoiceChecks.Issue> issues,String actor,Instant checkedAt,boolean current){}
    public record View(String state,String sourceHash,List<BaitlyInvoiceChecks.Issue> issues,List<Review> history,boolean pdfArchived){}
    public record Row(InvoiceDto invoice,String state,int issueCount,boolean pdfArchived){}
    public record Draft(String sourceHash,String sellerName,String sellerAddress,String sellerTaxId,String buyerName,String buyerAddress,String buyerTaxId,String legalMentions,java.time.LocalDate dueDate){}

    @Transactional(readOnly=true) public List<Row> list(Long org) {
        // La pagination de la liste est effectuée dans l'écran Conformité.
        // Quatre lectures groupées : ni historique ni contenu PDF n'est chargé pour chaque ligne.
        var invoices=em.createQuery("select distinct i from Invoice i left join fetch i.lines where i.organizationId=:org order by i.id desc",Invoice.class)
            .setParameter("org",org).getResultList();
        var reviews=new HashMap<Long,BaitlyInvoiceReview>();
        em.createQuery("from BaitlyInvoiceReview r where r.organizationId=:org and not exists (select newer.id from BaitlyInvoiceReview newer where newer.organizationId=:org and newer.invoiceId=r.invoiceId and newer.id>r.id)",BaitlyInvoiceReview.class)
            .setParameter("org",org).getResultList().forEach(r->reviews.put(r.getInvoiceId(),r));
        var archived=new HashSet<>(em.createQuery("select a.invoiceId from BaitlyInvoicePdfArchive a where a.organizationId=:org",Long.class).setParameter("org",org).getResultList());
        var documents=new HashMap<Long,DocumentGeneration>();
        em.createQuery("from DocumentGeneration d where d.organizationId=:org and d.id in (select i.documentGenerationId from Invoice i where i.organizationId=:org)",DocumentGeneration.class)
            .setParameter("org",org).getResultList().forEach(d->documents.put(d.getId(),d));
        return invoices.stream().map(i->{
            var issues=issues(i,documents.get(i.getDocumentGenerationId()));var review=reviews.get(i.getId());
            boolean current=review!=null && BaitlyInvoiceChecks.fingerprint(i).equals(review.getSourceHash()) && BaitlyInvoiceChecks.VERSION.equals(review.getVersion());
            String state=i.getDuplicateOfId()!=null?"COPY":!issues.isEmpty()?"BLOCKED":!current?"TO_CHECK":review.getState();
            return new Row(InvoiceDto.from(i),state,issues.size(),archived.contains(i.getId()));
        }).toList();
    }
    @Transactional(readOnly=true) public View view(Long org,Long id) {
        var invoice=invoice(org,id,false);String hash=BaitlyInvoiceChecks.fingerprint(invoice);
        var issues=issues(invoice);var records=em.createQuery("from BaitlyInvoiceReview where organizationId=:org and invoiceId=:id order by id desc",BaitlyInvoiceReview.class)
            .setParameter("org",org).setParameter("id",id).setMaxResults(20).getResultList();
        var history=records.stream().map(r->new Review(r.getId(),r.getState(),r.getSourceHash(),r.getVersion(),decode(r.getIssues()),r.getActor(),r.getCreatedAt(),hash.equals(r.getSourceHash()) && BaitlyInvoiceChecks.VERSION.equals(r.getVersion()))).toList();
        String state=invoice.getDuplicateOfId()!=null?"COPY":!issues.isEmpty()?"BLOCKED":history.isEmpty() || !history.getFirst().current()?"TO_CHECK":history.getFirst().state();
        boolean archived=em.createQuery("select count(a) from BaitlyInvoicePdfArchive a where a.organizationId=:org and a.invoiceId=:id",Long.class).setParameter("org",org).setParameter("id",id).getSingleResult()>0;
        return new View(state,hash,issues,history,archived);
    }
    public View check(Long org,Long id,String actor) {
        var invoice=invoice(org,id,true);record(invoice,actor);return view(org,id);
    }
    public void record(Invoice invoice,String actor) {
        require(invoice.getId()!=null && invoice.getOrganizationId()!=null,"Facture non enregistrée");
        require(actor!=null && !actor.isBlank() && actor.length()<=255,"Auteur requis");
        var issues=issues(invoice);
        em.persist(new BaitlyInvoiceReview(invoice.getOrganizationId(),invoice.getId(),BaitlyInvoiceChecks.fingerprint(invoice),BaitlyInvoiceChecks.VERSION,issues.isEmpty()?"CHECKED":"BLOCKED",encode(issues),actor));
    }
    public View updateDraft(Long org,Long id,Draft data,String actor) {
        var i=invoice(org,id,true);
        require(i.getStatus()==InvoiceStatus.DRAFT,"Un document émis est immuable ; préparez une rectification.");
        require(data!=null && Objects.equals(data.sourceHash(),BaitlyInvoiceChecks.fingerprint(i)),"Le brouillon a changé. Rechargez le dossier.");
        i.setSellerName(bounded(data.sellerName(),255));i.setSellerAddress(bounded(data.sellerAddress(),4000));i.setSellerTaxId(bounded(data.sellerTaxId(),50));
        i.setBuyerName(bounded(data.buyerName(),255));i.setBuyerAddress(bounded(data.buyerAddress(),4000));i.setBuyerTaxId(bounded(data.buyerTaxId(),50));
        i.setLegalMentions(bounded(data.legalMentions(),10000));i.setDueDate(data.dueDate());em.flush();record(i,actor);return view(org,id);
    }
    private List<BaitlyInvoiceChecks.Issue> issues(Invoice i) {
        return issues(i,i.getDocumentGenerationId()==null?null:em.find(DocumentGeneration.class,i.getDocumentGenerationId()));
    }
    private List<BaitlyInvoiceChecks.Issue> issues(Invoice i,DocumentGeneration d) {
        var issues=new ArrayList<>(BaitlyInvoiceChecks.issues(i));
        if(i.getDocumentGenerationId()!=null){
            if(d==null || !Objects.equals(i.getOrganizationId(),d.getOrganizationId()) || !Objects.equals(i.getInvoiceNumber(),d.getLegalNumber()))
                issues.add(new BaitlyInvoiceChecks.Issue("LEGACY_PDF","Le PDF historique et la facture ne portent pas la même référence. Rapprochement requis ; aucune renumérotation automatique."));
        }
        return List.copyOf(issues);
    }
    private Invoice invoice(Long org,Long id,boolean lock){var i=lock?em.find(Invoice.class,id,LockModeType.PESSIMISTIC_WRITE):em.find(Invoice.class,id);require(i!=null && org!=null && org.equals(i.getOrganizationId()),"Facture inaccessible");i.getLines().size();return i;}
    private static String bounded(String value,int size){require(value==null || value.length()<=size,"Champ trop long");return value==null?null:value.trim();}
    private static String encode(List<BaitlyInvoiceChecks.Issue> issues){try{return JSON.writeValueAsString(issues);}catch(Exception e){throw new IllegalStateException(e);}}
    private static List<BaitlyInvoiceChecks.Issue> decode(String value){try{return JSON.readValue(value,new TypeReference<>(){});}catch(Exception e){throw new IllegalStateException("Rapport de vérification illisible",e);}}
}
