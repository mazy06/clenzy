package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.security.oauth2.jwt.Jwt;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ServiceQuoteAmendmentServiceTest {
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"other-team", "unassigned", "mixed"})
    void changedOrAmbiguousAssignmentCannotCreateAnAmendment(String assignment) {
        when(scope.teamsOf(provider)).thenReturn(Set.of(8L));
        if (assignment.equals("other-team")) mission.setTeamId(99L);
        else if (assignment.equals("unassigned")) mission.setTeamId(null);
        else mission.setAssignedUser(provider);
        assertThat(service.access(1L, 99L, jwt("provider", "TECHNICIAN")).canPropose()).isFalse();
        assertThatThrownBy(() -> service.propose(1L, 99L, jwt("provider", "TECHNICIAN"), new BigDecimal("150"), "Travaux"))
                .hasMessageContaining("affectation");
        verify(amendments, never()).saveAndFlush(any());
        verifyNoInteractions(discussion, archives);
    }

    @Test void changedProviderBlocksAcceptanceBeforeChangingPriceOrPublishing() {
        var proposal = prepareAcceptance();
        mission.setTeamId(99L);
        assertThatThrownBy(() -> service.accept(4L, 7L, jwt("customer", "SUPER_ADMIN"), 0))
                .hasMessageContaining("affectation");
        assertThat(proposal.getStatus()).isEqualTo(ServiceQuoteAmendment.Status.PROPOSED);
        assertThat(mission.getEstimatedCost()).isEqualByComparingTo("120");
        verify(amendments, never()).saveAndFlush(any());
        verifyNoInteractions(discussion, archives);
    }

    @Test void teamAgreementFollowsAnActualMemberButNotAnOrganizationColleague() {
        var proposal = pendingForAccess();
        var assigned = new User(); assigned.setId(6L); assigned.setOrganizationId(7L);
        mission.proposeAssignment(assigned, null);
        when(amendments.findByQuoteIdAndOrganizationIdAndStatus(1L, 7L, ServiceQuoteAmendment.Status.PROPOSED))
                .thenReturn(List.of(proposal));
        when(scope.teamsOf(any())).thenAnswer(call -> call.getArgument(0) == assigned ? Set.of(8L) : Set.of());
        assertThat(service.access(1L, 7L, jwt("customer", "SUPER_ADMIN")).canAccept()).isTrue();
        when(scope.teamsOf(assigned)).thenReturn(Set.of(99L));
        assertThat(service.access(1L, 7L, jwt("customer", "SUPER_ADMIN")).canAccept()).isFalse();
    }

    @Test void individualAgreementCannotTransferToAnotherIndividual() {
        quote.setProviderTeamId(null); quote.setProviderUserId(provider.getId());
        var proposal = pendingForAccess();
        mission.proposeAssignment(provider, null);
        when(amendments.findByQuoteIdAndOrganizationIdAndStatus(1L, 7L, ServiceQuoteAmendment.Status.PROPOSED))
                .thenReturn(List.of(proposal));
        assertThat(service.access(1L, 7L, jwt("customer", "SUPER_ADMIN")).canAccept()).isTrue();
        var other = new User(); other.setId(6L);
        mission.proposeAssignment(other, null);
        assertThat(service.access(1L, 7L, jwt("customer", "SUPER_ADMIN")).canAccept()).isFalse();
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"propose", "reject", "withdraw"})
    void messageFailureRollsBackProposalOrClosure(String command) {
        var source = new org.springframework.jdbc.datasource.DriverManagerDataSource(
                "jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1", "sa", "");
        var jdbc = new org.springframework.jdbc.core.JdbcTemplate(source);
        jdbc.execute("CREATE TABLE amendment_state (status varchar(30))");
        String initial = command.equals("propose") ? "ABSENT" : "PROPOSED";
        jdbc.update("INSERT INTO amendment_state VALUES (?)", initial);
        when(amendments.saveAndFlush(any())).thenAnswer(call -> {
            ServiceQuoteAmendment amendment = call.getArgument(0);
            jdbc.update("UPDATE amendment_state SET status=?", amendment.getStatus().name());
            return amendment;
        });
        if (command.equals("propose") || command.equals("withdraw")) {
            when(scope.teamsOf(provider)).thenReturn(Set.of(8L));
        }
        if (!command.equals("propose")) {
            var proposal = ServiceQuoteAmendment.propose(quote, mission, provider.getId(),
                    new BigDecimal("150"), "Travaux", Instant.EPOCH);
            when(em.find(ServiceQuoteAmendment.class, 4L)).thenReturn(proposal);
            doThrow(new IllegalStateException("Message refusé")).when(discussion).closed(any(), any(), any());
        } else {
            doThrow(new IllegalStateException("Message refusé")).when(discussion).proposed(any(), any(), any());
        }
        if (command.equals("reject")) {
            var customer = new User(); customer.setId(5L);
            when(users.findByKeycloakId("customer")).thenReturn(Optional.of(customer));
        }
        var proxy = new org.springframework.aop.framework.ProxyFactory(service);
        proxy.addAdvice(new org.springframework.transaction.interceptor.TransactionInterceptor(
                new org.springframework.jdbc.datasource.DataSourceTransactionManager(source),
                new org.springframework.transaction.annotation.AnnotationTransactionAttributeSource()));
        var transactional = (ServiceQuoteAmendmentService) proxy.getProxy();
        assertThatThrownBy(() -> {
            if (command.equals("propose")) transactional.propose(1L, 99L, jwt("provider", "TECHNICIAN"), new BigDecimal("150"), "Travaux");
            else if (command.equals("withdraw")) transactional.close(4L, 99L, jwt("provider", "TECHNICIAN"), 0, true);
            else transactional.close(4L, 7L, jwt("customer", "SUPER_ADMIN"), 0, false);
        }).hasMessageContaining("Message refusé");
        assertThat(jdbc.queryForObject("SELECT status FROM amendment_state", String.class)).isEqualTo(initial);
        assertThat(mission.getEstimatedCost()).isEqualByComparingTo("120");
        verifyNoInteractions(archives);
    }

    @Test void currentPendingProposalHidesAnotherProposalAndAllowsCustomerAcceptance() {
        var proposal = pendingForAccess();
        when(scope.teamsOf(provider)).thenReturn(Set.of(8L));
        when(amendments.findByQuoteIdAndOrganizationIdAndStatus(1L, 7L, ServiceQuoteAmendment.Status.PROPOSED))
                .thenReturn(List.of(proposal));
        var providerAccess = service.access(1L, 99L, jwt("provider", "TECHNICIAN"));
        assertThat(providerAccess.canPropose()).isFalse();
        assertThat(providerAccess.canWithdrawOwn()).isTrue();
        var customerAccess = service.access(1L, 7L, jwt("customer", "SUPER_ADMIN"));
        assertThat(customerAccess.canAccept()).isTrue();
        assertThat(customerAccess.canDecide()).isTrue();
        verify(amendments, never()).saveAndFlush(any());
    }

    @Test void staleProposalCanBeReplacedButCannotBeAcceptedFromPreview() {
        var proposal = pendingForAccess();
        mission.setVersion(mission.getVersion() + 1);
        when(scope.teamsOf(provider)).thenReturn(Set.of(8L));
        when(amendments.findByQuoteIdAndOrganizationIdAndStatus(1L, 7L, ServiceQuoteAmendment.Status.PROPOSED))
                .thenReturn(List.of(proposal));
        assertThat(service.access(1L, 99L, jwt("provider", "TECHNICIAN")).canPropose()).isTrue();
        var customerAccess = service.access(1L, 7L, jwt("customer", "SUPER_ADMIN"));
        assertThat(customerAccess.canAccept()).isFalse();
        assertThat(customerAccess.canDecide()).isTrue();
        assertThat(proposal.getStatus()).isEqualTo(ServiceQuoteAmendment.Status.PROPOSED);
        verify(amendments, never()).saveAndFlush(any());
    }

    private ServiceQuoteAmendment pendingForAccess() {
        var customer = new User(); customer.setId(5L);
        when(users.findByKeycloakId("customer")).thenReturn(Optional.of(customer));
        return ServiceQuoteAmendment.propose(quote, mission, provider.getId(),
                new BigDecimal("150"), "Travaux", Instant.EPOCH);
    }

    @Test void customerWithoutPendingProposalHasNoAcceptanceAction() {
        var customer = new User(); customer.setId(5L);
        when(users.findByKeycloakId("customer")).thenReturn(Optional.of(customer));
        var access = service.access(1L, 7L, jwt("customer", "SUPER_ADMIN"));
        assertThat(access.canAccept()).isFalse();
        assertThat(access.canDecide()).isTrue();
    }

    @Test void changingToCustomerRoleDoesNotAllowAcceptingOwnProposal() {
        var customer = new User(); customer.setId(5L);
        when(users.findByKeycloakId("customer")).thenReturn(Optional.of(customer));
        var proposal = ServiceQuoteAmendment.propose(quote, mission, customer.getId(),
                new BigDecimal("150"), "Travaux", Instant.EPOCH);
        when(amendments.findByQuoteIdAndOrganizationIdAndStatus(1L, 7L, ServiceQuoteAmendment.Status.PROPOSED))
                .thenReturn(List.of(proposal));
        assertThat(service.access(1L, 7L, jwt("customer", "SUPER_ADMIN")).canAccept()).isFalse();
    }

    @Test void linkedRequestCannotCreateAnUnacceptableProposalOrChangeHistory() {
        assertUnavailableProposal(m -> m.setServiceRequest(new ServiceRequest()));
    }
    @Test void inconsistentPriceCannotCreateAnUnacceptableProposalOrChangeHistory() {
        assertUnavailableProposal(m -> m.setEstimatedCost(new BigDecimal("121")));
    }
    @Test void inconsistentCurrencyCannotCreateAnUnacceptableProposalOrChangeHistory() {
        assertUnavailableProposal(m -> m.setCurrency("USD"));
    }
    private void assertUnavailableProposal(java.util.function.Consumer<Intervention> change) {
        when(scope.teamsOf(provider)).thenReturn(Set.of(8L));
        change.accept(mission);
        assertThat(service.access(1L, 7L, jwt("provider", "TECHNICIAN")).canPropose()).isFalse();
        assertThatThrownBy(() -> service.propose(1L, 7L, jwt("provider", "TECHNICIAN"),
                new BigDecimal("150"), "Travaux")).isInstanceOf(IllegalStateException.class);
        verify(amendments, never()).saveAndFlush(any());
        verify(amendments, never()).findByQuoteIdAndOrganizationIdAndStatus(any(), any(), any());
        verifyNoInteractions(archives, discussion);
    }
    @Test void requestLinkedAfterProposalBlocksAcceptanceAndKeepsProposalPending() {
        var proposal = prepareAcceptance();
        mission.setServiceRequest(new ServiceRequest());
        assertThat(service.access(1L, 7L, jwt("customer", "SUPER_ADMIN")).canAccept()).isFalse();
        assertThatThrownBy(() -> service.accept(4L, 7L, jwt("customer", "SUPER_ADMIN"), 0))
                .hasMessageContaining("réconciliation");
        assertThat(proposal.getStatus()).isEqualTo(ServiceQuoteAmendment.Status.PROPOSED);
        assertThat(mission.getEstimatedCost()).isEqualByComparingTo("120");
        verifyNoInteractions(archives, discussion);
    }

    @Test void libraryScopeUsesActualTeamsAndAuthenticatedIdentity() {
        when(scope.teamsOf(provider)).thenReturn(Set.of(8L));
        var access = service.libraryAccess(99L, jwt("provider", "TECHNICIAN"));
        assertThat(access.actorId()).isEqualTo(3L);
        assertThat(access.organizationId()).isEqualTo(99L);
        assertThat(access.teamIds()).containsExactly(8L);
        assertThat(access.staff()).isFalse();
        assertThat(access.owner()).isFalse();
        assertThatThrownBy(() -> service.libraryAccess(7L, null))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }
    @Test void documentKeepsAcceptedTermsAfterMissionPriceChanges() {
        var proposal = prepareAcceptance();
        service.accept(4L, 7L, jwt("customer", "SUPER_ADMIN"), 0);
        mission.setEstimatedCost(new BigDecimal("999"));
        var document = service.acceptedDocument(4L, 7L, jwt("customer", "SUPER_ADMIN"));
        assertThat(document.originalAmount()).isEqualByComparingTo("120");
        assertThat(document.proposedAmount()).isEqualByComparingTo("150");
        assertThat(document.decidedAt()).isEqualTo(proposal.getDecidedAt());
        assertThat(document.reason()).isEqualTo("Travaux");
        assertThatThrownBy(() -> service.acceptedDocument(4L, 9L, jwt("customer", "SUPER_ADMIN")))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }

    @Test void pendingDocumentIsUnavailableAndOtherTeamHasNoAccess() {
        prepareAcceptance();
        assertThatThrownBy(() -> service.acceptedDocument(4L, 7L, jwt("customer", "SUPER_ADMIN")))
                .hasMessageContaining("accepté");
        when(scope.teamsOf(provider)).thenReturn(Set.of(99L));
        assertThatThrownBy(() -> service.acceptedDocument(4L, 7L, jwt("provider", "TECHNICIAN")))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }

    @Test void actualProviderTeamCanReadAcceptedDocumentFromAnotherOrganization() {
        prepareAcceptance();
        service.accept(4L, 7L, jwt("customer", "SUPER_ADMIN"), 0);
        when(scope.teamsOf(provider)).thenReturn(Set.of(8L));
        assertThat(service.acceptedDocument(4L, 99L, jwt("provider", "TECHNICIAN")).proposedAmount())
                .isEqualByComparingTo("150");
        when(scope.teamsOf(provider)).thenReturn(Set.of(99L));
        assertThatThrownBy(() -> service.acceptedDocument(4L, 7L, jwt("provider", "TECHNICIAN")))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }

    private ServiceQuoteAmendment prepareAcceptance() {
        mission.setEstimatedCost(new BigDecimal("120"));
        var proposal = ServiceQuoteAmendment.propose(quote, mission, provider.getId(),
                new BigDecimal("150"), "Travaux", Instant.EPOCH);
        org.springframework.test.util.ReflectionTestUtils.setField(proposal, "id", 4L);
        when(em.find(ServiceQuoteAmendment.class, 4L)).thenReturn(proposal);
        var customer = new User(); customer.setId(5L);
        when(users.findByKeycloakId("customer")).thenReturn(Optional.of(customer));
        return proposal;
    }

    @Test void acceptanceUpdatesMissionAndPostsHistoryWithoutChangingQuote() {
        var proposal = prepareAcceptance();
        service.accept(4L, 7L, jwt("customer", "SUPER_ADMIN"), 0);
        assertThat(proposal.getStatus()).isEqualTo(ServiceQuoteAmendment.Status.ACCEPTED);
        assertThat(proposal.getDecidedBy()).isEqualTo(5L);
        assertThat(mission.getEstimatedCost()).isEqualByComparingTo("150");
        assertThat(quote.getAmount()).isEqualByComparingTo("120");
        var order = inOrder(em, amendments, archives, discussion);
        order.verify(em).refresh(mission, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        order.verify(amendments).saveAndFlush(proposal);
        order.verify(archives).request(4L, 7L);
        order.verify(discussion).accepted(quote, proposal, "customer");
        assertThatThrownBy(() -> service.accept(4L, 7L, jwt("customer", "SUPER_ADMIN"), 0))
                .hasMessageContaining("proposition a changé");
        verify(discussion, times(1)).accepted(any(), any(), any());
        verify(archives, times(1)).request(4L, 7L);
    }

    @Test void archiveRequestFailureAbortsAcceptanceBeforePublishingMessage() {
        prepareAcceptance();
        doThrow(new IllegalStateException("Archivage indisponible")).when(archives).request(4L, 7L);
        assertThatThrownBy(() -> service.accept(4L, 7L, jwt("customer", "SUPER_ADMIN"), 0))
                .hasMessage("Archivage indisponible");
        verifyNoInteractions(discussion);
    }

    @Test void staleMissionPreventsAcceptance() {
        var proposal = prepareAcceptance();
        mission.setVersion(mission.getVersion() + 1);
        assertThatThrownBy(() -> service.accept(4L, 7L, jwt("customer", "SUPER_ADMIN"), 0))
                .hasMessageContaining("proposition a changé");
        assertThat(proposal.getStatus()).isEqualTo(ServiceQuoteAmendment.Status.PROPOSED);
        assertThat(mission.getEstimatedCost()).isEqualByComparingTo("120");
        verifyNoInteractions(discussion);
    }

    @Test void paymentPendingBeforeSessionCreationPreventsAcceptance() {
        var proposal = prepareAcceptance();
        when(payments.hasRecordedInterventionPayment(7L, 2L)).thenReturn(true);
        assertThatThrownBy(() -> service.accept(4L, 7L, jwt("customer", "SUPER_ADMIN"), 0))
                .hasMessageContaining("paiement est déjà engagé");
        assertThat(proposal.getStatus()).isEqualTo(ServiceQuoteAmendment.Status.PROPOSED);
        verifyNoInteractions(discussion);
    }

    @Test void otherOrganizationAndAuthorCannotAccept() {
        prepareAcceptance();
        assertThatThrownBy(() -> service.accept(4L, 9L, jwt("customer", "SUPER_ADMIN"), 0))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        assertThatThrownBy(() -> service.accept(4L, 7L, jwt("provider", "SUPER_ADMIN"), 0))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verifyNoInteractions(discussion);
    }

    @Test void discussionFailurePropagatesSoDecisionTransactionCannotCommit() {
        prepareAcceptance();
        doThrow(new IllegalStateException("Fil indisponible")).when(discussion).accepted(any(), any(), any());
        assertThatThrownBy(() -> service.accept(4L, 7L, jwt("customer", "SUPER_ADMIN"), 0))
                .hasMessageContaining("Fil indisponible");
    }

    @Test void discussionFailureRollsBackPersistedDecisionAndMissionAmount() {
        prepareAcceptance();
        var source = new org.springframework.jdbc.datasource.DriverManagerDataSource(
                "jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1", "sa", "");
        var jdbc = new org.springframework.jdbc.core.JdbcTemplate(source);
        jdbc.execute("CREATE TABLE agreement_state (status varchar(30), amount decimal(12,2))");
        jdbc.execute("INSERT INTO agreement_state VALUES ('PROPOSED',120)");
        when(amendments.saveAndFlush(any())).thenAnswer(call -> {
            assertThat(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()).isTrue();
            ServiceQuoteAmendment proposal = call.getArgument(0);
            jdbc.update("UPDATE agreement_state SET status=?, amount=?", proposal.getStatus().name(), mission.getEstimatedCost());
            return proposal;
        });
        doThrow(new IllegalStateException("Message refusé")).when(discussion).accepted(any(), any(), any());
        var proxy = new org.springframework.aop.framework.ProxyFactory(service);
        proxy.addAdvice(new org.springframework.transaction.interceptor.TransactionInterceptor(
                new org.springframework.jdbc.datasource.DataSourceTransactionManager(source),
                new org.springframework.transaction.annotation.AnnotationTransactionAttributeSource()));
        var transactional = (ServiceQuoteAmendmentService) proxy.getProxy();
        assertThatThrownBy(() -> transactional.accept(4L, 7L, jwt("customer", "SUPER_ADMIN"), 0))
                .hasMessageContaining("Message refusé");
        assertThat(jdbc.queryForObject("SELECT status FROM agreement_state", String.class)).isEqualTo("PROPOSED");
        assertThat(jdbc.queryForObject("SELECT amount FROM agreement_state", BigDecimal.class)).isEqualByComparingTo("120");
    }
    @Mock EntityManager em;
    @Mock ServiceQuoteAmendmentRepository amendments;
    @Mock UserRepository users;
    @Mock QuoteDiscussionScope scope;
    @Mock PaymentTransactionRepository payments;
    @Mock ServiceQuoteAmendmentDiscussion discussion;
    @Mock ServiceQuoteAmendmentArchives archives;
    ServiceQuoteAmendmentService service;
    ServiceQuote quote;
    Intervention mission;
    User provider;
    Jwt jwt(String subject, String role) {
        return Jwt.withTokenValue("test").header("alg", "none").subject(subject)
                .claim("realm_access", Map.of("roles", List.of(role))).build();
    }
    @BeforeEach void setup() {
        service = new ServiceQuoteAmendmentService(em, amendments, users, scope, Clock.fixed(Instant.EPOCH, ZoneOffset.UTC),
                new InterventionPaymentCoordination(em, payments, mock(ServiceQuoteRepository.class), mock(CurrencyConverterService.class)), new ServiceQuoteAgreementService(amendments), discussion, archives);
        quote = new ServiceQuote(); quote.setId(1L); quote.setOrganizationId(7L); quote.setInterventionId(2L);
        quote.setAmount(new BigDecimal("120")); quote.setStatus(ServiceQuote.Status.APPROVED); quote.setProviderTeamId(8L);
        mission = new Intervention(); mission.setEstimatedCost(new BigDecimal("120")); mission.setId(2L); mission.setOrganizationId(7L); mission.setStatus(InterventionStatus.PENDING);
        mission.setTeamId(8L);
        provider = new User(); provider.setId(3L);
        lenient().when(em.find(ServiceQuote.class, 1L)).thenReturn(quote);
        lenient().when(em.find(Intervention.class, 2L)).thenReturn(mission);
        lenient().when(users.findByKeycloakId("provider")).thenReturn(Optional.of(provider));
        lenient().when(amendments.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));
    }
    @Test void currentTeamMemberCanProposeAcrossOrganizations() {
        when(scope.teamsOf(provider)).thenReturn(Set.of(8L));
        var proposal = service.propose(1L, 9L, jwt("provider", "TECHNICIAN"), new BigDecimal("150"), "Travaux");
        assertThat(proposal.getOrganizationId()).isEqualTo(7L);
        assertThat(quote.getAmount()).isEqualByComparingTo("120");
        verify(amendments).saveAndFlush(proposal);
        verify(discussion).proposed(quote, proposal, "provider");
    }
    @Test void persistedPaymentBlocksProposalBeforeSessionIdIsAvailable() {
        when(scope.teamsOf(provider)).thenReturn(Set.of(8L));
        when(payments.hasRecordedInterventionPayment(7L, 2L)).thenReturn(true);
        assertThat(mission.getStripeSessionId()).isNull();
        assertThatThrownBy(() -> service.propose(1L, 9L, jwt("provider", "TECHNICIAN"),
                new BigDecimal("150"), "Travaux")).hasMessageContaining("paiement est déjà engagé");
        verifyNoInteractions(amendments);
        var order = inOrder(em, payments);
        order.verify(em).refresh(mission, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        order.verify(payments).hasRecordedInterventionPayment(7L, 2L);
    }
    @Test void anotherTeamCannotReadOrPropose() {
        when(scope.teamsOf(provider)).thenReturn(Set.of(9L));
        assertThatThrownBy(() -> service.propose(1L, 7L, jwt("provider", "TECHNICIAN"), new BigDecimal("150"), "Travaux"))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        assertThatThrownBy(() -> service.list(1L, 7L, jwt("provider", "TECHNICIAN")))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        assertThatThrownBy(() -> service.currentAgreement(1L, 7L, jwt("provider", "TECHNICIAN")))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verifyNoInteractions(amendments);
    }
    @Test void currentTeamMemberCanReadAgreementAcrossOrganizations() {
        when(scope.teamsOf(provider)).thenReturn(Set.of(8L));
        var result = service.currentAgreement(1L, 9L, jwt("provider", "TECHNICIAN"));
        assertThat(result.agreedAmount()).isEqualByComparingTo("120");
        assertThat(result.originalAmount()).isEqualByComparingTo("120");
        var access = service.access(1L, 9L, jwt("provider", "TECHNICIAN"));
        assertThat(access.canPropose()).isTrue();
        assertThat(access.canWithdrawOwn()).isTrue();
        assertThat(access.canDecide()).isFalse();
        assertThat(access.actorId()).isEqualTo(provider.getId());
    }
    @Test void engagedPaymentHidesPriceActionsButKeepsRefusalAndWithdrawalRights() {
        var actor = new User(); actor.setId(5L);
        when(users.findByKeycloakId("customer")).thenReturn(Optional.of(actor));
        when(payments.hasRecordedInterventionPayment(7L, 2L)).thenReturn(true);
        var customer = service.access(1L, 7L, jwt("customer", "SUPER_ADMIN"));
        assertThat(customer.canAccept()).isFalse();
        assertThat(customer.canDecide()).isTrue();
        when(scope.teamsOf(provider)).thenReturn(Set.of(8L));
        var providerAccess = service.access(1L, 9L, jwt("provider", "TECHNICIAN"));
        assertThat(providerAccess.canPropose()).isFalse();
        assertThat(providerAccess.canWithdrawOwn()).isTrue();
    }
    @Test void depositAgreementCannotEnterSimplePriceAmendmentFlow() {
        when(scope.teamsOf(provider)).thenReturn(Set.of(8L));
        quote.setDepositAmount(BigDecimal.TEN);
        assertThatThrownBy(() -> service.propose(1L, 9L, jwt("provider", "TECHNICIAN"), new BigDecimal("150"), "Travaux"))
                .hasMessageContaining("acompte");
        verify(amendments, never()).saveAndFlush(any());
        verify(amendments, never()).findByQuoteIdAndOrganizationIdAndStatus(any(), any(), any());
    }
    @Test void pendingProposalPreventsAnotherOne() {
        when(scope.teamsOf(provider)).thenReturn(Set.of(8L));
        when(amendments.existsByQuoteIdAndStatus(1L, ServiceQuoteAmendment.Status.PROPOSED)).thenReturn(true);
        assertThatThrownBy(() -> service.propose(1L, 9L, jwt("provider", "TECHNICIAN"), new BigDecimal("150"), "Travaux"))
                .hasMessageContaining("déjà en attente");
        verify(amendments, never()).saveAndFlush(any());
    }
    @Test void authorCanWithdrawButCannotRejectOwnProposal() {
        when(scope.teamsOf(provider)).thenReturn(Set.of(8L));
        var proposal = ServiceQuoteAmendment.propose(quote, mission, 3L, new BigDecimal("150"), "Travaux", Instant.EPOCH);
        when(em.find(ServiceQuoteAmendment.class, 4L)).thenReturn(proposal);
        assertThatThrownBy(() -> service.close(4L, 7L, jwt("provider", "SUPER_ADMIN"), 0, false))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        service.close(4L, 9L, jwt("provider", "TECHNICIAN"), 0, true);
        assertThat(proposal.getStatus()).isEqualTo(ServiceQuoteAmendment.Status.WITHDRAWN);
        assertThat(proposal.getDecidedBy()).isEqualTo(3L);
        verify(discussion).closed(quote, proposal, "provider");
    }
    @Test void staleVersionCannotWithdrawProposal() {
        when(scope.teamsOf(provider)).thenReturn(Set.of(8L));
        var proposal = ServiceQuoteAmendment.propose(quote, mission, 3L, new BigDecimal("150"), "Travaux", Instant.EPOCH);
        when(em.find(ServiceQuoteAmendment.class, 4L)).thenReturn(proposal);
        assertThatThrownBy(() -> service.close(4L, 9L, jwt("provider", "TECHNICIAN"), 1, true)).hasMessageContaining("déjà changé");
        assertThat(proposal.getStatus()).isEqualTo(ServiceQuoteAmendment.Status.PROPOSED);
        verify(amendments, never()).saveAndFlush(any());
    }

    @Test void onlyCustomerOrganizationCanRejectAndDecisionCannotBeRepeated() {
        var manager = new User(); manager.setId(5L);
        when(users.findByKeycloakId("manager")).thenReturn(Optional.of(manager));
        var proposal = ServiceQuoteAmendment.propose(quote, mission, 3L, new BigDecimal("150"), "Travaux", Instant.EPOCH);
        when(em.find(ServiceQuoteAmendment.class, 4L)).thenReturn(proposal);
        assertThatThrownBy(() -> service.close(4L, 99L, jwt("manager", "SUPER_MANAGER"), 0, false))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        service.close(4L, 7L, jwt("manager", "SUPER_MANAGER"), 0, false);
        assertThat(proposal.getStatus()).isEqualTo(ServiceQuoteAmendment.Status.REJECTED);
        assertThat(proposal.getDecidedBy()).isEqualTo(5L);
        assertThatThrownBy(() -> service.close(4L, 7L, jwt("manager", "SUPER_MANAGER"), 0, false))
                .hasMessageContaining("déjà changé");
        verify(amendments).saveAndFlush(proposal);
        verify(discussion, times(1)).closed(quote, proposal, "manager");
    }

    @Test void staleProposalIsRetainedAsObsoleteBeforeCreatingReplacement() {
        when(scope.teamsOf(provider)).thenReturn(Set.of(8L));
        var old = ServiceQuoteAmendment.propose(quote, mission, 3L, new BigDecimal("150"), "Ancien périmètre", Instant.EPOCH);
        mission.setVersion(1L);
        when(amendments.findByQuoteIdAndOrganizationIdAndStatus(1L, 7L, ServiceQuoteAmendment.Status.PROPOSED))
                .thenReturn(List.of(old));
        var replacement = service.propose(1L, 9L, jwt("provider", "TECHNICIAN"), new BigDecimal("160"), "Nouveau périmètre");
        assertThat(old.getStatus()).isEqualTo(ServiceQuoteAmendment.Status.OBSOLETE);
        assertThat(old.getProposedAmount()).isEqualByComparingTo("150");
        assertThat(replacement.getBaseInterventionVersion()).isEqualTo(1L);
        assertThat(replacement.getStatus()).isEqualTo(ServiceQuoteAmendment.Status.PROPOSED);
        var order = inOrder(amendments);
        order.verify(amendments).saveAndFlush(old);
        order.verify(amendments).saveAndFlush(replacement);
        assertThat(quote.getAmount()).isEqualByComparingTo("120");
    }

    @Test void invalidReplacementDoesNotCloseStaleProposal() {
        when(scope.teamsOf(provider)).thenReturn(Set.of(8L));
        var old = ServiceQuoteAmendment.propose(quote, mission, 3L, new BigDecimal("150"), "Travaux", Instant.EPOCH);
        mission.setVersion(1L);
        assertThatThrownBy(() -> service.propose(1L, 9L, jwt("provider", "TECHNICIAN"), new BigDecimal("120"), "Travaux"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(old.getStatus()).isEqualTo(ServiceQuoteAmendment.Status.PROPOSED);
        verify(amendments, never()).saveAndFlush(any());
        verify(amendments, never()).findByQuoteIdAndOrganizationIdAndStatus(any(), any(), any());
    }
}
