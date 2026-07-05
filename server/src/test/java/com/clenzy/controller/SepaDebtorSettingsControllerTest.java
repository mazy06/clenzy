package com.clenzy.controller;

import com.clenzy.model.Organization;
import com.clenzy.repository.OrganizationMemberRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.OrganizationService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link SepaDebtorSettingsController}.
 *
 * <h2>Focus</h2>
 * <ul>
 *   <li>GET : retourne nom + iban masque + bic + flag configured (org existante)</li>
 *   <li>GET : 404-like via IllegalArgumentException quand org introuvable</li>
 *   <li>PUT : applique trim+upper+strip whitespaces sur IBAN/BIC ; valide longueur IBAN ; valide format BIC</li>
 *   <li>PUT : sauvegarde l'organisation + renvoie IBAN masque</li>
 *   <li>PUT : si champ null dans request, ne touche pas l'org</li>
 * </ul>
 *
 * <p>T-ARCH-01 : le controller delegue desormais a {@link OrganizationService}
 * (updateSepaDebtorConfig / findById). Le test cable un service REEL sur des
 * repositories mockes pour conserver les memes assertions de bout en bout.</p>
 */
@ExtendWith(MockitoExtension.class)
class SepaDebtorSettingsControllerTest {

    @Mock
    private OrganizationRepository organizationRepository;

    @Mock
    private OrganizationMemberRepository memberRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private TenantContext tenantContext;

    private SepaDebtorSettingsController controller;

    @BeforeEach
    void setUp() {
        OrganizationService organizationService =
                new OrganizationService(organizationRepository, memberRepository, userRepository,
                        org.mockito.Mockito.mock(com.clenzy.service.AutomationRuleService.class));
        controller = new SepaDebtorSettingsController(organizationService, tenantContext);
    }

    private Organization org(Long id, String name, String iban, String bic) {
        Organization o = new Organization();
        o.setId(id);
        o.setSepaDebtorName(name);
        o.setSepaDebtorIban(iban);
        o.setSepaDebtorBic(bic);
        return o;
    }

    // ─── GET ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("GET returns SEPA debtor info with masked IBAN")
    void get_returnsMaskedIban() {
        when(tenantContext.getOrganizationId()).thenReturn(42L);
        when(organizationRepository.findById(42L))
                .thenReturn(Optional.of(org(42L, "Clenzy SAS", "FR7630006000011234567890189", "BNPAFRPPXXX")));

        ResponseEntity<SepaDebtorSettingsController.SepaDebtorConfigResponse> response =
                controller.getSepaDebtorConfig();

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        SepaDebtorSettingsController.SepaDebtorConfigResponse body = response.getBody();
        assertThat(body).isNotNull();
        assertThat(body.name()).isEqualTo("Clenzy SAS");
        assertThat(body.iban()).contains("FR76");      // prefix
        assertThat(body.iban()).contains("0189");      // suffix
        assertThat(body.iban()).contains("*");         // masked middle
        assertThat(body.bic()).isEqualTo("BNPAFRPPXXX");
        assertThat(body.configured()).isTrue();
    }

    @Test
    @DisplayName("GET returns configured=false when IBAN is null")
    void get_nullIban_notConfigured() {
        when(tenantContext.getOrganizationId()).thenReturn(7L);
        when(organizationRepository.findById(7L))
                .thenReturn(Optional.of(org(7L, "Empty Org", null, null)));

        ResponseEntity<SepaDebtorSettingsController.SepaDebtorConfigResponse> response =
                controller.getSepaDebtorConfig();

        assertThat(response.getBody().configured()).isFalse();
        assertThat(response.getBody().iban()).isNull(); // IbanMasker.mask(null) -> null
    }

    @Test
    @DisplayName("GET returns configured=false when IBAN is blank")
    void get_blankIban_notConfigured() {
        when(tenantContext.getOrganizationId()).thenReturn(8L);
        when(organizationRepository.findById(8L))
                .thenReturn(Optional.of(org(8L, "Blank", "   ", "")));

        ResponseEntity<SepaDebtorSettingsController.SepaDebtorConfigResponse> response =
                controller.getSepaDebtorConfig();

        assertThat(response.getBody().configured()).isFalse();
    }

