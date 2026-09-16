package com.clenzy.service.assignment;

import com.clenzy.model.ServiceRequest;
import com.clenzy.repository.ServiceRequestRepository;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class AssignmentCardQueryTest {
    SingleConnectionDataSource source;
    JdbcTemplate db;
    AssignmentCardQuery query;
    ServiceRequestRepository requests;
    AssignmentCommercialTerms commercial;
    @BeforeEach void setup() {
        source=new SingleConnectionDataSource("jdbc:h2:mem:"+UUID.randomUUID()+";MODE=PostgreSQL","sa","",true);
        db=new JdbcTemplate(source);
        db.execute("CREATE TABLE service_requests(id bigint,organization_id bigint,assigned_to_type varchar,assigned_to_id bigint,assignment_cycle integer,status varchar,assignment_phase varchar,converted_intervention_id bigint)");
        db.execute("CREATE TABLE team_members(team_id bigint,user_id bigint)");
        db.execute("CREATE TABLE service_assignment_proposals(id bigint,request_id bigint,organization_id bigint,cycle integer,target_type varchar,target_id bigint,origin varchar,status varchar,created_at timestamp,expires_at timestamp,responded_at timestamp,reason varchar,agreed_amount decimal,agreed_currency varchar,tariff_id bigint)");
        db.execute("CREATE TABLE marketplace_quote_requests(id bigint,service_request_cycle integer)");
        db.execute("CREATE TABLE service_quotes(id bigint,service_request_id bigint,organization_id bigint,assignment_proposal_id bigint,marketplace_request_id bigint,provider_user_id bigint,provider_team_id bigint,status varchar,amount decimal,currency varchar,created_at timestamp)");
        db.execute("INSERT INTO service_requests VALUES(1,2,'user',9,1,'ASSIGNED','PROPOSED',null),(2,2,'user',10,1,'ASSIGNED','PROPOSED',null)");
        db.execute("INSERT INTO service_assignment_proposals VALUES(3,1,2,1,'user',9,'AUTOMATIC','PENDING',CURRENT_TIMESTAMP,DATEADD('MINUTE',40,CURRENT_TIMESTAMP),null,null,80,'MAD',7)");
        requests=mock(ServiceRequestRepository.class);
        when(requests.findAllById(any())).thenAnswer(call->{
            var rows=new ArrayList<ServiceRequest>();
            for (Long id:(Iterable<Long>)call.getArgument(0)) {
                var need=new ServiceRequest(); need.setId(id); need.setOrganizationId(2L); rows.add(need);
            }
            return rows;
        });
        commercial=mock(AssignmentCommercialTerms.class);
        query=new AssignmentCardQuery(new NamedParameterJdbcTemplate(db),requests,new AssignmentProposalStore(db),commercial);
    }
    @AfterEach void close() { source.destroy(); }
    @Test void recipientGetsOnlyTheirOwnRequestAndSnapshot() {
        var cards=query.cards(9L,List.of(1L,2L));
        assertThat(cards).hasSize(1);
        assertThat(cards.getFirst().requestId()).isEqualTo(1L);
        assertThat(cards.getFirst().proposal().id()).isEqualTo(3L);
        assertThat(cards.getFirst().offeredPrice().currency()).isEqualTo("MAD");
    }
    @Test void competitorQuoteIsNeverReturnedAndOwnQuoteSuppressesAcceptance() {
        db.execute("INSERT INTO service_quotes VALUES(1,1,2,null,null,10,null,'RECEIVED',999,'EUR',CURRENT_TIMESTAMP)");
        assertThat(query.cards(9L,List.of(1L)).getFirst().quote()).isFalse();
        db.execute("INSERT INTO service_quotes VALUES(2,1,2,3,null,9,null,'RECEIVED',120,'MAD',CURRENT_TIMESTAMP)");
        var card=query.cards(9L,List.of(1L)).getFirst();
        assertThat(card.quote()).isTrue();
        assertThat(card.price().amount()).isEqualByComparingTo("120");
        assertThat(card.proposal()).isNull();
    }
    @Test void obsoleteCyclesAndConvertedRequestsHaveNoAcceptance() {
        db.execute("UPDATE service_requests SET assignment_cycle=2 WHERE id=1");
        assertThat(query.cards(9L,List.of(1L)).getFirst().proposal()).isNull();
        db.execute("UPDATE service_requests SET assignment_cycle=1,converted_intervention_id=55 WHERE id=1");
        assertThat(query.cards(9L,List.of(1L)).getFirst().proposal()).isNull();
    }
    @Test void unauthorizedUserCannotReadAnyCard() {
        assertThat(query.cards(42L,List.of(1L,2L))).isEmpty();
        verifyNoInteractions(requests);
    }
    @Test void teamProposalIsVisibleOnlyToItsMembers() {
        db.execute("UPDATE service_requests SET assigned_to_type='team',assigned_to_id=55 WHERE id=1");
        db.execute("UPDATE service_assignment_proposals SET target_type='team',target_id=55 WHERE id=3");
        db.execute("INSERT INTO team_members VALUES(55,9),(56,10)");
        assertThat(query.cards(9L,List.of(1L)).getFirst().proposal().id()).isEqualTo(3L);
        assertThat(query.cards(10L,List.of(1L))).isEmpty();
    }
    @Test void limitsBatchToTwenty() {
        assertThatThrownBy(()->query.cards(9L,Collections.nCopies(21,1L))).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void aMissingProviderRateDoesNotPreventAReadOnlyEstimate() {
        db.execute("DELETE FROM service_assignment_proposals");
        when(commercial.suggestion(any())).thenReturn(new AssignmentCommercialTerms.Terms(new java.math.BigDecimal("75"),"MAD",null));
        var card=query.cards(9L,List.of(1L)).getFirst();
        assertThat(card.price()).isNull();
        assertThat(card.estimate()).isEqualByComparingTo("75");
        assertThat(card.estimateCurrency()).isEqualTo("MAD");
        assertThat(card.proposal()).isNull();
    }
}
