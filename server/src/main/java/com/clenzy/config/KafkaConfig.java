package com.clenzy.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.*;
import org.springframework.kafka.listener.ContainerProperties;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.kafka.support.serializer.JsonDeserializer;
import org.springframework.kafka.support.serializer.JsonSerializer;
import org.springframework.util.backoff.FixedBackOff;

import java.util.HashMap;
import java.util.Map;

/**
 * Configuration Apache Kafka pour Clenzy.
 *
 * Topics :
 * - airbnb.webhooks.incoming   : evenements bruts recus d'Airbnb
 * - airbnb.reservations.sync   : sync reservations Airbnb <-> Clenzy
 * - airbnb.calendar.sync       : sync calendrier
 * - airbnb.messages.sync       : sync messagerie
 * - airbnb.listings.sync       : sync annonces
 * - notifications.send         : notifications internes (email, push)
 * - audit.events               : evenements d'audit
 * - airbnb.dlq                 : Dead Letter Queue (messages en echec)
 * - minut.webhooks.incoming     : evenements bruts recus de Minut
 * - minut.noise.events          : evenements bruit traites Minut
 * - calendar.updates             : propagation mutations calendrier (outbox G6)
 */
@Configuration
@EnableKafka
@ConditionalOnProperty(name = "clenzy.kafka.enabled", havingValue = "true", matchIfMissing = true)
public class KafkaConfig {

    // ---- Noms des topics (constantes reutilisables) ----
    public static final String TOPIC_AIRBNB_WEBHOOKS = "airbnb.webhooks.incoming";
    public static final String TOPIC_AIRBNB_RESERVATIONS = "airbnb.reservations.sync";
    public static final String TOPIC_AIRBNB_CALENDAR = "airbnb.calendar.sync";
    public static final String TOPIC_AIRBNB_MESSAGES = "airbnb.messages.sync";
    public static final String TOPIC_AIRBNB_LISTINGS = "airbnb.listings.sync";
    public static final String TOPIC_NOTIFICATIONS = "notifications.send";
    public static final String TOPIC_AUDIT_EVENTS = "audit.events";
    public static final String TOPIC_DLQ = "airbnb.dlq";
    public static final String TOPIC_DOCUMENT_GENERATE = "documents.generate";
    public static final String TOPIC_MINUT_WEBHOOKS = "minut.webhooks.incoming";
    public static final String TOPIC_MINUT_NOISE_EVENTS = "minut.noise.events";
    public static final String TOPIC_CALENDAR_UPDATES = "calendar.updates";

    // ---- Expedia/VRBO topics ----
    public static final String TOPIC_EXPEDIA_RESERVATIONS = "expedia.reservations.sync";
    public static final String TOPIC_EXPEDIA_CALENDAR = "expedia.calendar.sync";
    public static final String TOPIC_EXPEDIA_DLQ = "expedia.dlq";

    // ---- Conversation / WhatsApp topics ----
    public static final String TOPIC_CONVERSATIONS = "conversations.events";
    public static final String TOPIC_BOOKING_MESSAGES = "booking.messages.sync";
    public static final String TOPIC_WHATSAPP_WEBHOOKS = "whatsapp.webhooks.incoming";

    // ---- Reviews & Pricing topics ----
    public static final String TOPIC_REVIEWS_SYNC = "reviews.sync";
    public static final String TOPIC_PRICING_EXTERNAL = "pricing.external.sync";

    @Value("${spring.kafka.bootstrap-servers:localhost:9092}")
    private String bootstrapServers;

