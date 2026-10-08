package com.clenzy.service;

import com.clenzy.model.*;
import jakarta.persistence.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import static com.clenzy.service.BaitlyRefundSeries.require;

@Service
public class BaitlyCommerceOperations {
    private final EntityManager em;
    public BaitlyCommerceOperations(EntityManager em){this.em=em;}
    @Transactional(readOnly=true)
    public List<BaitlyCommerceOperation> history(Long org,String source,Long id) {order(org,source,id,false);return rows(org,source,id);}
    @Transactional
    public BaitlyCommerceOperation record(Long org,String source,Long id,UUID request,String action,String proof,String note,String actor) {
        require(request!=null && action!=null && proof!=null && !proof.isBlank() && proof.length()<=255 && note!=null && note.length()<=1000 && actor!=null && !actor.isBlank(),"Action, justificatif et auteur requis");
        var order=order(org,source,id,true);var history=rows(org,source,id);
        for(var previous:history) if(request.equals(previous.getRequestId())) {
            require(action.equals(previous.getAction()) && proof.trim().equals(previous.getProof()) && note.trim().equals(previous.getNote()),"Une autre action utilise cette demande");return previous;
        }
        String state=history.isEmpty()?"PAID":history.getLast().getAction();
        var allowed=source.equals("UPSELL")?Map.of("PAID",Set.of("SCHEDULED","FULFILLED","CANCELLED"),"SCHEDULED",Set.of("FULFILLED","CANCELLED"))
                :Map.of("PAID",Set.of("PREPARING","SHIPPED","CANCELLED"),"PREPARING",Set.of("SHIPPED","CANCELLED"),"SHIPPED",Set.of("DELIVERED","RETURN_REQUESTED"),"DELIVERED",Set.of("RETURN_REQUESTED"),"RETURN_REQUESTED",Set.of("RETURNED"));
        require(allowed.getOrDefault(state,Set.of()).contains(action),"Transition de commande impossible : actualisez le suivi");
        var receipts=em.createQuery("from PaymentTransaction where organizationId=:org and sourceType=:source and sourceId=:id and paymentType=com.clenzy.model.TransactionType.CHECKOUT and status=com.clenzy.model.TransactionStatus.COMPLETED",PaymentTransaction.class)
                .setParameter("org",org).setParameter("source",source).setParameter("id",id).getResultList();
        require(receipts.size()==1 && !receipts.getFirst().hasDisputeRisk(),"Encaissement de la commande à rapprocher");
        var receipt=receipts.getFirst();
        if(order instanceof UpsellOrder upsell)require(Set.of(UpsellOrderStatus.PAID,UpsellOrderStatus.REFUNDED).contains(upsell.getStatus())
                && receipt.getAmount().compareTo(upsell.getAmount())==0 && receipt.getCurrency().equalsIgnoreCase(upsell.getCurrency())
                && Objects.equals(receipt.getProviderTxId(),upsell.getStripeSessionId()),"Preuve de la vente incompatible");
        if(order instanceof HardwareOrder hardware)require(Set.of(OrderStatus.PAID,OrderStatus.SHIPPED,OrderStatus.DELIVERED).contains(hardware.getStatus())
                && receipt.getAmount().compareTo(java.math.BigDecimal.valueOf(hardware.getTotalAmount(),2))==0 && receipt.getCurrency().equalsIgnoreCase(hardware.getCurrency())
                && Objects.equals(receipt.getProviderTxId(),hardware.getStripeSessionId()),"Preuve du matériel incompatible");
        var refunds=em.createQuery("from PaymentTransaction where organizationId=:org and sourceType=:source and sourceId=:id and paymentType=com.clenzy.model.TransactionType.REFUND",PaymentTransaction.class)
                .setParameter("org",org).setParameter("source",source).setParameter("id",id).getResultList();
        if(Set.of("FULFILLED","PREPARING","SHIPPED").contains(action))require(refunds.stream().allMatch(BaitlyExternalRefundStore::rejectedBeforeAccounting),"Restitution en cours ou confirmée : vérifier la commande avant réalisation");
        if(order instanceof HardwareOrder hardware) {
            if(action.equals("SHIPPED"))require(hardware.getShippingName()!=null && hardware.getShippingAddress()!=null && hardware.getShippingCountry()!=null,"Adresse de livraison absente");
            if(action.equals("SHIPPED"))hardware.setStatus(OrderStatus.SHIPPED);
            if(action.equals("DELIVERED"))hardware.setStatus(OrderStatus.DELIVERED);
        }
        var operation=new BaitlyCommerceOperation(org,source,id,request,action,proof.trim(),note.trim(),actor);em.persist(operation);return operation;
    }
    private Object order(Long org,String source,Long id,boolean lock) {
        require(org!=null && id!=null && ("UPSELL".equals(source)||"HARDWARE_ORDER".equals(source)),"Commande inaccessible");
        Object row="UPSELL".equals(source)?em.find(UpsellOrder.class,id):em.find(HardwareOrder.class,id);
        require(row!=null,"Commande inaccessible");
        Long owner=row instanceof UpsellOrder upsell?upsell.getOrganizationId():((HardwareOrder)row).getOrganizationId();require(org.equals(owner),"Commande hors organisation");
        if(lock){em.flush();em.refresh(row,LockModeType.PESSIMISTIC_WRITE);}return row;
    }
    private List<BaitlyCommerceOperation> rows(Long org,String source,Long id){return em.createQuery("from BaitlyCommerceOperation where organizationId=:org and source=:source and sourceId=:id order by id",BaitlyCommerceOperation.class).setParameter("org",org).setParameter("source",source).setParameter("id",id).getResultList();}
}
