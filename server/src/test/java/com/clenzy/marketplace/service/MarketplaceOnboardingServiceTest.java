package com.clenzy.marketplace.service;

import com.clenzy.dto.CreateUserDto;
import com.clenzy.marketplace.model.MarketplaceProvider;
import com.clenzy.marketplace.model.MarketplaceProviderOffer;
import com.clenzy.marketplace.model.MarketplaceServiceCategory;
import com.clenzy.marketplace.repository.MarketplaceProviderRepository;
import com.clenzy.model.Organization;
import com.clenzy.model.OrganizationType;
import com.clenzy.model.ProviderDocument;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.repository.ProviderDocumentRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.KeycloakService;
import com.clenzy.service.OrganizationService;
import com.clenzy.util.StringUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Ouverture du compte d'un prestataire accepte.
 *
 * <p>Les cas qui comptent sont ceux ou l'on pourrait faire du degat : doubler
 * une identite qui existe deja, fabriquer un mot de passe, ou laisser un compte
 * Keycloak orphelin apres un echec en base.</p>
 */
@ExtendWith(MockitoExtension.class)
class MarketplaceOnboardingServiceTest {

    @Mock private MarketplaceProviderRepository providerRepository;
    @Mock private ProviderDocumentRepository documentRepository;
    @Mock private UserRepository userRepository;
    @Mock private OrganizationService organizationService;
    @Mock private KeycloakService keycloakService;
    @Mock private MarketplaceActivationDeliveries deliveries;
    @Mock private PlatformTransactionManager transactionManager;
    @Mock private MarketplaceProvisioningJobs jobs;

    private MarketplaceOnboardingService service;

    @BeforeEach
    void setUp() {
        lenient().when(transactionManager.getTransaction(any()))
            .thenReturn(new SimpleTransactionStatus());
        lenient().when(jobs.claim(any())).thenReturn(new MarketplaceProvisioningJobs.Claim(
                "00000000-0000-0000-0000-000000000002", "00000000-0000-0000-0000-000000000001"));
        lenient().when(jobs.operationKey(any())).thenReturn("00000000-0000-0000-0000-000000000001");
        service = new MarketplaceOnboardingService(
            providerRepository, documentRepository, userRepository,
            organizationService, keycloakService, deliveries, transactionManager, jobs);
    }

    @Test
    void whenTheProviderIsNew_thenAnAccountAndItsOwnOrganizationAreCreated() {
        var provider = provider();
        givenProvider(provider);
        when(userRepository.findByEmailHash(any())).thenReturn(Optional.empty());
        when(keycloakService.createMarketplaceUser(any(), any())).thenReturn("kc-new");
        when(userRepository.save(any())).thenAnswer(i -> {
            User u = i.getArgument(0);
            u.setId(99L);
            return u;
        });
        when(organizationService.createForUser(any(), any(), any())).thenReturn(organization(5L));

        var outcome = service.onboard(1L);

        assertThat(outcome).isEqualTo(MarketplaceOnboardingService.Outcome.ACCOUNT_CREATED);
        // Sa propre organisation : un independant travaille pour qui il veut.
        verify(organizationService).createForUser(any(), eq("ATELIER OURIKA SARL"),
            eq(OrganizationType.INDIVIDUAL));
        assertThat(provider.getUserId()).isEqualTo(99L);
    }

    @Test
    void weNeverInventAPasswordForSomeone() {
        givenProvider(provider());
        when(userRepository.findByEmailHash(any())).thenReturn(Optional.empty());
        when(keycloakService.createMarketplaceUser(any(), any())).thenReturn("kc-new");
        when(userRepository.save(any())).thenAnswer(i -> { ((User) i.getArgument(0)).setId(99L); return i.getArgument(0); });
        when(organizationService.createForUser(any(), any(), any())).thenReturn(organization(5L));

        service.onboard(1L);

        var created = ArgumentCaptor.forClass(CreateUserDto.class);
        verify(keycloakService).createMarketplaceUser(created.capture(), anyString());
        assertThat(created.getValue().getPassword()).isNull();
        // L'invitation sera envoyée par le worker après le commit du compte.
        verify(deliveries).enqueue(any());
    }

