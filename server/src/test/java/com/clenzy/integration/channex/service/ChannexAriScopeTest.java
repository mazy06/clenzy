package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.model.ChannexAriScope;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.env.MockEnvironment;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Un changement ne pousse que le canal qui le concerne.
 *
 * <p>Baitly poussait systematiquement availability ET rates a chaque flush. La
 * certification Channex l'a refuse le 2026-08-14 sur sept scenarios :
 * « Expected exactly one update (Property.UpdateRestrictions), found:
 * ["Property.UpdateRestrictions", "Property.UpdateAvailability"] ». Ces tests
 * verrouillent le trajet de la portee, de l'action calendrier jusqu'au push.</p>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("Portee des pushes ARI")
class ChannexAriScopeTest {

    private static final ChannexSyncService.ChannexSyncResult OK =
        new ChannexSyncService.ChannexSyncResult(true, "ok", 0, 0);

    @Mock private ChannexSyncService syncService;

    private ChannexAriBatcher batcher() {
        return new ChannexAriBatcher(syncService,
            Clock.fixed(Instant.parse("2026-08-14T10:00:00Z"), ZoneOffset.UTC),
            new MockEnvironment());
    }

    // ─── Lecture de l'action ────────────────────────────────────────────────

    @Test
    @DisplayName("un changement de prix ne concerne que les tarifs")
    void priceAction_mapsToRates() {
        assertThat(ChannexAriScope.fromCalendarAction("PRICE_UPDATED"))
            .isEqualTo(ChannexAriScope.RATES);
        assertThat(ChannexAriScope.fromCalendarAction("CALENDAR_PRICE_UPDATED"))
            .isEqualTo(ChannexAriScope.RATES);
    }

    @Test
    @DisplayName("RATE_UPDATED aussi — c'est l'action de l'ecran Tarification, scenario n°2")
    void rateAction_mapsToRates() {
        // RateOverrideService et RatePlanService emettent RATE_UPDATED, pas
        // PRICE_UPDATED. Ne reconnaitre que « PRICE » laissait ce cas — le plus
        // frequent, et celui du test 2 de certification — pousser les deux canaux.
        assertThat(ChannexAriScope.fromCalendarAction("RATE_UPDATED"))
            .isEqualTo(ChannexAriScope.RATES);
        assertThat(ChannexAriScope.fromCalendarAction("RATE_DISTRIBUTION"))
            .isEqualTo(ChannexAriScope.RATES);
    }

    @Test
    @DisplayName("une restriction voyage avec les tarifs — c'est le meme appel Channex")
    void restrictionAction_mapsToRates() {
        assertThat(ChannexAriScope.fromCalendarAction("RESTRICTION_UPDATED"))
            .isEqualTo(ChannexAriScope.RATES);
        assertThat(ChannexAriScope.fromCalendarAction("RESTRICTION_DELETED"))
            .isEqualTo(ChannexAriScope.RATES);
    }

    @Test
    @DisplayName("reservation et annulation consomment l'inventaire -> disponibilite")
    void bookingActions_mapToAvailability() {
        for (String action : new String[] {"BOOKED", "CANCELLED"}) {
            assertThat(ChannexAriScope.fromCalendarAction(action))
                .as(action)
                .isEqualTo(ChannexAriScope.AVAILABILITY);
        }
    }

    @Test
    @DisplayName("un blocage ferme la vente sans consommer d'inventaire -> tarifs (stop_sell)")
    void blockingActions_mapToRates() {
        // stop_sell voyage dans le payload des restrictions, pas dans celui de
        // la disponibilite : un blocage manuel ne touche donc que les tarifs.
        for (String action : new String[] {"BLOCKED", "UNBLOCKED"}) {
            assertThat(ChannexAriScope.fromCalendarAction(action))
                .as(action)
                .isEqualTo(ChannexAriScope.RATES);
        }
    }

