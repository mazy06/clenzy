package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.EngagementMode;
import com.clenzy.marketplace.model.ExposureEffect;
import com.clenzy.marketplace.model.MarketplaceExposureRule;
import com.clenzy.marketplace.model.MarketplaceProvider;
import com.clenzy.marketplace.model.ProviderStatus;
import com.clenzy.marketplace.repository.MarketplaceExposureRuleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Qui voit quelle fiche.
 *
 * <p>Le defaut est OUVERT : ces tests portent donc surtout sur les exceptions,
 * et sur leur ordre de resolution — qui est ce qui rend un {@code DENY} global
 * assouplissable.</p>
 */
@ExtendWith(MockitoExtension.class)
class MarketplaceExposureServiceTest {

    @Mock private MarketplaceExposureRuleRepository ruleRepository;

    private MarketplaceExposureService service;

    private static final Instant NOW = Instant.parse("2026-09-13T10:00:00Z");
    private static final Long ORG = 7L;

    @BeforeEach
    void setUp() {
        service = new MarketplaceExposureService(ruleRepository, Clock.fixed(NOW, ZoneOffset.UTC), org.mockito.Mockito.mock(com.clenzy.marketplace.service.MarketplaceDecisionJournal.class), documentary());
    }

    @Test
    void anActiveProviderIsVisibleToEveryoneByDefault() {
        // Un catalogue ferme par defaut n'a aucun interet : c'est l'ouverture
        // qui est le comportement attendu d'une place de marche.
        when(ruleRepository.findByProviderIdAndOrganizationId(1L, ORG)).thenReturn(Optional.empty());
        when(ruleRepository.findByProviderIdAndOrganizationIdIsNull(1L)).thenReturn(Optional.empty());

        assertThat(service.isVisibleTo(active(), ORG)).isTrue();
    }

    @Test
    void aPendingProviderIsVisibleToNobody() {
        var pending = active();
        pending.setStatus(ProviderStatus.PENDING_REVIEW);

        assertThat(service.isVisibleTo(pending, ORG)).isFalse();
        verifyNoInteractions(ruleRepository);
    }

    @Test
    void anExclusiveProviderIsHiddenFromEveryoneButItsOwnOrganisation() {
        var exclusive = active();
        exclusive.setEngagementMode(EngagementMode.EXCLUSIVE);
        exclusive.setHomeOrganizationId(ORG);

        // Le cas du prestataire reserve est deja porte par le mode
        // d'engagement : il n'a pas besoin d'une regle.
        assertThat(service.isVisibleTo(exclusive, 99L)).isFalse();
        assertThat(service.isVisibleTo(exclusive, ORG)).isTrue();
    }

    @Test
    void aNamedDenyHidesTheProviderFromThatOrganisationOnly() {
        when(ruleRepository.findByProviderIdAndOrganizationId(1L, ORG))
            .thenReturn(Optional.of(rule(ORG, ExposureEffect.DENY)));

        assertThat(service.isVisibleTo(active(), ORG)).isFalse();
    }

    @Test
    void aGlobalDenyHidesTheProviderFromAll() {
        when(ruleRepository.findByProviderIdAndOrganizationId(1L, ORG)).thenReturn(Optional.empty());
        when(ruleRepository.findByProviderIdAndOrganizationIdIsNull(1L))
            .thenReturn(Optional.of(rule(null, ExposureEffect.DENY)));

        assertThat(service.isVisibleTo(active(), ORG)).isFalse();
    }

    @Test
    void aNamedAllowSurvivesAGlobalDeny() {
        // L'ordre de resolution est ce qui rend une fermeture globale
        // assouplissable. L'inverser obligerait a rouvrir a tout le monde pour
        // ouvrir a un seul partenaire.
        when(ruleRepository.findByProviderIdAndOrganizationId(1L, ORG))
            .thenReturn(Optional.of(rule(ORG, ExposureEffect.ALLOW)));

        assertThat(service.isVisibleTo(active(), ORG)).isTrue();
        // La regle globale n'est meme pas consultee : la nominative tranche.
        verify(ruleRepository, never()).findByProviderIdAndOrganizationIdIsNull(any());
    }

    @Test
    void aRuleWithoutAReasonIsRefused() {
        // Une regle sans motif est impossible a reprendre : personne n'ose la
        // retirer, personne ne sait la justifier.
        assertThatThrownBy(() -> service.setRule(1L, ORG, ExposureEffect.DENY, "  ", "kc-1"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("motif");

        verify(ruleRepository, never()).save(any());
    }

    @Test
    void settingATwiceReplacesRatherThanDuplicates() {
        var existing = rule(ORG, ExposureEffect.DENY);
        existing.setId(42L);
        when(ruleRepository.findByProviderIdAndOrganizationId(1L, ORG)).thenReturn(Optional.of(existing));
        when(ruleRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        var saved = service.setRule(1L, ORG, ExposureEffect.ALLOW, "Partenariat signé", "kc-1");

        // La base interdit deja le doublon par un index unique : mieux vaut
        // ecraser explicitement que faire echouer l'ecran sur une contrainte.
        assertThat(saved.getId()).isEqualTo(42L);
        assertThat(saved.getEffect()).isEqualTo(ExposureEffect.ALLOW);
        assertThat(saved.getReason()).isEqualTo("Partenariat signé");
    }

    @Test
    void aRuleBelongingToAnotherProviderCannotBeRemoved() {
        // `findById` ne passe par aucun filtre : sans ce controle, un
        // identifiant devine suffirait a rouvrir la fiche d'un autre.
        var foreign = rule(ORG, ExposureEffect.DENY);
        foreign.setId(99L);
        foreign.setProviderId(8L);
        when(ruleRepository.findById(99L)).thenReturn(Optional.of(foreign));

        assertThatThrownBy(() -> service.removeRule(1L, 99L))
            .isInstanceOf(IllegalArgumentException.class);

        verify(ruleRepository, never()).delete(any());
    }

    @Test
    void withoutAnOrganisationNothingIsVisible() {
        // Une requete sans tenant resolu ne doit pas ouvrir le catalogue.
        assertThat(service.isVisibleTo(active(), null)).isFalse();
        assertThat(service.hiddenProviderIdsFor(null)).isEmpty();
        verifyNoInteractions(ruleRepository);
    }

    private static MarketplaceProvider active() {
        var provider = new MarketplaceProvider();
        provider.setId(1L);
        provider.setDisplayName("Atelier Ourika");
        provider.setStatus(ProviderStatus.ACTIVE);
        provider.setEngagementMode(EngagementMode.INDEPENDENT);
        return provider;
    }

    private static MarketplaceExposureRule rule(Long organizationId, ExposureEffect effect) {
        var rule = new MarketplaceExposureRule();
        rule.setProviderId(1L);
        rule.setOrganizationId(organizationId);
        rule.setEffect(effect);
        rule.setReason("motif");
        return rule;
    }
    private static com.clenzy.marketplace.service.ProviderDocumentaryService documentary() {
        var service=org.mockito.Mockito.mock(com.clenzy.marketplace.service.ProviderDocumentaryService.class);
        org.mockito.Mockito.lenient().when(service.eligible(org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any())).thenReturn(true);
        return service;
    }
}
