package com.clenzy.payment.payout.executor;

import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.PayoutMethod;
import com.clenzy.payment.payout.PayoutExecutor;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ManualPayoutExecutorTest {

    private final ManualPayoutExecutor executor = new ManualPayoutExecutor();

    @Test
    @DisplayName("getSupportedMethod returns MANUAL")
    void supportedMethod_isManual() {
        assertThat(executor.getSupportedMethod()).isEqualTo(PayoutMethod.MANUAL);
    }

    @Test
    @DisplayName("execute refuse explicitement avec un message clair")
    void execute_throwsWithExplicitMessage() {
        OwnerPayout payout = new OwnerPayout();
        OwnerPayoutConfig config = new OwnerPayoutConfig();

        assertThatThrownBy(() -> executor.execute(payout, config))
            .isInstanceOf(PayoutExecutor.PayoutExecutionException.class)
            .hasMessageContaining("MANUEL")
            .hasMessageContaining("SEPA");
    }
}
