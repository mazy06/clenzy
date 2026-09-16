package com.clenzy.service.assignment;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import java.math.BigDecimal;
import java.time.*;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class AssignmentQuoteServiceTest {
    final ServiceAssignmentService assignments=mock(ServiceAssignmentService.class);
    final AssignmentProposalStore proposals=mock(AssignmentProposalStore.class);
    final ServiceQuoteRepository quotes=mock(ServiceQuoteRepository.class);
    final UserRepository users=mock(UserRepository.class);
    final AcceptedServiceRequestConverter converter=mock(AcceptedServiceRequestConverter.class);
    final JdbcTemplate db=mock(JdbcTemplate.class);
    final Instant now=Instant.parse("2026-09-16T10:00:00Z");
    final Jwt jwt=Jwt.withTokenValue("test").header("alg","none").subject("provider").build();
    final AssignmentQuoteService service=new AssignmentQuoteService(assignments,proposals,quotes,users,converter,db,Clock.fixed(now,ZoneOffset.UTC));
    ServiceRequest need;
    AssignmentProposalStore.Proposal proposal;
    @BeforeEach void setup() {
        need=new ServiceRequest(); need.setId(1L); need.setOrganizationId(2L); need.setAssignmentPhase("PROPOSED"); need.setAssignmentCycle(1);
        need.setAssignedToType("user"); need.setAssignedToId(9L); need.setStatus(RequestStatus.ASSIGNED);
        when(assignments.lock(1L)).thenReturn(need);
        proposal=new AssignmentProposalStore.Proposal(3L,1L,2L,1,"user",9L,"AUTOMATIC","PENDING",now.minusSeconds(60),now.plusSeconds(60),null,null);
        when(proposals.get(3L)).thenReturn(Optional.of(proposal));
    }
    AssignmentQuoteService.Offer offer() { return new AssignmentQuoteService.Offer(new BigDecimal("120"),"MAD",LocalDate.of(2026,9,20),"Prestation complète"); }
    @Test void submittingAQuoteUsesTheExistingCommercialDossierWithoutCreatingAnExecution() {
        var user=new User(); user.setId(9L); user.setFirstName("Jean"); user.setLastName("Martin");
        when(assignments.currentUser(jwt)).thenReturn(9L); when(users.findById(9L)).thenReturn(Optional.of(user));
        when(quotes.saveAndFlush(any())).thenAnswer(call -> { ServiceQuote q=call.getArgument(0); q.setId(4L); return q; });
        assertThat(service.submit(1L,3L,offer(),jwt)).isEqualTo(4L);
        verify(assignments).requireRecipient(proposal,jwt);
        verify(quotes).saveAndFlush(argThat(q -> q.getServiceRequestId().equals(1L) && q.getAssignmentProposalId().equals(3L) && q.getInterventionId()==null && q.getStatus()==ServiceQuote.Status.RECEIVED));
        assertThat(need.getAssignmentPhase()).isEqualTo("QUOTED");
        assertThat(need.getAssignedToId()).isNull();
        verifyNoInteractions(converter);
    }
    @Test void aReplannedNeedRefusesAnOldProviderQuote() {
        need.setAssignmentCycle(2);
        assertThatThrownBy(() -> service.submit(1L,3L,offer(),jwt)).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(quotes,converter);
    }
    @Test void invalidAmountCannotBePersisted() {
        var invalid=new AssignmentQuoteService.Offer(new BigDecimal("-1"),"MAD",LocalDate.of(2026,9,20),"");
        assertThatThrownBy(() -> service.submit(1L,3L,invalid,jwt)).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(quotes,converter);
    }
    @Test void withdrawalOrReplanningPreventsApproval() {
        var quote=new ServiceQuote(); quote.setServiceRequestId(1L); quote.setAssignmentProposalId(3L); quote.setOrganizationId(2L);
        need.setAssignmentPhase("MANUAL");
        assertThatThrownBy(() -> service.prepareAcceptance(quote)).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(converter);
    }
}
