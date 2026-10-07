package com.clenzy.service.payout;

/** Liens de financement prouvés. Une alerte ne réécrit ni le transfert ni sa réception bancaire. */
final class BaitlyPayoutFundingRisk {
    private BaitlyPayoutFundingRisk() {}
    // Alias t = transfert autorisé de l'organisation. Ne jamais joindre par montant ou bénéficiaire seul.
    static final String DISPUTED = """
        EXISTS (SELECT 1 FROM payment_transactions p
          WHERE p.organization_id=t.organization_id AND p.provider_type='STRIPE'
            AND p.payment_type='CHECKOUT' AND p.disputed_amount>0
            AND (
              (t.source='INTERVENTION' AND (
                (p.source_type='INTERVENTION' AND p.source_id=t.source_id)
                OR EXISTS (SELECT 1 FROM intervention_payment_allocations a
                  WHERE a.organization_id=t.organization_id AND a.transaction_id=p.id AND a.intervention_id=t.source_id)
                OR (p.source_type='SERVICE_REQUEST' AND EXISTS (SELECT 1 FROM service_requests r
                  WHERE r.organization_id=t.organization_id AND r.id=p.source_id AND r.converted_intervention_id=t.source_id))))
              OR (t.source='OWNER_PAYOUT' AND EXISTS (SELECT 1 FROM owner_payout_reservations c
                WHERE c.organization_id=t.organization_id AND c.payout_id=t.source_id
                  AND c.payment_transaction_ids @> jsonb_build_array(p.id)))
              OR (t.source='PROVIDER_EXPENSE' AND EXISTS (SELECT 1 FROM provider_expenses e
                JOIN owner_payout_reservations c ON c.organization_id=e.organization_id AND c.payout_id=e.owner_payout_id
                WHERE e.organization_id=t.organization_id AND e.id=t.source_id
                  AND c.payment_transaction_ids @> jsonb_build_array(p.id)))
            ))
        """;
    static final String REFUND_RECOVERY = """
        EXISTS (SELECT 1 FROM baitly_transfer_recoveries r
          JOIN payment_transactions p ON p.organization_id=r.organization_id AND p.id=r.refund_id
          WHERE r.organization_id=t.organization_id AND r.transfer_id=t.id
            AND r.state IN ('WAITING_REFUND','RECOVERING','REVIEW_REQUIRED') AND p.status='COMPLETED')
        """;
}