    @Test
    void whenTheTradeIsCleaning_thenTheRoleFollowsIt() {
        givenProvider(providerWithCategory("CLEANING"));
        when(userRepository.findByEmailHash(any())).thenReturn(Optional.empty());
        when(keycloakService.createMarketplaceUser(any(), any())).thenReturn("kc-new");
        when(userRepository.save(any())).thenAnswer(i -> { ((User) i.getArgument(0)).setId(99L); return i.getArgument(0); });
        when(organizationService.createForUser(any(), any(), any())).thenReturn(organization(5L));

        service.onboard(1L);

        var saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(saved.capture());
        assertThat(saved.getValue().getRole()).isEqualTo(UserRole.HOUSEKEEPER);
    }

    @Test
    void whenNoContactNameWasGiven_thenTheAccountStillGetsUsableNames() {
        // `User` impose @NotBlank ET @Size(2..50) sur prenom et nom. Poser une
        // chaine vide faisait echouer la persistance APRES la creation du
        // compte Keycloak : l'ouverture entiere etait perdue pour un nom absent.
        var provider = provider();
        provider.setContactFirstName(null);
        provider.setContactLastName(null);
        provider.setDisplayName("Jardins de l'Atlas");
        givenProvider(provider);
        when(userRepository.findByEmailHash(any())).thenReturn(Optional.empty());
        when(keycloakService.createMarketplaceUser(any(), any())).thenReturn("kc-new");
        when(userRepository.save(any())).thenAnswer(i -> { ((User) i.getArgument(0)).setId(99L); return i.getArgument(0); });
        when(organizationService.createForUser(any(), any(), any())).thenReturn(organization(5L));

        service.onboard(1L);

        var saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(saved.capture());
        assertThat(saved.getValue().getFirstName()).isEqualTo("Jardins");
        assertThat(saved.getValue().getLastName()).isEqualTo("de l'Atlas");
    }

    @Test
    void whenTheDisplayNameIsOneLongWord_thenBothNamesStayWithinBounds() {
        var provider = provider();
        provider.setContactFirstName(null);
        provider.setContactLastName(null);
        provider.setDisplayName("A".repeat(120));
        givenProvider(provider);
        when(userRepository.findByEmailHash(any())).thenReturn(Optional.empty());
        when(keycloakService.createMarketplaceUser(any(), any())).thenReturn("kc-new");
        when(userRepository.save(any())).thenAnswer(i -> { ((User) i.getArgument(0)).setId(99L); return i.getArgument(0); });
        when(organizationService.createForUser(any(), any(), any())).thenReturn(organization(5L));

        service.onboard(1L);

        var saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(saved.capture());
        // La troncature est imposee par @Size(50), pas choisie : un nom
        // commercial peut aller jusqu'a 150 caracteres.
        assertThat(saved.getValue().getFirstName()).hasSize(50);
        assertThat(saved.getValue().getLastName()).hasSize(50);
    }

    @Test
    void whenAContactNameIsTooLong_thenItIsTrimmedRatherThanRejected() {
        var provider = provider();
        provider.setContactFirstName("B".repeat(80));
        givenProvider(provider);
        when(userRepository.findByEmailHash(any())).thenReturn(Optional.empty());
        when(keycloakService.createMarketplaceUser(any(), any())).thenReturn("kc-new");
        when(userRepository.save(any())).thenAnswer(i -> { ((User) i.getArgument(0)).setId(99L); return i.getArgument(0); });
        when(organizationService.createForUser(any(), any(), any())).thenReturn(organization(5L));

        service.onboard(1L);

        var saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(saved.capture());
        assertThat(saved.getValue().getFirstName()).hasSize(50);
    }

