package com.clenzy.service.voucher;
import com.clenzy.model.BookingVoucher;
import com.clenzy.model.voucher.VoucherDiscountType;
import com.clenzy.booking.dto.AvailabilityResponseDto;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import static org.assertj.core.api.Assertions.*;

class BaitlyStayDiscountTest {
    AvailabilityResponseDto quote() {
        var start=LocalDate.of(2026,11,1);
        return new AvailabilityResponseDto(true,1L,"Test",start,start.plusDays(3),2,3,
                List.of(new AvailabilityResponseDto.NightBreakdown(start,new BigDecimal("80"),"standard"),
                        new AvailabilityResponseDto.NightBreakdown(start.plusDays(1),new BigDecimal("100"),"standard"),
                        new AvailabilityResponseDto.NightBreakdown(start.plusDays(2),new BigDecimal("120"),"standard")),
                new BigDecimal("270"),new BigDecimal("30"),new BigDecimal("12"),new BigDecimal("312"),new BigDecimal("30"),"EUR",1,4,null,null,List.of());
    }
    BookingVoucher voucher(VoucherDiscountType type,String value) {
        var v=new BookingVoucher();v.setId(1L);v.setCode("SAVE");v.setDiscountType(type);v.setDiscountValue(new BigDecimal(value));v.setCurrency("EUR");return v;
    }
    @Test void percentageLeavesCleaningAndTouristTaxPayable() {
        var applied=BaitlyStayDiscount.apply(voucher(VoucherDiscountType.PERCENTAGE,"100"),quote());
        assertThat(applied.discountApplied()).isEqualByComparingTo("270");assertThat(applied.finalTotal()).isEqualByComparingTo("42");
    }
    @Test void freeNightUsesCheapestActualNightAfterDirectDiscount() {
        var applied=BaitlyStayDiscount.apply(voucher(VoucherDiscountType.FREE_NIGHTS,"1"),quote());
        assertThat(applied.discountApplied()).isEqualByComparingTo("72");assertThat(applied.finalTotal()).isEqualByComparingTo("240");
    }
    @Test void allFreeNightsPreserveFeesExactly() {assertThat(BaitlyStayDiscount.apply(voucher(VoucherDiscountType.FREE_NIGHTS,"3"),quote()).finalTotal()).isEqualByComparingTo("42");}
    @Test void fixedAmountCannotExceedAccommodation() {assertThat(BaitlyStayDiscount.apply(voucher(VoucherDiscountType.FIXED_AMOUNT,"500"),quote()).discountApplied()).isEqualByComparingTo("270");}
    @Test void wrongOrUnknownCurrencyNeverConvertsImplicitly() {
        var v=voucher(VoucherDiscountType.FIXED_AMOUNT,"10");v.setCurrency("MAD");
        assertThatThrownBy(()->BaitlyStayDiscount.apply(v,quote())).hasMessageContaining("devise");v.setCurrency(null);
        assertThatThrownBy(()->BaitlyStayDiscount.apply(v,quote())).hasMessageContaining("devise");
    }
    @Test void monetaryMinimumAlsoRequiresCurrency() {
        var v=voucher(VoucherDiscountType.PERCENTAGE,"10");v.setMinTotalAmount(BigDecimal.ONE);v.setCurrency("SAR");
        assertThatThrownBy(()->BaitlyStayDiscount.apply(v,quote())).hasMessageContaining("devise");
    }
    @Test void impossibleAndFractionalFreeNightsAreRejected() {
        for(var n:List.of("1.5","4"))assertThatThrownBy(()->BaitlyStayDiscount.apply(voucher(VoucherDiscountType.FREE_NIGHTS,n),quote())).isInstanceOf(IllegalArgumentException.class);
    }
}
