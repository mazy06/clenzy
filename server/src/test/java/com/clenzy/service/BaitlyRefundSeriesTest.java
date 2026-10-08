package com.clenzy.service;

import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

class BaitlyRefundSeriesTest {
    @Test void everyCentIsConservedAndEachLineIsMonotoneAcrossSuccessiveRefunds() {
        var random=new Random(71432);
        for(int scenario=0;scenario<100;scenario++) {
            var weights=new ArrayList<BigDecimal>();
            for(int line=0;line<5;line++) weights.add(BigDecimal.valueOf(random.nextInt(50),2));
            var previous=BaitlyRefundSeries.apportion(weights,BigDecimal.ZERO);
            int total=weights.stream().reduce(BigDecimal.ZERO,BigDecimal::add).movePointRight(2).intValueExact();
            for(int cents=1;cents<=total;cents++) {
                var next=BaitlyRefundSeries.apportion(weights,BigDecimal.valueOf(cents,2));
                assertThat(next.stream().reduce(BigDecimal.ZERO,BigDecimal::add)).isEqualByComparingTo(BigDecimal.valueOf(cents,2));
                for(int line=0;line<5;line++) assertThat(next.get(line)).isBetween(previous.get(line),weights.get(line));
                previous=next;
            }
            assertThat(previous).usingRecursiveComparison().isEqualTo(weights);
        }
    }
    @Test void invalidOrSubCentBudgetsCannotBeAllocated() {
        assertThatThrownBy(()->BaitlyRefundSeries.apportion(List.of(new BigDecimal("1")),new BigDecimal("1.01"))).hasMessageContaining("budget");
        assertThatThrownBy(()->BaitlyRefundSeries.apportion(List.of(new BigDecimal("-1")),BigDecimal.ZERO)).hasMessageContaining("négative");
        assertThatThrownBy(()->BaitlyRefundSeries.apportion(List.of(BigDecimal.ONE),new BigDecimal("0.001"))).isInstanceOf(ArithmeticException.class);
    }
}
