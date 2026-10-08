package com.clenzy.service;
import com.clenzy.model.HardwareOrder;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.HardwareOrderRepository;
import com.clenzy.tenant.TenantScopedExecutor;
import com.stripe.model.checkout.Session;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Scheduled;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import java.util.*;
import static com.clenzy.service.BaitlyRefundSeries.require;

/** Abandon vérifié auprès du PSP : aucune remise en stock sur le seul temps écoulé. */
@Service
public class BaitlyHardwareAbandonment {
    private final EntityManager em;private final HardwareOrderRepository orders;private final StripeGateway stripe;
    private final BaitlyHardwareInventory inventory;private final ShopService shop;private final TenantScopedExecutor tenants;
    private static final org.slf4j.Logger log=org.slf4j.LoggerFactory.getLogger(BaitlyHardwareAbandonment.class);
    public BaitlyHardwareAbandonment(EntityManager em,HardwareOrderRepository orders,StripeGateway stripe,BaitlyHardwareInventory inventory,ShopService shop,TenantScopedExecutor tenants){this.em=em;this.orders=orders;this.stripe=stripe;this.inventory=inventory;this.shop=shop;this.tenants=tenants;}
    @Scheduled(initialDelayString="${baitly.commerce.stock-check-ms:60000}",fixedDelayString="${baitly.commerce.stock-check-ms:60000}")
    @SchedulerLock(name="baitly-hardware-abandonment",lockAtMostFor="PT5M")
    public void recover() {
        @SuppressWarnings("unchecked") var candidates=(List<Object[]>)em.createNativeQuery("""
            SELECT o.id,o.organization_id FROM hardware_orders o
            WHERE o.status='PENDING' AND o.created_at<now()-interval '1 hour' AND o.stock_check_at<=now()
              AND (o.stripe_session_id IS NOT NULL OR EXISTS (
                SELECT 1 FROM payment_transactions p WHERE p.organization_id=o.organization_id
                  AND p.source_type='HARDWARE_ORDER' AND p.source_id=o.id AND p.payment_type='CHECKOUT'
                  AND p.provider_type='STRIPE' AND p.status IN ('PROCESSING','COMPLETED')
                  AND p.provider_tx_id LIKE 'cs_%'))
            ORDER BY o.stock_check_at,o.id LIMIT 20
            """).getResultList();
        for(var candidate:candidates) {Long id=((Number)candidate[0]).longValue(),org=((Number)candidate[1]).longValue();
            try {tenants.runAsOrganization(org,()->{inventory.deferCheck(org,id);check(org,id);});}catch(RuntimeException failure){log.warn("Commande matériel {} à rapprocher : {}",id,failure.getMessage());}
        }
    }
    public void check(Long org,Long id) {
        // Verrouiller avant la première lecture : le contexte tenant conserve le même EntityManager.
        String reference=shop.recoverCheckoutReference(org,id);
        HardwareOrder order=orders.findById(id).filter(o->org.equals(o.getOrganizationId())).orElseThrow();
        try {
            Session session=stripe.retrieveSession(reference);validate(order,session);
            if("complete".equals(session.getStatus()) && "paid".equals(session.getPaymentStatus())){shop.completeOrder(session.getId());return;}
            if("expired".equals(session.getStatus()) && "unpaid".equals(session.getPaymentStatus()))inventory.release(org,id,session.getId());
        }catch(com.stripe.exception.StripeException failure){throw new IllegalStateException("État du paiement indisponible : stock conservé",failure);}
    }
    private void validate(HardwareOrder order,Session session) {
        require(session!=null && order.getStripeSessionId().equals(session.getId()) && session.getMetadata()!=null
                && "HARDWARE_ORDER".equals(session.getMetadata().get("sourceType"))
                && order.getId().toString().equals(session.getMetadata().get("sourceId"))
                && order.getOrganizationId().toString().equals(session.getMetadata().get("orgId"))
                && order.getCurrency().equalsIgnoreCase(session.getCurrency()) && Objects.equals((long)order.getTotalAmount(),session.getAmountTotal()),"Session matérielle incompatible");
    }
}