    @Test
    void whenAnAccountAlreadyUsesThatAddress_thenItIsLinkedRatherThanDuplicated() {
        // Une femme de menage deja dans Baitly qui candidate ne doit pas se
        // retrouver avec deux identites et deux boites de reception.
        var provider = provider();
        givenProvider(provider);
        var existing = new User();
        existing.setId(42L);
        existing.setOrganizationId(7L);
        existing.setKeycloakId("kc-existing"); existing.setEmail("pro@exemple.fr"); existing.setStatus(com.clenzy.model.UserStatus.ACTIVE);
        when(userRepository.findForMarketplaceReconciliation(42L)).thenReturn(Optional.of(existing));
        when(userRepository.findByEmailHash(StringUtils.computeEmailHash("pro@exemple.fr")))
            .thenReturn(Optional.of(existing));

        var outcome = service.onboard(1L);

        assertThat(outcome).isEqualTo(MarketplaceOnboardingService.Outcome.EXISTING_ACCOUNT_LINKED);
        assertThat(provider.getUserId()).isEqualTo(42L);
        verify(keycloakService).verifyMarketplaceAccountOwner("kc-existing", "pro@exemple.fr");
        verify(keycloakService, never()).createMarketplaceUser(any(), any());
        verify(organizationService, never()).createForUser(any(), any(), any());
    }

    @Test
    void whenDocumentsWereDeposited_thenTheyChangeOwnerRatherThanBeingCopied() {
        var provider = provider();
        givenProvider(provider);
        var document = new ProviderDocument();
        document.setId(3L);
        document.setMarketplaceProviderId(1L);
        when(documentRepository.findByMarketplaceProviderIdOrderByCreatedAtDesc(1L))
            .thenReturn(List.of(document));
        var existing = new User();
        existing.setId(42L);
        existing.setOrganizationId(7L);
        existing.setKeycloakId("kc-existing"); existing.setEmail("pro@exemple.fr"); existing.setStatus(com.clenzy.model.UserStatus.ACTIVE);
        when(userRepository.findForMarketplaceReconciliation(42L)).thenReturn(Optional.of(existing));
        when(userRepository.findByEmailHash(any())).thenReturn(Optional.of(existing));

        service.onboard(1L);

        // Les deux champs bougent ENSEMBLE : la contrainte en base impose un
        // proprietaire et un seul.
        assertThat(document.getUserId()).isEqualTo(42L);
        assertThat(document.getMarketplaceProviderId()).isNull();
        assertThat(document.getOrganizationId()).isEqualTo(7L);
        verify(documentRepository).saveAll(any());
    }

    @Test
    void anInvitationQueueFailureFailsLocalProvisioningForRetry() {
        givenProvider(provider());
        when(userRepository.findByEmailHash(any())).thenReturn(Optional.empty());
        when(keycloakService.createMarketplaceUser(any(), any())).thenReturn("kc-new");
        when(userRepository.save(any())).thenAnswer(i -> { ((User) i.getArgument(0)).setId(99L); return i.getArgument(0); });
        when(organizationService.createForUser(any(), any(), any())).thenReturn(organization(5L));
        doThrow(new RuntimeException("file indisponible"))
            .when(deliveries).enqueue(any());

        var outcome = service.onboard(1L);

        assertThat(outcome).isEqualTo(MarketplaceOnboardingService.Outcome.FAILED);
        verify(transactionManager).rollback(any());
        verify(keycloakService, never()).deleteUser(any());
    }

