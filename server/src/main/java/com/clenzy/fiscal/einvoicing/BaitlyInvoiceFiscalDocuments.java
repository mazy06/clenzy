package com.clenzy.fiscal.einvoicing;

import com.clenzy.fiscal.einvoicing.francepdp.*;
import com.clenzy.model.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import static com.clenzy.service.BaitlyRefundSeries.require;

@Service @Transactional
public class BaitlyInvoiceFiscalDocuments {
    private static final ObjectMapper JSON=new ObjectMapper();
    private final EntityManager em;private final BaitlyInvoiceCiiBuilder builder;private final BaitlyCiiValidator validator;
    public BaitlyInvoiceFiscalDocuments(EntityManager em,BaitlyInvoiceCiiBuilder builder,BaitlyCiiValidator validator){this.em=em;this.builder=builder;this.validator=validator;}
    public record Request(@NotNull @Pattern(regexp="[0-9a-f]{64}") String sourceHash,@NotNull @Valid BaitlyCiiPreparation data){}
    public record View(String state,String sourceHash,String documentHash,String validation,Instant archivedAt,BaitlyCiiPreparation data,List<String> issues,List<BaitlyCiiValidator.Issue> transmissionIssues){}
    public record Check(boolean valid,List<BaitlyCiiValidator.Issue> issues,List<BaitlyCiiValidator.Issue> transmissionIssues){}

    @Transactional(readOnly=true) public View view(Long org,Long id) {
        var invoice=invoice(org,id,false);var found=find(org,id);var problems=new ArrayList<>(builder.issues(invoice));
        if(found.isEmpty())return new View("TO_PREPARE",sourceHash(invoice),null,null,null,null,List.copyOf(problems),List.of());
        var doc=found.getFirst();problems.clear();
        if(!sourceHash(invoice).equals(doc.getSourceHash()) || !hash(doc.getXml()).equals(doc.getDocumentHash())) problems.add("L’archive ne correspond plus à la facture source ; rapprochement requis.");
        return new View(problems.isEmpty()?"LOCAL_VALIDATED":"REVIEW_REQUIRED",sourceHash(invoice),doc.getDocumentHash(),doc.getValidation(),doc.getCreatedAt(),decode(doc.getPreparation()),List.copyOf(problems),validator.validateFrance(doc.getXml()));
    }
    @Transactional(readOnly=true) public Check check(Long org,Long id,Request request) {
        var invoice=invoice(org,id,false);require(request!=null && sourceHash(invoice).equals(request.sourceHash()),"La facture a changé. Rechargez le dossier.");
        return check(invoice,request.data());
    }
    public View archive(Long org,Long id,Request request,String actor) {
        var invoice=invoice(org,id,true);
        require(request!=null && sourceHash(invoice).equals(request.sourceHash()),"La facture a changé. Rechargez le dossier.");
        require(actor!=null && !actor.isBlank() && actor.length()<=255,"Auteur requis");
        var data=encode(request.data());var found=find(org,id);
        if(!found.isEmpty()) {
            require(found.getFirst().getPreparation().equals(data) && found.getFirst().getSourceHash().equals(request.sourceHash()),"Document déjà archivé ; modification interdite.");
            return view(org,id);
        }
        require(em.createQuery("select count(s) from EInvoiceSubmission s where s.organizationId=:org and s.invoiceId=:id and s.submissionStartedAt is not null",Long.class)
            .setParameter("org",org).setParameter("id",id).getSingleResult()==0,"Une transmission existe déjà : rapprochement requis.");
        var checked=check(invoice,request.data());require(checked.valid(),"Préparation fiscale invalide. Contrôlez les données et les mentions françaises avant archivage.");
        var xml=builder.build(invoice,request.data());
        em.persist(new BaitlyInvoiceFiscalDocument(org,id,request.sourceHash(),hash(xml),data,xml,BaitlyInvoiceCiiBuilder.VERSION+" / "+BaitlyCiiValidator.VERSION+" / "+BaitlyCiiValidator.FR_VERSION,actor));em.flush();
        return view(org,id);
    }
    @Transactional(readOnly=true) public byte[] document(Long org,Long id) {
        var invoice=invoice(org,id,false);var found=find(org,id);require(!found.isEmpty(),"Préparation fiscale requise");
        var doc=found.getFirst();require(sourceHash(invoice).equals(doc.getSourceHash()) && hash(doc.getXml()).equals(doc.getDocumentHash()),"Le document fiscal a changé : rapprochement requis");
        return doc.getXml().getBytes(StandardCharsets.UTF_8);
    }
    @Transactional(readOnly=true) public byte[] preparedArtifact(Invoice invoice) {
        if(!builder.issues(invoice).isEmpty())return new byte[0];
        var found=find(invoice.getOrganizationId(),invoice.getId());if(found.isEmpty())return new byte[0];
        var doc=found.getFirst();
        if(!sourceHash(invoice).equals(doc.getSourceHash()) || !hash(doc.getXml()).equals(doc.getDocumentHash()))return new byte[0];
        return doc.getXml().getBytes(StandardCharsets.UTF_8);
    }
    private Check check(Invoice invoice,BaitlyCiiPreparation data) {
        var source=builder.issues(invoice);
        if(!source.isEmpty())return new Check(false,source.stream().map(s->new BaitlyCiiValidator.Issue("SOURCE",s)).toList(),List.of());
        try {var xml=builder.build(invoice,data);var issues=validator.validate(xml);var france=issues.isEmpty()?validator.validateFrance(xml):List.<BaitlyCiiValidator.Issue>of();return new Check(issues.isEmpty() && france.isEmpty(),issues,france);}
        catch(IllegalArgumentException e){return new Check(false,List.of(new BaitlyCiiValidator.Issue("IDENTITY",e.getMessage())),List.of());}
    }
    private Invoice invoice(Long org,Long id,boolean lock) {
        var i=lock?em.find(Invoice.class,id,LockModeType.PESSIMISTIC_WRITE):em.find(Invoice.class,id);
        require(i!=null && org!=null && org.equals(i.getOrganizationId()),"Facture inaccessible");i.getLines().size();return i;
    }
    private List<BaitlyInvoiceFiscalDocument> find(Long org,Long id){return em.createQuery("from BaitlyInvoiceFiscalDocument where organizationId=:org and invoiceId=:id",BaitlyInvoiceFiscalDocument.class).setParameter("org",org).setParameter("id",id).getResultList();}
    private static String sourceHash(Invoice invoice){return hash(BaitlyEInvoiceStore.fingerprint(invoice)+"|"+invoice.getDueDate()+"|"+invoice.getOriginalInvoiceId()+"|"+invoice.getDuplicateOfId());}
    private static String hash(String value){try{return HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(java.security.NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
    private static String encode(BaitlyCiiPreparation data){try{return JSON.writeValueAsString(data);}catch(Exception e){throw new IllegalArgumentException("Préparation invalide",e);}}
    private static BaitlyCiiPreparation decode(String value){try{return JSON.readValue(value,BaitlyCiiPreparation.class);}catch(Exception e){throw new IllegalStateException("Archive illisible",e);}}
}
