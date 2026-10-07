package com.clenzy.service;
import com.clenzy.model.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import static com.clenzy.service.BaitlyRefundSeries.require;

@Service
public class BaitlyHardwareInventory {
    private final EntityManager em;private final ObjectMapper json;
    public BaitlyHardwareInventory(EntityManager em,ObjectMapper json){this.em=em;this.json=json;}
    @Transactional(readOnly=true) public List<BaitlyHardwareStock> list(String country){country(country);return em.createQuery("from BaitlyHardwareStock where country=:country order by sku",BaitlyHardwareStock.class).setParameter("country",country).getResultList();}
    @Transactional public BaitlyHardwareStock adjust(String country,String sku,int expected,int delta,UUID request,String proof,String actor) {
        country(country);require(HardwareCatalog.findBySku(sku).isPresent() && request!=null && delta!=0 && Math.abs((long)delta)<=100000
                && proof!=null && !proof.isBlank() && proof.length()<=255 && actor!=null && !actor.isBlank(),"Produit, quantité et justificatif requis");
        String id=country+":"+sku;
        em.flush(); // Une seconde opération dans la même transaction ne doit pas perdre une variation non flushée.
        em.createNativeQuery("INSERT INTO baitly_hardware_stock(id,country,sku,available,reserved) VALUES (:id,:country,:sku,0,0) ON CONFLICT DO NOTHING")
                .setParameter("id",id).setParameter("country",country).setParameter("sku",sku).executeUpdate();
        var row=em.find(BaitlyHardwareStock.class,id,LockModeType.PESSIMISTIC_WRITE);em.refresh(row);
        var existing=em.createQuery("from BaitlyHardwareStockChange where requestId=:request",BaitlyHardwareStockChange.class).setParameter("request",request).getResultList();
        if(!existing.isEmpty()) {
            var previous=existing.getFirst();require(id.equals(previous.getStockId()) && delta==previous.getDelta() && expected==previous.getBeforeQuantity() && proof.trim().equals(previous.getProof()),"Une autre réception utilise cette demande");return row;
        }
        require(row.getAvailable()==expected,"Le stock a changé : actualisez les quantités");
        em.persist(new BaitlyHardwareStockChange(id,request,delta,expected,proof.trim(),actor));row.adjust(delta);return row;
    }
    @Transactional public void reserve(HardwareOrder order,String country) {
        country(country);require(order.getId()!=null && order.getStatus()==OrderStatus.PENDING,"Commande non préparée");
        var items=items(order);var previous=reservations(order);
        if(!previous.isEmpty()) {require(previous.size()==items.size() && previous.stream().allMatch(p->p.getStockId().startsWith(country+":") && p.getQuantity()==items.getOrDefault(p.getStockId().substring(3),0) && p.getState().equals("HELD")),"Réserve de commande incompatible");return;}
        for(var item:items.entrySet()) {
            var stock=stock(country+":"+item.getKey());stock.reserve(item.getValue());em.persist(new BaitlyHardwareReservation(order.getOrganizationId(),order.getId(),stock.getId(),item.getValue()));
        }
    }
    @Transactional public void paid(HardwareOrder order) {
        var rows=reservations(order);require(!rows.isEmpty(),"Ancienne commande sans réserve de stock : rapprochement requis");
        require(rows.size()==items(order).size(),"Réserve incomplète");
        for(var row:rows) {if(row.getState().equals("SOLD"))continue;require(row.getState().equals("HELD"),"Paiement tardif après libération du stock : vérifier la commande");stock(row.getStockId()).sell(row.getQuantity());row.state("SOLD");}
    }
    /** La session canonique doit être expirée et non payée avant d'appeler cette méthode. */
    @Transactional public void release(Long org,Long orderId,String sessionId) {
        var order=em.find(HardwareOrder.class,orderId,LockModeType.PESSIMISTIC_WRITE);require(order!=null && org.equals(order.getOrganizationId()),"Commande inaccessible");em.refresh(order);
        require(order.getStatus()==OrderStatus.PENDING && sessionId.equals(order.getStripeSessionId()),"Commande déjà encaissée ou session différente");
        for(var row:reservations(order)) {if(row.getState().equals("RELEASED"))continue;require(row.getState().equals("HELD"),"Stock déjà vendu");stock(row.getStockId()).release(row.getQuantity());row.state("RELEASED");}
        order.setStatus(OrderStatus.CANCELLED);
    }
    /** Un retour physique reste distinct du remboursement ; seuls les articles contrôlés réintègrent le stock. */
    @Transactional public void returnToStock(Long org,Long orderId,String proof,String actor) {
        var order=em.find(HardwareOrder.class,orderId,LockModeType.PESSIMISTIC_WRITE);require(order!=null && org.equals(order.getOrganizationId()),"Commande inaccessible");em.refresh(order);
        var returned=em.createQuery("select count(e) from BaitlyCommerceOperation e where e.organizationId=:org and e.source='HARDWARE_ORDER' and e.sourceId=:id and e.action='RETURNED'",Long.class).setParameter("org",org).setParameter("id",orderId).getSingleResult();
        require(returned>0 && proof!=null && !proof.isBlank() && proof.length()<=255 && actor!=null && !actor.isBlank(),"Retour reçu et contrôle requis");
        var reservations=reservations(order);require(!reservations.isEmpty() && reservations.size()==items(order).size(),"Stock de la commande à rapprocher");
        for(var row:reservations) {
            UUID request=UUID.nameUUIDFromBytes(("return:"+orderId+":"+row.getStockId()).getBytes(java.nio.charset.StandardCharsets.UTF_8));
            if(row.getState().equals("RETURNED")){
                var previous=em.createQuery("from BaitlyHardwareStockChange where requestId=:request",BaitlyHardwareStockChange.class).setParameter("request",request).getSingleResult();
                require(previous.getProof().equals(proof.trim()),"Le retour possède déjà un autre justificatif");continue;
            }
            require(row.getState().equals("SOLD"),"Article non vendu");var stock=stock(row.getStockId());
            em.persist(new BaitlyHardwareStockChange(stock.getId(),request,row.getQuantity(),stock.getAvailable(),proof.trim(),actor));
            stock.adjust(row.getQuantity());row.state("RETURNED");
        }
    }
    @Transactional public void deferCheck(Long org,Long id) {
        em.createNativeQuery("UPDATE hardware_orders SET stock_check_at=now()+interval '1 hour' WHERE id=:id AND organization_id=:org")
            .setParameter("org",org).setParameter("id",id).executeUpdate();
    }
    private SortedMap<String,Integer> items(HardwareOrder order) {
        try {var items=new TreeMap<String,Integer>();for(var item:json.readTree(order.getItemsJson())) {
            String sku=item.path("sku").asText();int n=item.path("quantity").asInt();require(n>0 && n<=100 && HardwareCatalog.findBySku(sku).isPresent() && !items.containsKey(sku),"Panier historique invalide");items.put(sku,n);
        }require(!items.isEmpty(),"Panier vide");return items;}catch(com.fasterxml.jackson.core.JsonProcessingException e){throw new IllegalStateException("Panier historique illisible",e);}
    }
    private BaitlyHardwareStock stock(String id){em.flush();var row=em.find(BaitlyHardwareStock.class,id,LockModeType.PESSIMISTIC_WRITE);require(row!=null,"Stock à renseigner pour "+id);em.refresh(row);return row;}
    private List<BaitlyHardwareReservation> reservations(HardwareOrder order){return em.createQuery("from BaitlyHardwareReservation where organizationId=:org and orderId=:id order by stockId",BaitlyHardwareReservation.class).setParameter("org",order.getOrganizationId()).setParameter("id",order.getId()).getResultList();}
    private static void country(String country){require(Set.of("FR","MA","SA").contains(Objects.toString(country,"")),"Pays de stock inconnu");}
}
