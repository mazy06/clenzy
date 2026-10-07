package com.clenzy.service;

import com.clenzy.model.*;
import jakarta.persistence.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import static com.clenzy.service.BaitlyRefundSeries.require;

/** Archive les factures/avoirs du vendeur et relevés partenaire contre les preuves financières existantes. */
@Service @Transactional
public class BaitlyCommerceEvidenceStore {
    private final EntityManager em;
    public BaitlyCommerceEvidenceStore(EntityManager em){this.em=em;}
    public record Target(String kind,String reference,BigDecimal amount,String currency){}
    public record Request(UUID requestId,String kind,String reference,String number,String issuer,String issuerReference,BigDecimal amount,String currency){}
    public record View(Long id,String kind,String reference,String number,String issuer,String issuerReference,BigDecimal amount,String currency,String sha256,Instant createdAt){}
    public record Dossier(List<Target> targets,List<View> documents){}
    public Dossier dossier(Long org,String source,Long id){var targets=targets(org,source,id);return new Dossier(targets,rows(org,source,id).stream().map(BaitlyCommerceEvidenceStore::view).toList());}
    public View attach(Long org,String source,Long id,Request request,BaitlyFinancialDocument document,String actor){
        require(request!=null && request.requestId()!=null && text(request.number(),100) && text(request.issuer(),200)
            && text(request.issuerReference(),255) && text(actor,255),"Numéro, émetteur, référence légale ou mandat et auteur requis");
        // Source verrouillée avant le rapprochement et le test d'idempotence.
        var targets=targets(org,source,id);
        var existing=em.createQuery("from BaitlyCommerceEvidence where organizationId=:org and requestId=:request",BaitlyCommerceEvidence.class)
            .setParameter("org",org).setParameter("request",request.requestId()).getResultList();
        if(!existing.isEmpty()) {
            var p=existing.getFirst();require(source.equals(p.getSource()) && id.equals(p.getSourceId()) && p.getKind().equals(request.kind())
                && p.getFinancialReference().equals(request.reference()) && p.getDocumentNumber().equals(request.number().trim())
                && p.getIssuer().equals(request.issuer().trim()) && p.getIssuerReference().equals(request.issuerReference().trim())
                && Objects.equals(p.getCurrency(),request.currency()) && request.amount()!=null && p.getAmount().compareTo(request.amount())==0
                && p.getSha256().equals(document.sha256()),"Cette demande désigne une autre pièce");return view(p);
        }
        var target=targets.stream().filter(t->t.kind().equals(request.kind()) && t.reference().equals(request.reference())).findFirst()
            .orElseThrow(()->new IllegalStateException("Preuve financière absente ou pièce déjà rattachée"));
        if(target.kind().equals("CREDIT_NOTE"))require(rows(org,source,id).stream().anyMatch(p->p.getKind().equals("INVOICE")),"Rattachez d'abord la facture vendeur à laquelle cet avoir se rapporte");
        require(request.amount()!=null && target.amount().compareTo(request.amount())==0 && target.currency().equals(request.currency()),"Le montant ou la devise de la pièce ne correspond pas à la preuve");
        var row=new BaitlyCommerceEvidence(org,source,id,request.requestId(),target.kind(),target.reference(),request.number().trim(),request.issuer().trim(),request.issuerReference().trim(),target.amount(),target.currency(),document.sha256(),document.mime(),document.bytes(),actor);
        em.persist(row);em.flush();return view(row);
    }
    @Transactional(readOnly=true) public BaitlyFinancialDocument document(Long org,Long id){
        var row=em.find(BaitlyCommerceEvidence.class,id);require(row!=null && org.equals(row.getOrganizationId()),"Pièce inaccessible");
        var doc=BaitlyFinancialDocument.checked(row.getContent());require(doc.sha256().equals(row.getSha256()),"Intégrité de la pièce à vérifier");return doc;
    }
    private List<Target> targets(Long org,String source,Long id){
        require(org!=null && id!=null && Set.of("UPSELL","AFFILIATE").contains(Objects.toString(source,"")),"Source inaccessible");
        List<Target> result=new ArrayList<>();
        if(source.equals("UPSELL")) {
            var order=em.find(UpsellOrder.class,id);require(order!=null && org.equals(order.getOrganizationId()),"Commande inaccessible");em.refresh(order,LockModeType.PESSIMISTIC_WRITE);
            var payments=em.createQuery("from PaymentTransaction where organizationId=:org and sourceType='UPSELL' and sourceId=:id",PaymentTransaction.class).setParameter("org",org).setParameter("id",id).getResultList();
            var originals=payments.stream().filter(p->p.getPaymentType()==TransactionType.CHECKOUT && p.getStatus()==TransactionStatus.COMPLETED).toList();
            require(originals.size()==1 && Set.of(UpsellOrderStatus.PAID,UpsellOrderStatus.REFUNDED).contains(order.getStatus()),"Vente à rapprocher avant rattachement");
            var original=originals.getFirst();require(original.getAmount().compareTo(order.getAmount())==0 && original.getCurrency().equals(order.getCurrency()) && Objects.equals(original.getProviderTxId(),order.getStripeSessionId()),"Encaissement incompatible");
            result.add(new Target("INVOICE",original.getTransactionRef(),original.getAmount(),original.getCurrency()));
            for(var p:payments)if(p.getPaymentType()==TransactionType.REFUND && p.getStatus()==TransactionStatus.COMPLETED && BaitlyRefundEvidence.confirmedStripe(p)
                && p.getMetadata()!=null && original.getTransactionRef().equals(p.getMetadata().get("originalTransactionRef")) && Boolean.TRUE.equals(p.getMetadata().get("commerceApplied")))
                result.add(new Target("CREDIT_NOTE",p.getTransactionRef(),p.getAmount(),p.getCurrency()));
        } else {
            var commission=em.find(ActivityCommission.class,id);require(commission!=null && org.equals(commission.getOrganizationId()),"Commission inaccessible");em.refresh(commission,LockModeType.PESSIMISTIC_WRITE);
            require(commission.getReceivedAt()!=null && text(commission.getReceiptReference(),255),"Commission reçue à rapprocher avant rattachement");
            var changes=em.createQuery("from BaitlyAffiliateAdjustment where organizationId=:org and commissionId=:id order by id",BaitlyAffiliateAdjustment.class).setParameter("org",org).setParameter("id",id).getResultList();
            result.add(new Target("PARTNER_STATEMENT",commission.getReceiptReference(),changes.isEmpty()?commission.getGrossCommission():changes.getFirst().getBasisGross(),commission.getCurrency()));
            for(var change:changes)result.add(new Target("CORRECTION_STATEMENT","ADJUSTMENT-"+change.getId(),change.getAfterGross(),change.getCurrency()));
        }
        var attached=rows(org,source,id);return result.stream().filter(t->attached.stream().noneMatch(p->p.getKind().equals(t.kind()) && p.getFinancialReference().equals(t.reference()))).toList();
    }
    private List<BaitlyCommerceEvidence> rows(Long org,String source,Long id){return em.createQuery("from BaitlyCommerceEvidence where organizationId=:org and source=:source and sourceId=:id order by id",BaitlyCommerceEvidence.class).setParameter("org",org).setParameter("source",source).setParameter("id",id).getResultList();}
    private static boolean text(String value,int max){return value!=null && !value.isBlank() && value.length()<=max;}
    private static View view(BaitlyCommerceEvidence p){return new View(p.getId(),p.getKind(),p.getFinancialReference(),p.getDocumentNumber(),p.getIssuer(),p.getIssuerReference(),p.getAmount(),p.getCurrency(),p.getSha256(),p.getCreatedAt());}
}
