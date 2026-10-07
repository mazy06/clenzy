package com.clenzy.payment;

import com.stripe.exception.StripeException;
import com.stripe.model.Account;
import com.stripe.model.AccountLink;
import com.stripe.model.Coupon;
import com.stripe.model.Customer;
import com.stripe.model.EphemeralKey;
import com.stripe.model.PaymentIntent;
import com.stripe.model.Price;
import com.stripe.model.Refund;
import com.stripe.model.Subscription;
import com.stripe.model.Transfer;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.param.AccountCreateParams;
import com.stripe.param.AccountLinkCreateParams;
import com.stripe.param.CouponCreateParams;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.EphemeralKeyCreateParams;
import com.stripe.param.PaymentIntentCreateParams;
import com.stripe.param.PaymentIntentUpdateParams;
import com.stripe.param.PriceCreateParams;
import com.stripe.param.RefundCreateParams;
import com.stripe.param.SubscriptionCancelParams;
import com.stripe.param.SubscriptionCreateParams;
import com.stripe.param.TransferCreateParams;
import com.stripe.param.checkout.SessionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Point d'entree unique vers le SDK Stripe (T-SOLID-3 / Z3-SEC-05).
 *
 * <p>La cle API est transmise a chaque appel via {@link RequestOptions} au lieu
 * de muter l'etat statique global {@code Stripe.apiKey} : c'est thread-safe et
 * compatible avec une future introduction de cles par tenant (Stripe Connect
 * multi-comptes) sans risque de fuite de cle entre threads concurrents.</p>
 *
 * <p>Les methodes acceptant une {@code idempotencyKey} garantissent qu'un
 * re-essai du meme appel (apres timeout, crash ou echec de persistance locale)
 * ne produit pas un second effet de bord cote Stripe : Stripe renvoie la
 * reponse de la premiere requete.</p>
 */
@Component
public class StripeGateway {
    // Identifiant stable de l'intégration : préserver les retries idempotents.
    public static final String CHECKOUT_INTEGRATION_ID = "baitly-pms-vnjqksaf";

    private final String stripeSecretKey;

    public StripeGateway(@Value("${stripe.secret-key:}") String stripeSecretKey) {
        this.stripeSecretKey = stripeSecretKey;
    }

    public Session createSession(SessionCreateParams params) throws StripeException {
        return Session.create(params, requestOptions(null));
    }

    /**
     * Crée une session Checkout avec cle d'idempotence : un re-essai (double-clic,
     * concurrence scan+action manuelle, retry apres timeout) ne cree pas une seconde
     * session — Stripe renvoie la premiere. La cle doit etre stable pour un meme lot.
     */
    public Session createSession(SessionCreateParams params, String idempotencyKey) throws StripeException {
        return Session.create(params, requestOptions(idempotencyKey));
    }

    public Session retrieveSession(String sessionId) throws StripeException {
        return Session.retrieve(sessionId, requestOptions(null));
    }

    public Account retrievePlatformAccount() throws StripeException {
        return Account.retrieve(requestOptions(null));
    }

    /** Un prix en MAD/SAR ne permet pas de facturer avec l'entité française par défaut. */
    public String requireSubscriptionSellerCountry(String country) throws StripeException {
        Account account=retrievePlatformAccount();
        if(account==null || account.getId()==null || country==null || !country.equalsIgnoreCase(account.getCountry()))
            throw new IllegalStateException("Le compte de paiement de la société Baitly "+country+" doit être raccordé avant la souscription");
        return account.getId();
    }

    public void verifySubscriptionSeller(String country,String accountId) throws StripeException {
        if(accountId==null)return; // Contrats historiques, à rapprocher sans inventer leur vendeur.
        if(!accountId.equals(requireSubscriptionSellerCountry(country)))
            throw new IllegalStateException("Le compte de paiement ne correspond pas à la société du contrat Baitly");
    }

    /** Sans paramétrage fiscal actif, ne pas annoncer des taxes calculées en facturant silencieusement zéro. */
    public void requireSubscriptionTaxReady() throws StripeException {
        var tax = new com.stripe.StripeClient(stripeSecretKey).v1().tax();
        var settings = tax.settings().retrieve();
        var registrations = tax.registrations().list(com.stripe.param.tax.RegistrationListParams.builder()
                .setStatus(com.stripe.param.tax.RegistrationListParams.Status.ACTIVE).setLimit(1L).build());
        if (!"active".equals(settings.getStatus()) || registrations.getData().isEmpty())
            throw new IllegalStateException("La facturation HT nécessite de finaliser la configuration Stripe Tax de Baitly avant le paiement");
    }

