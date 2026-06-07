package com.clenzy.service.messaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.charset.StandardCharsets;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class OpenWaWebhookServiceTest {

    @Mock private WhatsAppInboundRouter inboundRouter;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private OpenWaWebhookService service() {
        return new OpenWaWebhookService(inboundRouter, objectMapper);
    }

    private static byte[] payload(String json) {
        return json.getBytes(StandardCharsets.UTF_8);
    }

    @Test
    void receivedIndividualMessage_routesWithStrippedNumber() {
        service().process(payload("""
            {"event":"message.received","data":{
              "id":"msg-1","from":"33612345678@c.us","body":"Bonjour",
              "fromMe":false,"isGroup":false}}"""));

        verify(inboundRouter, times(1)).route("33612345678", "", "Bonjour", "msg-1");
    }

    @Test
    void fromMeEcho_isIgnored() {
        service().process(payload("""
            {"event":"message.received","data":{
              "id":"msg-2","from":"33612345678@c.us","body":"echo","fromMe":true}}"""));

        verify(inboundRouter, never()).route(anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void groupMessageByFlag_isIgnored() {
        service().process(payload("""
            {"event":"message.received","data":{
              "id":"msg-3","from":"33612345678@c.us","body":"grp","fromMe":false,"isGroup":true}}"""));

        verify(inboundRouter, never()).route(anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void groupMessageBySuffix_isIgnored() {
        service().process(payload("""
            {"event":"message.received","data":{
              "id":"msg-4","from":"33612345678-160000@g.us","body":"grp","fromMe":false}}"""));

        verify(inboundRouter, never()).route(anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void nonReceivedEvent_isIgnored() {
        service().process(payload("""
            {"event":"session.status","data":{"status":"ready"}}"""));

        verify(inboundRouter, never()).route(anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void numberWithoutSuffix_routedAsIs() {
        service().process(payload("""
            {"event":"message.received","data":{
              "id":"msg-5","from":"33612345678","body":"plain","fromMe":false}}"""));

        verify(inboundRouter, times(1)).route("33612345678", "", "plain", "msg-5");
    }
}
