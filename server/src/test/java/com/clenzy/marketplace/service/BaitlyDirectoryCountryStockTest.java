package com.clenzy.marketplace.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.env.MockEnvironment;
import java.nio.file.*;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyDirectoryCountryStockTest {
    private final ObjectMapper json=new ObjectMapper().registerModule(new JavaTimeModule());
    @TempDir Path folder;
    @Test void identitiesAreCountryScopedAndRcRequiresTheCourt(){
        assertThat(new BaitlyDirectoryCountry.Identity("MA","ICE","001234567890123").value()).startsWith("00");
        assertThat(new BaitlyDirectoryCountry.Identity("MA","RC","CASABLANCA:1234").key()).isNotEqualTo(new BaitlyDirectoryCountry.Identity("MA","RC","RABAT:1234").key());
        assertThatThrownBy(()->new BaitlyDirectoryCountry.Identity("MA","RC","1234")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->new BaitlyDirectoryCountry.Identity("SA","SIRET","12345678900011")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->new BaitlyDirectoryCountry.Identity("SA","UNN","1010711252")).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void disabledAndUnauthorizedSourcesMakeNoNetworkCalls()throws Exception {
        var environment=new MockEnvironment();var api=mock(BaitlyWathqClient.class);var source=new BaitlyDirectoryCountryStock(environment,json,api);
        assertThat(source.open("MA")).isEmpty();environment.setProperty("baitly.directory.ma.enabled","true");
        assertThatThrownBy(()->source.open("MA")).hasMessageContaining("authorization");verifyNoInteractions(api);
    }
    @Test void checksummedAuthorizedFilePreservesContactsWithoutInventingLocations()throws Exception {
        Path data=folder.resolve("stock.jsonl"),manifest=folder.resolve("manifest.json");
        String line="""
            {"active":true,"identifierType":"ICE","identifier":"001234567890123","name":"Fixture entretien","address":"Rue test","city":"Rabat","postalCode":"10000","activity":"","service":"CLEANING","phone":"+212 537 000000","email":"CONTACT@example.org","website":"https://example.org","identifiers":{"RC":"RABAT:1234","COURT":"RABAT","IF":"1234","CNSS":"5678"}}
            """;Files.writeString(data,line);
        String hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(data)));
        var m=new BaitlyDirectoryCountryStock.Manifest("MA","OMPIC","projection","test",hash,1,"https://www.directinfo.ma/","Contrat de test",Instant.parse("2026-01-01T00:00:00Z"),false,true);
        Files.writeString(manifest,json.writeValueAsString(m));
        var env=new MockEnvironment().withProperty("baitly.directory.ma.enabled","true").withProperty("baitly.directory.ma.reuse-authorized","true")
            .withProperty("baitly.directory.ma.manifest",manifest.toString()).withProperty("baitly.directory.ma.snapshot",data.toString());
        var api=mock(BaitlyWathqClient.class);var source=new BaitlyDirectoryCountryStock(env,json,api);var opened=source.open("MA").orElseThrow();
        var entry=source.entry(opened.manifest(),line);assertThat(entry.email()).isEqualTo("contact@example.org");assertThat(entry.latitude()).isNull();assertThat(entry.identifiers()).containsEntry("RC","RABAT:1234");
        assertThat(entry.phone()).isEqualTo("+212537000000");
        assertThat(json.readTree(json.writeValueAsString(entry)).path("retrievedAt").asText()).isEqualTo("2026-01-01T00:00:00Z");
        Files.writeString(data,line+"\n");assertThatThrownBy(()->source.open("MA")).hasMessageContaining("checksum");verifyNoInteractions(api);
    }
    @Test void wathqUsesExactIdentityAndNeverCopiesPrivateMobilesOrCityCentroids()throws Exception {
        var raw=json.readTree("""
            {"crNationalNumber":"7001272475","crNumber":"1010711252","name":"شركة اختبار","headquarterCityName":"الرياض","status":{"id":1},"contactInfo":{"phoneNo":"011256398","mobileNo":"050111101","email":"Test@example.org","websiteUrl":"example.org"},"parties":[{"name":"private"}]}
            """);
        var requested=new BaitlyDirectoryCountry.Identity("SA","CR","1010711252");
        var projection=BaitlyDirectoryCountryStock.wathqProjection(raw,requested,"MAINTENANCE");
        var entry=BaitlyDirectoryCountryStock.projection("SA",projection);
        assertThat(entry.identity().type()).isEqualTo("UNN");assertThat(entry.phone()).isEqualTo("011256398");assertThat(entry.address()).isEmpty();assertThat(entry.latitude()).isNull();
        assertThat(entry.raw().toString()).doesNotContain("private","050111101");
        assertThatThrownBy(()->BaitlyDirectoryCountryStock.wathqProjection(raw,new BaitlyDirectoryCountry.Identity("SA","UNN","7000000000"),"CLEANING")).hasMessageContaining("identity");
    }
    @Test void retryAfterSupportsHttpDatesWithoutUnboundedDelay(){
        Instant now=Instant.parse("2026-10-20T12:00:00Z");
        assertThat(BaitlyWathqClient.retryAfter("Tue, 20 Oct 2026 12:01:00 GMT",now)).isEqualTo(60);
        assertThat(BaitlyWathqClient.retryAfter("999999999",now)).isEqualTo(86400);
        assertThat(BaitlyWathqClient.retryAfter("invalid",now)).isEqualTo(60);
    }
    @Test void malformedOptionalContactsDoNotDiscardTheCompanyOrOtherValidContactFields()throws Exception {
        var entry=BaitlyDirectoryCountryStock.projection("MA",json.readTree("""
            {"active":true,"identifierType":"ICE","identifier":"001234567890123","name":"Fixture","city":"Rabat","service":"CLEANING","phone":"non communiqué","email":"contact@example.org","website":"javascript:alert(1)"}
            """));
        assertThat(entry.phone()).isNull();assertThat(entry.email()).isEqualTo("contact@example.org");assertThat(entry.website()).isEmpty();
    }
}