    /** Résout la session d'un remboursement externe sans se fier à ses métadonnées. */
    public java.util.List<Session> sessionsForPaymentIntent(String intent) throws StripeException {
        var params = com.stripe.param.checkout.SessionListParams.builder().setPaymentIntent(intent).setLimit(100L).build();
        var sessions = new java.util.ArrayList<Session>();
        for (var session : new com.stripe.StripeClient(stripeSecretKey).v1().checkout().sessions().list(params).autoPagingIterable()) {
            sessions.add(session);
        }
        return java.util.List.copyOf(sessions);
    }

    public Session expireSession(Session session, String idempotencyKey) throws StripeException {
        return session.expire(com.stripe.param.checkout.SessionExpireParams.builder().build(), requestOptions(idempotencyKey));
    }

    public com.stripe.model.Charge retrieveCharge(String chargeId) throws StripeException {
        return com.stripe.model.Charge.retrieve(chargeId, requestOptions(null));
    }

    public com.stripe.model.Dispute retrieveDispute(String disputeId) throws StripeException {
        return new com.stripe.StripeClient(stripeSecretKey).v1().disputes().retrieve(disputeId);
    }

    /** Une page bornée ; les données métier sont ensuite relues par identifiant canonique. */
    public com.stripe.model.StripeCollection<com.stripe.model.Dispute> listDisputePage(String after) throws StripeException {
        var params = com.stripe.param.DisputeListParams.builder().setLimit(25L);
        if (after != null) params.setStartingAfter(after);
        return new com.stripe.StripeClient(stripeSecretKey).v1().disputes().list(params.build());
    }

    public java.util.List<com.stripe.model.Dispute> disputesForCharge(String chargeId) throws StripeException {
        var params=com.stripe.param.DisputeListParams.builder().setCharge(chargeId).setLimit(100L).build();
        var result=new java.util.ArrayList<com.stripe.model.Dispute>();
        for(var dispute:new com.stripe.StripeClient(stripeSecretKey).v1().disputes().list(params).autoPagingIterable()) result.add(dispute);
        return java.util.List.copyOf(result);
    }

    /**
     * Dépose les preuves d'un litige ({@code CHARGEBACK_SUBMIT}) — retrieve puis update
     * avec RequestOptions par appel (jamais de clé statique) et idempotency key.
     */
    public com.stripe.model.Dispute updateDispute(String disputeId,
                                                  com.stripe.param.DisputeUpdateParams params,
                                                  String idempotencyKey) throws StripeException {
        com.stripe.model.Dispute dispute = com.stripe.model.Dispute.retrieve(disputeId, requestOptions(null));
        return dispute.update(params, requestOptions(idempotencyKey));
    }

    public Refund createRefund(RefundCreateParams params, String idempotencyKey) throws StripeException {
        return Refund.create(params, requestOptions(idempotencyKey));
    }

    public Refund retrieveRefund(String refundId) throws StripeException {
        return Refund.retrieve(refundId, requestOptions(null));
    }

    public java.util.List<Refund> listPaymentRefunds(String intent) throws StripeException {
        var params = com.stripe.param.RefundListParams.builder().setPaymentIntent(intent).setLimit(100L).build();
        var result = new java.util.ArrayList<Refund>();
        for (var refund : new com.stripe.StripeClient(stripeSecretKey).v1().refunds().list(params).autoPagingIterable()) {
            result.add(refund);
        }
        return java.util.List.copyOf(result);
    }

    /** Retrouve une émission après timeout, même au-delà de la durée des clés Stripe. */
    public Refund findPaymentRefund(String intent, String ref) throws StripeException {
        var params = com.stripe.param.RefundListParams.builder().setPaymentIntent(intent).setLimit(100L).build();
        var client = new com.stripe.StripeClient(stripeSecretKey);
        Refund found = null;
        for (var refund : client.v1().refunds().list(params).autoPagingIterable()) {
            if (refund.getMetadata() != null && ref.equals(refund.getMetadata().get("baitly_refund_ref"))) {
                if (found != null) throw new IllegalStateException("Plusieurs remboursements portent la même référence Baitly");
                found = refund;
            }
        }
        return found;
    }