    // ---- Producer ----
    @Bean
    public ProducerFactory<String, Object> producerFactory() {
        Map<String, Object> props = new HashMap<>();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);
        props.put(ProducerConfig.ACKS_CONFIG, "all");
        props.put(ProducerConfig.RETRIES_CONFIG, 3);
        props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);
        return new DefaultKafkaProducerFactory<>(props);
    }

    @Bean
    public KafkaTemplate<String, Object> kafkaTemplate() {
        return new KafkaTemplate<>(producerFactory());
    }

    // ---- Consumer ----
    @Bean
    public ConsumerFactory<String, Object> consumerFactory() {
        Map<String, Object> props = new HashMap<>();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ConsumerConfig.GROUP_ID_CONFIG, "clenzy-backend");
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, JsonDeserializer.class);
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);
        props.put(JsonDeserializer.TRUSTED_PACKAGES, "com.clenzy.*");
        props.put(JsonDeserializer.USE_TYPE_INFO_HEADERS, false);
        props.put(JsonDeserializer.VALUE_DEFAULT_TYPE, "java.util.LinkedHashMap");
        return new DefaultKafkaConsumerFactory<>(props);
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> kafkaListenerContainerFactory() {
        ConcurrentKafkaListenerContainerFactory<String, Object> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactory());
        factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.RECORD);

        // Concurrence : 1 consumer par partition (max 3 partitions)
        factory.setConcurrency(3);

        // Retry : 5 tentatives avec 2s d'intervalle, puis DLQ
        factory.setCommonErrorHandler(new DefaultErrorHandler(
                new FixedBackOff(2000L, 5)
        ));

        return factory;
    }

    // ---- Creation des topics ----
    @Bean
    public NewTopic airbnbWebhooksTopic() {
        return TopicBuilder.name(TOPIC_AIRBNB_WEBHOOKS)
                .partitions(3)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic airbnbReservationsTopic() {
        return TopicBuilder.name(TOPIC_AIRBNB_RESERVATIONS)
                .partitions(3)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic airbnbCalendarTopic() {
        return TopicBuilder.name(TOPIC_AIRBNB_CALENDAR)
                .partitions(3)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic airbnbMessagesTopic() {
        return TopicBuilder.name(TOPIC_AIRBNB_MESSAGES)
                .partitions(1)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic airbnbListingsTopic() {
        return TopicBuilder.name(TOPIC_AIRBNB_LISTINGS)
                .partitions(1)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic notificationsTopic() {
        return TopicBuilder.name(TOPIC_NOTIFICATIONS)
                .partitions(3)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic auditEventsTopic() {
        return TopicBuilder.name(TOPIC_AUDIT_EVENTS)
                .partitions(3)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic dlqTopic() {
        return TopicBuilder.name(TOPIC_DLQ)
                .partitions(1)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic documentGenerateTopic() {
        return TopicBuilder.name(TOPIC_DOCUMENT_GENERATE)
                .partitions(3)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic minutWebhooksTopic() {
        return TopicBuilder.name(TOPIC_MINUT_WEBHOOKS)
                .partitions(3)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic minutNoiseEventsTopic() {
        return TopicBuilder.name(TOPIC_MINUT_NOISE_EVENTS)
                .partitions(3)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic calendarUpdatesTopic() {
        return TopicBuilder.name(TOPIC_CALENDAR_UPDATES)
                .partitions(3)
                .replicas(1)
                .build();
    }

    // ---- Expedia/VRBO topics ----

    @Bean
    public NewTopic expediaReservationsTopic() {
        return TopicBuilder.name(TOPIC_EXPEDIA_RESERVATIONS)
                .partitions(3)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic expediaCalendarTopic() {
        return TopicBuilder.name(TOPIC_EXPEDIA_CALENDAR)
                .partitions(3)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic expediaDlqTopic() {
        return TopicBuilder.name(TOPIC_EXPEDIA_DLQ)
                .partitions(1)
                .replicas(1)
                .build();
    }

    // ---- Conversation / WhatsApp topics ----

    @Bean
    public NewTopic conversationsTopic() {
        return TopicBuilder.name(TOPIC_CONVERSATIONS)
                .partitions(3)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic bookingMessagesTopic() {
        return TopicBuilder.name(TOPIC_BOOKING_MESSAGES)
                .partitions(1)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic whatsappWebhooksTopic() {
        return TopicBuilder.name(TOPIC_WHATSAPP_WEBHOOKS)
                .partitions(1)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic reviewsSyncTopic() {
        return TopicBuilder.name(TOPIC_REVIEWS_SYNC)
                .partitions(3)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic pricingExternalTopic() {
        return TopicBuilder.name(TOPIC_PRICING_EXTERNAL)
                .partitions(3)
                .replicas(1)
                .build();
    }
}