    @Test
    @DisplayName("action inconnue ou absente -> les deux canaux (jamais de mise a jour perdue)")
    void unknownAction_fallsBackToBoth() {
        assertThat(ChannexAriScope.fromCalendarAction(null)).isEqualTo(ChannexAriScope.BOTH);
        assertThat(ChannexAriScope.fromCalendarAction("QUELQUE_CHOSE_DE_NEUF"))
            .isEqualTo(ChannexAriScope.BOTH);
    }

    @Test
    @DisplayName("deux natures dans la meme fenetre -> les deux canaux, deux appels legitimes")
    void mergingDifferentScopes_yieldsBoth() {
        assertThat(ChannexAriScope.RATES.merge(ChannexAriScope.RATES))
            .isEqualTo(ChannexAriScope.RATES);
        assertThat(ChannexAriScope.RATES.merge(ChannexAriScope.AVAILABILITY))
            .isEqualTo(ChannexAriScope.BOTH);
        assertThat(ChannexAriScope.AVAILABILITY.merge(null))
            .isEqualTo(ChannexAriScope.AVAILABILITY);
    }

    // ─── Trajet jusqu'au push ───────────────────────────────────────────────

    @Test
    @DisplayName("plusieurs changements de prix -> la portee reste RATES, un seul push")
    void batcherKeepsSingleScope() {
        when(syncService.processCalendarRange(anyLong(), anyLong(), any(), any(), any(), any()))
            .thenReturn(OK);
        ChannexAriBatcher batcher = batcher();

        batcher.enqueue(3L, 42L, LocalDate.parse("2026-11-22"), LocalDate.parse("2026-11-22"),
            ChannexAriScope.RATES);
        batcher.enqueue(3L, 42L, LocalDate.parse("2026-11-23"), LocalDate.parse("2026-11-24"),
            ChannexAriScope.RATES);
        batcher.flush();

        ArgumentCaptor<ChannexAriScope> scope = ArgumentCaptor.forClass(ChannexAriScope.class);
        verify(syncService, times(1)).processCalendarRange(
            anyLong(), anyLong(), any(), any(), scope.capture(), any());
        assertThat(scope.getValue()).isEqualTo(ChannexAriScope.RATES);
    }

    @Test
    @DisplayName("un prix ET un blocage dans la meme fenetre -> BOTH")
    void batcherMergesMixedScopes() {
        when(syncService.processCalendarRange(anyLong(), anyLong(), any(), any(), any(), any()))
            .thenReturn(OK);
        ChannexAriBatcher batcher = batcher();

        batcher.enqueue(3L, 42L, LocalDate.parse("2026-11-22"), LocalDate.parse("2026-11-22"),
            ChannexAriScope.RATES);
        batcher.enqueue(3L, 42L, LocalDate.parse("2026-11-25"), LocalDate.parse("2026-11-26"),
            ChannexAriScope.AVAILABILITY);
        batcher.flush();

        ArgumentCaptor<ChannexAriScope> scope = ArgumentCaptor.forClass(ChannexAriScope.class);
        verify(syncService).processCalendarRange(anyLong(), anyLong(), any(), any(), scope.capture(), any());
        assertThat(scope.getValue()).isEqualTo(ChannexAriScope.BOTH);
    }

    @Test
    @DisplayName("enqueue sans portee -> BOTH (resynchronisation manuelle)")
    void enqueueWithoutScope_pushesBoth() {
        when(syncService.processCalendarRange(anyLong(), anyLong(), any(), any(), any(), any()))
            .thenReturn(OK);
        ChannexAriBatcher batcher = batcher();

        batcher.enqueue(3L, 42L, LocalDate.parse("2026-11-22"), LocalDate.parse("2026-11-24"));
        batcher.flush();

        ArgumentCaptor<ChannexAriScope> scope = ArgumentCaptor.forClass(ChannexAriScope.class);
        verify(syncService).processCalendarRange(anyLong(), anyLong(), any(), any(), scope.capture(), any());
        assertThat(scope.getValue()).isEqualTo(ChannexAriScope.BOTH);
    }
}
