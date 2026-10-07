package com.clenzy.fiscal.einvoicing.francepdp;

import com.clenzy.model.BaitlyIopoleStatus;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;

/** Aucun appel HTTP dans la transaction ; chaque événement est durable avant son acquittement. */
@Service
@Transactional
public class BaitlyIopoleInboxStore {
    private final EntityManager em;
    public BaitlyIopoleInboxStore(EntityManager em) { this.em = em; }
    public record Event(UUID status, UUID invoice, String body) {}

    public void retain(Long organization, String environment, UUID customer, List<Event> events) {
        for (var event : events) {
            em.createNativeQuery("""
                INSERT INTO baitly_iopole_statuses(organization_id,environment,customer_id,status_id,invoice_id,body)
                VALUES (:org,:env,:customer,:status,:invoice,:body)
                ON CONFLICT (environment,customer_id,status_id) DO NOTHING
                """).setParameter("org", organization).setParameter("env", environment).setParameter("customer", customer)
                .setParameter("status", event.status()).setParameter("invoice", event.invoice()).setParameter("body", event.body()).executeUpdate();
            var saved = em.createQuery("from BaitlyIopoleStatus where environment=:env and customerId=:customer and statusId=:status", BaitlyIopoleStatus.class)
                .setParameter("env", environment).setParameter("customer", customer).setParameter("status", event.status()).getSingleResult();
            if (!organization.equals(saved.getOrganizationId()) || !event.invoice().equals(saved.getInvoiceId()) || !event.body().equals(saved.getBody())) {
                throw new IllegalStateException("Événement Iopole différent ou compte attribué à une autre organisation");
            }
        }
    }

    @Transactional(readOnly = true)
    public List<String> history(Long organization, String environment, UUID customer, UUID invoice) {
        return em.createQuery("select body from BaitlyIopoleStatus where organizationId=:org and environment=:env and customerId=:customer and invoiceId=:invoice order by id", String.class)
            .setParameter("org", organization).setParameter("env", environment).setParameter("customer", customer).setParameter("invoice", invoice).getResultList();
    }
}
