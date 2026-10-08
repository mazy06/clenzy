package com.clenzy.payment.payout;

import com.clenzy.payment.StripeGateway;
import com.clenzy.service.payout.BaitlyTransferRecoveryStore.Instruction;
import com.stripe.StripeClient;
import com.stripe.net.RequestOptions;
import com.stripe.param.PaymentIntentCreateParams;
import com.stripe.param.RefundCreateParams;
import com.stripe.param.TransferCreateParams;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import static org.assertj.core.api.Assertions.assertThat;

/** Contrat réseau du service de récupération. Fixtures Stripe seules, aucune écriture dans le PMS. */
@EnabledIfEnvironmentVariable(named="BAITLY_RECOVERY_SANDBOX_WRITE",matches="true")
class BaitlyTransferRecoverySandboxIT {
    @Test void refundedCustomerAndRecoveredProviderHaveDistinctUniqueProofs() throws Exception {
        String key=required("BAITLY_STRIPE_SANDBOX_KEY");
        assertThat(key.matches("(?:sk|rk)_test_[A-Za-z0-9]+" )).as("Clé sandbox requise").isTrue();
        String run=required("BAITLY_RECOVERY_RUN");
        Instant started=Instant.ofEpochSecond(Long.parseLong(required("BAITLY_RECOVERY_STARTED")));
        assertThat(started.isAfter(Instant.now().minusSeconds(23*3600))).as("Ne pas réutiliser une clé expirée").isTrue();
        var client=new StripeClient(key);
        var gateway=new StripeGateway(key);
        try {
            assertThat(client.v1().accounts().retrieveCurrent().getId()).isEqualTo(required("BAITLY_STRIPE_SANDBOX_PLATFORM"));
            assertThat(gateway.retrievePlatformBalance().getLivemode()).isFalse();
            String beneficiary=required("BAITLY_RECOVERY_BENEFICIARY");
            var account=gateway.retrieveAccount(beneficiary);
            assertThat(account.getCapabilities().getTransfers()).isEqualTo("active");
            var payment=client.v1().paymentIntents().create(PaymentIntentCreateParams.builder()
                    .setAmount(3500L).setCurrency("eur").setPaymentMethod("pm_card_bypassPendingInternational")
                    .setConfirm(true).setAutomaticPaymentMethods(PaymentIntentCreateParams.AutomaticPaymentMethods.builder()
                        .setEnabled(true).setAllowRedirects(PaymentIntentCreateParams.AutomaticPaymentMethods.AllowRedirects.NEVER).build())
                    .setDescription("Baitly TEST SANDBOX : contrat de récupération, sans prestation réelle")
                    .putMetadata("baitly_sandbox_recipe",run).build(),options(run+":payment"));
            assertThat(payment.getLivemode()).isFalse(); assertThat(payment.getStatus()).isEqualTo("succeeded");
            var transfer=client.v1().transfers().create(TransferCreateParams.builder().setAmount(3000L).setCurrency("eur")
                    .setDestination(beneficiary).setSourceTransaction(payment.getLatestCharge())
                    .putMetadata("baitly_sandbox_recipe",run).build(),options(run+":transfer"));
            var refund=client.v1().refunds().create(RefundCreateParams.builder().setPaymentIntent(payment.getId())
                    .setAmount(3500L).putMetadata("baitly_sandbox_recipe",run).build(),options(run+":refund"));
            assertThat(gateway.retrieveRefund(refund.getId()).getStatus()).isEqualTo("succeeded");
            var order=new Instruction(Long.parseLong(required("BAITLY_RECOVERY_STARTED")),7L,2L,transfer.getId(),
                    beneficiary,transfer.getDestinationPayment(),false,new BigDecimal("30"),new BigDecimal("30"),
                    "EUR","SANDBOX-"+refund.getId(),started);
            var service=new BaitlyStripeTransferRecovery(gateway);
            String first=service.recover(order);
            assertThat(service.recover(order)).isEqualTo(first);
            var canonical=gateway.retrieveTransfer(transfer.getId());
            assertThat(canonical.getReversed()).isTrue(); assertThat(canonical.getAmountReversed()).isEqualTo(3000L);
            assertThat(gateway.listTransferReversals(transfer.getId())).hasSize(1);
            Files.writeString(Path.of(required("BAITLY_RECOVERY_REPORT")),
                    "Stripe sandbox : contrat validé\nEncaissement : "+payment.getId()+"\nTransfert : "+transfer.getId()
                    +"\nRemboursement : "+refund.getId()+"\nRécupération : "+first
                    +"\n35 EUR remboursés, 30 EUR récupérés, un seul effet après rejeu.\nAucune écriture PMS ; parcours UI non validé par ce test.\n");
        } catch(com.stripe.exception.StripeException failure) {
            throw new AssertionError("Stripe sandbox : HTTP "+failure.getStatusCode()+", code "+failure.getCode());
        }
    }
    private static RequestOptions options(String key) { return RequestOptions.builder().setIdempotencyKey(key).build(); }
    private static String required(String name) {
        String value=System.getenv(name); assertThat(value!=null&&!value.isBlank()).as("Variable requise : %s",name).isTrue(); return value;
    }
}
