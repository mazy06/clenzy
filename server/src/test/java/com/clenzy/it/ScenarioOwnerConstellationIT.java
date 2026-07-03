package com.clenzy.it;

import com.clenzy.AbstractIntegrationTest;
import com.clenzy.dto.OwnerConstellationPublicDto;
import com.clenzy.dto.OwnerPortalLinkDto;
import com.clenzy.model.Organization;
import com.clenzy.model.OrganizationType;
import com.clenzy.model.OwnerPortalToken;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.OwnerPortalTokenRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.OwnerConstellationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Scenario S6 — Constellation Proprietaire : lien token → vue publique brandee
 * (nom org + branding + activite par bien) → revocation → vue vide (404 cote
 * controller, sans oracle).
 *
 * <p>Anti-fuite : 2 organisations. La vue publique d'un token de l'org A ne
 * doit JAMAIS exposer les biens d'un proprietaire de l'org B, et le token de
 * l'org B ne montre que l'org B.</p>
 */
@EnabledIfEnvironmentVariable(named = "CLENZY_IT", matches = "true")
class ScenarioOwnerConstellationIT extends AbstractIntegrationTest {

    @Autowired private OwnerConstellationService ownerConstellationService;
    @Autowired private OwnerPortalTokenRepository tokenRepository;
    @Autowired private OrganizationRepository organizationRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PropertyRepository propertyRepository;

    private Long orgAId;
    private Long orgBId;
    private Long ownerAId;
    private Long ownerBId;
    private String propANamePrefix;
    private String propBNamePrefix;

    @BeforeEach
    void seedTwoOrgsWithOwners() {
        String salt = UUID.randomUUID().toString().substring(0, 8);
        propANamePrefix = "Riad Constellation A " + salt;
        propBNamePrefix = "Chalet Constellation B " + salt;

        Organization orgA = new Organization(
                "Conciergerie Aurore " + salt, OrganizationType.INDIVIDUAL, "aurore-" + salt);
        orgA.setBrandingLogoUrl("https://cdn.test/logo-a.png");
        orgA.setBrandingPrimaryColor("#6B8A9A");
        orgAId = organizationRepository.save(orgA).getId();

        Organization orgB = new Organization(
                "Conciergerie Borealis " + salt, OrganizationType.INDIVIDUAL, "borealis-" + salt);
        orgBId = organizationRepository.save(orgB).getId();

        User ownerA = new User("Odile", "Proprio", "odile." + salt + "@test.com", "password123");
        ownerA.setOrganizationId(orgAId);
        ownerA.setKeycloakId("kc-owner-a-" + salt);
        ownerAId = userRepository.save(ownerA).getId();

        User ownerB = new User("Boris", "Proprio", "boris." + salt + "@test.com", "password123");
        ownerB.setOrganizationId(orgBId);
        ownerB.setKeycloakId("kc-owner-b-" + salt);
        ownerBId = userRepository.save(ownerB).getId();

        Property propA = new Property(propANamePrefix, "1 rue des Etoiles", 3, 2, ownerA);
        propA.setOrganizationId(orgAId);
        propA.setNightlyPrice(new BigDecimal("140.00"));
        propertyRepository.save(propA);

        Property propB = new Property(propBNamePrefix, "9 route des Cimes", 2, 1, ownerB);
        propB.setOrganizationId(orgBId);
        propB.setNightlyPrice(new BigDecimal("110.00"));
        propertyRepository.save(propB);

        // Vue publique = pas de tenant HTTP (le TenantFilter ne pose pas d'org
        // sur les routes publiques) : contexte laisse vierge par le reset du socle.
    }

