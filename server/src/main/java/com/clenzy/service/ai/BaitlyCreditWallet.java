package com.clenzy.service.ai;

import com.clenzy.model.*;
import com.clenzy.repository.AiCreditGrantRepository;
import jakarta.persistence.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.UUID;

/** PostgreSQL décide du droit de dépenser ; aucune perte de cache ne libère une réservation. */
@Service
public class BaitlyCreditWallet {
    private static final Duration LEASE = Duration.ofMinutes(30);
    private final EntityManager em;
    private final AiCreditGrantRepository grants;
    public BaitlyCreditWallet(EntityManager em, AiCreditGrantRepository grants) { this.em = em; this.grants = grants; }

    @Transactional
    public BaitlyCreditAccount lock(Long org) {
        if (org == null) throw new IllegalArgumentException("Organisation requise");
        em.createNativeQuery("insert into baitly_ai_credit_accounts (organization_id,overdraft_millicredits) values (:org,0) on conflict do nothing")
                .setParameter("org", org).executeUpdate();
        var account = em.find(BaitlyCreditAccount.class, org, LockModeType.PESSIMISTIC_WRITE);
        em.refresh(account, LockModeType.PESSIMISTIC_WRITE);
        return account;
    }

    @Transactional
    public boolean reserve(Long org, UUID key, long amount) {
        if (org == null || key == null || amount <= 0) return false;
        lock(org);
        var hold = em.find(BaitlyCreditReservation.class, key);
        var now = Instant.now();
        if (hold != null && (!org.equals(hold.getOrganizationId()) || !hold.isActive(now))) return false;
        if (available(org) < amount) return false;
        if (hold == null) em.persist(new BaitlyCreditReservation(key, org, amount, now.plus(LEASE)));
        else hold.extend(amount, now.plus(LEASE));
        return true;
    }

    @Transactional
    public void release(Long org, UUID key) {
        lock(org);
        var hold = key == null ? null : em.find(BaitlyCreditReservation.class, key);
        if (hold != null) {
            if (!org.equals(hold.getOrganizationId())) throw new IllegalStateException("Réservation d'une autre organisation");
            hold.close();
        }
    }

    @Transactional
    public boolean renew(Long org, UUID key) {
        lock(org);
        var hold = em.find(BaitlyCreditReservation.class, key);
        if (hold == null || !org.equals(hold.getOrganizationId()) || !hold.isActive(Instant.now()) || available(org) < 0) return false;
        hold.extend(0, Instant.now().plus(LEASE));
        return true;
    }

    @Transactional
    public long consume(Long org, UUID key, long amount) {
        if (amount <= 0) return 0;
        var account = lock(org);
        var hold = key == null ? null : em.find(BaitlyCreditReservation.class, key);
        if (hold != null) {
            if (!org.equals(hold.getOrganizationId())) throw new IllegalStateException("Réservation d'une autre organisation");
            hold.consume(amount);
        }
        long remaining = amount;
        for (var grant : grants.lockActiveGrants(org, Instant.now())) {
            if (remaining == 0) break;
            remaining -= grant.applyConsumption(remaining);
        }
        account.addOverdraft(remaining);
        return amount - remaining;
    }

    @Transactional(readOnly = true)
    public long available(Long org) {
        var state=snapshot(org);
        return Math.subtractExact(state.netMillicredits(),state.reservedMillicredits());
    }

    public record Balance(long netMillicredits,long reservedMillicredits) {
        public long availableMillicredits(){return Math.max(0,netMillicredits-reservedMillicredits);}
        public long debtMillicredits(){return Math.max(0,-netMillicredits);}
    }
    @Transactional(readOnly = true)
    public Balance snapshot(Long org) {
        var now = Instant.now();
        long held = em.createQuery("select coalesce(sum(r.remainingMillicredits),0) from BaitlyCreditReservation r where r.organizationId=:org and r.closed=false and r.expiresAt>:now", Long.class)
                .setParameter("org", org).setParameter("now", now).getSingleResult();
        var account = em.find(BaitlyCreditAccount.class, org);
        return new Balance(Math.subtractExact(grants.availableMillicredits(org, now),
                Math.addExact(account == null ? 0 : account.getOverdraftMillicredits(), revokedDebt(org))),held);
    }

    public long revokedDebt(Long org) {
        return em.createQuery("select coalesce(sum(case when g.millicreditsConsumed > g.millicreditsGranted - g.millicreditsRevoked then g.millicreditsConsumed - g.millicreditsGranted + g.millicreditsRevoked else 0 end),0) from AiCreditGrant g where g.organizationId=:org", Long.class)
                .setParameter("org", org).getSingleResult();
    }

