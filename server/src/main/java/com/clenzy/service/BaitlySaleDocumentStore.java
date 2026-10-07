package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.payment.StripeAmounts;
import jakarta.persistence.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;
import static com.clenzy.service.BaitlyRefundSeries.require;

/** Transactions courtes ; aucun appel PSP dans ce magasin. */
@Service @Transactional
public class BaitlySaleDocumentStore {
    private final EntityManager em;
    public BaitlySaleDocumentStore(EntityManager em){this.em=em;}
    public record Candidate(Long org,Long id){}
    public record Claim(Long id,Long org,UUID token,String source,Long sourceId,String sourceRef,String refundRef,String session,String invoice,
                        String subscription,String customer,String seller,String account,String currency,long gross,Instant firstAttempt){}
    public record Proof(String account,String ref,String number,String currency,long net,long total,String pdf,Instant issued,Map<String,Object> snapshot){}
    public record View(Long id,String source,Long sourceId,String sourceRef,String kind,String state,String number,String currency,Long netCents,Long totalCents,String pdfUrl,Instant issuedAt,String failure){}
    public List<Candidate> candidates(){
        // Source explicite cross-tenant du worker ; les traitements suivants rétablissent le tenant.
        em.createNativeQuery("""
            INSERT INTO baitly_sale_documents(organization_id,source,source_id,source_ref)
            SELECT organization_id,source_type,source_id,transaction_ref FROM payment_transactions
             WHERE status='COMPLETED' AND payment_type='CHECKOUT' AND provider_type='STRIPE'
               AND source_type IN ('AI_CREDIT_TOPUP','HARDWARE_ORDER')
            ON CONFLICT (organization_id,source_ref,refund_ref) DO NOTHING
            """).executeUpdate();
        em.createNativeQuery("""
            INSERT INTO baitly_sale_documents(organization_id,source,source_id,source_ref,refund_ref)
            SELECT p.organization_id,p.source_type,p.source_id,p.metadata->>'originalTransactionRef',p.transaction_ref
             FROM payment_transactions p WHERE p.status='COMPLETED' AND p.payment_type='REFUND' AND p.provider_type='STRIPE'
               AND p.source_type IN ('AI_CREDIT_TOPUP','HARDWARE_ORDER') AND p.metadata->>'commerceApplied'='true'
               AND p.metadata->>'originalTransactionRef' IS NOT NULL
            ON CONFLICT (organization_id,source_ref,refund_ref) DO NOTHING
            """).executeUpdate();
        em.createNativeQuery("""
            INSERT INTO baitly_sale_documents(organization_id,source,source_id,source_ref)
            SELECT organization_id,'SUBSCRIPTION',order_id,invoice_id FROM baitly_subscription_invoices
             WHERE status IN ('paid','open','uncollectible')
            ON CONFLICT (organization_id,source_ref,refund_ref) DO NOTHING
            """).executeUpdate();
        @SuppressWarnings("unchecked") List<Object[]> rows=em.createNativeQuery("SELECT organization_id,id FROM baitly_sale_documents WHERE retry_at<=now() AND (state<>'READY' OR source='SUBSCRIPTION' AND refund_ref='') ORDER BY retry_at,id LIMIT 30").getResultList();
        return rows.stream().map(r->new Candidate(((Number)r[0]).longValue(),((Number)r[1]).longValue())).toList();
    }
    public Optional<Claim> claim(Long org,Long id){
        var d=lock(org,id);if(d.getRetryAt().isAfter(Instant.now()))return Optional.empty();
        String invoice=null,session=null,sub=null,customer=null,seller=null,account=null,currency;long gross;
        if(d.getSource().equals("SUBSCRIPTION")){
            var copy=em.find(BaitlySubscriptionInvoice.class,d.getSourceRef());
            require(copy!=null && org.equals(copy.getOrganizationId()),"DOCUMENT_SOURCE_MISMATCH");
            var order=em.find(BaitlySubscriptionOrder.class,copy.getOrderId());
            require(order!=null && org.equals(order.getOrganizationId()),"DOCUMENT_SOURCE_MISMATCH");
            invoice=copy.getInvoiceId();sub=order.getStripeSubscriptionId();customer=order.getStripeCustomerId();seller=order.getSellerCountry();account=order.getSellerStripeAccountId();currency=copy.getCurrency();gross=copy.getTotalCents();
        } else {
            var p=em.createQuery("from PaymentTransaction where organizationId=:org and transactionRef=:ref",PaymentTransaction.class).setParameter("org",org).setParameter("ref",d.getSourceRef()).getSingleResult();
            require(p.getStatus()==TransactionStatus.COMPLETED && p.getPaymentType()==TransactionType.CHECKOUT && p.getProviderType()==PaymentProviderType.STRIPE && d.getSource().equals(p.getSourceType()) && Objects.equals(d.getSourceId(),p.getSourceId()),"DOCUMENT_SOURCE_MISMATCH");
            require(p.getMetadata()!=null && "true".equals(Objects.toString(p.getMetadata().get("baitly_commerce_invoice"),"")),"LEGACY_DOCUMENT_RECONCILIATION_REQUIRED");
            seller=Objects.toString(p.getMetadata().get("seller_country"),"");account=Objects.toString(p.getMetadata().get("seller_account"),"");session=p.getProviderTxId();currency=p.getCurrency();gross=StripeAmounts.toMinorUnits(p.getAmount());
            if(!d.getRefundRef().isEmpty()) {
                var r=em.createQuery("from PaymentTransaction where organizationId=:org and transactionRef=:ref",PaymentTransaction.class).setParameter("org",org).setParameter("ref",d.getRefundRef()).getSingleResult();
                require(r.getStatus()==TransactionStatus.COMPLETED && BaitlyRefundEvidence.confirmedStripe(r) && d.getSourceRef().equals(r.getMetadata().get("originalTransactionRef")),"REFUND_DOCUMENT_UNCONFIRMED");
            }
        }
        require("FR".equals(seller) && account!=null && account.startsWith("acct_"),"DOCUMENT_SELLER_UNCONFIGURED");
        d.claim();return Optional.of(new Claim(id,org,d.getLeaseToken(),d.getSource(),d.getSourceId(),d.getSourceRef(),d.getRefundRef(),session,invoice,sub,customer,seller,account,currency,gross,d.getFirstAttemptAt()));
    }
    public String refundId(Claim c){
        if(c.source().equals("SUBSCRIPTION"))return c.refundRef();
        var r=em.createQuery("from PaymentTransaction where organizationId=:org and transactionRef=:ref",PaymentTransaction.class).setParameter("org",c.org()).setParameter("ref",c.refundRef()).getSingleResult();return r.getProviderTxId();
    }
    public void validateRefund(Claim c,com.stripe.model.Refund proof){
        if(c.source().equals("SUBSCRIPTION"))return;
        var r=em.createQuery("from PaymentTransaction where organizationId=:org and transactionRef=:ref",PaymentTransaction.class)
            .setParameter("org",c.org()).setParameter("ref",c.refundRef()).getSingleResult();
        require(r.getStatus()==TransactionStatus.COMPLETED && Objects.equals(r.getProviderTxId(),proof.getId())
            && Objects.equals(StripeAmounts.toMinorUnits(r.getAmount()),proof.getAmount()) && r.getCurrency().equalsIgnoreCase(proof.getCurrency()),"REFUND_DOCUMENT_AMOUNT_MISMATCH");
    }
    public Instant emitting(Claim c){var d=lease(c);d.emitting();return d.getFirstAttemptAt();}
    public void complete(Claim c,Proof p){var d=lease(c);d.complete(p.account(),p.ref(),p.number(),p.currency(),p.net(),p.total(),p.pdf(),p.issued(),p.snapshot());}
    public void failed(Long org,Long id,UUID token,String code){var d=lock(org,id);if(token==null && d.getState().equals("PROCESSING") || token!=null && !token.equals(d.getLeaseToken()))return;d.retry(code);}
    public void discoverRefund(Claim c,String refund){
        require(c.source().equals("SUBSCRIPTION") && refund!=null && refund.startsWith("re_"),"REFUND_SOURCE_MISMATCH");
        em.createNativeQuery("INSERT INTO baitly_sale_documents(organization_id,source,source_id,source_ref,refund_ref) VALUES (:org,'SUBSCRIPTION',:id,:ref,:refund) ON CONFLICT (organization_id,source_ref,refund_ref) DO NOTHING")
            .setParameter("org",c.org()).setParameter("id",c.sourceId()).setParameter("ref",c.sourceRef()).setParameter("refund",refund).executeUpdate();
    }
    @Transactional(readOnly=true) public List<View> list(Long org,String source,Long id){
        return em.createQuery("from BaitlySaleDocument where organizationId=:org and (:source is null or source=:source) and (:id is null or sourceId=:id) order by id desc",BaitlySaleDocument.class)
            .setParameter("org",org).setParameter("source",source).setParameter("id",id).setMaxResults(100).getResultList().stream()
            .map(d->new View(d.getId(),d.getSource(),d.getSourceId(),d.getSourceRef(),d.getRefundRef().isEmpty()?"INVOICE":"CREDIT_NOTE",d.getState(),d.getNumber(),d.getCurrency(),d.getNetCents(),d.getTotalCents(),d.getPdfUrl(),d.getIssuedAt(),d.getFailure())).toList();
    }
    @Transactional(readOnly=true) public Map<String,Object> export(Long org,Long id,String source,Long sourceId){
        var d=em.find(BaitlySaleDocument.class,id);
        require(d!=null && org.equals(d.getOrganizationId()) && (source==null || source.equals(d.getSource())) && (sourceId==null || sourceId.equals(d.getSourceId())),"DOCUMENT_NOT_ACCESSIBLE");
        require(d.getProviderRef()!=null && d.getSnapshot()!=null,"DOCUMENT_NOT_VERIFIED");
        return Map.of("schema","baitly.sale-document.v1","number",d.getNumber(),"issuerAccount",d.getProviderAccount(),
            "providerReference",d.getProviderRef(),"issuedAt",d.getIssuedAt(),"currency",d.getCurrency(),"netCents",d.getNetCents(),
            "totalCents",d.getTotalCents(),"kind",d.getRefundRef().isEmpty()?"INVOICE":"CREDIT_NOTE","document",d.getSnapshot());
    }
    private BaitlySaleDocument lease(Claim c){var d=lock(c.org(),c.id());require(c.token().equals(d.getLeaseToken()),"DOCUMENT_LEASE_EXPIRED");return d;}
    private BaitlySaleDocument lock(Long org,Long id){var d=em.find(BaitlySaleDocument.class,id,LockModeType.PESSIMISTIC_WRITE);require(d!=null && org.equals(d.getOrganizationId()),"DOCUMENT_NOT_ACCESSIBLE");em.refresh(d);return d;}
}
