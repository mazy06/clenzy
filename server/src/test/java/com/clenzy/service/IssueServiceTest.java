package com.clenzy.service;

import com.clenzy.dto.IssueDtos.CreateIssueRequest;
import com.clenzy.dto.IssueDtos.DismissIssueRequest;
import com.clenzy.dto.IssueDtos.IssueDto;
import com.clenzy.dto.IssueDtos.QualifyIssueRequest;
import com.clenzy.dto.PricingConfigDto;
import com.clenzy.dto.ServiceRequestDto;
import com.clenzy.model.Intervention;
import com.clenzy.model.Issue;
import com.clenzy.model.Issue.IssueSeverity;
import com.clenzy.model.Issue.IssueStatus;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.Priority;
import com.clenzy.model.Property;
import com.clenzy.model.ServiceType;
import com.clenzy.model.User;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.IssueRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import com.clenzy.exception.NotFoundException;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Moteur Ménage 3C (P10) — anomalies terrain.
 * Création + chiffrage catalogue, transitions protégées, conversion en
 * ServiceRequest MAINTENANCE pré-chiffrée, ownership org fail-closed.
 */
@ExtendWith(MockitoExtension.class)
class IssueServiceTest {

    private static final long ORG_ID = 7L;

    @Mock private IssueRepository issueRepository;
    @Mock private InterventionRepository interventionRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private UserRepository userRepository;
    @Mock private PricingConfigService pricingConfigService;
    @Mock private ServiceRequestService serviceRequestService;
    @Mock private NotificationService notificationService;
    @Mock private TenantContext tenantContext;

    private IssueService service;

    @BeforeEach
    void setUp() {
        // Guard REEL (fail-closed) sur un TenantContext mocké : pas de bypass staff.
        OrganizationAccessGuard accessGuard = new OrganizationAccessGuard(tenantContext);
        service = new IssueService(issueRepository, interventionRepository, propertyRepository,
                userRepository, pricingConfigService, serviceRequestService, notificationService,
                accessGuard, tenantContext);
        lenient().when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
        lenient().when(tenantContext.isSuperAdmin()).thenReturn(false);
        lenient().when(tenantContext.isSystemOrg()).thenReturn(false);
        lenient().when(issueRepository.save(any(Issue.class))).thenAnswer(inv -> {
            Issue issue = inv.getArgument(0);
            if (issue.getId() == null) issue.setId(55L);
            return issue;
        });
        lenient().when(propertyRepository.findById(3L)).thenReturn(Optional.of(orgProperty(3L, ORG_ID)));
        lenient().when(userRepository.findById(anyLong())).thenReturn(Optional.empty());
    }

    private static Property orgProperty(Long id, Long orgId) {
        Property p = new Property();
        p.setId(id);
        p.setOrganizationId(orgId);
        p.setName("P" + id);
        return p;
    }

    @Test
    @DisplayName("list mine : reportedBy résolu depuis le JWT, toujours org-scopé")
    void whenMineFilter_thenScopedToReporter() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
        when(userRepository.findByKeycloakId("kc-hk")).thenReturn(Optional.of(user(9L, "kc-hk")));
        when(issueRepository.findByOrgWithFilters(ORG_ID, null, null, 9L)).thenReturn(List.of());

        service.list(null, null, "kc-hk");

