package com.clenzy.service;
import com.clenzy.model.BaitlyPurchaseRequest;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import java.util.function.Supplier;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import static com.clenzy.service.BaitlyRefundSeries.require;

@Service
public class BaitlyPurchaseRequests {
    private final EntityManager em;
    public BaitlyPurchaseRequests(EntityManager em){this.em=em;}
    @Transactional
    public Long prepare(Long org,UUID request,String source,String scope,String basket,Supplier<Long> create) {
        require(org!=null && request!=null && Set.of("UPSELL","HARDWARE_ORDER").contains(source) && scope!=null && !scope.isBlank() && basket!=null,"Identifiant d'achat requis");
        String fingerprint=digest(scope+"\n"+basket);
        em.createNativeQuery("select 1 from pg_advisory_xact_lock(hashtextextended(:key,0))").setParameter("key","baitly-purchase:"+org+":"+request).getResultList();
        var rows=em.createQuery("from BaitlyPurchaseRequest where organizationId=:org and requestId=:request",BaitlyPurchaseRequest.class).setParameter("org",org).setParameter("request",request).getResultList();
        if(!rows.isEmpty()) {var row=rows.getFirst();require(source.equals(row.getSource()) && fingerprint.equals(row.getFingerprint()),"Cette demande appartient à un autre achat");return row.getSourceId();}
        Long id=create.get();require(id!=null,"Commande non préparée");em.persist(new BaitlyPurchaseRequest(org,request,source,id,fingerprint));return id;
    }
    private String digest(String value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(java.security.NoSuchAlgorithmException impossible){throw new IllegalStateException(impossible);}}
}
