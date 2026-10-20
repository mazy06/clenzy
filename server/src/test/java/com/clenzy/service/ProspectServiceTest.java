package com.clenzy.service;
import com.clenzy.dto.ProspectDto;
import com.clenzy.model.Prospect;
import com.clenzy.repository.ProspectRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class ProspectServiceTest {
    ProspectRepository repository; TenantContext tenant; ProspectService service;
    @BeforeEach void setup() {
        repository=mock(ProspectRepository.class);tenant=new TenantContext();tenant.setOrganizationId(10L);
        service=new ProspectService(repository,tenant);
        lenient().when(repository.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));
    }
    @AfterEach void cleanup() { tenant.clear(); }
    static Prospect contact(long id,long org,String email) {
        var p=new Prospect();p.setId(id);p.setOrganizationId(org);p.setName("Contact");
        p.setEmail(email);p.setNormalizedEmail(email);p.setCategory(Prospect.ProspectCategory.PROVIDERS);
        return p;
    }
    static ProspectDto command(String email) {
        return new ProspectDto(null,"Nouveau contact",email,null,"Lyon",null,"OWNERS","TO_CONTACT",null,null,null,null,null,
            "OWNER","PRIVATE","REFERRAL","Le contact a demandé à être présenté",null,null,false);
    }
    @Test void createsOwnerInCurrentOrganizationWithoutInferringConsent() {
        ProspectDto result=service.create(command(" Alice@Example.com "));
        assertThat(result.email()).isEqualTo("alice@example.com");
        assertThat(result.contactType()).isEqualTo("OWNER");
        assertThat(result.sourceRecordedAt()).isNotNull();
        var captor=org.mockito.ArgumentCaptor.forClass(Prospect.class);
        verify(repository).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getOrganizationId()).isEqualTo(10);
    }
    @Test void duplicateCheckNeverSearchesOtherOrganizations() {
        when(repository.findIdentityMatches(10L,"alice@example.com",null)).thenReturn(List.of(contact(1,10,"alice@example.com")));
        assertThatThrownBy(()->service.create(command("ALICE@example.com"))).isInstanceOf(ResponseStatusException.class);
        verify(repository,never()).saveAndFlush(any());
        verify(repository).findIdentityMatches(10L,"alice@example.com",null);
    }
    @Test void archivedIdentityCannotBeRecreated() {
        var p=contact(1,10,"alice@example.com");p.setArchived(true);
        when(repository.findIdentityMatches(10L,"alice@example.com",null)).thenReturn(List.of(p));
        assertThatThrownBy(()->service.create(command("alice@example.com"))).isInstanceOf(ResponseStatusException.class);
    }
    @Test void oldCoordinatesWithContactHistoryCannotBeReimportedAsANewContact() {
        when(repository.findHistoricIdentityMatches(eq(10L),anyCollection()))
            .thenReturn(List.of(contact(1,10,"changed@example.com")));
        assertThatThrownBy(()->service.create(command("alice@example.com"))).isInstanceOf(ResponseStatusException.class);
        verify(repository,never()).saveAndFlush(any());
    }
    @Test void unknownOrForeignIdIsDeniedWithoutUnscopedLookup() {
        when(repository.findByIdAndOrganizationId(99L,10L)).thenReturn(Optional.empty());
        assertThatThrownBy(()->service.detail(99L)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->service.update(99L,command("alice@example.com"))).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->service.delete(99L)).isInstanceOf(AccessDeniedException.class);
        verify(repository,never()).findById(any());
    }
    @Test void coordinateChangeInvalidatesEarlierContactAssertions() {
        var p=contact(1,10,"old@example.com");
        when(repository.findByIdAndOrganizationId(1L,10L)).thenReturn(Optional.of(p));
        service.update(1L,new ProspectDto(null,null,"new@example.com",null,null,null,null,null,null,null,null,null,null));
        assertThat(p.getIdentityVersion()).isEqualTo(1);
    }
    @Test void noteEditPreservesIdentityAndOriginalProvenance() {
        var p=contact(1,10,"old@example.com");p.setSourceType("REFERRAL");p.setSourceDetail("Source initiale");
        when(repository.findByIdAndOrganizationId(1L,10L)).thenReturn(Optional.of(p));
        service.update(1L,new ProspectDto(null,null,null,null,null,null,null,null,"Une note",null,null,null,null));
        assertThat(p.getIdentityVersion()).isZero();
        assertThat(p.getSourceDetail()).isEqualTo("Source initiale");
    }
    @Test void archivingRetainsRecordAndSuppressions() {
        var p=contact(1,10,"old@example.com");
        when(repository.findByIdAndOrganizationId(1L,10L)).thenReturn(Optional.of(p));
        service.delete(1L);
        assertThat(p.isArchived()).isTrue();verify(repository,never()).delete(any(Prospect.class));
    }
    @Test void legacyRecordsRemainVisibleWithoutClaimedProvenance() {
        var p=contact(1,10,"old@example.com");
        when(repository.findByOrganizationId(10L)).thenReturn(List.of(p));
        assertThat(service.getAll().get(0).sourceType()).isEqualTo("LEGACY");
        assertThat(service.getAll().get(0).sourceRecordedAt()).isNull();
    }
    @Test void bulkRemovalIsScopedDeduplicatedAndPreservesIdentities() {
        var first=contact(1,10,"alice@example.com");var second=contact(2,10,"bob@example.com");
        when(repository.findByOrganizationIdAndIdIn(eq(10L),anyCollection())).thenReturn(List.of(first,second));
        service.deleteMany(List.of(1L,2L,1L));
        assertThat(first.isArchived()).isTrue();assertThat(second.isArchived()).isTrue();
        assertThat(first.getNormalizedEmail()).isEqualTo("alice@example.com");
        verify(repository).findByOrganizationIdAndIdIn(10L,new LinkedHashSet<>(List.of(1L,2L)));
        verify(repository).saveAllAndFlush(List.of(first,second));verify(repository,never()).deleteAll(anyIterable());
    }
    @Test void foreignOrMissingContactRejectsTheWholeSelectionBeforeMutation() {
        var own=contact(1,10,"alice@example.com");
        when(repository.findByOrganizationIdAndIdIn(eq(10L),anyCollection())).thenReturn(List.of(own));
        assertThatThrownBy(()->service.deleteMany(List.of(1L,99L))).isInstanceOf(AccessDeniedException.class);
        assertThat(own.isArchived()).isFalse();verify(repository,never()).saveAllAndFlush(anyIterable());
    }
    @Test void invalidBulkSelectionNeverQueriesOrMutatesContacts() {
        for(List<Long> ids:Arrays.asList(null,List.<Long>of(),List.of(-1L),Arrays.asList(1L,null),Collections.nCopies(10001,1L)))
            assertThatThrownBy(()->service.deleteMany(ids)).isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(repository);
    }
}