        verify(issueRepository).findByOrgWithFilters(ORG_ID, null, null, 9L);
    }

    @Test
    @DisplayName("list sans mine : reportedBy null (comportement historique intact)")
    void whenNoMineFilter_thenReportedByNull() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
        when(issueRepository.findByOrgWithFilters(ORG_ID, null, null, null)).thenReturn(List.of());

        service.list(null, null);

        verify(issueRepository).findByOrgWithFilters(ORG_ID, null, null, null);
    }

    @Test
    @DisplayName("list mine : user inconnu → NotFound (pas de fuite d'un scope élargi)")
    void whenMineWithUnknownUser_thenNotFound() {
        when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
        when(userRepository.findByKeycloakId("kc-ghost")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.list(null, null, "kc-ghost"))
                .isInstanceOf(NotFoundException.class);
    }

    private static User user(long id, String keycloakId) {
        User u = new User();
        u.setId(id);
        u.setKeycloakId(keycloakId);
        return u;
    }

    private static PricingConfigDto.ServicePriceConfig catalogItem(
            String type, String label, String domain, Double price, boolean enabled) {
        PricingConfigDto.ServicePriceConfig item =
                new PricingConfigDto.ServicePriceConfig(type, price, enabled);
        item.setLabel(label);
        item.setDomain(domain);
        return item;
    }

    private Issue existingIssue(IssueStatus status) {
        Issue issue = new Issue();
        issue.setId(55L);
        issue.setOrganizationId(ORG_ID);
        issue.setPropertyId(3L);
        issue.setReportedBy(9L);
        issue.setTitle("Fuite sous l'évier");
        issue.setSeverity(IssueSeverity.HIGH);
        issue.setStatus(status);
        issue.setSuggestedCost(BigDecimal.valueOf(120));
        when(issueRepository.findById(55L)).thenReturn(Optional.of(issue));
        return issue;
    }

    // ── Création + chiffrage catalogue ───────────────────────────────────────

    @Test
    @DisplayName("create : catégorie qui matche le catalogue travaux → suggestedCost pré-rempli")
    void whenCategoryMatchesCatalog_thenSuggestedCostFilled() {
        when(userRepository.findByKeycloakId("kc-hk")).thenReturn(Optional.of(user(9L, "kc-hk")));
        when(pricingConfigService.getTravaux()).thenReturn(List.of(
                catalogItem("PLUMBING_REPAIR", "Réparation Plomberie", "Plomberie", 120.0, true)));

        IssueDto dto = service.create(new CreateIssueRequest(
                3L, null, "Fuite sous l'évier", "Ça goutte", "PLUMBING_REPAIR", IssueSeverity.HIGH), "kc-hk");

        assertThat(dto.suggestedCost()).isEqualByComparingTo("120.00");
        assertThat(dto.status()).isEqualTo(IssueStatus.OPEN);
        assertThat(dto.reportedById()).isEqualTo(9L);
        verify(notificationService).notifyAdminsAndManagers(
                eq(NotificationKey.ISSUE_REPORTED), any(), any(), any());
    }

    @Test
    @DisplayName("create : matching insensible casse/accents/underscores (label + domaine)")
    void whenCategoryMatchesLabelOrDomain_thenSuggestedCostFilled() {
        when(pricingConfigService.getTravaux()).thenReturn(List.of(
                catalogItem("PLUMBING_REPAIR", "Réparation Plomberie", "Plomberie", 120.0, true),
                catalogItem("DRAIN_UNBLOCKING", "Débouchage canalisation", "Plomberie", 150.0, true)));

        // Label exact (accents/casse ignorés) prime sur le domaine.
        assertThat(service.suggestCostFromCatalog("reparation plomberie")).isEqualByComparingTo("120.00");
        // Domaine → premier item actif du domaine.
        assertThat(service.suggestCostFromCatalog("plomberie")).isEqualByComparingTo("120.00");
        // interventionType avec underscores vs espaces.
        assertThat(service.suggestCostFromCatalog("drain unblocking")).isEqualByComparingTo("150.00");
    }

    @Test
    @DisplayName("create : catégorie sans correspondance catalogue → suggestedCost null (chiffrage manuel)")
    void whenCategoryDoesNotMatchCatalog_thenSuggestedCostNull() {
        when(userRepository.findByKeycloakId("kc-hk")).thenReturn(Optional.of(user(9L, "kc-hk")));
        when(pricingConfigService.getTravaux()).thenReturn(List.of(
                catalogItem("PLUMBING_REPAIR", "Réparation Plomberie", "Plomberie", 120.0, true),
                catalogItem("HVAC_REPAIR", "Clim", "CVC", 200.0, false))); // disabled → ignoré

        IssueDto dto = service.create(new CreateIssueRequest(
                3L, null, "Objet manquant", null, "MISSING_ITEM", null), "kc-hk");

        assertThat(dto.suggestedCost()).isNull();
        assertThat(dto.severity()).isEqualTo(IssueSeverity.MEDIUM); // défaut
    }

    @Test
    @DisplayName("create depuis une intervention : ownership org validé + logement dérivé")
    void whenCreatedFromIntervention_thenPropertyDerivedAndOrgChecked() {
        when(userRepository.findByKeycloakId("kc-hk")).thenReturn(Optional.of(user(9L, "kc-hk")));
        Intervention intervention = new Intervention();
        intervention.setId(77L);
        intervention.setOrganizationId(ORG_ID);
        intervention.setProperty(orgProperty(3L, ORG_ID));
        when(interventionRepository.findById(77L)).thenReturn(Optional.of(intervention));
        when(pricingConfigService.getTravaux()).thenReturn(List.of());

        IssueDto dto = service.create(new CreateIssueRequest(
                null, 77L, "Dommage constaté — Salle de bain", "Carrelage fissuré", "DAMAGE",
                IssueSeverity.MEDIUM), "kc-hk");

        assertThat(dto.propertyId()).isEqualTo(3L);
        assertThat(dto.sourceInterventionId()).isEqualTo(77L);
    }

    @Test
    @DisplayName("create : intervention d'une AUTRE org → AccessDenied, rien n'est sauvé")
    void whenInterventionBelongsToForeignOrg_thenAccessDenied() {
        when(userRepository.findByKeycloakId("kc-hk")).thenReturn(Optional.of(user(9L, "kc-hk")));
        Intervention foreign = new Intervention();
        foreign.setId(78L);
        foreign.setOrganizationId(666L);
        when(interventionRepository.findById(78L)).thenReturn(Optional.of(foreign));

        assertThatThrownBy(() -> service.create(new CreateIssueRequest(
                null, 78L, "Titre", null, null, null), "kc-hk"))
                .isInstanceOf(AccessDeniedException.class);
        verify(issueRepository, never()).save(any());
    }

    // ── Transitions ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("qualify : ajuste catégorie/sévérité/coût explicite → QUALIFIED")
    void whenQualify_thenFieldsAdjustedAndStatusQualified() {
        Issue issue = existingIssue(IssueStatus.OPEN);

        IssueDto dto = service.qualify(55L, new QualifyIssueRequest(
                "ELECTRICAL_REPAIR", IssueSeverity.CRITICAL, BigDecimal.valueOf(250)));

        assertThat(dto.status()).isEqualTo(IssueStatus.QUALIFIED);
        assertThat(dto.category()).isEqualTo("ELECTRICAL_REPAIR");
        assertThat(dto.severity()).isEqualTo(IssueSeverity.CRITICAL);
        // Coût explicite du gestionnaire : PAS de recalcul catalogue.
        assertThat(dto.suggestedCost()).isEqualByComparingTo("250.00");
        verify(pricingConfigService, never()).getTravaux();
        assertThat(issue.getStatus()).isEqualTo(IssueStatus.QUALIFIED);
    }

    @Test
    @DisplayName("qualify : nouvelle catégorie sans coût explicite → re-suggestion catalogue")
    void whenQualifyWithCategoryOnly_thenCostResuggested() {
        existingIssue(IssueStatus.OPEN);
        when(pricingConfigService.getTravaux()).thenReturn(List.of(
                catalogItem("ELECTRICAL_REPAIR", "Réparation Électrique", "Électricité", 180.0, true)));

        IssueDto dto = service.qualify(55L, new QualifyIssueRequest("ELECTRICAL_REPAIR", null, null));

        assertThat(dto.suggestedCost()).isEqualByComparingTo("180.00");
    }

    @Test
    @DisplayName("qualify/dismiss : interdits depuis un statut terminal")
    void whenTerminalStatus_thenTransitionsRejected() {
        existingIssue(IssueStatus.CONVERTED);

        assertThatThrownBy(() -> service.qualify(55L, new QualifyIssueRequest(null, null, null)))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> service.dismiss(55L, new DismissIssueRequest("doublon")))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("dismiss : OPEN → DISMISSED avec raison")
    void whenDismiss_thenStatusDismissedWithReason() {
        existingIssue(IssueStatus.OPEN);

        IssueDto dto = service.dismiss(55L, new DismissIssueRequest("Déjà réparé"));

        assertThat(dto.status()).isEqualTo(IssueStatus.DISMISSED);
        assertThat(dto.dismissReason()).isEqualTo("Déjà réparé");
    }

    @Test
    @DisplayName("issue d'une autre org : toute action → AccessDenied (fail-closed)")
    void whenIssueBelongsToForeignOrg_thenAccessDenied() {
        Issue foreign = new Issue();
        foreign.setId(66L);
        foreign.setOrganizationId(666L);
        when(issueRepository.findById(66L)).thenReturn(Optional.of(foreign));

        assertThatThrownBy(() -> service.get(66L)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.qualify(66L, new QualifyIssueRequest(null, null, null)))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.convert(66L, "kc-mgr"))
                .isInstanceOf(AccessDeniedException.class);
        verify(serviceRequestService, never()).create(any());
    }

    // ── Conversion ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("convert : SR MAINTENANCE pré-chiffrée créée via le flux existant + issue liée")
    void whenConvert_thenMaintenanceServiceRequestCreatedAndLinked() {
        Issue issue = existingIssue(IssueStatus.QUALIFIED);
        issue.setCategory("PLUMBING_REPAIR");
        when(issueRepository.transitionStatus(eq(55L), eq(IssueStatus.CONVERTED), anyCollection()))
                .thenReturn(1);
        when(userRepository.findByKeycloakId("kc-mgr")).thenReturn(Optional.of(user(42L, "kc-mgr")));
        ServiceRequestDto created = new ServiceRequestDto();
        created.id = 900L;
        when(serviceRequestService.create(any(ServiceRequestDto.class))).thenReturn(created);

        IssueDto dto = service.convert(55L, "kc-mgr");

        ArgumentCaptor<ServiceRequestDto> captor = ArgumentCaptor.forClass(ServiceRequestDto.class);
        verify(serviceRequestService).create(captor.capture());
        ServiceRequestDto sr = captor.getValue();
        assertThat(sr.serviceType).isEqualTo(ServiceType.PLUMBING_REPAIR);
        assertThat(sr.estimatedCost).isEqualByComparingTo("120"); // pré-chiffrée = suggestedCost
        assertThat(sr.priority).isEqualTo(Priority.HIGH);
        assertThat(sr.propertyId).isEqualTo(3L);
        assertThat(sr.userId).isEqualTo(42L);
        assertThat(sr.description).contains("anomalie terrain #55");

        assertThat(dto.status()).isEqualTo(IssueStatus.CONVERTED);
        assertThat(dto.convertedServiceRequestId()).isEqualTo(900L);
    }

    @Test
    @DisplayName("convert : catégorie libre → type dérivé de la sévérité (CRITICAL → urgence)")
    void whenConvertWithFreeCategory_thenTypeDerivedFromSeverity() {
        Issue issue = existingIssue(IssueStatus.OPEN);
        issue.setCategory("DAMAGE");
        issue.setSeverity(IssueSeverity.CRITICAL);
        when(issueRepository.transitionStatus(eq(55L), eq(IssueStatus.CONVERTED), anyCollection()))
                .thenReturn(1);
        when(userRepository.findByKeycloakId("kc-mgr")).thenReturn(Optional.of(user(42L, "kc-mgr")));
        ServiceRequestDto created = new ServiceRequestDto();
        created.id = 901L;
        when(serviceRequestService.create(any(ServiceRequestDto.class))).thenReturn(created);

        service.convert(55L, "kc-mgr");

        ArgumentCaptor<ServiceRequestDto> captor = ArgumentCaptor.forClass(ServiceRequestDto.class);
        verify(serviceRequestService).create(captor.capture());
        assertThat(captor.getValue().serviceType).isEqualTo(ServiceType.EMERGENCY_REPAIR);
        assertThat(captor.getValue().urgent).isTrue();
        assertThat(captor.getValue().priority).isEqualTo(Priority.CRITICAL);
    }

    @Test
    @DisplayName("convert : refusé si la réclamation conditionnelle échoue (DISMISSED / double clic)")
    void whenConditionalClaimFails_thenConvertRejectedWithoutServiceRequest() {
        existingIssue(IssueStatus.DISMISSED);
        when(issueRepository.transitionStatus(eq(55L), eq(IssueStatus.CONVERTED), anyCollection()))
                .thenReturn(0);

        assertThatThrownBy(() -> service.convert(55L, "kc-mgr"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("DISMISSED");
        verify(serviceRequestService, never()).create(any());
    }

    @Test
    @DisplayName("convert : la fenêtre de transition n'accepte que OPEN et QUALIFIED")
    void whenConvert_thenClaimWindowIsOpenAndQualifiedOnly() {
        existingIssue(IssueStatus.QUALIFIED);
        when(issueRepository.transitionStatus(eq(55L), eq(IssueStatus.CONVERTED), anyCollection()))
                .thenReturn(1);
        when(userRepository.findByKeycloakId("kc-mgr")).thenReturn(Optional.of(user(42L, "kc-mgr")));
        ServiceRequestDto created = new ServiceRequestDto();
        created.id = 902L;
        when(serviceRequestService.create(any(ServiceRequestDto.class))).thenReturn(created);

        service.convert(55L, "kc-mgr");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Collection<IssueStatus>> fromCaptor =
                ArgumentCaptor.forClass((Class) Collection.class);
        verify(issueRepository).transitionStatus(eq(55L), eq(IssueStatus.CONVERTED), fromCaptor.capture());
        assertThat(fromCaptor.getValue())
                .containsExactlyInAnyOrder(IssueStatus.OPEN, IssueStatus.QUALIFIED);
    }
}
