package com.clenzy.service;

import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static com.clenzy.service.BaitlyCrmCampaignPolicy.*;

class BaitlyCrmCampaignPolicyTest {
    Instant now=Instant.now();String hash=BaitlyCrmIdentity.hash("alice@example.com");
    Contact owner=new Contact(1,"Alice","alice@example.com","Rabat","OWNER","PRIVATE","TO_CONTACT",false,0,1);
    Assertion grant(String basis){return new Assertion(1,1,hash,0,"MANAGEMENT",basis,"GRANTED","Accord documenté",now.minusSeconds(60),null);}
    @Test void requestedReplyIsNotCampaignConsent(){assertThat(evaluate(owner,List.of(grant("REQUESTED_CONTACT")),now).reason()).isEqualTo("REQUEST_ONLY");}
    @Test void privateOwnerRequiresConsentAndCurrentIdentity(){
        assertThat(evaluate(owner,List.of(grant("B2B_LEGITIMATE_INTEREST")),now).eligible()).isFalse();
        assertThat(evaluate(owner,List.of(grant("CONSENT")),now).eligible()).isTrue();
        var changed=new Contact(1,"Alice","alice@example.com","Rabat","OWNER","PRIVATE","TO_CONTACT",false,1,1);
        assertThat(evaluate(changed,List.of(grant("CONSENT")),now).eligible()).isFalse();
    }
    @Test void professionalProviderCanUseDocumentedB2BForCorrectPurpose(){
        var provider=new Contact(1,"Samira","alice@example.com","Rabat","PROVIDER","PROFESSIONAL","PARTNER",false,0,1);
        var assertion=new Assertion(2,1,hash,0,"PROVIDER_RECRUITMENT","B2B_LEGITIMATE_INTEREST","GRANTED","Services professionnels pertinents",now.minusSeconds(60),null);
        assertThat(evaluate(provider,List.of(assertion),now).eligible()).isTrue();assertThat(evaluate(provider,List.of(grant("CONSENT")),now).eligible()).isFalse();
    }
    @Test void withdrawalAcrossHistoricContactsOverridesEarlierGrantAndTie(){
        var revoked=new Assertion(2,55,hash,9,"MANAGEMENT","CONSENT","REVOKED","Refus",now.minusSeconds(60),null);
        assertThat(evaluate(owner,List.of(grant("CONSENT"),revoked),now).reason()).isEqualTo("REVOKED");
    }
    @Test void expiredOrLatestRequestedOnlyAssertionsCannotFallBackToOldConsent(){
        var expired=new Assertion(2,1,hash,0,"MANAGEMENT","CONSENT","GRANTED","Accord",now.minusSeconds(30),now.minusSeconds(1));
        assertThat(evaluate(owner,List.of(grant("CONSENT"),expired),now).reason()).isEqualTo("EXPIRED");
        var requested=new Assertion(3,1,hash,0,"MANAGEMENT","REQUESTED_CONTACT","GRANTED","Demande",now.minusSeconds(10),null);
        assertThat(evaluate(owner,List.of(grant("CONSENT"),requested),now).reason()).isEqualTo("REQUEST_ONLY");
    }
    @Test void archivedRefusedAndAmbiguousContactsAreExcluded(){
        for(var contact:List.of(new Contact(1,"Alice","alice@example.com",null,"OWNER","PRIVATE","TO_CONTACT",true,0,1),new Contact(1,"Alice","alice@example.com",null,"OWNER","PRIVATE","REJECTED",false,0,1),new Contact(1,"Alice","alice@example.com",null,"OWNER","PRIVATE","TO_CONTACT",false,0,2)))
            assertThat(evaluate(contact,List.of(grant("CONSENT")),now).eligible()).isFalse();
    }
    @Test void templatesRejectUnknownVariablesAndReplaceValuesWithoutReinterpretingThem(){
        assertThatThrownBy(()->BaitlyCrmCampaignText.validate("Hello {{email}}","Body")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->BaitlyCrmCampaignText.validate("Subject\nInjected","Body")).isInstanceOf(IllegalArgumentException.class);
        var contact=new Contact(1,"{{organization}} $1","alice@example.com","Rabat","OWNER","PRIVATE","TO_CONTACT",false,0,1);
        assertThat(BaitlyCrmCampaignText.render("{{name}} / {{organization}}",contact,"Maison")).isEqualTo("{{organization}} $1 / Maison");
    }
}