    @Test
    void theProviderIsReReadInsideTheTransactionRatherThanSavedStale() {
        // Incident : cette methode s'execute dans un `afterCommit`, ou le
        // contexte de persistance d'origine est ENCORE lie au thread.
        // Sauvegarder l'instance recue faisait un merge de TOUS ses champs et
        // remettait `decision_sent_at` a NULL alors que le courriel etait parti
        // — la fiche repartait pour une seconde annonce au changement suivant.
        var stale = provider();
        var fresh = provider();
        fresh.setDecisionSentAt(java.time.LocalDateTime.of(2026, 9, 13, 5, 44));
        when(providerRepository.findById(1L)).thenReturn(Optional.of(stale), Optional.of(fresh));
        when(userRepository.findByEmailHash(any())).thenReturn(Optional.empty());
        when(keycloakService.createMarketplaceUser(any(), any())).thenReturn("kc-new");
        when(userRepository.save(any())).thenAnswer(i -> { ((User) i.getArgument(0)).setId(99L); return i.getArgument(0); });
        when(organizationService.createForUser(any(), any(), any())).thenReturn(organization(5L));

        service.onboard(1L);

        // Le rattachement et le jeton sont désormais enregistrés ensemble.
        var saved = ArgumentCaptor.forClass(com.clenzy.marketplace.model.MarketplaceProvider.class);
        verify(providerRepository).save(saved.capture());
        var accountWrite = saved.getAllValues().get(0);

        // C'est l'instance RELUE qui est ecrite, donc l'horodatage d'annonce survit.
        assertThat(accountWrite.getDecisionSentAt()).isNotNull();
        assertThat(accountWrite.getUserId()).isEqualTo(99L);
        assertThat(accountWrite).isNotSameAs(stale);
    }

    @Test
    void whenPersistingFails_thenTheMarkedIdentityIsKeptForRetry() {
        // La preuve du provisionnement permet de reprendre le compte distant.
        givenProvider(provider());
        when(userRepository.findByEmailHash(any())).thenReturn(Optional.empty());
        when(keycloakService.createMarketplaceUser(any(), any())).thenReturn("kc-new");
        when(userRepository.save(any())).thenThrow(new RuntimeException("base indisponible"));

        var outcome = service.onboard(1L);

        assertThat(outcome).isEqualTo(MarketplaceOnboardingService.Outcome.FAILED);
        verify(keycloakService, never()).deleteUser(any());
        verifyNoInteractions(deliveries);
    }

    @Test
    void whenTheProviderAlreadyHasAnAccount_thenNothingHappens() {
        var provider = provider();
        provider.setUserId(42L);
        givenProvider(provider);

        assertThat(service.onboard(1L))
            .isEqualTo(MarketplaceOnboardingService.Outcome.ALREADY_LINKED);
        verifyNoInteractions(keycloakService, userRepository, organizationService);
    }

    @Test
    void whenTheProviderHasNoAddress_thenNoAccountIsAttempted() {
        var provider = provider();
        provider.setEmail(null);
        givenProvider(provider);

        assertThat(service.onboard(1L))
            .isEqualTo(MarketplaceOnboardingService.Outcome.FAILED);
        verifyNoInteractions(keycloakService);
    }

    // ─── Fixtures ────────────────────────────────────────────────────────────

    @Test
    void aCompetingWorkerDoesNotCreateAnotherAccount() {
        when(jobs.claim(1L)).thenReturn(null);
        assertThat(service.onboard(1L)).isEqualTo(MarketplaceOnboardingService.Outcome.DEFERRED);
        verifyNoInteractions(providerRepository, keycloakService, organizationService);
    }

    @Test
    void anUnavailableQueueDoesNotUndoAnAlreadyCommittedModeration() {
        doThrow(new RuntimeException("base indisponible")).when(jobs).enqueue(1L);
        assertThat(service.onboard(1L)).isEqualTo(MarketplaceOnboardingService.Outcome.FAILED);
        verifyNoInteractions(keycloakService);
    }

    @Test
    void aFailedAttemptIsRecordedForRetry() {
        givenProvider(provider());
        doThrow(new RuntimeException("indisponible")).when(keycloakService).createMarketplaceUser(any(), any());
        assertThat(service.onboard(1L)).isEqualTo(MarketplaceOnboardingService.Outcome.FAILED);
        verify(jobs).finish(eq(1L), anyString(), eq(MarketplaceOnboardingService.Outcome.FAILED));
    }

