package com.clenzy.fiscal.einvoicing.francepdp;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static com.clenzy.fiscal.einvoicing.francepdp.BaitlyIopoleFixture.*;

class BaitlyIopoleInboxTest {
    final ObjectMapper json = new ObjectMapper();
    final BaitlyIopoleApi api = mock(BaitlyIopoleApi.class);
    final BaitlyIopoleInboxStore store = mock(BaitlyIopoleInboxStore.class);
    final BaitlyIopoleInbox inbox = new BaitlyIopoleInbox(api, store);

    ArrayNode batch(int count) {
        var groups = json.createArrayNode();
        var events = groups.addObject().put("invoiceId", REMOTE.toString()).putArray("newstatus");
        for (int i = 0; i < count; i++) {
            var e = events.addObject().put("statusId", new UUID(0, i + 1).toString()).put("invoiceId", REMOTE.toString())
                .put("date", "2026-10-07T10:00:00Z").put("destType", "OPERATOR");
            e.putObject("status").put("code", "SUBMITTED");
        }
        return groups;
    }

    @Test void aFullBatchIsDrainedBeforeLocalHistoryCanConfirmAnything() {
        var full = batch(100);
        when(api.unseen(CUSTOMER)).thenReturn(full, json.createArrayNode());
        when(store.history(2L, "SANDBOX", CUSTOMER, REMOTE)).thenReturn(List.of());
        assertThat(inbox.refresh(2L, "SANDBOX", CUSTOMER, REMOTE)).isEmpty();
        var order = inOrder(api, store);
        order.verify(api).unseen(CUSTOMER);
        order.verify(store).retain(eq(2L), eq("SANDBOX"), eq(CUSTOMER), anyList());
        order.verify(api, times(100)).acknowledge(eq(CUSTOMER), any());
        order.verify(api).unseen(CUSTOMER);
        order.verify(store).retain(2L, "SANDBOX", CUSTOMER, List.of());
        order.verify(store).history(2L, "SANDBOX", CUSTOMER, REMOTE);
    }

    @Test void repeatedFullBatchesRemainPendingRatherThanTrustATruncatedHistory() {
        when(api.unseen(CUSTOMER)).thenReturn(batch(100));
        assertThatThrownBy(() -> inbox.refresh(2L, "SANDBOX", CUSTOMER, REMOTE)).hasMessageContaining("incomplet");
        verify(api, times(5)).unseen(CUSTOMER);
        verify(store, never()).history(any(), any(), any(), any());
    }

    @Test void wrongInvoiceOrDuplicateStatusIsRejectedBeforeArchivingOrAcknowledging() {
        var wrong = batch(1);
        ((com.fasterxml.jackson.databind.node.ObjectNode) wrong.get(0).get("newstatus").get(0)).put("invoiceId", UUID.randomUUID().toString());
        when(api.unseen(CUSTOMER)).thenReturn(wrong);
        assertThatThrownBy(() -> inbox.refresh(2L, "SANDBOX", CUSTOMER, REMOTE)).hasMessageContaining("contradictoires");
        verifyNoInteractions(store); verify(api, never()).acknowledge(any(), any());
        var duplicate = batch(1); ((ArrayNode) duplicate.get(0).get("newstatus")).add(duplicate.get(0).get("newstatus").get(0).deepCopy());
        assertThatThrownBy(() -> BaitlyIopoleInbox.parse(duplicate)).hasMessageContaining("contradictoires");
    }

    @Test void onlyMinimalStatusEvidenceIsArchivedWithoutUpstreamXmlOrPersonalData() {
        var payload = batch(1);
        ((com.fasterxml.jackson.databind.node.ObjectNode) payload.get(0).get("newstatus").get(0)).put("xml", "private XML not needed");
        assertThat(BaitlyIopoleInbox.parse(payload)).singleElement().satisfies(e -> {
            assertThat(e.invoice()).isEqualTo(REMOTE); assertThat(e.body()).contains("SUBMITTED").doesNotContain("private", "xml");
        });
    }

    @Test void oversizedAndMalformedBatchesFailClosed() {
        assertThatThrownBy(() -> BaitlyIopoleInbox.parse(batch(101))).hasMessageContaining("volumineux");
        assertThatThrownBy(() -> BaitlyIopoleInbox.parse(json.createObjectNode())).hasMessageContaining("invalide");
        var missingDate = batch(1); ((com.fasterxml.jackson.databind.node.ObjectNode) missingDate.get(0).get("newstatus").get(0)).remove("date");
        assertThatThrownBy(() -> BaitlyIopoleInbox.parse(missingDate)).isInstanceOf(RuntimeException.class);
    }
}
