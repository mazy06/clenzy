package com.clenzy.service;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.junit.jupiter.api.*;
import java.time.Instant;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.assertj.core.api.Assertions.*;
class BaitlyCrmContactAuthorizationsTest {
    ProspectService contacts=mock(ProspectService.class);
    BaitlyCrmContactAuthorizationRepository repository=mock(BaitlyCrmContactAuthorizationRepository.class);
    BaitlyCrmContactAuthorizations service=new BaitlyCrmContactAuthorizations(contacts,repository);
    Prospect owner;
    @BeforeEach void setup() {
        owner=ProspectServiceTest.contact(1,10,"alice@example.com");owner.setContactType("OWNER");owner.setContactNature("PRIVATE");
        when(contacts.require(1L)).thenReturn(owner);
        lenient().when(repository.saveAndFlush(any())).thenAnswer(call->call.getArgument(0));
    }
    BaitlyCrmContactAuthorizations.Command command(String basis,String decision) {
        return new BaitlyCrmContactAuthorizations.Command("EMAIL","MANAGEMENT",basis,decision,"Demande reçue par formulaire",Instant.now().minusSeconds(60),null);
    }
    @Test void requiresEvidenceAndDoesNotTreatPrivateOwnersAsB2B() {
        assertThatThrownBy(()->service.record(1L,command("B2B_LEGITIMATE_INTEREST","GRANTED"),"manager"))
            .isInstanceOf(IllegalArgumentException.class);
        var missing=new BaitlyCrmContactAuthorizations.Command("EMAIL","MANAGEMENT","CONSENT","GRANTED"," ",Instant.now().minusSeconds(60),null);
        assertThatThrownBy(()->service.record(1L,missing,"manager")).isInstanceOf(IllegalArgumentException.class);
        verify(repository,never()).saveAndFlush(any());
    }
    @Test void recordedConsentIsScopedAuditedAndBoundToIdentity() {
        var entry=service.record(1L,command("CONSENT","GRANTED"),"manager");
        assertThat(entry.currentIdentity()).isTrue();assertThat(entry.recordedBy()).isEqualTo("manager");
        var captured=org.mockito.ArgumentCaptor.forClass(BaitlyCrmContactAuthorization.class);
        verify(repository).saveAndFlush(captured.capture());
        assertThat(captured.getValue().getOrganizationId()).isEqualTo(10);
        assertThat(captured.getValue().getDestinationHash()).isEqualTo(BaitlyCrmIdentity.hash("alice@example.com"));
    }
    @Test void identityChangesMakePreviousAgreementsInapplicable() {
        var old=new BaitlyCrmContactAuthorization();old.setIdentityVersion(0);old.setChannel("EMAIL");
        old.setDestinationHash(BaitlyCrmIdentity.hash("alice@example.com"));
        when(repository.findByOrganizationIdAndProspectIdOrderByIdDesc(10L,1L)).thenReturn(List.of(old));
        owner.setIdentityVersion(1);
        assertThat(service.history(1L).get(0).currentIdentity()).isFalse();
    }
    @Test void earlierConsentCannotOverrideALaterWithdrawal() {
        var withdrawal=new BaitlyCrmContactAuthorization();withdrawal.setChannel("EMAIL");withdrawal.setPurpose("MANAGEMENT");
        withdrawal.setDecision("REVOKED");withdrawal.setOccurredAt(Instant.now().minusSeconds(10));
        when(repository.findByOrganizationIdAndDestinationHashAndPurposeAndChannelOrderByIdDesc(
            10L,BaitlyCrmIdentity.hash("alice@example.com"),"MANAGEMENT","EMAIL")).thenReturn(List.of(withdrawal));
        assertThatThrownBy(()->service.record(1L,command("CONSENT","GRANTED"),"manager")).isInstanceOf(IllegalArgumentException.class);
        verify(repository,never()).saveAndFlush(any());
    }
    @Test void expiredAndFutureAssertionsAreRejected() {
        var future=new BaitlyCrmContactAuthorizations.Command("EMAIL","MANAGEMENT","CONSENT","GRANTED","Preuve",Instant.now().plusSeconds(60),null);
        assertThatThrownBy(()->service.record(1L,future,"manager")).isInstanceOf(IllegalArgumentException.class);
    }
}
