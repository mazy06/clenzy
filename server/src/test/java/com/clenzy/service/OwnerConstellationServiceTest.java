package com.clenzy.service;

import com.clenzy.dto.OwnerConstellationPublicDto;
import com.clenzy.dto.OwnerDashboardDto;
import com.clenzy.dto.OwnerPortalLinkDto;
import com.clenzy.model.Organization;
import com.clenzy.model.OwnerPortalToken;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.OwnerPortalTokenRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.SupervisionActivityRepository;
import com.clenzy.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OwnerConstellationServiceTest {

    private static final Long ORG_ID = 10L;
    private static final Long OWNER_ID = 42L;
    private static final String FRONTEND = "http://localhost:3000";

    @Mock private OwnerPortalTokenRepository tokenRepository;
    @Mock private OwnerPortalService ownerPortalService;
    @Mock private PropertyRepository propertyRepository;
    @Mock private SupervisionActivityRepository activityRepository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private UserRepository userRepository;

    private OwnerConstellationService service;

    @BeforeEach
    void setUp() {
        service = new OwnerConstellationService(tokenRepository, ownerPortalService,
                propertyRepository, activityRepository, organizationRepository, userRepository);
    }

    private Property property(Long id, Long orgId, String name) {
        Property p = new Property();
        p.setId(id);
        p.setOrganizationId(orgId);
        p.setName(name);
        return p;
    }

    private OwnerDashboardDto emptyDashboard() {
        return new OwnerDashboardDto(OWNER_ID, 1, 0, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, 0.0, 0.0, Map.of(), List.of());
    }

    @Nested
    @DisplayName("createLink")
    class CreateLink {

        @Test
        @DisplayName("refuse un proprietaire sans bien dans l'organisation (anti cross-org)")
        void whenOwnerHasNoPropertyInOrg_thenAccessDenied() {
            when(propertyRepository.findByOwnerId(OWNER_ID))
                    .thenReturn(List.of(property(1L, 999L, "Bien d'une autre org")));

            assertThatThrownBy(() -> service.createLink(ORG_ID, OWNER_ID, null, FRONTEND))
                    .isInstanceOf(AccessDeniedException.class);
            verify(tokenRepository, never()).save(any());
        }

        @Test
        @DisplayName("genere un lien /owner-view/{token} avec expiration par defaut 365 j")
        void whenOwnerHasProperty_thenLinkCreated() {
            when(propertyRepository.findByOwnerId(OWNER_ID))
                    .thenReturn(List.of(property(1L, ORG_ID, "Appartement Paris")));

            OwnerPortalLinkDto link = service.createLink(ORG_ID, OWNER_ID, null, FRONTEND);

            assertThat(link.url()).startsWith(FRONTEND + "/owner-view/");
            assertThat(link.expiresAt()).isAfter(LocalDateTime.now().plusDays(364));
            verify(tokenRepository).save(any(OwnerPortalToken.class));
        }
    }

    @Nested
    @DisplayName("revokeLink")
    class RevokeLink {

        @Test
        @DisplayName("refuse la revocation d'un lien d'une autre organisation")
        void whenLinkBelongsToOtherOrg_thenAccessDenied() {
            OwnerPortalToken token = new OwnerPortalToken(999L, OWNER_ID,
                    LocalDateTime.now().plusDays(10));
            when(tokenRepository.findById(5L)).thenReturn(Optional.of(token));

            assertThatThrownBy(() -> service.revokeLink(ORG_ID, 5L))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        @DisplayName("revoque un lien de l'organisation courante")
        void whenLinkInOrg_thenRevoked() {
            OwnerPortalToken token = new OwnerPortalToken(ORG_ID, OWNER_ID,
                    LocalDateTime.now().plusDays(10));
            when(tokenRepository.findById(5L)).thenReturn(Optional.of(token));

            service.revokeLink(ORG_ID, 5L);

            assertThat(token.isRevoked()).isTrue();
            verify(tokenRepository).save(token);
        }
    }

    @Nested
    @DisplayName("branding white-label (X9-b)")
    class Branding {

        @Test
        @DisplayName("logo non-HTTPS refuse (page publique : jamais de http/data/javascript)")
        void whenLogoNotHttps_thenRejected() {
            when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(new Organization()));

            assertThatThrownBy(() -> service.updateBranding(ORG_ID, "http://insecure.example/logo.png", null))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("HTTPS");
            assertThatThrownBy(() -> service.updateBranding(ORG_ID, "javascript:alert(1)", null))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("couleur hors format #RRGGBB refusee")
        void whenColorInvalid_thenRejected() {
            when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(new Organization()));

            assertThatThrownBy(() -> service.updateBranding(ORG_ID, null, "red"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("#RRGGBB");
        }

        @Test
        @DisplayName("branding valide persiste et champs vides retires")
        void whenValid_thenSavedAndBlankClears() {
            Organization org = new Organization();
            when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org));

            service.updateBranding(ORG_ID, "https://cdn.example/logo.png", "#4A9B8E");
            assertThat(org.getBrandingLogoUrl()).isEqualTo("https://cdn.example/logo.png");
            assertThat(org.getBrandingPrimaryColor()).isEqualTo("#4A9B8E");

            service.updateBranding(ORG_ID, "", "");
            assertThat(org.getBrandingLogoUrl()).isNull();
            assertThat(org.getBrandingPrimaryColor()).isNull();
        }
    }

    @Nested
    @DisplayName("getPublicView")
    class GetPublicView {

        @Test
        @DisplayName("token inconnu -> empty (404 uniforme)")
        void whenTokenUnknown_thenEmpty() {
            UUID token = UUID.randomUUID();
            when(tokenRepository.findByToken(token)).thenReturn(Optional.empty());

            assertThat(service.getPublicView(token)).isEmpty();
        }

        @Test
        @DisplayName("token expire ou revoque -> empty")
        void whenTokenExpiredOrRevoked_thenEmpty() {
            UUID raw = UUID.randomUUID();
            OwnerPortalToken expired = new OwnerPortalToken(ORG_ID, OWNER_ID,
                    LocalDateTime.now().minusDays(1));
            when(tokenRepository.findByToken(raw)).thenReturn(Optional.of(expired));
            assertThat(service.getPublicView(raw)).isEmpty();

            OwnerPortalToken revoked = new OwnerPortalToken(ORG_ID, OWNER_ID,
                    LocalDateTime.now().plusDays(30));
            revoked.setRevoked(true);
            when(tokenRepository.findByToken(raw)).thenReturn(Optional.of(revoked));
            assertThat(service.getPublicView(raw)).isEmpty();
        }

        @Test
        @DisplayName("token valide -> vue white-label limitee aux biens du proprietaire DANS l'org")
        void whenTokenValid_thenViewScopedToOwnerOrgProperties() {
            UUID raw = UUID.randomUUID();
            OwnerPortalToken token = new OwnerPortalToken(ORG_ID, OWNER_ID,
                    LocalDateTime.now().plusDays(30));
            when(tokenRepository.findByToken(raw)).thenReturn(Optional.of(token));

            Organization org = new Organization();
            org.setName("Conciergerie Azur");
            when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org));

            User owner = new User();
            owner.setFirstName("Marie");
            owner.setLastName("Durand");
            when(userRepository.findById(OWNER_ID)).thenReturn(Optional.of(owner));

            when(ownerPortalService.getDashboard(OWNER_ID, ORG_ID)).thenReturn(emptyDashboard());
            // 2 biens : un dans l'org, un dans une AUTRE org (doit etre exclu)
            when(propertyRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of(
                    property(1L, ORG_ID, "Appartement Paris"),
                    property(2L, 999L, "Bien hors org")));
            when(activityRepository.countByOrganizationIdAndPropertyIdAndKindAndCreatedAtAfter(
                    eq(ORG_ID), eq(1L), eq("ACT"), any())).thenReturn(14L);
            when(activityRepository.countByOrganizationIdAndPropertyIdAndKindAndCreatedAtAfter(
                    eq(ORG_ID), eq(1L), eq("SUGGEST"), any())).thenReturn(2L);
            when(activityRepository.findByOrganizationIdAndPropertyIdOrderByCreatedAtDesc(
                    eq(ORG_ID), eq(1L), any())).thenReturn(List.of());

            Optional<OwnerConstellationPublicDto> view = service.getPublicView(raw);

            assertThat(view).isPresent();
            assertThat(view.get().conciergerieName()).isEqualTo("Conciergerie Azur");
            assertThat(view.get().ownerDisplayName()).isEqualTo("Marie Durand");
            assertThat(view.get().agentActivity()).hasSize(1);
            assertThat(view.get().agentActivity().get(0).propertyName()).isEqualTo("Appartement Paris");
            assertThat(view.get().agentActivity().get(0).actionsLast30Days()).isEqualTo(14);
            assertThat(view.get().agentActivity().get(0).suggestionsLast30Days()).isEqualTo(2);
        }
    }
}
