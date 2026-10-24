package com.clenzy.integration.minut.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

class BaitlyMinutEventParserTest {
    final ObjectMapper mapper=new ObjectMapper();
    final BaitlyMinutEventParser parser=new BaitlyMinutEventParser(mapper);
    Map<String,Object> event() {
        return new HashMap<>(Map.of("id","synthetic-event","type","device_offline","device_id","synthetic-device","created_at","2026-10-23T10:00:00Z"));
    }
    @Test void canonicalIdentitySurvivesJsonOrderingWhitespaceAndIrrelevantFields() throws Exception {
        var raw=event();var first=parser.parse(mapper.writeValueAsString(raw)).orElseThrow();
        raw.put("unused","private-token-not-retained");
        var second=parser.parse(mapper.writerWithDefaultPrettyPrinter().writeValueAsString(raw)).orElseThrow();
        assertThat(second).isEqualTo(first);
        assertThat(first.key()).matches("[a-f0-9]{64}");assertThat(first.fingerprint()).matches("[a-f0-9]{64}");
        assertThat(first.toString()).doesNotContain("private-token-not-retained","synthetic-event");
    }
    @Test void legacyAndDocumentedEventNamesNormalizeToTheSameIdentity() throws Exception {
        var raw=event();var first=parser.parse(mapper.writeValueAsString(raw)).orElseThrow();
        raw.put("event_id",raw.remove("id"));raw.put("event_type",raw.remove("type"));
        assertThat(parser.parse(mapper.writeValueAsString(raw)).orElseThrow()).isEqualTo(first);
    }
    @Test void wrappedOrganizationWebhookUsesStableWebhookEventId() throws Exception {
        var raw=event();raw.put("webhook_event_id","stable-org-event");
        var first=parser.parse(mapper.writeValueAsString(Map.of("event",raw,"hook_token","synthetic-token"))).orElseThrow();
        raw.put("id","different-event-surface-id");
        var second=parser.parse(mapper.writeValueAsString(Map.of("event",raw,"hook_token","changed-token"))).orElseThrow();
        assertThat(second).isEqualTo(first);
    }
    @Test void sameIdWithChangedBusinessMeaningKeepsKeyButChangesFingerprint() throws Exception {
        var raw=event();var first=parser.parse(mapper.writeValueAsString(raw)).orElseThrow();
        raw.put("type","device_online");var second=parser.parse(mapper.writeValueAsString(raw)).orElseThrow();
        assertThat(second.key()).isEqualTo(first.key());assertThat(second.fingerprint()).isNotEqualTo(first.fingerprint());
    }
    @Test void distinctEventsNeverShareTheRecoveryKey() throws Exception {
        var raw=event();var first=parser.parse(mapper.writeValueAsString(raw)).orElseThrow();
        raw.put("id","next-event");assertThat(parser.parse(mapper.writeValueAsString(raw)).orElseThrow().key()).isNotEqualTo(first.key());
    }
    @ParameterizedTest @ValueSource(strings={"id","device_id"})
    void missingStableIdentityIsNotReplacedWithRandomOrPayloadHash(String field) throws Exception {
        var raw=event();raw.remove(field);String payload=mapper.writeValueAsString(raw);
        assertThatThrownBy(() -> parser.parse(payload)).hasNoCause().hasMessageContaining("non confirme");
    }
    @ParameterizedTest @ValueSource(strings={"", " ", "\n", "x\ny"})
    void invalidIdentityIsRefusedWithoutLeakingIt(String id) throws Exception {
        var raw=event();raw.put("id",id);String payload=mapper.writeValueAsString(raw);
        assertThatThrownBy(() -> parser.parse(payload)).hasNoCause().hasMessageContaining("non confirme");
    }
    @Test void conflictingIdentityFieldsAreRefused() throws Exception {
        var raw=event();raw.put("event_id","other");String payload=mapper.writeValueAsString(raw);
        assertThatThrownBy(() -> parser.parse(payload)).hasNoCause();
    }
    @Test void missingOccurrenceTimeCannotInventARecoveryBoundary() throws Exception {
        var raw=event();raw.remove("created_at");String payload=mapper.writeValueAsString(raw);
        assertThatThrownBy(() -> parser.parse(payload)).hasNoCause();
    }
    @Test void equivalentUtcTimesHaveTheSameFingerprint() throws Exception {
        var raw=event();var first=parser.parse(mapper.writeValueAsString(raw)).orElseThrow();
        raw.put("created_at","2026-10-23T11:00:00+01:00");
        assertThat(parser.parse(mapper.writeValueAsString(raw)).orElseThrow()).isEqualTo(first);
    }
    @ParameterizedTest @ValueSource(strings={"NaN","Infinity","-Infinity","0","-1","1e309"})
    void nonfiniteOrNonpositiveMeasurementsCannotEnterTheJournal(String level) throws Exception {
        var raw=event();raw.put("type","disturbance");raw.put("sound_level",level);
        assertThat(parser.parse(mapper.writeValueAsString(raw))).isEmpty();
    }
    @Test void nestedNoiseReadingIsNormalizedWithoutRawPayloadStorage() throws Exception {
        var raw=event();raw.put("type","disturbance");raw.remove("device_id");
        raw.put("data",Map.of("device_id","synthetic-device","level","82.5"));
        assertThat(parser.parse(mapper.writeValueAsString(raw)).orElseThrow().measuredDb()).isEqualTo(82.5);
    }
    @Test void unsupportedEventsAreIgnoredWithoutInventingAnAction() {
        assertThat(parser.parse("{\"type\":\"future-provider-event\"}")).isEmpty();
    }
}