    /** Une annulation ne cumule jamais implicitement un ancien remboursement ou un geste commercial. */
    public Refund findExclusivePaymentRefund(String intent, String ref) throws StripeException {
        var params = com.stripe.param.RefundListParams.builder().setPaymentIntent(intent).setLimit(100L).build();
        var client = new com.stripe.StripeClient(stripeSecretKey);
        Refund found = null;
        for (var refund : client.v1().refunds().list(params).autoPagingIterable()) {
            if (refund.getMetadata() != null && ref.equals(refund.getMetadata().get("baitly_refund_ref"))) {
                if (found != null) throw new IllegalStateException("Plusieurs remboursements portent la même référence Baitly");
                found = refund;
            } else if (!"failed".equals(refund.getStatus()) && !"canceled".equals(refund.getStatus())) {
                throw new IllegalStateException("Un autre remboursement nécessite un rapprochement avant l'annulation financière");
            }
        }
        return found;
    }

    public Refund findFinancialRefund(String paymentIntent, String decisionId) throws StripeException {
        var params = com.stripe.param.RefundListParams.builder().setPaymentIntent(paymentIntent).setLimit(100L).build();
        for (Refund refund : Refund.list(params, requestOptions(null)).autoPagingIterable()) {
            if (refund.getMetadata() != null && decisionId.equals(refund.getMetadata().get("baitly_financial_decision"))) return refund;
        }
        return null;
    }

    public Transfer createTransfer(TransferCreateParams params, String idempotencyKey) throws StripeException {
        return Transfer.create(params, requestOptions(idempotencyKey));
    }

    public java.util.List<com.stripe.model.TransferReversal> listTransferReversals(String transferId) throws StripeException {
        var params = com.stripe.param.TransferReversalListParams.builder().setLimit(100L).build();
        var result = new java.util.ArrayList<com.stripe.model.TransferReversal>();
        for (var reversal : new com.stripe.StripeClient(stripeSecretKey).v1().transfers().reversals()
                .list(transferId, params).autoPagingIterable()) result.add(reversal);
        return java.util.List.copyOf(result);
    }

    public com.stripe.model.TransferReversal createTransferReversal(String transferId,
            com.stripe.param.TransferReversalCreateParams params, String key) throws StripeException {
        return new com.stripe.StripeClient(stripeSecretKey).v1().transfers().reversals()
                .create(transferId, params, RequestOptions.builder().setIdempotencyKey(key).build());
    }

    public com.stripe.model.TransferReversal retrieveTransferReversal(String transferId, String reversalId) throws StripeException {
        return new com.stripe.StripeClient(stripeSecretKey).v1().transfers().reversals().retrieve(transferId, reversalId);
    }

    /** Preuve du transfert émis par la plateforme. */
    public com.stripe.model.Transfer retrieveTransfer(String transferId) throws StripeException {
        return new com.stripe.StripeClient(stripeSecretKey).transfers().retrieve(transferId);
    }

    public com.stripe.model.Balance retrievePlatformBalance() throws StripeException {
        return new com.stripe.StripeClient(stripeSecretKey).balance().retrieve();
    }

    public com.stripe.model.Payout retrieveConnectedPayout(String accountId, String payoutId) throws StripeException {
        return new com.stripe.StripeClient(stripeSecretKey).payouts().retrieve(payoutId, connectedOptions(accountId));
    }

    /** Fenêtre figée et pagination explicite pour reprendre un rattrapage après interruption. */
    public com.stripe.model.StripeCollection<com.stripe.model.Payout> listConnectedPayouts(
            String accountId, long from, long until, String after) throws StripeException {
        var params = com.stripe.param.PayoutListParams.builder().setLimit(25L)
                .setCreated(com.stripe.param.PayoutListParams.Created.builder().setGte(from).setLte(until).build());
        if (after != null) params.setStartingAfter(after);
        return new com.stripe.StripeClient(stripeSecretKey).payouts().list(params.build(), connectedOptions(accountId));
    }

    public com.stripe.model.StripeCollection<com.stripe.model.BalanceTransaction> listConnectedPayoutTransactions(
            String accountId, String payoutId, String after) throws StripeException {
        var params = com.stripe.param.BalanceTransactionListParams.builder().setPayout(payoutId).setLimit(100L);
        if (after != null) params.setStartingAfter(after);
        return new com.stripe.StripeClient(stripeSecretKey).balanceTransactions().list(params.build(), connectedOptions(accountId));
    }

    private RequestOptions connectedOptions(String accountId) {
        if (accountId == null || !accountId.startsWith("acct_")) throw new IllegalArgumentException("Compte connecté requis.");
        return RequestOptions.builder().setStripeAccount(accountId).build();
    }

