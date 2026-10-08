package com.clenzy.booking.service;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import static org.assertj.core.api.Assertions.*;
class BaitlyBookingPaymentPlanTest {
    @Test void thirdsPreserveEveryCent() {
        var plan=BaitlyBookingPaymentPlan.of(new BigDecimal("100.01"),33);
        assertThat(plan.now()).isEqualByComparingTo("33.00");assertThat(plan.balance()).isEqualByComparingTo("67.01");
        assertThat(plan.metadata()).containsEntry("server_total","100.01").containsEntry("deposit_balance","67.01");
    }
    @Test void fullPaymentAndNoPolicyProduceNoResidual() {
        assertThat(BaitlyBookingPaymentPlan.of(BigDecimal.TEN,null).balance()).isZero();
        assertThat(BaitlyBookingPaymentPlan.of(BigDecimal.TEN,100).balance()).isZero();
    }
    @Test void invalidPolicyAndUnrepresentableMoneyFailBeforeCheckout() {
        assertThatThrownBy(()->BaitlyBookingPaymentPlan.of(BigDecimal.TEN,101)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->BaitlyBookingPaymentPlan.of(new BigDecimal("0.001"),30)).isInstanceOf(ArithmeticException.class);
        assertThatThrownBy(()->BaitlyBookingPaymentPlan.of(new BigDecimal("0.01"),1)).isInstanceOf(IllegalArgumentException.class);
    }
}