    @Test
    void aReplacedAttemptCannotPersistAnAccountOrDeleteTheSharedRemoteIdentity() {
        givenProvider(provider());
        when(keycloakService.createMarketplaceUser(any(), any())).thenReturn("kc-shared");
        doThrow(new IllegalStateException("Tentative remplacée")).when(jobs).requireClaim(eq(1L), anyString());
        assertThat(service.onboard(1L)).isEqualTo(MarketplaceOnboardingService.Outcome.FAILED);
        verify(userRepository, never()).save(any());
        verify(organizationService, never()).createForUser(any(), any(), any());
        verify(keycloakService, never()).deleteUser(anyString());
    }

    @Test
    void suspensionDuringExternalCreationPreventsLocalLinking() {
        var initial = provider();
        var suspended = provider();
        suspended.setStatus(com.clenzy.marketplace.model.ProviderStatus.SUSPENDED);
        when(providerRepository.findById(1L)).thenReturn(Optional.of(initial), Optional.of(suspended));
        when(keycloakService.createMarketplaceUser(any(), any())).thenReturn("kc-new");
        assertThat(service.onboard(1L)).isEqualTo(MarketplaceOnboardingService.Outcome.FAILED);
        verify(userRepository, never()).save(any());
        verify(keycloakService, never()).deleteUser(any());
    }

    private org.springframework.security.oauth2.jwt.Jwt ownerSession(String email, boolean verified) {
        return org.springframework.security.oauth2.jwt.Jwt.withTokenValue("test").header("alg", "RS256")
            .subject("kc-owner").claim("email", email).claim("email_verified", verified).build();
    }

