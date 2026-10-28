package com.clenzy.config;

import com.clenzy.model.*;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.service.ai.BaitlyCreditFunding;
import com.clenzy.service.ai.AiCreditPurchaseService;
import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

/** Finite funded balance for scripted LLM scenarios; no PSP or real model call. */
public final class BaitlyIntegrationCreditFixture {
    private BaitlyIntegrationCreditFixture() {}

    public static void fund(PaymentTransactionRepository payments, BaitlyCreditFunding credits, Long org) {
        // Trusted fixture seeds a completed purchase, then uses real entitlement
        // reconciliation. Signed webhook admission is tested separately.
        var id = UUID.randomUUID().toString();
        var payment = new PaymentTransaction();
        payment.setTransactionRef("BAITLY-IT-" + id);
        payment.setOrganizationId(org);
        payment.setSourceId(org);
        payment.setSourceType(AiCreditPurchaseService.SOURCE_TYPE);
        payment.setProviderType(PaymentProviderType.STRIPE);
        payment.setProviderTxId("cs_recipe_" + id);
        payment.setPaymentType(TransactionType.CHECKOUT);
        payment.setStatus(TransactionStatus.COMPLETED);
        payment.setCurrency("EUR");
        payment.setAmount(new BigDecimal("160.00"));
        payment.setMetadata(Map.of("pack_key", "pack_10000", "millicredits", 10_000_000L));
        payments.saveAndFlush(payment);
        credits.completeTopUp(payment.getTransactionRef());
    }
}
