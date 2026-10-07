package com.clenzy.service.tags;

import java.math.BigDecimal;
import java.util.Locale;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class BaitlyMoneyFormattingTest {
    @Test void moneyKeepsDecimalCommaAndCurrencyWhateverTheHostLocale() {
        Locale previous = Locale.getDefault();
        try {
            for (Locale locale : new Locale[]{Locale.FRANCE, Locale.US, Locale.GERMANY}) {
                Locale.setDefault(locale);
                assertThat(TagFormatting.formatMoney(new BigDecimal("1234.56"), "MAD")).isEqualTo("1 234,56 MAD");
                assertThat(TagFormatting.formatMoney(new BigDecimal("55.5"), "SAR")).isEqualTo("55,50 SAR");
                assertThat(TagFormatting.formatMoney(null, "SAR")).isEqualTo("0,00 SAR");
                assertThat(TagFormatting.formatMoney(new BigDecimal("120"), "EUR")).isEqualTo("120,00 €");
            }
        } finally { Locale.setDefault(previous); }
    }
}
