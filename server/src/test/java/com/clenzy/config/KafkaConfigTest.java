package com.clenzy.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests unitaires pour {@link KafkaConfig}.
 *
 * <p>On instancie directement la classe (sans Spring), on injecte la propriete
 * {@code bootstrapServers} via reflection puis on appelle chaque @Bean.
 * Chaque NewTopic doit avoir le nom + partitions + replicas attendus.</p>
 */
@DisplayName("KafkaConfig")
class KafkaConfigTest {

    private KafkaConfig config;

    @BeforeEach
    void setUp() {
        config = new KafkaConfig();
        ReflectionTestUtils.setField(config, "bootstrapServers", "localhost:9092");
    }

    @Test
    @DisplayName("producerFactory: cree un DefaultKafkaProducerFactory configure")
    void producerFactory_isCreated() {
        ProducerFactory<String, Object> factory = config.producerFactory();
        assertThat(factory).isNotNull();
    }

    @Test
    @DisplayName("kafkaTemplate: wrappe la producer factory")
    void kafkaTemplate_isCreated() {
        KafkaTemplate<String, Object> template = config.kafkaTemplate();
        assertThat(template).isNotNull();
        assertThat(template.getProducerFactory()).isNotNull();
    }

    @Test
    @DisplayName("consumerFactory: cree un DefaultKafkaConsumerFactory configure")
    void consumerFactory_isCreated() {
        ConsumerFactory<String, Object> factory = config.consumerFactory();
        assertThat(factory).isNotNull();
    }

    @Test
    @DisplayName("kafkaListenerContainerFactory: ack-mode=RECORD + concurrency=3 + error handler")
    void listenerContainerFactory_isCreated() {
        ConcurrentKafkaListenerContainerFactory<String, Object> factory =
            config.kafkaListenerContainerFactory();

        assertThat(factory).isNotNull();
        assertThat(factory.getContainerProperties().getAckMode())
            .isEqualTo(org.springframework.kafka.listener.ContainerProperties.AckMode.RECORD);
        assertThat(factory.getContainerProperties()).isNotNull();
    }

    // ─── NewTopic beans ────────────────────────────────────────────────────────

    private void assertTopic(NewTopic topic, String expectedName, int expectedPartitions, int expectedReplicas) {
        assertThat(topic).isNotNull();
        assertThat(topic.name()).isEqualTo(expectedName);
        assertThat(topic.numPartitions()).isEqualTo(expectedPartitions);
        assertThat(topic.replicationFactor()).isEqualTo((short) expectedReplicas);
    }

    @Test
    @DisplayName("Airbnb topics: webhooks/reservations/calendar (3 partitions) + messages/listings (1 partition)")
    void airbnbTopics_areConfigured() {
        assertTopic(config.airbnbWebhooksTopic(), KafkaConfig.TOPIC_AIRBNB_WEBHOOKS, 3, 1);
        assertTopic(config.airbnbReservationsTopic(), KafkaConfig.TOPIC_AIRBNB_RESERVATIONS, 3, 1);
        assertTopic(config.airbnbCalendarTopic(), KafkaConfig.TOPIC_AIRBNB_CALENDAR, 3, 1);
        assertTopic(config.airbnbMessagesTopic(), KafkaConfig.TOPIC_AIRBNB_MESSAGES, 1, 1);
        assertTopic(config.airbnbListingsTopic(), KafkaConfig.TOPIC_AIRBNB_LISTINGS, 1, 1);
    }

    @Test
    @DisplayName("Notifications + audit topics")
    void notificationAndAudit_topics() {
        assertTopic(config.notificationsTopic(), KafkaConfig.TOPIC_NOTIFICATIONS, 3, 1);
        assertTopic(config.auditEventsTopic(), KafkaConfig.TOPIC_AUDIT_EVENTS, 3, 1);
        assertTopic(config.dlqTopic(), KafkaConfig.TOPIC_DLQ, 1, 1);
    }

    @Test
    @DisplayName("Document generate topic")
    void documentGenerate_topic() {
        assertTopic(config.documentGenerateTopic(), KafkaConfig.TOPIC_DOCUMENT_GENERATE, 3, 1);
    }

    @Test
    @DisplayName("Minut topics")
    void minut_topics() {
        assertTopic(config.minutWebhooksTopic(), KafkaConfig.TOPIC_MINUT_WEBHOOKS, 3, 1);
        assertTopic(config.minutNoiseEventsTopic(), KafkaConfig.TOPIC_MINUT_NOISE_EVENTS, 3, 1);
    }

    @Test
    @DisplayName("Calendar updates topic")
    void calendarUpdates_topic() {
        assertTopic(config.calendarUpdatesTopic(), KafkaConfig.TOPIC_CALENDAR_UPDATES, 3, 1);
    }

