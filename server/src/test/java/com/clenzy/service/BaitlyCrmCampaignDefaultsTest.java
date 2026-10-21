package com.clenzy.service;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import java.time.Instant;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyCrmCampaignDefaultsTest {
    @Test void catalogueCoversEveryDirectoryFamilyAndAdditionalRecruitmentTrades() {
        var entries=BaitlyCrmCampaignDefaults.CATALOG;
        assertThat(entries).hasSize(17);
        assertThat(entries).extracting(BaitlyCrmCampaignDefaults.Entry::key).doesNotHaveDuplicates();
        assertThat(entries).extracting(BaitlyCrmCampaignDefaults.Entry::key).contains(
            "fr-provider-cleaning","fr-provider-laundry","fr-provider-maintenance","fr-provider-exterior",
            "fr-provider-concierge","fr-provider-repairs","fr-provider-security","fr-provider-pest-control",
            "fr-provider-catering","fr-provider-moving","fr-provider-property-experts",
            "fr-provider-keys","fr-provider-pool","fr-provider-photography","fr-provider-general");
        assertThat(entries.stream().filter(e->e.contactType().equals("OWNER"))).hasSize(2);
        for(var entry:entries){
            assertThat(entry.name()).isNotBlank().hasSizeLessThanOrEqualTo(150);
            assertThat(entry.subject()).isNotBlank().hasSizeLessThanOrEqualTo(200);
            assertThat(entry.body()).isNotBlank().hasSizeLessThanOrEqualTo(6000);
            assertThat(entry.contactType()).isIn("OWNER","PROVIDER");
            assertThatCode(()->BaitlyCrmCampaignText.validate(entry.subject(),entry.body())).doesNotThrowAnyException();
            var contact=new BaitlyCrmCampaignPolicy.Contact(1,"Atelier Alice","a@example.com","Paris",entry.contactType(),"PROFESSIONAL","TO_CONTACT",false,0,1);
            assertThat(BaitlyCrmCampaignText.render(entry.body(),contact,"Maison Bleue"))
                .contains("Atelier Alice","Maison Bleue").doesNotContain("{{","}}");
            // Having a template never creates an authorization to contact its audience.
            assertThat(BaitlyCrmCampaignPolicy.evaluate(contact,java.util.List.of(),Instant.now()).eligible()).isFalse();
        }
    }

    @Test void accessIsCheckedBeforeAnyDefaultIsWritten() {
        var db=mock(JdbcTemplate.class);var access=mock(BaitlyCrmAccess.class);
        when(access.require("forbidden")).thenThrow(new org.springframework.security.access.AccessDeniedException("Denied"));
        assertThatThrownBy(()->new BaitlyCrmCampaigns(db,access).templates("forbidden"))
            .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verifyNoInteractions(db);
    }
}
