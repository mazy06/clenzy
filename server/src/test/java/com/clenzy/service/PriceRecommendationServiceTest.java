package com.clenzy.service;

import com.clenzy.dto.PriceRecommendationDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.PriceRecommendation;
import com.clenzy.model.PriceRecommendationSource;
import com.clenzy.model.PriceRecommendationStatus;
import com.clenzy.repository.PriceRecommendationRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Cycle de vie des recommandations de prix (CLZ-P0-17) : transitions CAS + ownership.
 */
class PriceRecommendationServiceTest {

    private final PriceRecommendationRepository repository = mock(PriceRecommendationRepository.class);
    private final OrganizationAccessGuard accessGuard = mock(OrganizationAccessGuard.class);

    private final PriceRecommendationService service =
        new PriceRecommendationService(repository, accessGuard);

    private PriceRecommendation reco(Long id, Long orgId) {
        PriceRecommendation r = new PriceRecommendation();
        r.setId(id);
        r.setOrganizationId(orgId);
        r.setPropertyId(7L);
        r.setRecoDate(LocalDate.of(2026, 7, 1));
        r.setSuggestedPrice(new BigDecimal("130.00"));
        r.setBasePrice(new BigDecimal("100.00"));
        r.setStatus(PriceRecommendationStatus.PROPOSED);
        r.setSource(PriceRecommendationSource.LLM);
        return r;
    }

    @Test
    void acceptTransitionsProposedToAcceptedViaCas() {
        when(repository.findById(5L)).thenReturn(Optional.of(reco(5L, 1L)));
        when(repository.transitionStatus(5L, 1L,
            PriceRecommendationStatus.PROPOSED, PriceRecommendationStatus.ACCEPTED)).thenReturn(1);

        service.accept(1L, 5L);

        verify(repository).transitionStatus(5L, 1L,
            PriceRecommendationStatus.PROPOSED, PriceRecommendationStatus.ACCEPTED);
    }

    @Test
    void acceptThrowsWhenCasLosesRace() {
        when(repository.findById(5L)).thenReturn(Optional.of(reco(5L, 1L)));
        when(repository.transitionStatus(eq(5L), eq(1L),
            eq(PriceRecommendationStatus.PROPOSED), any())).thenReturn(0); // déjà traitée

        assertThatThrownBy(() -> service.accept(1L, 5L))
            .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void rejectTransitionsProposedToRejected() {
        when(repository.findById(8L)).thenReturn(Optional.of(reco(8L, 1L)));
        when(repository.transitionStatus(8L, 1L,
            PriceRecommendationStatus.PROPOSED, PriceRecommendationStatus.REJECTED)).thenReturn(1);

        service.reject(1L, 8L);

        verify(repository).transitionStatus(8L, 1L,
            PriceRecommendationStatus.PROPOSED, PriceRecommendationStatus.REJECTED);
    }

    @Test
    void acceptDeniedForOtherOrg() {
        when(repository.findById(9L)).thenReturn(Optional.of(reco(9L, 2L)));
        doThrow(new AccessDeniedException("denied"))
            .when(accessGuard).requireSameOrganization(eq(2L), any(String.class));

        assertThatThrownBy(() -> service.accept(1L, 9L))
            .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void acceptThrowsNotFoundWhenMissing() {
        when(repository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.accept(1L, 404L))
            .isInstanceOf(NotFoundException.class);
    }

    @Test
    void listMapsToDtoWithDelta() {
        when(repository.findByOrganizationIdAndPropertyIdAndRecoDateBetween(
            1L, 7L, LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 31)))
            .thenReturn(List.of(reco(5L, 1L)));

        List<PriceRecommendationDto> dtos = service.list(
            1L, 7L, LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 31));

        assertThat(dtos).hasSize(1);
        assertThat(dtos.get(0).delta()).isEqualByComparingTo("30.00");
        assertThat(dtos.get(0).status()).isEqualTo(PriceRecommendationStatus.PROPOSED);
    }
}