    public Coupon createCoupon(CouponCreateParams params) throws StripeException {
        return Coupon.create(params, requestOptions(null));
    }

    public Coupon createCoupon(CouponCreateParams params,String key) throws StripeException {
        return Coupon.create(params,requestOptions(key));
    }

    public com.stripe.model.Invoice retrieveInvoice(String id) throws StripeException {
        return com.stripe.model.Invoice.retrieve(id,requestOptions(null));
    }

    public java.util.List<com.stripe.model.CreditNote> creditNotes(String invoice) throws StripeException {
        var result=new java.util.ArrayList<com.stripe.model.CreditNote>();
        for(var note:com.stripe.model.CreditNote.list(java.util.Map.of("invoice",invoice,"limit",100L),requestOptions(null)).autoPagingIterable())result.add(note);
        return java.util.List.copyOf(result);
    }

    public java.util.List<com.stripe.model.InvoiceLineItem> invoiceLines(String invoice)throws StripeException {
        var result=new java.util.ArrayList<com.stripe.model.InvoiceLineItem>();
        for(var line:new com.stripe.StripeClient(stripeSecretKey).v1().invoices().lineItems().list(invoice,com.stripe.param.InvoiceLineItemListParams.builder().setLimit(100L).build()).autoPagingIterable())result.add(line);
        return java.util.List.copyOf(result);
    }
    public java.util.List<com.stripe.model.CreditNoteLineItem> creditNoteLines(String note)throws StripeException {
        var result=new java.util.ArrayList<com.stripe.model.CreditNoteLineItem>();
        for(var line:new com.stripe.StripeClient(stripeSecretKey).v1().creditNotes().lineItems().list(note,
            com.stripe.param.CreditNoteLineItemListParams.builder().setLimit(100L).build()).autoPagingIterable())result.add(line);
        return java.util.List.copyOf(result);
    }

    /** Rattache un remboursement existant ; ne crée jamais un second remboursement. */
    public com.stripe.model.CreditNote createLinkedCreditNote(com.stripe.param.CreditNoteCreateParams params,String key) throws StripeException {
        if(params.getRefundAmount()!=null || params.getRefunds()==null || params.getRefunds().size()!=1
                || params.getEmailType()!=com.stripe.param.CreditNoteCreateParams.EmailType.NONE)
            throw new IllegalArgumentException("L'avoir doit uniquement référencer un remboursement existant");
        return com.stripe.model.CreditNote.create(params,requestOptions(key));
    }

    public java.util.List<com.stripe.model.InvoicePayment> invoicePayments(String invoice,String intent) throws StripeException {
        var params=new java.util.HashMap<String,Object>();params.put("limit",100L);
        if(invoice!=null)params.put("invoice",invoice);
        if(intent!=null)params.put("payment",java.util.Map.of("type","payment_intent","payment_intent",intent));
        if(invoice==null && intent==null)throw new IllegalArgumentException("Facture ou encaissement requis");
        var result=new java.util.ArrayList<com.stripe.model.InvoicePayment>();
        for(var payment:com.stripe.model.InvoicePayment.list(params,requestOptions(null)).autoPagingIterable())result.add(payment);
        return java.util.List.copyOf(result);
    }

    public java.util.List<Refund> refundsForCharge(String charge) throws StripeException {
        var result=new java.util.ArrayList<Refund>();
        for(var refund:Refund.list(java.util.Map.of("charge",charge,"limit",100L),requestOptions(null)).autoPagingIterable())result.add(refund);
        return java.util.List.copyOf(result);
    }

    public Subscription updateSubscription(Subscription subscription,java.util.Map<String,Object> params,String key) throws StripeException {
        return subscription.update(params,requestOptions(key));
    }

    public String subscriptionPaymentPortal(String customer,String returnUrl) throws StripeException {
        return com.stripe.model.billingportal.Session.create(java.util.Map.of("customer",customer,"return_url",returnUrl,
                "flow_data",java.util.Map.of("type","payment_method_update")),requestOptions(null)).getUrl();
    }

    public Customer createCustomer(CustomerCreateParams params) throws StripeException {
        return Customer.create(params, requestOptions(null));
    }

    public Customer retrieveCustomer(String customerId) throws StripeException {
        return Customer.retrieve(customerId, requestOptions(null));
    }

    public EphemeralKey createEphemeralKey(EphemeralKeyCreateParams params) throws StripeException {
        return EphemeralKey.create(params, requestOptions(null));
    }