    @Test
    @DisplayName("User profile topic")
    void userProfile_topic() {
        assertTopic(config.userProfileTopic(), KafkaConfig.TOPIC_USER_PROFILE, 3, 1);
    }

    @Test
    @DisplayName("Expedia topics")
    void expedia_topics() {
        assertTopic(config.expediaReservationsTopic(), KafkaConfig.TOPIC_EXPEDIA_RESERVATIONS, 3, 1);
        assertTopic(config.expediaCalendarTopic(), KafkaConfig.TOPIC_EXPEDIA_CALENDAR, 3, 1);
        assertTopic(config.expediaDlqTopic(), KafkaConfig.TOPIC_EXPEDIA_DLQ, 1, 1);
    }

    @Test
    @DisplayName("Conversation + WhatsApp topics")
    void conversation_topics() {
        assertTopic(config.conversationsTopic(), KafkaConfig.TOPIC_CONVERSATIONS, 3, 1);
        assertTopic(config.bookingMessagesTopic(), KafkaConfig.TOPIC_BOOKING_MESSAGES, 1, 1);
        assertTopic(config.whatsappWebhooksTopic(), KafkaConfig.TOPIC_WHATSAPP_WEBHOOKS, 1, 1);
    }

    @Test
    @DisplayName("Reviews + pricing topics")
    void reviews_pricing_topics() {
        assertTopic(config.reviewsSyncTopic(), KafkaConfig.TOPIC_REVIEWS_SYNC, 3, 1);
        assertTopic(config.pricingExternalTopic(), KafkaConfig.TOPIC_PRICING_EXTERNAL, 3, 1);
    }

    @Test
    @DisplayName("Payment topics")
    void payment_topics() {
        assertTopic(config.paymentEventsTopic(), KafkaConfig.TOPIC_PAYMENT_EVENTS, 3, 1);
    }

    @Test
    @DisplayName("constants topic names sont les noms attendus (regression check)")
    void topicConstants_areStable() {
        assertThat(KafkaConfig.TOPIC_AIRBNB_WEBHOOKS).isEqualTo("airbnb.webhooks.incoming");
        assertThat(KafkaConfig.TOPIC_AIRBNB_RESERVATIONS).isEqualTo("airbnb.reservations.sync");
        assertThat(KafkaConfig.TOPIC_AIRBNB_CALENDAR).isEqualTo("airbnb.calendar.sync");
        assertThat(KafkaConfig.TOPIC_AIRBNB_MESSAGES).isEqualTo("airbnb.messages.sync");
        assertThat(KafkaConfig.TOPIC_AIRBNB_LISTINGS).isEqualTo("airbnb.listings.sync");
        assertThat(KafkaConfig.TOPIC_NOTIFICATIONS).isEqualTo("notifications.send");
        assertThat(KafkaConfig.TOPIC_AUDIT_EVENTS).isEqualTo("audit.events");
        assertThat(KafkaConfig.TOPIC_DLQ).isEqualTo("airbnb.dlq");
        assertThat(KafkaConfig.TOPIC_DOCUMENT_GENERATE).isEqualTo("documents.generate");
        assertThat(KafkaConfig.TOPIC_MINUT_WEBHOOKS).isEqualTo("minut.webhooks.incoming");
        assertThat(KafkaConfig.TOPIC_MINUT_NOISE_EVENTS).isEqualTo("minut.noise.events");
        assertThat(KafkaConfig.TOPIC_CALENDAR_UPDATES).isEqualTo("calendar.updates");
        assertThat(KafkaConfig.TOPIC_USER_PROFILE).isEqualTo("users.profile.updates");
        assertThat(KafkaConfig.TOPIC_EXPEDIA_RESERVATIONS).isEqualTo("expedia.reservations.sync");
        assertThat(KafkaConfig.TOPIC_EXPEDIA_CALENDAR).isEqualTo("expedia.calendar.sync");
        assertThat(KafkaConfig.TOPIC_EXPEDIA_DLQ).isEqualTo("expedia.dlq");
        assertThat(KafkaConfig.TOPIC_CONVERSATIONS).isEqualTo("conversations.events");
        assertThat(KafkaConfig.TOPIC_BOOKING_MESSAGES).isEqualTo("booking.messages.sync");
        assertThat(KafkaConfig.TOPIC_WHATSAPP_WEBHOOKS).isEqualTo("whatsapp.webhooks.incoming");
        assertThat(KafkaConfig.TOPIC_REVIEWS_SYNC).isEqualTo("reviews.sync");
        assertThat(KafkaConfig.TOPIC_PRICING_EXTERNAL).isEqualTo("pricing.external.sync");
        assertThat(KafkaConfig.TOPIC_PAYMENT_EVENTS).isEqualTo("payment.events");
    }
}
