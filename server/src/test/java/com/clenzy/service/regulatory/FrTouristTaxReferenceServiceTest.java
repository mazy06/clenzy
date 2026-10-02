package com.clenzy.service.regulatory;

import com.clenzy.integration.dgfip.DeltaTouristTaxClient;
import com.clenzy.integration.dgfip.DeltaTouristTaxClient.DeltaRow;
import com.clenzy.model.FrTouristTaxRate;
import com.clenzy.model.FrTouristTaxRate.Category;
import com.clenzy.model.TouristTaxConfig.TaxCalculationMode;
import com.clenzy.repository.FrTouristTaxRateRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.web.client.ResourceAccessException;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FrTouristTaxReferenceServiceTest {

    @Mock private DeltaTouristTaxClient client;
    @Mock private FrTouristTaxRateRepository repository;

    private FrTouristTaxReferenceService service;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(Instant.parse("2026-10-02T08:00:00Z"), ZoneId.of("Europe/Paris"));
        service = new FrTouristTaxReferenceService(client, repository, clock);
        when(repository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));
    }

    /** Extrait réel du jeu DGFiP pour Paris (2025) — délibération toujours en vigueur en 2026. */
    private static DeltaRow paris(String label, String rate, String unit) {
        return new DeltaRow("75", "056", "VILLE DE PARIS", "2025", null, label, "Réel",
                new BigDecimal(rate), unit, "10,00", null, null, null, null, null, "217500016");
    }

    private List<DeltaRow> parisRows() {
        return List.of(
                paris("Meublés de tourisme 3 étoiles", "1.7", "€"),
                paris("Palaces", "4.8", "€"),
                paris("Hébergements sans classement ou en attente de classement", "5.0", "%"),
                paris("Chambres d’hôtes", "0.8", "€"));
    }

    @Test
    void classifiedFurnishedRental_inParis_getsDeliberatedRatePlusLegalIdfSurcharges() {
        when(repository.findByInseeCodeOrderByEffectiveYearDesc("75056")).thenReturn(List.of());
        when(client.fetchCommune("75056")).thenReturn(parisRows());

        var s = service.suggest("75056", Category.MEUBLE_3, 2026).orElseThrow();

        assertThat(s.sourceYear()).isEqualTo(2025); // délibération 2025 toujours en vigueur
        assertThat(s.calculationMode()).isEqualTo(TaxCalculationMode.PER_PERSON_PER_NIGHT);
        assertThat(s.ratePerPerson()).isEqualByComparingTo("1.7");
        assertThat(s.departmentalSurchargePct()).isEqualByComparingTo("10");
        // 15 % (L2531-17) + 200 % IDF Mobilités (L2531-18) : 1,70 € → 5,53 € par personne et par nuit.
        assertThat(s.regionalSurchargePct()).isEqualByComparingTo("215");
    }

    @Test
    void unclassified_isPercentageCappedAtTheHighestDeliberatedRate() {
        when(repository.findByInseeCodeOrderByEffectiveYearDesc("75056")).thenReturn(List.of());
        when(client.fetchCommune("75056")).thenReturn(parisRows());

        var s = service.suggest("75056", Category.UNCLASSIFIED, 2026).orElseThrow();

        assertThat(s.calculationMode()).isEqualTo(TaxCalculationMode.PERCENTAGE_OF_RATE);
        assertThat(s.percentageRate()).isEqualByComparingTo("0.05");
        assertThat(s.capPerPersonNight()).isEqualByComparingTo("4.8");
    }

    @Test
    void outsideIdf_noLegalSurchargeIsInvented() {
        DeltaRow lyon = new DeltaRow("69", "123", "LYON", "2026", null, "Meublés de tourisme 2 étoiles", "Réel",
                new BigDecimal("1.1"), "€", "10,00", null, null, null, null, null, "1");
        when(repository.findByInseeCodeOrderByEffectiveYearDesc("69123")).thenReturn(List.of());
        when(client.fetchCommune("69123")).thenReturn(List.of(lyon));

        var s = service.suggest("69123", Category.MEUBLE_2, 2026).orElseThrow();

        assertThat(s.regionalSurchargePct()).isEqualByComparingTo("0");
    }

    @Test
    void freshLocalCopy_isServedWithoutCallingTheApi() {
        FrTouristTaxRate cached = FrTouristTaxReferenceService.toEntity("75056",
                paris("Meublés de tourisme 3 étoiles", "1.7", "€"), LocalDateTime.of(2026, 9, 20, 0, 0));
        when(repository.findByInseeCodeOrderByEffectiveYearDesc("75056")).thenReturn(List.of(cached));

        assertThat(service.suggest("75056", Category.MEUBLE_3, 2026)).isPresent();
        verify(client, never()).fetchCommune("75056");
    }

    @Test
    void unreachableApi_fallsBackOnTheStaleCopy() {
        FrTouristTaxRate stale = FrTouristTaxReferenceService.toEntity("75056",
                paris("Meublés de tourisme 3 étoiles", "1.7", "€"), LocalDateTime.of(2026, 1, 1, 0, 0));
        when(repository.findByInseeCodeOrderByEffectiveYearDesc("75056")).thenReturn(List.of(stale));
        when(client.fetchCommune("75056")).thenThrow(new ResourceAccessException("timeout"));

        assertThat(service.suggest("75056", Category.MEUBLE_3, 2026)).isPresent();
    }

    @Test
    void categoryMapping_followsDgfipLabels() {
        assertThat(FrTouristTaxReferenceService.categoryOf("Meublés de tourisme 1 étoile")).isEqualTo(Category.MEUBLE_1);
        assertThat(FrTouristTaxReferenceService.categoryOf("Meublés de tourisme 5 étoiles")).isEqualTo(Category.MEUBLE_5);
        assertThat(FrTouristTaxReferenceService.categoryOf("Chambres d’hôtes")).isEqualTo(Category.CHAMBRE_HOTES);
        assertThat(FrTouristTaxReferenceService.categoryOf("Hôtels de tourisme 3 étoiles")).isEqualTo(Category.OTHER);
    }
}
