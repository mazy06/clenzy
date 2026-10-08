package com.clenzy.service.voucher;

import com.clenzy.model.BookingVoucher;
import com.clenzy.model.voucher.VoucherDiscountType;
import com.clenzy.booking.dto.AvailabilityResponseDto;
import com.clenzy.service.BaitlyRefundSeries;
import java.math.*;
import java.util.*;

/** Promotions sur l'hébergement seulement : ni ménage, ni taxes, ni options ne sont offerts implicitement. */
public final class BaitlyStayDiscount {
    private BaitlyStayDiscount() {}
    public static VoucherApplyResult apply(BookingVoucher voucher,AvailabilityResponseDto quote) {
        if(voucher==null || quote==null || !quote.available() || quote.subtotal()==null || quote.subtotal().signum()<0)
            throw new IllegalArgumentException("Devis de séjour requis");
        boolean monetary=voucher.getDiscountType()==VoucherDiscountType.FIXED_AMOUNT
                || voucher.getMinTotalAmount()!=null && voucher.getMinTotalAmount().signum()>0;
        if(monetary && (voucher.getCurrency()==null || !voucher.getCurrency().equals(quote.currency())))
            throw new IllegalArgumentException("La devise de ce code ne correspond pas au séjour");
        var value=voucher.getDiscountValue();
        if(value==null || value.signum()<=0)throw new IllegalArgumentException("Valeur de promotion invalide");
        BigDecimal discount=switch(voucher.getDiscountType()) {
            case PERCENTAGE -> {
                if(value.compareTo(BigDecimal.valueOf(100))>0)throw new IllegalArgumentException("Pourcentage de remise invalide");
                yield quote.subtotal().multiply(value).divide(BigDecimal.valueOf(100),2,RoundingMode.HALF_UP);
            }
            case FIXED_AMOUNT -> value.min(quote.subtotal());
            case FREE_NIGHTS -> {
                int free;
                try{free=value.intValueExact();}catch(ArithmeticException error){throw new IllegalArgumentException("Le nombre de nuits offertes doit être entier");}
                if(quote.breakdown()==null || quote.breakdown().size()!=quote.nights() || free>quote.nights())
                    throw new IllegalArgumentException("Le séjour ne contient pas les nuits offertes");
                var weights=quote.breakdown().stream().map(n->n.price().setScale(2,RoundingMode.UNNECESSARY)).toList();
                // Répartit la remise directe déjà comprise dans le devis, puis offre les nuits les moins chères.
                var nights=BaitlyRefundSeries.apportion(weights,quote.subtotal());
                yield nights.stream().sorted().limit(free).reduce(BigDecimal.ZERO,BigDecimal::add);
            }
        };
        discount=discount.min(quote.subtotal()).setScale(2,RoundingMode.HALF_UP);
        return new VoucherApplyResult(voucher.getId(),voucher.getCode(),quote.total(),discount,quote.total().subtract(discount));
    }
}
