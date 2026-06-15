package com.clenzy.service;

import com.clenzy.dto.PublicUpsellDto;
import com.clenzy.model.*;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.UpsellOfferRepository;
import com.clenzy.repository.UpsellOrderRepository;
import com.clenzy.repository.WelcomeGuideTokenRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UpsellServiceTest {

    @Mock private UpsellOfferRepository offerRepository;
    @Mock private UpsellOrderRepository orderRepository;
    @Mock private WelcomeGuideTokenRepository tokenRepository;
    @Mock private com.clenzy.repository.WelcomeGuideRepository guideRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private StripeService stripeService;
    @Mock private WalletService walletService;
    @Mock private LedgerService ledgerService;
    @Mock private MonetizationConfigService monetizationConfigService;
    @Mock private ManagementContractService managementContractService;

    private UpsellService service() {
        return new UpsellService(offerRepository, orderRepository, tokenRepository, guideRepository, reservationRepository,
            stripeService, walletService, ledgerService, monetizationConfigService, managementContractService,
            java.time.Clock.systemUTC());
    }

    private WelcomeGuideToken validToken(Long propertyId) {
        Property property = new Property();
        property.setId(propertyId);
        Reservation reservation = new Reservation();
        reservation.setId(50L);
        reservation.setProperty(property);
        WelcomeGuide guide = new WelcomeGuide();
        guide.setId(9L);
        guide.setPublished(true);
        WelcomeGuideToken token = new WelcomeGuideToken();
        token.setOrganizationId(1L);
        token.setGuide(guide);
        token.setReservation(reservation);
        token.setValidFrom(LocalDateTime.now().minusDays(1));
        token.setExpiresAt(LocalDateTime.now().plusDays(1));
        token.setRevoked(false);
        return token;
    }

    /** Token de lien manuel : livret publié AVEC logement, AUCUNE réservation. */
    private WelcomeGuideToken validTokenNoReservation(Long guidePropertyId) {
        Property property = new Property();
        property.setId(guidePropertyId);
        WelcomeGuide guide = new WelcomeGuide();
        guide.setId(9L);
        guide.setPublished(true);
        guide.setProperty(property);
        WelcomeGuideToken token = new WelcomeGuideToken();
        token.setOrganizationId(1L);
        token.setGuide(guide);
        token.setValidFrom(LocalDateTime.now().minusDays(1));
        token.setExpiresAt(LocalDateTime.now().plusDays(1));
        token.setRevoked(false);
        return token;
    }

    private UpsellOffer offer(Long id, Long propertyId, String title) {
        UpsellOffer o = new UpsellOffer();
        o.setId(id);
        o.setOrganizationId(1L);
        o.setPropertyId(propertyId);
        o.setTitle(title);
        o.setPrice(new BigDecimal("100.00"));
        o.setCurrency("EUR");
        o.setActive(true);
        return o;
    }

    @Test
    void listForToken_returnsPropertySpecificAndOrgWideOnly() {
        UUID token = UUID.randomUUID();
        when(tokenRepository.findByToken(token)).thenReturn(Optional.of(validToken(7L)));
        when(offerRepository.findByOrganizationIdAndActiveTrueOrderBySortOrderAscIdAsc(1L))
            .thenReturn(List.of(
                offer(1L, 7L, "Spécifique propriété 7"),
                offer(2L, null, "Org-wide"),
                offer(3L, 99L, "Autre propriété")));

        List<PublicUpsellDto> result = service().listForToken(token);

        assertThat(result).hasSize(2);
        assertThat(result).extracting(PublicUpsellDto::title)
            .containsExactlyInAnyOrder("Spécifique propriété 7", "Org-wide");
    }

    @Test
    void listForToken_noReservation_usesGuidePropertyAndOrgWide() {
        // Lien manuel / livret par défaut (sans réservation) : on affiche quand même les services
        // (logement résolu depuis le livret), au lieu d'une liste vide.
        UUID token = UUID.randomUUID();
        when(tokenRepository.findByToken(token)).thenReturn(Optional.of(validTokenNoReservation(7L)));
        when(offerRepository.findByOrganizationIdAndActiveTrueOrderBySortOrderAscIdAsc(1L))
            .thenReturn(List.of(
                offer(1L, 7L, "Spécifique propriété 7"),
                offer(2L, null, "Org-wide"),
                offer(3L, 99L, "Autre propriété")));

        List<PublicUpsellDto> result = service().listForToken(token);

        assertThat(result).extracting(PublicUpsellDto::title)
            .containsExactlyInAnyOrder("Spécifique propriété 7", "Org-wide");
    }

    @Test
    void listForToken_unpublishedGuide_returnsEmpty() {
        UUID token = UUID.randomUUID();
        WelcomeGuideToken tok = validTokenNoReservation(7L);
        tok.getGuide().setPublished(false);
        when(tokenRepository.findByToken(token)).thenReturn(Optional.of(tok));

        assertThat(service().listForToken(token)).isEmpty();
        verify(offerRepository, never()).findByOrganizationIdAndActiveTrueOrderBySortOrderAscIdAsc(any());
    }

    @Test
    void listForToken_withSelection_showsOnlySelectedOffers() {
        // Sélection par livret : seul le service 2 est coché → on n'affiche que celui-là.
        UUID token = UUID.randomUUID();
        WelcomeGuideToken tok = validTokenNoReservation(7L);
        tok.getGuide().setUpsellOfferIds("[2]");
        when(tokenRepository.findByToken(token)).thenReturn(Optional.of(tok));
        when(offerRepository.findByOrganizationIdAndActiveTrueOrderBySortOrderAscIdAsc(1L))
            .thenReturn(List.of(offer(1L, null, "Org-wide 1"), offer(2L, null, "Org-wide 2")));

        List<PublicUpsellDto> result = service().listForToken(token);

        assertThat(result).extracting(PublicUpsellDto::title).containsExactly("Org-wide 2");
    }

    @Test
    void createCheckout_invalidToken_throws() {
        UUID token = UUID.randomUUID();
        when(tokenRepository.findByToken(token)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().createCheckout(token, 1L))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void markPaidBySession_computesFeeSplitAndCreditsHostShare() {
        UpsellOrder order = new UpsellOrder();
        order.setId(1L);
        order.setOrganizationId(1L);
        order.setReservationId(50L);
        order.setTitle("Early check-in");
        order.setAmount(new BigDecimal("100.00"));
        order.setCurrency("EUR");
        order.setStatus(UpsellOrderStatus.PENDING);
        when(orderRepository.findByStripeSessionId("sess_1")).thenReturn(Optional.of(order));
        when(monetizationConfigService.getEffectiveUpsellPlatformFeePct(1L)).thenReturn(new BigDecimal("10"));
        when(monetizationConfigService.getEffectiveUpsellOrgCommissionPct(1L)).thenReturn(BigDecimal.ZERO);

        User owner = new User();
        owner.setId(5L);
        Property property = new Property();
        property.setOwner(owner);
        Reservation reservation = new Reservation();
        reservation.setProperty(property);
        when(reservationRepository.findById(50L)).thenReturn(Optional.of(reservation));

        Wallet platformWallet = new Wallet();
        Wallet ownerWallet = new Wallet();
        when(walletService.getOrCreatePlatformWallet(1L, "EUR")).thenReturn(platformWallet);
        when(walletService.getOrCreateWallet(1L, WalletType.OWNER, 5L, "EUR")).thenReturn(ownerWallet);

        service().markPaidBySession("sess_1");

        assertThat(order.getStatus()).isEqualTo(UpsellOrderStatus.PAID);
        assertThat(order.getPlatformFeeAmount()).isEqualByComparingTo("10.00"); // 10% défaut
        assertThat(order.getHostAmount()).isEqualByComparingTo("90.00");

        ArgumentCaptor<BigDecimal> amount = ArgumentCaptor.forClass(BigDecimal.class);
        verify(ledgerService).recordTransfer(eq(platformWallet), eq(ownerWallet), amount.capture(),
            eq(LedgerReferenceType.UPSELL), anyString(), anyString());
        assertThat(amount.getValue()).isEqualByComparingTo("90.00");
    }

    @Test
    void markPaidBySession_alreadyPaid_isIdempotent() {
        UpsellOrder order = new UpsellOrder();
        order.setStatus(UpsellOrderStatus.PAID);
        when(orderRepository.findByStripeSessionId("sess_2")).thenReturn(Optional.of(order));

        service().markPaidBySession("sess_2");

        verify(ledgerService, never()).recordTransfer(any(), any(), any(), any(), anyString(), anyString());
    }
}
