package com.clenzy.payment.payout;

import com.clenzy.payment.StripeGateway;
import com.clenzy.service.payout.BaitlyTransferRecoveryStore.Instruction;
import com.clenzy.service.payout.BaitlyTransferRecoveryStore.PreviousRecovery;
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
import java.util.ArrayList;
import static org.assertj.core.api.Assertions.assertThat;

/** Contrat réseau explicite, fonds fictifs seulement ; aucune écriture métier PMS. */
@EnabledIfEnvironmentVariable(named="BAITLY_PARTIAL_RECOVERY_SANDBOX_WRITE",matches="true")
class BaitlyPartialTransferRecoverySandboxIT {
    @Test void successiveRefundsHaveDistinctRecoveriesAndReplaysNeverRecoverTwice() throws Exception {
        String key=required("BAITLY_STRIPE_SANDBOX_KEY");
        assertThat(key.matches("(?:sk|rk)_test_[A-Za-z0-9]+" )).isTrue();
        String run=required("BAITLY_RECOVERY_RUN");
        long epoch=Long.parseLong(required("BAITLY_RECOVERY_STARTED"));
        Instant started=Instant.ofEpochSecond(epoch);
        assertThat(started.isAfter(Instant.now().minusSeconds(23*3600))).isTrue();
        var client=new StripeClient(key);
        var gateway=new StripeGateway(key);
        try {
            assertThat(client.v1().accounts().retrieveCurrent().getId()).isEqualTo(required("BAITLY_STRIPE_SANDBOX_PLATFORM"));
            assertThat(gateway.retrievePlatformBalance().getLivemode()).isFalse();
            String beneficiary=required("BAITLY_RECOVERY_BENEFICIARY");
            assertThat(gateway.retrieveAccount(beneficiary).getCapabilities().getTransfers()).isEqualTo("active");
            var payment=client.v1().paymentIntents().create(PaymentIntentCreateParams.builder()
                    .setAmount(3600L).setCurrency("eur").setPaymentMethod("pm_card_bypassPendingInternational").setConfirm(true)
                    .setAutomaticPaymentMethods(PaymentIntentCreateParams.AutomaticPaymentMethods.builder().setEnabled(true)
                            .setAllowRedirects(PaymentIntentCreateParams.AutomaticPaymentMethods.AllowRedirects.NEVER).build())
                    .setDescription("Baitly TEST SANDBOX : récupérations partielles, aucune prestation réelle")
                    .putMetadata("baitly_sandbox_recipe",run).build(),options(run+":payment"));
            assertThat(payment.getLivemode()).isFalse(); assertThat(payment.getStatus()).isEqualTo("succeeded");
            var transfer=client.v1().transfers().create(TransferCreateParams.builder().setAmount(3600L).setCurrency("eur")
                    .setDestination(beneficiary).setSourceTransaction(payment.getLatestCharge())
                    .putMetadata("baitly_sandbox_recipe",run).build(),options(run+":transfer"));
            var prior=new ArrayList<PreviousRecovery>();
            var report=new StringBuilder("Baitly sandbox : contrat de récupération partielle\nEncaissement : ")
                    .append(payment.getId()).append("\nTransfert : ").append(transfer.getId()).append("\n");
            var service=new BaitlyStripeTransferRecovery(gateway);
            long cumulative=0;
            for (long cents : new long[]{501,1000,2099}) {
                int step=prior.size()+1;
                var refund=client.v1().refunds().create(RefundCreateParams.builder().setPaymentIntent(payment.getId())
                        .setAmount(cents).putMetadata("baitly_sandbox_recipe",run).build(),options(run+":refund:"+step));
                assertThat(gateway.retrieveRefund(refund.getId()).getStatus()).isEqualTo("succeeded");
                var amount=BigDecimal.valueOf(cents,2);
                var order=new Instruction(epoch*10+step,7L,2L,transfer.getId(),beneficiary,transfer.getDestinationPayment(),false,
                        new BigDecimal("36.00"),amount,"EUR","SANDBOX-"+refund.getId(),started,prior);
                String reversal=service.recover(order);
                assertThat(service.recover(order)).isEqualTo(reversal);
                cumulative+=cents;
                var canonical=gateway.retrieveTransfer(transfer.getId());
                assertThat(canonical.getAmountReversed()).isEqualTo(cumulative);
                assertThat(canonical.getReversed()).isEqualTo(cumulative==3600);
                assertThat(gateway.listTransferReversals(transfer.getId())).hasSize(step);
                prior.add(new PreviousRecovery(reversal,amount,order.metadata()));
                report.append(amount).append(" EUR remboursés et récupérés : ").append(refund.getId())
                        .append(" / ").append(reversal).append("\n");
                Files.writeString(Path.of(required("BAITLY_RECOVERY_REPORT")),report+"Recette en cours ; aucune écriture PMS.\n");
            }
            Files.writeString(Path.of(required("BAITLY_RECOVERY_REPORT")),report
                    +"36 EUR remboursés, 36 EUR récupérés, trois preuves uniques après six appels.\n"
                    +"Aucune écriture PMS ; ce contrat réseau ne valide pas le parcours UI ni la réception bancaire.\n");
        } catch(com.stripe.exception.StripeException failure) {
            throw new AssertionError("Stripe sandbox : HTTP "+failure.getStatusCode()+", code "+failure.getCode());
        }
    }
    private static RequestOptions options(String key) { return RequestOptions.builder().setIdempotencyKey(key).build(); }
    private static String required(String name) {
        String value=System.getenv(name); assertThat(value!=null&&!value.isBlank()).as("Variable requise : %s",name).isTrue(); return value;
    }
}
