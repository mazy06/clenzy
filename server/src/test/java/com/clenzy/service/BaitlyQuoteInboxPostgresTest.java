package com.clenzy.service;

import com.clenzy.model.ContactThread;
import com.clenzy.repository.ContactThreadRepository;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Exécute le vrai SQL PostgreSQL dans un schéma jetable, sans toucher aux données métier. */
@EnabledIfEnvironmentVariable(named="BAITLY_TEST_JDBC", matches="jdbc:postgresql:.*")
class BaitlyQuoteInboxPostgresTest {
    SingleConnectionDataSource source;
    JdbcTemplate db;
    BaitlyQuoteInbox inbox;
    ServiceQuoteAmendmentService parties;
    QuoteThreadAccessPolicy threadAccess;
    String schema;

    @BeforeEach void setup() {
        source = new SingleConnectionDataSource(System.getenv("BAITLY_TEST_JDBC"),
            System.getenv().getOrDefault("BAITLY_TEST_USER","postgres"), System.getenv().getOrDefault("BAITLY_TEST_PASSWORD",""), true);
        db = new JdbcTemplate(source);
        schema = "baitly_quote_inbox_" + UUID.randomUUID().toString().replace("-", "");
        db.execute("CREATE SCHEMA " + schema);
        db.execute("SET search_path TO " + schema);
        db.execute("CREATE TABLE properties(id bigint PRIMARY KEY, organization_id bigint, owner_id bigint, name text, city text DEFAULT 'Ville')");
        db.execute("INSERT INTO properties(id,organization_id,owner_id,name) VALUES (1,7,5,'Villa'),(2,7,6,'Autre'),(3,9,5,'Externe')");
        db.execute("CREATE TABLE interventions(id bigint PRIMARY KEY, organization_id bigint, property_id bigint, title text)");
        db.execute("INSERT INTO interventions VALUES (1,7,1,'Réparation'),(2,7,2,'Autre intervention'),(3,9,3,'Mission externe')");
        db.execute("CREATE TABLE service_requests(id bigint PRIMARY KEY, organization_id bigint, property_id bigint, user_id bigint, title text)");
        db.execute("INSERT INTO service_requests VALUES (1,7,1,5,'Besoin sans mission')");
        db.execute("CREATE TABLE marketplace_providers(id bigint PRIMARY KEY, user_id bigint, display_name text)");
        db.execute("INSERT INTO marketplace_providers VALUES (50,3,'Prestataire'),(51,4,'Concurrent')");
        db.execute("CREATE TABLE marketplace_quote_requests(id bigint PRIMARY KEY, requester_organization_id bigint, property_id bigint, requested_by_user_id bigint, marketplace_provider_id bigint, provider_team_id bigint, service_request_id bigint, intervention_id bigint, title text, status text, quoted_amount numeric, quoted_currency text, quote_valid_until date, created_at timestamp)");
        db.execute("""
            INSERT INTO marketplace_quote_requests(id,requester_organization_id,property_id,requested_by_user_id,marketplace_provider_id,title,status,quoted_amount,quoted_currency,created_at) VALUES
            (1,7,1,5,50,'Catalogue lié','ACCEPTED',200,'EUR','2026-10-01'),
            (2,7,1,5,50,'Demande seule','SENT',NULL,NULL,'2026-10-02'),
            (3,9,3,5,51,'Autre organisation','QUOTED',60,'EUR','2026-10-03'),
            (4,7,2,6,51,'Autre propriétaire','QUOTED',60,'EUR','2026-10-04'),
            (5,9,3,5,50,'Prestataire externe','QUOTED',70,'EUR','2026-10-05'),
            (6,7,NULL,5,51,'Sans logement','SENT',NULL,NULL,'2026-10-06')
            """);
        db.execute("CREATE TABLE service_quotes(id bigint PRIMARY KEY, organization_id bigint, intervention_id bigint, property_id bigint, service_request_id bigint, assignment_proposal_id bigint, marketplace_request_id bigint, provider_team_id bigint, provider_user_id bigint, provider_name text DEFAULT 'Prestataire',status text DEFAULT 'RECEIVED',amount numeric DEFAULT 100,currency text DEFAULT 'EUR',valid_until date,created_at timestamp DEFAULT '2026-10-10',document_ref text)");
        db.execute("""
            INSERT INTO service_quotes(id,organization_id,intervention_id,property_id,provider_team_id,provider_user_id) VALUES
            (1,7,1,1,NULL,3),(2,7,2,2,NULL,4),(3,9,3,3,8,4),
            (4,7,1,1,NULL,3),(5,7,NULL,1,8,3),(6,7,1,1,9,3),(7,7,1,1,NULL,3),(8,9,3,3,9,4)
            """);
        db.execute("UPDATE service_quotes SET marketplace_request_id=1,status='APPROVED',amount=200,document_ref='77' WHERE id=4");
        db.execute("UPDATE service_quotes SET service_request_id=1,assignment_proposal_id=99 WHERE id=5");
        db.execute("UPDATE service_quotes SET valid_until='2026-10-20' WHERE id=7");
        db.execute("CREATE TABLE service_quote_amendments(id bigint,quote_id bigint,organization_id bigint,intervention_id bigint,status text,currency text,proposed_amount numeric,decided_at timestamp)");
        db.execute("INSERT INTO service_quote_amendments VALUES (1,4,7,1,'ACCEPTED','EUR',250,now()),(2,4,99,1,'ACCEPTED','EUR',999,now())");
        db.execute("CREATE TABLE contact_threads(id bigint PRIMARY KEY,organization_id bigint,reference_id bigint,reference_type text)");
        db.execute("INSERT INTO contact_threads VALUES (100,7,1,'SERVICE_QUOTE_USER_3'),(101,7,1,'MARKETPLACE_QUOTE')");
        db.execute("CREATE TABLE contact_thread_participants(thread_id bigint,keycloak_id text,archived boolean)");
        db.execute("INSERT INTO contact_thread_participants VALUES (100,'viewer',false),(101,'viewer',true)");
        parties=mock(ServiceQuoteAmendmentService.class);
        threadAccess=mock(QuoteThreadAccessPolicy.class);
        when(threadAccess.canAccess(any(),anyString())).thenReturn(true);
        var threads=mock(ContactThreadRepository.class);
        for (long id : List.of(100L,101L)) {
            var thread=new ContactThread(); ReflectionTestUtils.setField(thread,"id",id);
            when(threads.findById(id)).thenReturn(Optional.of(thread));
        }
        inbox=new BaitlyQuoteInbox(new NamedParameterJdbcTemplate(db),parties,threads,threadAccess,
            Clock.fixed(Instant.parse("2026-10-21T12:00:00Z"),ZoneOffset.UTC));
    }
    void access(long actor, Set<Long> teams, boolean staff, boolean owner) {
        when(parties.libraryAccess(7L,null)).thenReturn(new ServiceQuoteAmendmentService.LibraryAccess(actor,7L,"viewer",teams,staff,owner));
    }
    @AfterEach void cleanup() {
        if (db != null && schema != null) db.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
        if (source != null) source.destroy();
    }
    @Test void unifiesBeforePaginationWithoutDuplicatingCommercialQuotes() {
        access(9,Set.of(),true,false);
        var all=inbox.list(7L,null,"ALL",0,50);
        assertThat(all.totalElements()).isEqualTo(9);
        assertThat(all.items()).extracting(BaitlyQuoteInbox.Entry::key).doesNotContain("request-1").contains("quote-4","request-2","quote-5");
        var agreed=all.items().stream().filter(e -> e.quoteId()!=null && e.quoteId()==4L).findFirst().orElseThrow();
        assertThat(agreed.status()).isEqualTo("APPROVED");
        assertThat(agreed.originalAmount()).isEqualByComparingTo("200");
        assertThat(agreed.agreedAmount()).isEqualByComparingTo("250");
        assertThat(agreed.documentGenerationId()).isEqualTo(77L);
        assertThat(inbox.list(7L,null,"ALL",0,2).items()).hasSize(2);
        assertThat(inbox.list(7L,null,"ALL",1,2).totalElements()).isEqualTo(9);
        assertThat(inbox.list(7L,null,"DECIDE",0,50).items()).hasSize(5);
        assertThat(inbox.list(7L,null,"ACCEPTED",0,50).items()).hasSize(1);
        assertThat(inbox.list(7L,null,"CLOSED",0,50).items()).extracting(BaitlyQuoteInbox.Entry::key).containsExactly("quote-7");
    }
    @Test void ownerCannotReadOtherOwnersOrOrganizations() {
        access(5,Set.of(),false,true);
        var all=inbox.list(7L,null,"ALL",0,50);
        assertThat(all.totalElements()).isEqualTo(7);
        assertThat(all.items()).extracting(BaitlyQuoteInbox.Entry::key).doesNotContain("quote-2","quote-3","quote-8","request-3","request-4","request-5");
        access(99,Set.of(),false,false);
        assertThat(inbox.list(7L,null,"ALL",0,50).totalElements()).isZero();
    }
    @Test void currentTeamMembershipControlsExternalProviderQuotesWithoutGrantingDecisions() {
        access(3,Set.of(8L),false,false);
        var all=inbox.list(7L,null,"ALL",0,50);
        assertThat(all.items()).extracting(BaitlyQuoteInbox.Entry::key).contains("quote-3","quote-5","request-5").doesNotContain("quote-6","quote-8","request-4");
        assertThat(all.items()).allMatch(e -> !e.canDecide() && !e.canWithdraw());
        assertThat(all.items().stream().filter(e -> e.key().equals("quote-5")).findFirst().orElseThrow().propertyName()).isEqualTo("Ville");
        access(3,Set.of(),false,false);
        assertThat(inbox.list(7L,null,"ALL",0,50).items()).extracting(BaitlyQuoteInbox.Entry::key).doesNotContain("quote-3","quote-5");
    }
    @Test void linksOnlyCurrentParticipantsToAuthorizedDiscussionsIncludingArchives() {
        access(5,Set.of(),false,true);
        var all=inbox.list(7L,null,"ALL",0,50);
        assertThat(all.items().stream().filter(e -> e.key().equals("quote-1")).findFirst().orElseThrow().discussionUrl()).isEqualTo("/contact?thread=group%3A100");
        assertThat(all.items().stream().filter(e -> e.key().equals("quote-4")).findFirst().orElseThrow().discussionUrl()).isEqualTo("/contact?tab=archived&thread=group%3A101");
        when(threadAccess.canAccess(any(),anyString())).thenReturn(false);
        assertThat(inbox.list(7L,null,"ALL",0,50).items()).allMatch(e -> e.discussionUrl()==null);
    }
    @Test void invalidPaginationAndViewsAreRejected() {
        assertThatThrownBy(() -> inbox.list(7L,null,"ALL",-1,20)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> inbox.list(7L,null,"ALL",0,51)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> inbox.list(7L,null,"unsafe",0,20)).isInstanceOf(IllegalArgumentException.class);
    }
}
