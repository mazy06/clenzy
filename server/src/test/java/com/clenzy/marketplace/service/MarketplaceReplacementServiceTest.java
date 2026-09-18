package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.*;
import com.clenzy.model.ServiceQuote;
import com.clenzy.repository.ServiceQuoteCancellationRepository;
import com.clenzy.service.ServiceQuoteAmendmentService;
import jakarta.persistence.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import java.time.*;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MarketplaceReplacementServiceTest {
    @Mock EntityManager em;
    @Mock ServiceQuoteAmendmentService access;
    @Mock ServiceQuoteCancellationRepository cancellations;
    @Mock MarketplaceQuoteService requests;
    @Mock ProviderAccountResolver accounts;
    @Mock TypedQuery<MarketplaceQuoteRequest> query;
    ServiceQuote quote = new ServiceQuote();
    MarketplaceQuoteRequest original = new MarketplaceQuoteRequest();
    Jwt jwt = Jwt.withTokenValue("test").header("alg", "none").subject("manager").build();
    MarketplaceReplacementService service;
    @BeforeEach void setup() {
        service = new MarketplaceReplacementService(em, access, cancellations, requests, accounts,
            Clock.fixed(Instant.parse("2026-09-16T00:00:00Z"), ZoneOffset.UTC));
        quote.setId(1L); quote.setOrganizationId(7L); quote.setMarketplaceRequestId(2L); quote.setPropertyId(3L);
        original.setTitle("Nettoyage terrasse"); original.setCategoryCode("EXTERIOR"); original.setServiceItemCode("TERRACE");
        original.setDesiredDate(LocalDate.of(2026, 10, 1)); original.setQuoteMessage("Négociation confidentielle ancien prestataire");
        lenient().when(access.access(1L, 7L, jwt)).thenReturn(new ServiceQuoteAmendmentService.Access(5L, false, true, false, false));
        lenient().when(em.find(ServiceQuote.class, 1L)).thenReturn(quote);
        lenient().when(em.find(MarketplaceQuoteRequest.class, 2L)).thenReturn(original);
        lenient().when(cancellations.existsById(1L)).thenReturn(true);
        lenient().when(em.createQuery(anyString(), eq(MarketplaceQuoteRequest.class))).thenReturn(query);
        lenient().when(query.setParameter("id", 1L)).thenReturn(query);
        lenient().when(query.getResultList()).thenReturn(List.of());
    }
    @Test void createsANewNegotiationUsingServerContextWithoutCopyingMoneyOrPrivateMessages() {
        when(accounts.userIdOf("manager")).thenReturn(5L);
        var next = new MarketplaceQuoteRequest(); next.setId(9L);
        when(requests.request(11L,7L,5L,"Nettoyage terrasse",null,3L,"EXTERIOR","TERRACE",LocalDate.of(2026,10,1))).thenReturn(next);
        assertThat(service.replace(1L,7L,jwt,11L,null)).isSameAs(next);
        assertThat(next.getReplacesQuoteId()).isEqualTo(1L);
        assertThat(next.getQuotedAmount()).isNull(); assertThat(next.getInterventionId()).isNull();
        var order = inOrder(em, requests);
        order.verify(em).refresh(quote,LockModeType.PESSIMISTIC_WRITE);
        order.verify(requests).request(11L,7L,5L,"Nettoyage terrasse",null,3L,"EXTERIOR","TERRACE",LocalDate.of(2026,10,1));
        order.verify(em).flush();
    }
    @Test void requiresCancellationAndManagerAccess() {
        when(cancellations.existsById(1L)).thenReturn(false);
        assertThatThrownBy(() -> service.replace(1L,7L,jwt,11L,null)).hasMessageContaining("Annulez");
        when(access.access(1L,7L,jwt)).thenReturn(new ServiceQuoteAmendmentService.Access(5L,true,false,false,false));
        assertThatThrownBy(() -> service.context(1L,7L,jwt)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(requests);
    }
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.EnumSource(value=QuoteRequestStatus.class,names={"SENT","QUOTED","ACCEPTED"})
    void blocksAnotherReplacementWhileAPreviousOneIsActive(QuoteRequestStatus state) {
        var next = new MarketplaceQuoteRequest(); next.setId(9L); next.setStatus(state);
        when(query.getResultList()).thenReturn(List.of(next));
        assertThat(service.context(1L,7L,jwt).activeRequestId()).isEqualTo(9L);
        assertThatThrownBy(() -> service.replace(1L,7L,jwt,12L,null)).hasMessageContaining("existe déjà");
        verifyNoInteractions(requests);
    }
    @Test void aRefusedOrExpiredNegotiationDoesNotBlockAnotherCandidate() {
        var next = new MarketplaceQuoteRequest(); next.setId(9L); next.setStatus(QuoteRequestStatus.QUOTED);
        next.setQuoteValidUntil(LocalDate.of(2026,9,15)); when(query.getResultList()).thenReturn(List.of(next));
        assertThat(service.context(1L,7L,jwt).activeRequestId()).isNull();
        next.setStatus(QuoteRequestStatus.TURNED_DOWN);
        assertThat(service.context(1L,7L,jwt).activeRequestId()).isNull();
    }
    @Test void pastMissionRequiresAnExplicitNewDate() {
        original.setDesiredDate(LocalDate.of(2026,1,1));
        assertThatThrownBy(() -> service.replace(1L,7L,jwt,11L,null)).hasMessageContaining("nouvelle date");
        verifyNoInteractions(requests);
    }

    @Test void originalMissionSlotWinsOverAnOutdatedRequestedDate() {
        quote.setInterventionId(4L);
        var mission = new com.clenzy.model.Intervention();
        mission.setStartTime(LocalDateTime.of(2026, 11, 3, 14, 30));
        mission.setEndTime(LocalDateTime.of(2026, 11, 3, 16, 0));
        when(em.find(com.clenzy.model.Intervention.class, 4L)).thenReturn(mission);
        var context = service.context(1L,7L,jwt);
        assertThat(context.desiredDate()).isEqualTo(LocalDate.of(2026,11,3));
        assertThat(context.startTime()).isEqualTo(LocalTime.of(14,30));
        assertThat(context.durationMinutes()).isEqualTo(90);
    }

    @Test void legacyMissionRequiresAnExplicitCatalogueService() {
        quote.setMarketplaceRequestId(null); quote.setInterventionId(4L);
        when(em.find(com.clenzy.model.Intervention.class, 4L)).thenReturn(new com.clenzy.model.Intervention());
        assertThat(service.context(1L,7L,jwt).requiresServiceSelection()).isTrue();
        assertThatThrownBy(() -> service.replace(1L,7L,jwt,11L,LocalDate.of(2026,10,1)))
            .hasMessageContaining("Sélectionnez la prestation");
        verifyNoInteractions(requests);
    }
}
