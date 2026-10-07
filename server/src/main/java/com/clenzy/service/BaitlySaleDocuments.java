package com.clenzy.service;

import com.clenzy.payment.StripeGateway;
import com.clenzy.tenant.TenantScopedExecutor;
import com.stripe.model.Invoice;
import com.stripe.model.CreditNote;
import com.stripe.model.Refund;
import com.stripe.param.CreditNoteCreateParams;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Scheduled;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import java.time.Instant;
import java.util.*;
import static com.clenzy.service.BaitlyRefundSeries.require;

/** Copie des pièces du vendeur PSP ; appels réseau hors transaction, émission d'avoir liée à la restitution. */
@Service
public class BaitlySaleDocuments {
    private final BaitlySaleDocumentStore store;
    private final StripeGateway stripe;
    private final TenantScopedExecutor tenants;
    public BaitlySaleDocuments(BaitlySaleDocumentStore store,StripeGateway stripe,TenantScopedExecutor tenants){this.store=store;this.stripe=stripe;this.tenants=tenants;}

    @Scheduled(initialDelayString="${baitly.commerce.documents-ms:60000}",fixedDelayString="${baitly.commerce.documents-ms:60000}")
    @SchedulerLock(name="baitly-sale-documents",lockAtMostFor="PT15M")
    public void resume(){
        for(var c:store.candidates())try {tenants.runAsOrganization(c.org(),()->process(c));}
        catch(Exception e){org.slf4j.LoggerFactory.getLogger(getClass()).warn("Document commercial {} à reprendre : {}",c.id(),e.getClass().getSimpleName());}
    }
    void process(BaitlySaleDocumentStore.Candidate candidate){
        BaitlySaleDocumentStore.Claim claim=null;
        try {
            var optional=store.claim(candidate.org(),candidate.id());if(optional.isEmpty())return;
            claim=optional.get();reconcile(claim);
        }catch(Exception e){
            String code=e.getMessage()!=null && e.getMessage().matches("[A-Z_]{1,100}")?e.getMessage():"DOCUMENT_RECONCILIATION_REQUIRED";
            store.failed(candidate.org(),candidate.id(),claim==null?null:claim.token(),code);
        }
    }
    public void reconcile(BaitlySaleDocumentStore.Claim c)throws com.stripe.exception.StripeException {
        stripe.verifySubscriptionSeller(c.seller(),c.account());
        String invoiceId=c.invoice(),intent=null;
        if(c.session()!=null){
            var session=stripe.retrieveSession(c.session());
            require("complete".equals(session.getStatus()) && "paid".equals(session.getPaymentStatus())
                && Objects.equals(session.getAmountTotal(),c.gross()) && c.currency().equalsIgnoreCase(session.getCurrency())
                && session.getMetadata()!=null && c.account().equals(session.getMetadata().get("seller_account"))
                && c.seller().equals(session.getMetadata().get("seller_country")),"DOCUMENT_CHECKOUT_MISMATCH");
            invoiceId=session.getInvoice();intent=session.getPaymentIntent();
        }
        require(invoiceId!=null && invoiceId.startsWith("in_"),"DOCUMENT_INVOICE_NOT_READY");
        var invoice=stripe.retrieveInvoice(invoiceId);
        require(Set.of("paid","open","uncollectible").contains(Objects.toString(invoice.getStatus(),""))
            && invoiceId.equals(invoice.getId()) && c.currency().equalsIgnoreCase(invoice.getCurrency())
            && Objects.equals(invoice.getTotal(),c.gross()) && c.seller().equals(invoice.getAccountCountry())
            && invoice.getTotalExcludingTax()!=null && invoice.getTotalExcludingTax()>=0 && invoice.getTotalExcludingTax()<=invoice.getTotal()
            && invoice.getAutomaticTax()!=null && Boolean.TRUE.equals(invoice.getAutomaticTax().getEnabled())
            && "complete".equals(invoice.getAutomaticTax().getStatus()),"DOCUMENT_INVOICE_MISMATCH");
        if(c.subscription()!=null)require(c.subscription().equals(BaitlySubscriptionBilling.subscriptionId(invoice)) && Objects.equals(c.customer(),invoice.getCustomer()),"DOCUMENT_SUBSCRIPTION_MISMATCH");
        if(c.session()!=null)require(invoice.getMetadata()!=null && c.account().equals(invoice.getMetadata().get("seller_account")),"DOCUMENT_SELLER_MISMATCH");
        var charges=charges(invoice,intent);
        var snapshot=snapshot(invoice);
        if(c.refundRef().isEmpty()){
            store.complete(c,new BaitlySaleDocumentStore.Proof(c.account(),invoice.getId(),invoice.getNumber(),c.currency(),invoice.getTotalExcludingTax(),invoice.getTotal(),pdf(invoice.getInvoicePdf()),issued(invoice),snapshot));
            if(c.source().equals("SUBSCRIPTION"))for(String charge:charges)for(var refund:stripe.refundsForCharge(charge))
                if("succeeded".equals(refund.getStatus())){require(charge.equals(refund.getCharge()),"DOCUMENT_REFUND_MISMATCH");store.discoverRefund(c,refund.getId());}
            return;
        }
        String refundId=store.refundId(c);var refund=stripe.retrieveRefund(refundId);
        require(refundId.equals(refund.getId()) && "succeeded".equals(refund.getStatus()) && refund.getAmount()!=null && refund.getAmount()>0
            && invoice.getCurrency().equals(refund.getCurrency()) && charges.contains(refund.getCharge()),"DOCUMENT_REFUND_MISMATCH");
        store.validateRefund(c,refund);
        var notes=stripe.creditNotes(invoiceId);
        var matches=notes.stream().filter(n->n.getRefunds()!=null && n.getRefunds().stream().anyMatch(r->refundId.equals(r.getRefund()))).toList();
        require(matches.size()<=1,"DOCUMENT_MULTIPLE_CREDIT_NOTES");
        CreditNote note;
        if(matches.isEmpty()){
            Instant first=store.emitting(c);
            // Au-delà de la fenêtre PSP, rechercher la preuve reste autorisé ; réémettre ne l'est pas.
            require(first.plusSeconds(23*3600).isAfter(Instant.now()),"DOCUMENT_ISSUANCE_UNCERTAIN");
            note=stripe.createLinkedCreditNote(creditNote(invoice,refund,c),"baitly-sale-credit-"+c.org()+"-"+c.id());
        }else note=matches.getFirst();
        validateNote(invoice,refund,note);
        snapshot=new LinkedHashMap<>(snapshot);snapshot.put("originalInvoice",invoice.getId());snapshot.put("originalNumber",invoice.getNumber());snapshot.put("refund",refundId);
        snapshot.put("taxes",com.stripe.net.ApiResource.GSON.toJson(note.getTotalTaxes()));
        snapshot.put("discounts",com.stripe.net.ApiResource.GSON.toJson(note.getDiscountAmounts()));
        snapshot.put("lines",com.stripe.net.ApiResource.GSON.toJson(stripe.creditNoteLines(note.getId())));
        store.complete(c,new BaitlySaleDocumentStore.Proof(c.account(),note.getId(),note.getNumber(),c.currency(),note.getTotalExcludingTax(),note.getAmount(),pdf(note.getPdf()),Instant.ofEpochSecond(note.getCreated()),snapshot));
    }
    private List<String> charges(Invoice invoice,String intent)throws com.stripe.exception.StripeException {
        var result=new ArrayList<String>();long paid=0;boolean sessionFound=intent==null;
        for(var payment:stripe.invoicePayments(invoice.getId(),null)){
            if(!"paid".equals(payment.getStatus()))continue;
            require(invoice.getId().equals(payment.getInvoice()) && invoice.getCurrency().equals(payment.getCurrency()) && payment.getPayment()!=null && payment.getAmountPaid()!=null,"DOCUMENT_PAYMENT_MISMATCH");
            var details=payment.getPayment();String chargeId=details.getCharge();
            if(details.getPaymentIntent()!=null){var pi=stripe.retrievePaymentIntent(details.getPaymentIntent());require("succeeded".equals(pi.getStatus()) && invoice.getCustomer().equals(pi.getCustomer()),"DOCUMENT_PAYMENT_MISMATCH");chargeId=pi.getLatestCharge();}
            require(chargeId!=null && chargeId.startsWith("ch_"),"DOCUMENT_CHARGE_MISSING");
            var charge=stripe.retrieveCharge(chargeId);
            require(chargeId!=null && !result.contains(chargeId) && Boolean.TRUE.equals(charge.getPaid()) && Boolean.TRUE.equals(charge.getCaptured())
                && Objects.equals(charge.getAmount(),payment.getAmountPaid()) && Objects.equals(charge.getAmountCaptured(),charge.getAmount())
                && invoice.getCurrency().equals(charge.getCurrency()) && Objects.equals(invoice.getCustomer(),charge.getCustomer()),"DOCUMENT_CHARGE_MISMATCH");
            result.add(chargeId);paid=Math.addExact(paid,payment.getAmountPaid());sessionFound|=Objects.equals(intent,details.getPaymentIntent());
        }
        require(sessionFound && Objects.equals(invoice.getAmountPaid(),paid),"DOCUMENT_PAYMENTS_INCOMPLETE");return result;
    }
    static CreditNoteCreateParams creditNote(Invoice invoice,Refund refund,BaitlySaleDocumentStore.Claim c){
        return CreditNoteCreateParams.builder().setInvoice(invoice.getId()).setAmount(refund.getAmount()).setEmailType(CreditNoteCreateParams.EmailType.NONE)
            .addRefund(CreditNoteCreateParams.Refund.builder().setType(CreditNoteCreateParams.Refund.Type.REFUND).setRefund(refund.getId()).setAmountRefunded(refund.getAmount()).build())
            .putMetadata("baitly_document",c.id().toString()).putMetadata("baitly_org",c.org().toString()).build();
    }
    static void validateNote(Invoice invoice,Refund refund,CreditNote note){
        require(note!=null && note.getId()!=null && "issued".equals(note.getStatus()) && invoice.getId().equals(note.getInvoice()) && invoice.getCurrency().equals(note.getCurrency())
            && Objects.equals(note.getCustomer(),invoice.getCustomer()) && Objects.equals(note.getAmount(),refund.getAmount())
            && note.getNumber()!=null && note.getCreated()!=null && note.getTotalExcludingTax()!=null && note.getTotalExcludingTax()>=0 && note.getTotalExcludingTax()<=note.getAmount()
            && (note.getOutOfBandAmount()==null || note.getOutOfBandAmount()==0) && note.getRefunds()!=null && note.getRefunds().size()==1
            && refund.getId().equals(note.getRefunds().getFirst().getRefund()) && Objects.equals(refund.getAmount(),note.getRefunds().getFirst().getAmountRefunded()),"DOCUMENT_CREDIT_NOTE_MISMATCH");
    }
    private Map<String,Object> snapshot(Invoice invoice)throws com.stripe.exception.StripeException {
        require(invoice.getNumber()!=null && invoice.getAccountName()!=null && !invoice.getAccountName().isBlank()
            && invoice.getCustomerName()!=null && !invoice.getCustomerName().isBlank() && invoice.getCustomerAddress()!=null
            && invoice.getCustomerAddress().getCountry()!=null,"DOCUMENT_IDENTITIES_INCOMPLETE");
        var data=new LinkedHashMap<String,Object>();data.put("sellerName",invoice.getAccountName());data.put("sellerCountry",invoice.getAccountCountry());
        data.put("sellerTaxIds",com.stripe.net.ApiResource.GSON.toJson(invoice.getAccountTaxIds()));
        data.put("buyerName",invoice.getCustomerName());data.put("buyerAddress",com.stripe.net.ApiResource.GSON.toJson(invoice.getCustomerAddress()));
        data.put("buyerTaxIds",com.stripe.net.ApiResource.GSON.toJson(invoice.getCustomerTaxIds()));
        data.put("taxes",com.stripe.net.ApiResource.GSON.toJson(invoice.getTotalTaxes()));data.put("discounts",com.stripe.net.ApiResource.GSON.toJson(invoice.getTotalDiscountAmounts()));
        data.put("lines",com.stripe.net.ApiResource.GSON.toJson(stripe.invoiceLines(invoice.getId())));return data;
    }
    private static Instant issued(Invoice invoice){require(invoice.getStatusTransitions()!=null && invoice.getStatusTransitions().getFinalizedAt()!=null,"DOCUMENT_NOT_FINALIZED");return Instant.ofEpochSecond(invoice.getStatusTransitions().getFinalizedAt());}
    private static String pdf(String value){require(value!=null,"DOCUMENT_PDF_NOT_READY");return BaitlySubscriptionBilling.stripeUrl(value);}
}
