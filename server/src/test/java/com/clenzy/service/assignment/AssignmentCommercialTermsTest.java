package com.clenzy.service.assignment;

import com.clenzy.model.*;
import com.clenzy.marketplace.model.PricingModel;
import com.clenzy.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import java.math.BigDecimal;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class AssignmentCommercialTermsTest {
    final ProviderTariffRepository tariffs=mock(ProviderTariffRepository.class);
    final TeamRepository teams=mock(TeamRepository.class);
    final com.clenzy.service.pricing.CleaningPricingEngine cleaning=mock(com.clenzy.service.pricing.CleaningPricingEngine.class);
    final AssignmentCommercialTerms service=new AssignmentCommercialTerms(tariffs,teams,mock(JdbcTemplate.class),cleaning);
    ServiceRequest need() {
        var need=new ServiceRequest(); need.setServiceItemCode("cleaning-turnover"); need.setEstimatedDurationHours(2);
        need.setEstimatedCost(new BigDecimal("999")); return need;
    }
    ProviderTariff tariff(PricingModel model) {
        var tariff=new ProviderTariff(); tariff.setPricingModel(model); tariff.setAmount(new BigDecimal("35.00"));
        tariff.setCurrency("MAD");
        when(tariffs.findByUserIdAndServiceKey(9L,"cleaning-turnover")).thenReturn(Optional.of(tariff));
        return tariff;
    }
    @Test void hourlyPriceUsesTheCanonicalRateAndDurationNotTheGuide() {
        tariff(PricingModel.HOURLY);
        var terms=service.resolve(need(),"user",9L);
        assertThat(terms.amount()).isEqualByComparingTo("70");
        assertThat(terms.currency()).isEqualTo("MAD");
        verify(tariffs).lockUser(9L);
    }
    @Test void flatPriceIsNotMultipliedByDuration() {
        tariff(PricingModel.FLAT);
        assertThat(service.resolve(need(),"user",9L).amount()).isEqualByComparingTo("35");
    }
    @Test void estimateCanBeOfferedSeparatelyFromThePublishedProviderRate() {
        var need=need();need.setServiceType(ServiceType.CLEANING);need.setProperty(new Property());
        when(cleaning.resolveCleaningPrice(need.getProperty(),"CLEANING",null,null)).thenReturn(
            new com.clenzy.service.pricing.CleaningPricingEngine.ResolvedCleaningPrice(new BigDecimal("65"),
                com.clenzy.service.pricing.CleaningPricingEngine.CleaningPriceSource.ENGINE,null));
        var offered=service.offered(need,"user",9L);
        assertThat(offered.amount()).isEqualByComparingTo("65");
        assertThat(offered.currency()).isEqualTo("EUR");
        assertThat(offered.tariffId()).isNull();
        verifyNoInteractions(tariffs);
    }
    @Test void propertyPriceRetainsItsOwnCurrency() {
        var need=need();need.setServiceType(ServiceType.CLEANING);var property=new Property();property.setDefaultCurrency("MAD");need.setProperty(property);
        when(cleaning.resolveCleaningPrice(property,"CLEANING",null,null)).thenReturn(
            new com.clenzy.service.pricing.CleaningPricingEngine.ResolvedCleaningPrice(new BigDecimal("400"),
                com.clenzy.service.pricing.CleaningPricingEngine.CleaningPriceSource.PROPERTY_OVERRIDE,null));
        assertThat(service.offered(need,"user",9L).currency()).isEqualTo("MAD");
    }
    @Test void cardPreviewUsesCanonicalCalculationWithoutLockingTheUser() {
        tariff(PricingModel.HOURLY);
        assertThat(service.preview(need(),"user",9L).amount()).isEqualByComparingTo("70");
        verify(tariffs,never()).lockUser(anyLong());
    }
    @Test void surfacePriceUsesTheCanonicalPropertyArea() {
        tariff(PricingModel.PER_SQM);
        var need=need(); var property=new Property(); property.setSquareMeters(50); need.setProperty(property);
        assertThat(service.resolve(need,"user",9L).amount()).isEqualByComparingTo("1750");
    }
    @Test void zeroDurationCannotProduceAFreeHourlyAgreement() {
        tariff(PricingModel.HOURLY); var need=need(); need.setEstimatedDurationHours(0);
        assertThat(service.resolve(need,"user",9L)).isNull();
    }
    @Test void unqualifiedOrDisabledRatesRequireAQuote() {
        var tariff=tariff(PricingModel.FLAT); tariff.setNeedsReview(true);
        assertThat(service.resolve(need(),"user",9L)).isNull();
        tariff.setNeedsReview(false); tariff.setEnabled(false);
        assertThat(service.resolve(need(),"user",9L)).isNull();
    }
    @Test void collectiveTeamNeverInheritsAnArbitraryMembersRate() {
        var team=new Team(); team.setId(5L);
        when(teams.findById(5L)).thenReturn(Optional.of(team));
        assertThat(service.resolve(need(),"team",5L)).isNull();
        verifyNoInteractions(tariffs);
    }
    @Test void personalTeamUsesTheSamePriceAsItsOwner() {
        var team=new Team(); team.setId(5L); team.setPersonalUserId(9L);
        when(teams.findById(5L)).thenReturn(Optional.of(team)); tariff(PricingModel.FLAT);
        assertThat(service.resolve(need(),"team",5L)).isEqualTo(service.resolve(need(),"user",9L));
    }
}
