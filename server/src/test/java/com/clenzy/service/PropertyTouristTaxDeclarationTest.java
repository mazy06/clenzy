package com.clenzy.service;

import com.clenzy.dto.TouristTaxDeclarationDto;
import com.clenzy.model.Property;
import com.clenzy.model.TouristTaxConfig.TaxCalculationMode;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Taxe de séjour déclarée et confirmée à la création d'un logement (France, Maroc). */
class PropertyTouristTaxDeclarationTest {

    private static Property in(String country) {
        Property p = new Property();
        p.setCountryCode(country);
        return p;
    }

    private static TouristTaxDeclarationDto perNight(String amount, boolean confirmed) {
        return new TouristTaxDeclarationDto(false, TaxCalculationMode.PER_PERSON_PER_NIGHT,
                amount == null ? null : new BigDecimal(amount), null, null, null, null, null, confirmed);
    }

    @Test
    void frenchOrMoroccanProperty_withoutDeclaration_isRefused() {
        assertThatThrownBy(() -> PropertyService.requireTouristTaxDeclaration(in("FR"), null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PropertyService.requireTouristTaxDeclaration(in("MA"), null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void unconfirmedAmount_isRefused() {
        assertThatThrownBy(() -> PropertyService.requireTouristTaxDeclaration(in("MA"), perNight("25", false)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void zeroAmount_isRefused_butExplicitNoTaxIsAccepted() {
        assertThatThrownBy(() -> PropertyService.requireTouristTaxDeclaration(in("FR"), perNight("0", true)))
                .isInstanceOf(IllegalArgumentException.class);
        TouristTaxDeclarationDto none = new TouristTaxDeclarationDto(true, null, null, null, null, null, null, null, true);
        assertThatCode(() -> PropertyService.requireTouristTaxDeclaration(in("FR"), none)).doesNotThrowAnyException();
    }

    @Test
    void percentageMode_requiresItsCap() {
        TouristTaxDeclarationDto noCap = new TouristTaxDeclarationDto(false, TaxCalculationMode.PERCENTAGE_OF_RATE,
                null, new BigDecimal("0.05"), null, null, null, null, true);
        assertThatThrownBy(() -> PropertyService.requireTouristTaxDeclaration(in("FR"), noCap))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void confirmedAmount_isAccepted_andOtherCountriesAreNotConcerned() {
        assertThatCode(() -> PropertyService.requireTouristTaxDeclaration(in("MA"), perNight("25", true)))
                .doesNotThrowAnyException();
        assertThatCode(() -> PropertyService.requireTouristTaxDeclaration(in("AE"), null)).doesNotThrowAnyException();
    }

    @Test
    void saudiProperty_requiresItsOccupancyFee_withoutCap() {
        assertThatThrownBy(() -> PropertyService.requireTouristTaxDeclaration(in("SA"), null))
                .isInstanceOf(IllegalArgumentException.class);
        TouristTaxDeclarationDto fee = new TouristTaxDeclarationDto(false, TaxCalculationMode.PERCENTAGE_OF_RATE,
                null, new BigDecimal("0.025"), null, null, null, null, true);
        assertThatCode(() -> PropertyService.requireTouristTaxDeclaration(in("SA"), fee)).doesNotThrowAnyException();
    }
}