    @Transactional
    public Instant recordCoverage(User payer, com.stripe.model.Invoice invoice) {
        if (invoice == null || invoice.getId() == null || !"paid".equals(invoice.getStatus())
                || !Long.valueOf(0).equals(invoice.getAmountRemaining()) || invoice.getAmountPaid()==null || invoice.getAmountPaid()<=0
                || (invoice.getAmountPaidOffStripe()!=null && invoice.getAmountPaidOffStripe()>0)
                || payer.getStripeCustomerId()==null || !payer.getStripeCustomerId().equals(invoice.getCustomer())
                || payer.getStripeSubscriptionId()==null || !payer.getStripeSubscriptionId().equals(com.clenzy.service.BaitlySubscriptionBilling.subscriptionId(invoice))
                || !java.util.Set.of("subscription_create","subscription_cycle").contains(java.util.Objects.toString(invoice.getBillingReason(),""))
                || invoice.getLines()==null || Boolean.TRUE.equals(invoice.getLines().getHasMore()))
            throw new IllegalStateException("Période de crédits prépayés non prouvée");
        var periods=invoice.getLines().getData().stream()
                .filter(l->l.getParent()!=null && l.getParent().getSubscriptionItemDetails()!=null)
                .filter(l->payer.getStripeSubscriptionId().equals(l.getParent().getSubscriptionItemDetails().getSubscription())
                        && !Boolean.TRUE.equals(l.getParent().getSubscriptionItemDetails().getProration()))
                .map(com.stripe.model.InvoiceLineItem::getPeriod).toList();
        if(periods.isEmpty() || periods.stream().anyMatch(p->p==null || p.getStart()==null || p.getEnd()==null || p.getEnd()<=p.getStart()))
            throw new IllegalStateException("Période de crédits absente");
        // Intersection : aucune ligne du contrat ne permet d'étendre les droits d'une autre ligne.
        Instant start=Instant.ofEpochSecond(periods.stream().mapToLong(p->p.getStart()).max().orElseThrow());
        Instant end=Instant.ofEpochSecond(periods.stream().mapToLong(p->p.getEnd()).min().orElseThrow());
        if(!end.isAfter(start)) throw new IllegalStateException("Périodes de crédits incompatibles");
        lock(payer.getOrganizationId());
        var known=em.find(BaitlyCreditCoverage.class,invoice.getId());
        if(known==null) em.persist(new BaitlyCreditCoverage(invoice.getId(),payer.getOrganizationId(),payer.getStripeSubscriptionId(),start,end));
        else if(!payer.getOrganizationId().equals(known.getOrganizationId()) || !payer.getStripeSubscriptionId().equals(known.getSubscriptionId())
                || !start.equals(known.getPeriodStart()) || !end.equals(known.getPeriodEnd()))
            throw new IllegalStateException("Facture de crédits déjà liée à une autre période");
        reconcileLegacyCoverage(payer.getOrganizationId());
        return start.isAfter(Instant.now()) || known!=null && known.isBlocked() ? null : end;
    }

    @Transactional(readOnly=true)
    public Instant paidUntil(Long org,String subscription) {
        return em.createQuery("select max(c.periodEnd) from BaitlyCreditCoverage c where c.organizationId=:org and c.subscriptionId=:sub and c.blocked=false and c.periodStart<=:now and c.periodEnd>:now",Instant.class)
                .setParameter("org",org).setParameter("sub",subscription).setParameter("now",Instant.now()).getSingleResult();
    }

    @Transactional(readOnly=true)
    public String fundingInvoice(Long org,String subscription) {
        return em.createQuery("from BaitlyCreditCoverage where organizationId=:org and subscriptionId=:sub and blocked=false and periodStart<=:now and periodEnd>:now order by periodEnd desc",BaitlyCreditCoverage.class)
                .setParameter("org",org).setParameter("sub",subscription).setParameter("now",Instant.now()).setMaxResults(1).getResultStream().map(BaitlyCreditCoverage::getInvoiceId).findFirst().orElse(null);
    }

    /** Le lien historique ne se déduit que d'une couverture payée unique, jamais d'un abonnement actif. */
    public void reconcileLegacyCoverage(Long org) {
        for (var grant : em.createQuery("from AiCreditGrant where organizationId=:org and fundingPending=true", AiCreditGrant.class)
                .setParameter("org", org).getResultList()) {
            if (!grant.getStripeRef().startsWith("monthly:" + org + ":")) continue;
            var proofs = em.createQuery("from BaitlyCreditCoverage where organizationId=:org and periodStart<=:date and periodEnd>:date and periodEnd>=:expiry", BaitlyCreditCoverage.class)
                    .setParameter("org", org).setParameter("date", grant.getGrantedAt()).setParameter("expiry", grant.getExpiresAt()).getResultList();
            if (proofs.size() == 1) {
                grant.linkFunding(proofs.getFirst().getInvoiceId()); applyFunding(grant);
            }
        }
    }

    public void applyFunding(AiCreditGrant grant) {
        String ref=grant.getStripeRef();if(!AiCreditGrant.SOURCE_SUBSCRIPTION.equals(grant.getSource()) || ref==null)return;
        String invoice=grant.getFundingInvoiceId()!=null?grant.getFundingInvoiceId():ref.startsWith("in_")?ref:ref.startsWith("monthly:")?ref.substring(ref.lastIndexOf(':')+1):null;
        if(invoice==null || !invoice.startsWith("in_"))return;
        var funding=em.find(BaitlySubscriptionFunding.class,invoice);
        if(funding!=null) {
            if(!grant.getOrganizationId().equals(funding.getOrganizationId()))throw new IllegalStateException("Crédits d'une autre organisation");
            grant.setMillicreditsRevoked(funding.revoked(grant.getMillicreditsGranted()));
        }
    }
}