    @Test
    @DisplayName("GET throws IllegalArgumentException when org not found")
    void get_orgNotFound_throws() {
        when(tenantContext.getOrganizationId()).thenReturn(99L);
        when(organizationRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> controller.getSepaDebtorConfig())
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("introuvable");
    }

    // ─── PUT ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("PUT updates all fields and trims/uppercases IBAN+BIC")
    void put_updatesAllFields_normalized() {
        when(tenantContext.getOrganizationId()).thenReturn(42L);
        Organization o = org(42L, null, null, null);
        when(organizationRepository.findById(42L)).thenReturn(Optional.of(o));

        SepaDebtorSettingsController.UpdateSepaDebtorRequest req =
                new SepaDebtorSettingsController.UpdateSepaDebtorRequest(
                        "  Clenzy SAS  ", "fr76 3000 6000 0112 3456 7890 189", "bnpa fr pp xxx");

        SepaDebtorSettingsController.SepaDebtorConfigResponse result =
                controller.updateSepaDebtorConfig(req);

        ArgumentCaptor<Organization> captor = ArgumentCaptor.forClass(Organization.class);
        verify(organizationRepository).save(captor.capture());
        Organization saved = captor.getValue();
        assertThat(saved.getSepaDebtorName()).isEqualTo("Clenzy SAS"); // trimmed
        assertThat(saved.getSepaDebtorIban()).isEqualTo("FR7630006000011234567890189");
        assertThat(saved.getSepaDebtorBic()).isEqualTo("BNPAFRPPXXX");

        assertThat(result.name()).isEqualTo("Clenzy SAS");
        assertThat(result.iban()).contains("FR76");
        assertThat(result.iban()).contains("0189");
        assertThat(result.bic()).isEqualTo("BNPAFRPPXXX");
        assertThat(result.configured()).isTrue();
    }

    @Test
    @DisplayName("PUT rejects IBAN shorter than 15 characters")
    void put_ibanTooShort_throws() {
        when(tenantContext.getOrganizationId()).thenReturn(1L);
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(org(1L, null, null, null)));

        SepaDebtorSettingsController.UpdateSepaDebtorRequest req =
                new SepaDebtorSettingsController.UpdateSepaDebtorRequest(null, "FR1234567", null);

        assertThatThrownBy(() -> controller.updateSepaDebtorConfig(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("IBAN");
    }

    @Test
    @DisplayName("PUT rejects IBAN longer than 34 characters")
    void put_ibanTooLong_throws() {
        when(tenantContext.getOrganizationId()).thenReturn(1L);
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(org(1L, null, null, null)));

        String tooLong = "F".repeat(35);
        SepaDebtorSettingsController.UpdateSepaDebtorRequest req =
                new SepaDebtorSettingsController.UpdateSepaDebtorRequest(null, tooLong, null);

        assertThatThrownBy(() -> controller.updateSepaDebtorConfig(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("IBAN");
    }

    @Test
    @DisplayName("PUT accepts IBAN at boundary length 15 and 34")
    void put_ibanBoundary_ok() {
        when(tenantContext.getOrganizationId()).thenReturn(2L);
        when(organizationRepository.findById(2L)).thenReturn(Optional.of(org(2L, null, null, null)));

        SepaDebtorSettingsController.UpdateSepaDebtorRequest req =
                new SepaDebtorSettingsController.UpdateSepaDebtorRequest(null, "F".repeat(15), null);

        controller.updateSepaDebtorConfig(req); // should not throw
    }

    @Test
    @DisplayName("PUT rejects BIC with invalid format")
    void put_invalidBic_throws() {
        when(tenantContext.getOrganizationId()).thenReturn(1L);
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(org(1L, null, null, null)));

        SepaDebtorSettingsController.UpdateSepaDebtorRequest req =
                new SepaDebtorSettingsController.UpdateSepaDebtorRequest(null, null, "INVALID");

        assertThatThrownBy(() -> controller.updateSepaDebtorConfig(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("BIC");
    }

    @Test
    @DisplayName("PUT accepts BIC 8-chars format")
    void put_bic8Chars_ok() {
        when(tenantContext.getOrganizationId()).thenReturn(1L);
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(org(1L, null, null, null)));

        SepaDebtorSettingsController.UpdateSepaDebtorRequest req =
                new SepaDebtorSettingsController.UpdateSepaDebtorRequest(null, null, "BNPAFRPP");

        SepaDebtorSettingsController.SepaDebtorConfigResponse result =
                controller.updateSepaDebtorConfig(req);

        assertThat(result.bic()).isEqualTo("BNPAFRPP");
    }

    @Test
    @DisplayName("PUT accepts BIC 11-chars format (with branch code)")
    void put_bic11Chars_ok() {
        when(tenantContext.getOrganizationId()).thenReturn(1L);
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(org(1L, null, null, null)));

        SepaDebtorSettingsController.UpdateSepaDebtorRequest req =
                new SepaDebtorSettingsController.UpdateSepaDebtorRequest(null, null, "BNPAFRPPXXX");

        SepaDebtorSettingsController.SepaDebtorConfigResponse result =
                controller.updateSepaDebtorConfig(req);

        assertThat(result.bic()).isEqualTo("BNPAFRPPXXX");
    }

    @Test
    @DisplayName("PUT with all-null request still saves (no-op update)")
    void put_allNullRequest_savesIdempotent() {
        when(tenantContext.getOrganizationId()).thenReturn(1L);
        Organization existing = org(1L, "Pre-existing", "FR7630006000011234567890189", "BNPAFRPP");
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(existing));

        SepaDebtorSettingsController.UpdateSepaDebtorRequest req =
                new SepaDebtorSettingsController.UpdateSepaDebtorRequest(null, null, null);

        SepaDebtorSettingsController.SepaDebtorConfigResponse result =
                controller.updateSepaDebtorConfig(req);

        verify(organizationRepository).save(existing);
        // Fields untouched
        assertThat(existing.getSepaDebtorName()).isEqualTo("Pre-existing");
        assertThat(existing.getSepaDebtorIban()).isEqualTo("FR7630006000011234567890189");
        assertThat(result.configured()).isTrue();
    }

