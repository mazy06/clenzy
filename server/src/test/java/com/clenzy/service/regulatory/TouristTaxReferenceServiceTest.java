package com.clenzy.service.regulatory;

import com.clenzy.model.MaTouristTaxRate;
import com.clenzy.model.MaTouristTaxRate.Category;
import com.clenzy.repository.MaTouristTaxRateRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.Clock;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TouristTaxReferenceServiceTest {

    @Mock private FrCommuneResolver communeResolver;
    @Mock private FrTouristTaxReferenceService frReference;
    @Mock private MaTouristTaxRateRepository maRepository;

    private TouristTaxReferenceService service;

    @BeforeEach
    void setUp() {
        service = new TouristTaxReferenceService(communeResolver, frReference, maRepository, Clock.systemUTC());
        when(maRepository.findByCityKeyAndCategory(any(), any())).thenReturn(Optional.empty());
        when(maRepository.findByCityKeyAndCategory(MaTouristTaxRate.NATIONAL, Category.RIAD_MAISON))
                .thenReturn(Optional.of(rate("*", "Maroc (fourchette légale)", Category.RIAD_MAISON, "10", "25", null)));
        when(maRepository.findByCityKeyAndCategory(MaTouristTaxRate.NATIONAL, Category.MAISON_HOTES))
                .thenReturn(Optional.of(rate("*", "Maroc (fourchette légale)", Category.MAISON_HOTES, "15", "30", null)));
        when(maRepository.findByCityKeyAndCategory("casablanca", Category.MAISON_HOTES))
                .thenReturn(Optional.of(rate("casablanca", "Casablanca", Category.MAISON_HOTES, null, null, "30")));
    }

    private static MaTouristTaxRate rate(String key, String label, Category c, String min, String max, String exact) {
        MaTouristTaxRate r = new MaTouristTaxRate();
        r.setCityKey(key);
        r.setCityLabel(label);
        r.setCategory(c);
        r.setMinRate(min == null ? null : new BigDecimal(min));
        r.setMaxRate(max == null ? null : new BigDecimal(max));
        r.setRate(exact == null ? null : new BigDecimal(exact));
        r.setSourceLabel("source");
        return r;
    }

    @Test
    void unknownCity_suggestsTheTopOfTheLegalRange_marked_notExact() {
        var s = service.suggest("MA", null, null, "Essaouira", "RIAD_MAISON").orElseThrow();

        assertThat(s.ratePerPerson()).isEqualByComparingTo("25"); // prudence : haut de fourchette
        assertThat(s.minRate()).isEqualByComparingTo("10");
        assertThat(s.exact()).isFalse();
        assertThat(s.childrenExemptUnder()).isEqualTo(12);
        assertThat(s.platformsCollect()).isFalse();
        assertThat(s.currency()).isEqualTo("MAD");
    }

    @Test
    void knownCity_suggestsItsPublishedRate_evenWithAccentsOrCase() {
        var s = service.suggest("ma", null, null, "  CASABLANCA ", "MAISON_HOTES").orElseThrow();

        assertThat(s.ratePerPerson()).isEqualByComparingTo("30");
        assertThat(s.exact()).isTrue();
        assertThat(s.communeName()).isEqualTo("Casablanca");
    }

    @Test
    void cityKey_isNormalised() {
        assertThat(TouristTaxReferenceService.cityKey("Fès")).isEqualTo("fes");
        assertThat(TouristTaxReferenceService.cityKey("Ait Ben Haddou")).isEqualTo("ait-ben-haddou");
    }

    @Test
    void otherCountries_haveNoSuggestion() {
        assertThat(service.suggest("AE", null, null, "Dubai", "HOTEL_5")).isEmpty();
    }

    @Test
    void saudiArabia_nationalOccupancyFee_byClassification() {
        var luxury = service.suggest("SA", null, null, "Riyadh", "FOUR_STARS_PLUS").orElseThrow();
        var standard = service.suggest("SA", null, null, "Jeddah", "STANDARD").orElseThrow();
        var privateHome = service.suggest("SA", null, null, "Abha", "PRIVATE").orElseThrow();

        assertThat(luxury.percentageRate()).isEqualByComparingTo("0.05");
        assertThat(standard.percentageRate()).isEqualByComparingTo("0.025");
        assertThat(privateHome.percentageRate()).isEqualByComparingTo("0.025");
        assertThat(privateHome.verified()).isFalse(); // lecture du texte, à confirmer
        assertThat(standard.capPerPersonNight()).isNull();
        assertThat(standard.childrenExemptUnder()).isZero();
        assertThat(standard.currency()).isEqualTo("SAR");
    }
}
