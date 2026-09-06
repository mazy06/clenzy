package com.clenzy.service;

import com.clenzy.model.CalendarDay;
import com.clenzy.model.Property;
import com.clenzy.model.RateOverride;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RateOverrideRepository;
import com.clenzy.repository.RatePlanRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Grille de prix du planning.
 *
 * <p>Le {@link PriceEngine} est le VRAI, pas un mock : c'est la cascade de prix
 * qu'on veut voir a l'oeuvre, et c'est elle qui porte le nombre de requetes.
 * Seuls les repositories sont simules — ce sont eux qu'on compte.</p>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("PlanningPricingService")
class PlanningPricingServiceTest {

    @Mock private CalendarEngine calendarEngine;
    @Mock private RateOverrideRepository rateOverrideRepository;
    @Mock private RatePlanRepository ratePlanRepository;
    @Mock private PropertyRepository propertyRepository;

    private PlanningPricingService service;

    private static final LocalDate FROM = LocalDate.of(2026, 5, 1);
    private static final LocalDate TO = LocalDate.of(2026, 5, 4); // 3 jours, borne exclusive
    private static final Long ORG = 1L;

    private static Property property(long id, String nightlyPrice) {
        Property p = new Property();
        p.setId(id);
        p.setNightlyPrice(new BigDecimal(nightlyPrice));
        return p;
    }

    @BeforeEach
    void setUp() {
        // PriceEngine REEL : c'est la cascade qu'on veut voir, et c'est elle qui
        // porte le cout en requetes. CalendarEngine est mocke (12 dependances).
        PriceEngine priceEngine = new PriceEngine(rateOverrideRepository, ratePlanRepository, propertyRepository);
        service = new PlanningPricingService(calendarEngine, priceEngine);

        when(calendarEngine.getDays(anySet(), any(), any(), anyLong())).thenReturn(List.of());
        when(rateOverrideRepository.findByPropertyIdsAndDateRange(any(), any(), any(), anyLong()))
                .thenReturn(List.of());
        when(ratePlanRepository.findActiveByPropertyIds(any(), anyLong())).thenReturn(List.of());
        when(propertyRepository.findAllById(any())).thenReturn(List.of(property(1L, "100")));
    }

    // ── La propriete qui compte : le cout ne suit PAS le nombre de logements ──

    @Nested
    @DisplayName("cout en requetes")
    class CoutRequetes {

        @Test
        void quelQueSoitLeNombreDeLogements_leNombreDeRequetesEstConstant() {
            List<Long> cinquante = IntStream.rangeClosed(1, 50).mapToObj(Long::valueOf).toList();
            when(propertyRepository.findAllById(any()))
                    .thenReturn(cinquante.stream().map(id -> property(id, "100")).toList());

            service.pricingRows(cinquante, FROM, TO, ORG, true);

            // 4 requetes pour 50 logements. L'implementation d'origine bouclait
            // par logement : 4 x 50 = 200, et autant de transactions.
            verify(calendarEngine, times(1)).getDays(anySet(), any(), any(), anyLong());
            verify(rateOverrideRepository, times(1))
                    .findByPropertyIdsAndDateRange(any(), any(), any(), anyLong());
            verify(ratePlanRepository, times(1)).findActiveByPropertyIds(any(), anyLong());
            verify(propertyRepository, times(1)).findAllById(any());
        }

        @Test
        void unSeulLogementCoutAussi4Requetes() {
            service.pricingRows(List.of(1L), FROM, TO, ORG, false);

            verify(calendarEngine, times(1)).getDays(anySet(), any(), any(), anyLong());
            verify(ratePlanRepository, times(1)).findActiveByPropertyIds(any(), anyLong());
        }

        @Test
        void aucunLogement_aucuneRequete() {
            assertThat(service.pricingRows(List.of(), FROM, TO, ORG, true)).isEmpty();

            verify(calendarEngine, times(0)).getDays(anySet(), any(), any(), anyLong());
        }
    }

    // ── Cascade de prix (reprise de l'ancien CalendarControllerTest) ──────────

    @Nested
    @DisplayName("cascade de prix")
    class Cascade {

        @Test
        void sansRienDeParticulier_leRepliEstLePrixDuLogement() {
            List<Map<String, Object>> rows = service.pricingRows(List.of(1L), FROM, TO, ORG, false);

            assertThat(rows).hasSize(3);
            assertThat(rows.get(0)).containsEntry("priceSource", PriceEngine.SOURCE_PROPERTY_DEFAULT);
            assertThat(rows.get(0)).containsEntry("nightlyPrice", 100.0);
            assertThat(rows.get(0)).containsEntry("status", "AVAILABLE");
        }

        @Test
        void unOverrideSurUneDate_primeSurLeRepli() {
            Property p = property(1L, "100");
            RateOverride o = new RateOverride();
            o.setProperty(p);
            o.setDate(FROM);
            o.setNightlyPrice(new BigDecimal("150"));
            when(rateOverrideRepository.findByPropertyIdsAndDateRange(any(), any(), any(), anyLong()))
                    .thenReturn(List.of(o));

            List<Map<String, Object>> rows = service.pricingRows(List.of(1L), FROM, TO, ORG, false);

            assertThat(rows.get(0)).containsEntry("priceSource", PriceEngine.SOURCE_OVERRIDE);
            assertThat(rows.get(0)).containsEntry("nightlyPrice", 150.0);
            // Le lendemain retombe sur le repli : l'override est bien par DATE.
            assertThat(rows.get(1)).containsEntry("priceSource", PriceEngine.SOURCE_PROPERTY_DEFAULT);
            assertThat(rows.get(1)).containsEntry("nightlyPrice", 100.0);
        }

        @Test
        void lesLignesDUnLotPortentChacuneSonLogement() {
            when(propertyRepository.findAllById(any()))
                    .thenReturn(List.of(property(1L, "100"), property(2L, "200")));

            List<Map<String, Object>> rows = service.pricingRows(List.of(1L, 2L), FROM, TO, ORG, true);

            // 2 logements x 3 jours, groupes par logement dans l'ordre demande.
            assertThat(rows).hasSize(6);
            assertThat(rows.stream().map(r -> r.get("propertyId")).collect(Collectors.toList()))
                    .containsExactly(1L, 1L, 1L, 2L, 2L, 2L);
            assertThat(rows.get(3)).containsEntry("nightlyPrice", 200.0);
        }

        @Test
        void horsLot_leProprietyIdEstOmis() {
            List<Map<String, Object>> rows = service.pricingRows(List.of(1L), FROM, TO, ORG, false);

            assertThat(rows.get(0)).doesNotContainKey("propertyId");
        }
    }

    // ── Statut du jour ────────────────────────────────────────────────────────

    @Test
    void unJourCalendrierExistant_imposeSonStatut() {
        Property p = property(1L, "100");
        CalendarDay day = new CalendarDay();
        day.setProperty(p);
        day.setDate(FROM);
        day.setStatus(com.clenzy.model.CalendarDayStatus.BLOCKED);
        when(calendarEngine.getDays(anySet(), any(), any(), anyLong())).thenReturn(List.of(day));

        List<Map<String, Object>> rows = service.pricingRows(List.of(1L), FROM, TO, ORG, false);

        assertThat(rows.get(0)).containsEntry("status", "BLOCKED");
        // Les jours sans ligne calendrier restent disponibles (convention Baitly :
        // l'absence de ligne vaut AVAILABLE).
        assertThat(rows.get(1)).containsEntry("status", "AVAILABLE");
    }
}
