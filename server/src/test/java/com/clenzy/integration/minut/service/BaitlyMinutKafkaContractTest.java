package com.clenzy.integration.minut.service;

import com.clenzy.config.KafkaConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.kafka.common.header.internals.RecordHeaders;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.serializer.*;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.StringReader;
import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Actual pinned Kafka codecs and application config; no broker or network is started. */
class BaitlyMinutKafkaContractTest {
    static final String PAYLOAD="{\"id\":\"synthetic-event\",\"event_type\":\"device_offline\",\"device_id\":\"synthetic-device\",\"created_at\":\"2026-10-23T10:00:00Z\"}";

    KafkaConfig config() {
        var config=new KafkaConfig();ReflectionTestUtils.setField(config,"bootstrapServers","127.0.0.1:1");return config;
    }
    Map<String,Object> consumerProperties(boolean listenerOverrides) throws Exception {
        var result=new HashMap<>(config().consumerFactory().getConfigurationProperties());
        if(listenerOverrides) {
            var annotation=MinutWebhookConsumer.class.getMethod("handleMinutWebhook",String.class).getAnnotation(KafkaListener.class);
            var properties=new Properties();
            for(String value : annotation.properties()) properties.load(new StringReader(value));
            properties.forEach((key,value) -> result.put(key.toString(),value));
        }
        return result;
    }
    byte[] encode(RecordHeaders headers,Object payload) {
        try(var serializer=new JsonSerializer<Object>()) {
            serializer.configure(config().producerFactory().getConfigurationProperties(),false);
            return serializer.serialize(KafkaConfig.TOPIC_MINUT_WEBHOOKS,headers,payload);
        }
    }
    Object decode(RecordHeaders headers,byte[] bytes,boolean listenerOverrides) throws Exception {
        try(var deserializer=new ErrorHandlingDeserializer<Object>(new JsonDeserializer<>())) {
            deserializer.configure(consumerProperties(listenerOverrides),false);
            return deserializer.deserialize(KafkaConfig.TOPIC_MINUT_WEBHOOKS,headers,bytes);
        }
    }
    @Test void originalGlobalMapDefaultCannotDecodeTheStringSentByTheWebhookController() throws Exception {
        var headers=new RecordHeaders();byte[] wire=encode(headers,PAYLOAD);
        assertThat(decode(headers,wire,false)).isNull();
        assertThat(headers.lastHeader(SerializationUtils.VALUE_DESERIALIZER_EXCEPTION_HEADER)).isNotNull();
        assertThat(consumerProperties(false).get(JsonDeserializer.VALUE_DEFAULT_TYPE)).isEqualTo("java.util.LinkedHashMap");
    }
    @Test void minutListenerOverrideRoundTripsOriginalBodyIntoDurableAdmission() throws Exception {
        var headers=new RecordHeaders();byte[] wire=encode(headers,PAYLOAD);Object decoded=decode(headers,wire,true);
        assertThat(decoded).isEqualTo(PAYLOAD);
        assertThat(headers.lastHeader(SerializationUtils.VALUE_DESERIALIZER_EXCEPTION_HEADER)).isNull();
        var journal=mock(BaitlyMinutEventJournal.class);var worker=mock(BaitlyMinutRecoveryWorker.class);UUID id=UUID.randomUUID();
        when(journal.admit(any())).thenReturn(id);
        new MinutWebhookConsumer(new BaitlyMinutEventParser(new ObjectMapper()),journal,worker).handleMinutWebhook((String)decoded);
        verify(journal).admit(argThat(input -> input.kind()==BaitlyMinutEventParser.Kind.OFFLINE && input.externalDevice().equals("synthetic-device")));
        verify(worker).process(id);
    }
    @Test void producerTypeHeadersCannotOverrideTheFixedStringContract() throws Exception {
        var headers=new RecordHeaders();byte[] wire=encode(headers,PAYLOAD);
        headers.remove("__TypeId__");headers.add("__TypeId__","java.util.HashMap".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        assertThat(consumerProperties(true).get(JsonDeserializer.USE_TYPE_INFO_HEADERS)).isEqualTo(false);
        assertThat(decode(headers,wire,true)).isEqualTo(PAYLOAD);
        // No change to consumers of structured payloads elsewhere in the application.
        assertThat(consumerProperties(false).get(JsonDeserializer.VALUE_DEFAULT_TYPE)).isEqualTo("java.util.LinkedHashMap");
    }
}