    @Test
    void reconciliationRejectsAnUnverifiedSessionBeforeAnyLookup() {
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.reconcile(1L, ownerSession("pro@exemple.fr", false)))
            .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verifyNoInteractions(providerRepository, keycloakService, jobs);
    }

    @Test
    void reconciliationRejectsAnotherCandidatesEmail() {
        givenProvider(provider());
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.reconcile(1L, ownerSession("other@example.com", true)))
            .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verifyNoInteractions(keycloakService, jobs);
    }

    @Test
    void reconciliationDoesNotReplaceALocalIdentityEvenWithTheSameEmail() {
        givenProvider(provider());
        var existing = new User(); existing.setId(42L); existing.setKeycloakId("another-subject");
        when(userRepository.findByEmailHash(any())).thenReturn(Optional.of(existing));
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.reconcile(1L, ownerSession("pro@exemple.fr", true)))
            .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verifyNoInteractions(jobs, deliveries);
        verify(userRepository, never()).save(any());
    }

    @Test
    void reconciliationWaitsWhenAnotherWorkerOwnsTheClaim() {
        givenProvider(provider());
        assertThat(service.reconcile(1L, ownerSession("pro@exemple.fr", true)))
            .isEqualTo(MarketplaceOnboardingService.Outcome.DEFERRED);
        verify(keycloakService).verifyMarketplaceAccountOwner("kc-owner", "pro@exemple.fr");
        verify(keycloakService, never()).assignRoleToUser(any(), any());
        verify(userRepository, never()).save(any());
    }

    @Test
    void reconciliationCreatesOnlyTheLocalAccountWithoutResettingTheExistingPassword() {
        var provider = providerWithCategory("CLEANING");
        givenProvider(provider);
        when(providerRepository.findForErasure(1L)).thenReturn(Optional.of(provider));
        when(jobs.claimReconciliation(1L, "kc-owner")).thenReturn(new MarketplaceProvisioningJobs.Claim("claim", "operation"));
        when(userRepository.save(any())).thenAnswer(i -> { User user = i.getArgument(0); user.setId(99L); return user; });
        when(organizationService.createForUser(any(), any(), any())).thenReturn(organization(5L));
        assertThat(service.reconcile(1L, ownerSession("pro@exemple.fr", true)))
            .isEqualTo(MarketplaceOnboardingService.Outcome.ACCOUNT_CREATED);
        var saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(saved.capture());
        assertThat(saved.getValue().getKeycloakId()).isEqualTo("kc-owner");
        assertThat(saved.getValue().isEmailVerified()).isTrue();
        verify(keycloakService).assignRoleToUser("kc-owner", "HOUSEKEEPER");
        verify(keycloakService, never()).createMarketplaceUser(any(), any());
        verifyNoInteractions(deliveries);
        verify(jobs).finish(1L, "claim", MarketplaceOnboardingService.Outcome.ACCOUNT_CREATED);
    }

    @Test
    void reconciliationFailureLeavesTheJobRetriableWithoutClaimingSuccess() {
        givenProvider(provider());
        when(jobs.claimReconciliation(1L, "kc-owner")).thenReturn(new MarketplaceProvisioningJobs.Claim("claim", "operation"));
        doThrow(new IllegalStateException("Keycloak unavailable")).when(keycloakService).assignRoleToUser(any(), any());
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.reconcile(1L, ownerSession("pro@exemple.fr", true)))
            .isInstanceOf(IllegalStateException.class);
        verify(jobs).finish(1L, "claim", MarketplaceOnboardingService.Outcome.FAILED);
        verify(userRepository, never()).save(any());
    }

    @Test
    void reconciledOwnerCanRetryWithoutCreatingAnotherAccount() {
        var provider = provider(); provider.setUserId(42L); givenProvider(provider);
        var user = new User(); user.setId(42L); user.setKeycloakId("kc-owner"); user.setOrganizationId(7L);
        user.setStatus(com.clenzy.model.UserStatus.ACTIVE);
        when(userRepository.findByEmailHash(any())).thenReturn(Optional.of(user));
        when(userRepository.findByKeycloakId("kc-owner")).thenReturn(Optional.of(user));
        assertThat(service.reconcile(1L, ownerSession("pro@exemple.fr", true)))
            .isEqualTo(MarketplaceOnboardingService.Outcome.ALREADY_LINKED);
        verifyNoInteractions(jobs, deliveries);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(booleans = {false, true})
    void reconciliationPreservesAnExistingOrganizationOrCreatesTheMissingOne(boolean hasOrganization) {
        var provider = provider(); givenProvider(provider);
        when(providerRepository.findForErasure(1L)).thenReturn(Optional.of(provider));
        var user = new User(); user.setId(42L); user.setKeycloakId("kc-owner"); user.setEmail("pro@exemple.fr");
        user.setStatus(com.clenzy.model.UserStatus.ACTIVE);
        if (hasOrganization) user.setOrganizationId(7L);
        else when(organizationService.createForUser(any(), any(), any())).thenReturn(organization(7L));
        when(userRepository.findByEmailHash(any())).thenReturn(Optional.of(user));
        when(userRepository.findByKeycloakId("kc-owner")).thenReturn(Optional.of(user));
        when(userRepository.findForMarketplaceReconciliation(42L)).thenReturn(Optional.of(user));
        when(jobs.claimReconciliation(1L, "kc-owner")).thenReturn(new MarketplaceProvisioningJobs.Claim("claim", "operation"));
        assertThat(service.reconcile(1L, ownerSession("pro@exemple.fr", true)))
            .isEqualTo(MarketplaceOnboardingService.Outcome.EXISTING_ACCOUNT_LINKED);
        assertThat(provider.getUserId()).isEqualTo(42L);
        assertThat(provider.getHomeOrganizationId()).isEqualTo(7L);
        verify(userRepository, never()).save(any());
        verify(keycloakService, never()).assignRoleToUser(any(), any());
        if (hasOrganization) verifyNoInteractions(organizationService);
        verifyNoInteractions(deliveries);
    }

    @Test
    void automaticLinkingAlsoGivesAnOrphanLocalAccountItsOwnOrganization() {
        var provider = provider(); givenProvider(provider);
        var user = new User(); user.setId(42L); user.setKeycloakId("kc-owner"); user.setEmail("pro@exemple.fr");
        user.setStatus(com.clenzy.model.UserStatus.ACTIVE);
        when(userRepository.findByEmailHash(any())).thenReturn(Optional.of(user));
        when(userRepository.findForMarketplaceReconciliation(42L)).thenReturn(Optional.of(user));
        when(organizationService.createForUser(any(), any(), any())).thenReturn(organization(7L));
        assertThat(service.onboard(1L)).isEqualTo(MarketplaceOnboardingService.Outcome.EXISTING_ACCOUNT_LINKED);
        assertThat(provider.getHomeOrganizationId()).isEqualTo(7L);
        verify(organizationService).createForUser(user, provider.getDisplayName(), OrganizationType.INDIVIDUAL);
    }

    @Test
    void previouslyLinkedOwnerWithoutOrganizationCanRepairTheirOwnAccount() {
        var provider = provider(); provider.setUserId(42L); givenProvider(provider);
        when(providerRepository.findForErasure(1L)).thenReturn(Optional.of(provider));
        var user = new User(); user.setId(42L); user.setKeycloakId("kc-owner"); user.setEmail("pro@exemple.fr");
        user.setStatus(com.clenzy.model.UserStatus.ACTIVE);
        when(userRepository.findByEmailHash(any())).thenReturn(Optional.of(user));
        when(userRepository.findByKeycloakId("kc-owner")).thenReturn(Optional.of(user));
        when(userRepository.findForMarketplaceReconciliation(42L)).thenReturn(Optional.of(user));
        when(organizationService.createForUser(any(), any(), any())).thenReturn(organization(7L));
        var orphan = new ProviderDocument(); orphan.setUserId(42L);
        var owned = new ProviderDocument(); owned.setUserId(42L); owned.setOrganizationId(9L);
        when(documentRepository.findByUserIdOrderByCreatedAtDesc(42L)).thenReturn(List.of(orphan, owned));
        assertThat(service.reconcile(1L, ownerSession("pro@exemple.fr", true)))
            .isEqualTo(MarketplaceOnboardingService.Outcome.ALREADY_LINKED);
        assertThat(orphan.getOrganizationId()).isEqualTo(7L);
        assertThat(owned.getOrganizationId()).isEqualTo(9L);
        verify(documentRepository).saveAll(List.of(orphan));
        verifyNoInteractions(jobs, deliveries);
    }

    @Test
    void automaticLinkingCannotBypassARejectedRemoteIdentityProof() {
        givenProvider(provider());
        var user = new User(); user.setId(42L); user.setKeycloakId("kc-unverified");
        user.setStatus(com.clenzy.model.UserStatus.ACTIVE);
        when(userRepository.findByEmailHash(any())).thenReturn(Optional.of(user));
        doThrow(new org.springframework.security.access.AccessDeniedException("Email not verified"))
            .when(keycloakService).verifyMarketplaceAccountOwner("kc-unverified", "pro@exemple.fr");
        assertThat(service.onboard(1L)).isEqualTo(MarketplaceOnboardingService.Outcome.FAILED);
        verify(providerRepository, never()).save(any());
        verifyNoInteractions(organizationService, documentRepository, deliveries);
    }

    private void givenProvider(MarketplaceProvider provider) {
        when(providerRepository.findById(1L)).thenReturn(Optional.of(provider));
    }

    private static MarketplaceProvider provider() {
        var provider = new MarketplaceProvider();
        provider.setId(1L);
        provider.setStatus(com.clenzy.marketplace.model.ProviderStatus.ACTIVE);
        provider.setEmailConfirmedAt(java.time.LocalDateTime.now());
        provider.setDisplayName("Atelier Ourika");
        provider.setLegalName("ATELIER OURIKA SARL");
        provider.setContactFirstName("Yasmine");
        provider.setContactLastName("Benali");
        provider.setEmail("pro@exemple.fr");
        return provider;
    }

    private static MarketplaceProvider providerWithCategory(String code) {
        var provider = provider();
        var category = new MarketplaceServiceCategory();
        category.setCode(code);
        var offer = new MarketplaceProviderOffer();
        offer.setCategory(category);
        offer.setLabel("Ménage de départ");
        provider.getOffers().add(offer);
        return provider;
    }

    private static Organization organization(Long id) {
        var organization = new Organization();
        organization.setId(id);
        return organization;
    }
}
