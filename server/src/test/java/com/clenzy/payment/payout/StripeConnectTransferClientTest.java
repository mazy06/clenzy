package com.clenzy.payment.payout;

import com.clenzy.payment.StripeGateway;
import com.stripe.exception.StripeException;
import com.stripe.model.Transfer;
import com.stripe.param.TransferCreateParams;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class StripeConnectTransferClientTest {

    private StripeGateway stripeGateway;
    private StripeConnectTransferClient client;

    @BeforeEach
    void setUp() {
        stripeGateway = mock(StripeGateway.class);
        client = new StripeConnectTransferClient(stripeGateway);
    }

    @Test
    void createTransfer_convertsAmountLowercasesCurrencyAndReturnsId() throws StripeException {
        Transfer transfer = mock(Transfer.class);
        when(transfer.getId()).thenReturn("tr_1");
        ArgumentCaptor<TransferCreateParams> paramsCaptor = ArgumentCaptor.forClass(TransferCreateParams.class);
        when(stripeGateway.createTransfer(paramsCaptor.capture(), eq("key-1"))).thenReturn(transfer);

        String id = client.createTransfer(new BigDecimal("500.00"), "EUR", "acct_x", "desc", "key-1");

        assertThat(id).isEqualTo("tr_1");
        TransferCreateParams params = paramsCaptor.getValue();
        assertThat(params.getAmount()).isEqualTo(50000L); // HALF_UP, jamais de troncature
        assertThat(params.getCurrency()).isEqualTo("eur");
        assertThat(params.getDestination()).isEqualTo("acct_x");
        assertThat(params.getDescription()).isEqualTo("desc");
    }
}