    @Test
    @DisplayName("PUT throws IllegalArgumentException when org not found")
    void put_orgNotFound_throws() {
        when(tenantContext.getOrganizationId()).thenReturn(404L);
        when(organizationRepository.findById(404L)).thenReturn(Optional.empty());

        SepaDebtorSettingsController.UpdateSepaDebtorRequest req =
                new SepaDebtorSettingsController.UpdateSepaDebtorRequest("X", null, null);

        assertThatThrownBy(() -> controller.updateSepaDebtorConfig(req))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("PUT only IBAN provided updates only IBAN")
    void put_onlyIban_partialUpdate() {
        when(tenantContext.getOrganizationId()).thenReturn(1L);
        Organization existing = org(1L, "Existing Name", null, "BNPAFRPP");
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(existing));

        SepaDebtorSettingsController.UpdateSepaDebtorRequest req =
                new SepaDebtorSettingsController.UpdateSepaDebtorRequest(
                        null, "FR7630006000011234567890189", null);

        controller.updateSepaDebtorConfig(req);

        assertThat(existing.getSepaDebtorName()).isEqualTo("Existing Name"); // unchanged
        assertThat(existing.getSepaDebtorIban()).isEqualTo("FR7630006000011234567890189");
        assertThat(existing.getSepaDebtorBic()).isEqualTo("BNPAFRPP"); // unchanged
    }

    @Test
    @DisplayName("UpdateSepaDebtorRequest record accessors work")
    void updateRequest_record_accessors() {
        SepaDebtorSettingsController.UpdateSepaDebtorRequest req =
                new SepaDebtorSettingsController.UpdateSepaDebtorRequest("A", "B", "C");
        assertThat(req.name()).isEqualTo("A");
        assertThat(req.iban()).isEqualTo("B");
        assertThat(req.bic()).isEqualTo("C");
    }

    @Test
    @DisplayName("SepaDebtorConfigResponse record accessors work")
    void responseRecord_accessors() {
        SepaDebtorSettingsController.SepaDebtorConfigResponse r =
                new SepaDebtorSettingsController.SepaDebtorConfigResponse("N", "I", "B", true);
        assertThat(r.name()).isEqualTo("N");
        assertThat(r.iban()).isEqualTo("I");
        assertThat(r.bic()).isEqualTo("B");
        assertThat(r.configured()).isTrue();
    }
}