    @Test
    void createdToken_exposesBrandedPublicView_thenRevocationHidesIt() {
        OwnerPortalLinkDto link = ownerConstellationService.createLink(
                orgAId, ownerAId, 30, "https://app.test");
        assertThat(link.url()).contains("/owner-view/");
        assertThat(link.revoked()).isFalse();

        UUID token = extractToken(link.url());

        Optional<OwnerConstellationPublicDto> view = ownerConstellationService.getPublicView(token);
        assertThat(view).isPresent();
        OwnerConstellationPublicDto dto = view.orElseThrow();

        // Nom org + branding white-label + identite proprietaire.
        assertThat(dto.conciergerieName()).startsWith("Conciergerie Aurore");
        assertThat(dto.brandingLogoUrl()).isEqualTo("https://cdn.test/logo-a.png");
        assertThat(dto.brandingPrimaryColor()).isEqualTo("#6B8A9A");
        assertThat(dto.ownerDisplayName()).isEqualTo("Odile Proprio");

        // Activite agents : uniquement les biens du proprietaire DANS l'org A.
        assertThat(dto.agentActivity())
                .extracting(OwnerConstellationPublicDto.PropertyAgentActivityDto::propertyName)
                .containsExactly(propANamePrefix);

        // Revocation → vue vide (le controller repondra 404 uniformement).
        ownerConstellationService.revokeLink(orgAId, link.id());
        assertThat(ownerConstellationService.getPublicView(token)).isEmpty();

        // Le lien liste reste visible cote gestionnaire, marque revoked.
        assertThat(ownerConstellationService.listLinks(orgAId, ownerAId, "https://app.test"))
                .anyMatch(l -> l.id().equals(link.id()) && l.revoked());
    }

    @Test
    void publicView_neverLeaksPropertiesOfAnotherOrganization() {
        OwnerPortalLinkDto linkA = ownerConstellationService.createLink(
                orgAId, ownerAId, 30, "https://app.test");
        OwnerPortalLinkDto linkB = ownerConstellationService.createLink(
                orgBId, ownerBId, 30, "https://app.test");

        OwnerConstellationPublicDto viewA = ownerConstellationService
                .getPublicView(extractToken(linkA.url())).orElseThrow();
        OwnerConstellationPublicDto viewB = ownerConstellationService
                .getPublicView(extractToken(linkB.url())).orElseThrow();

        assertThat(viewA.agentActivity())
                .extracting(OwnerConstellationPublicDto.PropertyAgentActivityDto::propertyName)
                .contains(propANamePrefix)
                .doesNotContain(propBNamePrefix);
        assertThat(viewB.agentActivity())
                .extracting(OwnerConstellationPublicDto.PropertyAgentActivityDto::propertyName)
                .contains(propBNamePrefix)
                .doesNotContain(propANamePrefix);
        assertThat(viewB.conciergerieName()).startsWith("Conciergerie Borealis");
    }

    @Test
    void unknownOrExpiredToken_yieldsEmptyView() {
        // Token inconnu.
        assertThat(ownerConstellationService.getPublicView(UUID.randomUUID())).isEmpty();

        // Token expire : on force l'expiration en base (pas de sleep).
        OwnerPortalLinkDto link = ownerConstellationService.createLink(
                orgAId, ownerAId, 1, "https://app.test");
        OwnerPortalToken stored = tokenRepository.findById(link.id()).orElseThrow();
        stored.setExpiresAt(java.time.LocalDateTime.now().minusMinutes(1));
        tokenRepository.save(stored);

        assertThat(ownerConstellationService.getPublicView(stored.getToken())).isEmpty();
    }

    @Test
    void ownerOfAnotherOrg_cannotGetALink_andCrossOrgRevocationIsRefused() {
        // createLink refuse un proprietaire sans bien dans l'org appelante.
        org.junit.jupiter.api.Assertions.assertThrows(
                org.springframework.security.access.AccessDeniedException.class,
                () -> ownerConstellationService.createLink(orgAId, ownerBId, 30, "https://app.test"));

        // revokeLink refuse un lien d'une autre org.
        OwnerPortalLinkDto linkB = ownerConstellationService.createLink(
                orgBId, ownerBId, 30, "https://app.test");
        org.junit.jupiter.api.Assertions.assertThrows(
                org.springframework.security.access.AccessDeniedException.class,
                () -> ownerConstellationService.revokeLink(orgAId, linkB.id()));
    }

    private UUID extractToken(String url) {
        return UUID.fromString(url.substring(url.lastIndexOf('/') + 1));
    }
}