    public Price createPrice(PriceCreateParams params) throws StripeException {
        return Price.create(params, requestOptions(null));
    }

    public PaymentIntent createPaymentIntent(PaymentIntentCreateParams params) throws StripeException {
        return PaymentIntent.create(params, requestOptions(null));
    }

    /** Cree un PaymentIntent avec cle d'idempotence (pre-autorisation / hold de caution). */
    public PaymentIntent createPaymentIntent(PaymentIntentCreateParams params, String idempotencyKey)
            throws StripeException {
        return PaymentIntent.create(params, requestOptions(idempotencyKey));
    }

    /** Capture (totale ou partielle) un PaymentIntent en pre-autorisation manuelle. */
    public PaymentIntent capturePaymentIntent(PaymentIntent paymentIntent,
                                              com.stripe.param.PaymentIntentCaptureParams params,
                                              String idempotencyKey) throws StripeException {
        return paymentIntent.capture(params, requestOptions(idempotencyKey));
    }

    /** Annule un PaymentIntent (libere un hold de caution). */
    public PaymentIntent cancelPaymentIntent(PaymentIntent paymentIntent, String idempotencyKey)
            throws StripeException {
        return paymentIntent.cancel(requestOptions(idempotencyKey));
    }

    public PaymentIntent retrievePaymentIntent(String paymentIntentId) throws StripeException {
        return PaymentIntent.retrieve(paymentIntentId, requestOptions(null));
    }

    public PaymentIntent updatePaymentIntent(PaymentIntent paymentIntent, PaymentIntentUpdateParams params)
            throws StripeException {
        return paymentIntent.update(params, requestOptions(null));
    }

    public Subscription createSubscription(SubscriptionCreateParams params) throws StripeException {
        return Subscription.create(params, requestOptions(null));
    }

    public Subscription retrieveSubscription(String subscriptionId) throws StripeException {
        return Subscription.retrieve(subscriptionId, requestOptions(null));
    }

    public com.stripe.model.SubscriptionSchedule createSubscriptionSchedule(String subscriptionId, String key) throws StripeException {
        return com.stripe.model.SubscriptionSchedule.create(java.util.Map.of("from_subscription", subscriptionId), requestOptions(key));
    }

    public com.stripe.model.SubscriptionSchedule retrieveSubscriptionSchedule(String id) throws StripeException {
        return com.stripe.model.SubscriptionSchedule.retrieve(id, requestOptions(null));
    }

    public com.stripe.model.SubscriptionSchedule updateSubscriptionSchedule(com.stripe.model.SubscriptionSchedule schedule,
            java.util.Map<String,Object> parameters, String key) throws StripeException {
        return schedule.update(parameters, requestOptions(key));
    }

    public Subscription cancelSubscription(Subscription subscription, SubscriptionCancelParams params)
            throws StripeException {
        return subscription.cancel(params, requestOptions(null));
    }

    public Account createAccount(AccountCreateParams params) throws StripeException {
        return Account.create(params, requestOptions(null));
    }

    public Account createAccount(AccountCreateParams params, String idempotencyKey) throws StripeException {
        return Account.create(params, requestOptions(idempotencyKey));
    }

    public String connectExistingAccount(String code) throws StripeException {
        var response = com.stripe.net.OAuth.token(java.util.Map.of(
                "grant_type", "authorization_code", "code", code), requestOptions(null));
        return response.getStripeUserId();
    }

    public boolean isConfigured() { return stripeSecretKey != null && !stripeSecretKey.isBlank(); }

    public AccountLink createAccountLink(AccountLinkCreateParams params) throws StripeException {
        return AccountLink.create(params, requestOptions(null));
    }

    public com.stripe.model.Account retrieveAccount(String accountId) throws StripeException {
        return com.stripe.model.Account.retrieve(accountId, requestOptions(null));
    }

    /** Account Session — onboarding Connect EMBARQUÉ (composants @stripe/connect-js). */
    public com.stripe.model.AccountSession createAccountSession(
            com.stripe.param.AccountSessionCreateParams params) throws StripeException {
        return com.stripe.model.AccountSession.create(params, requestOptions(null));
    }

    private RequestOptions requestOptions(String idempotencyKey) {
        RequestOptions.RequestOptionsBuilder builder = RequestOptions.builder()
            .setApiKey(stripeSecretKey);
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            builder.setIdempotencyKey(idempotencyKey);
        }
        return builder.build();
    }
}
