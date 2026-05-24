package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.Conversation;
import com.clenzy.model.ConversationChannel;
import com.clenzy.model.ConversationMessage;
import com.clenzy.repository.ConversationMessageRepository;
import com.clenzy.repository.ConversationRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests des 3 services paid apps Channex — Phase post-audit.
 * Couvre principalement les cas "app non installee" (empty fallback) + 1 happy path
 * mocke par service pour valider la wiring de bout en bout.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("Channex paid apps services (Messages / Reviews / Stripe Tokenization)")
class ChannexPaidAppsServicesTest {

    private static final ObjectMapper M = new ObjectMapper();

    // ─── Item 2 — Messages App ──────────────────────────────────────────────

    @Nested
    @DisplayName("Item 2 — ChannexMessagingService")
    class MessagingTests {

        @Mock private ChannexClient channexClient;
        @Mock private ChannexPropertyMappingRepository mappingRepository;
        @Mock private ConversationRepository conversationRepository;
        @Mock private ConversationMessageRepository messageRepository;

        private ChannexMessagingService service;

        @BeforeEach
        void setUp() {
            service = new ChannexMessagingService(channexClient, mappingRepository,
                conversationRepository, messageRepository);
            // save() retourne l'arg modifie pour que le service ait un objet non-null
            org.mockito.Mockito.lenient().when(conversationRepository.save(any()))
                .thenAnswer(inv -> inv.getArgument(0));
            org.mockito.Mockito.lenient().when(messageRepository.save(any()))
                .thenAnswer(inv -> inv.getArgument(0));
        }

        private ChannexPropertyMapping mapping() {
            ChannexPropertyMapping m = new ChannexPropertyMapping();
            m.setId(UUID.randomUUID());
            m.setOrganizationId(42L);
            m.setClenzyPropertyId(100L);
            m.setChannexPropertyId("channex-prop-1");
            return m;
        }

        @Test
        @DisplayName("onChannexMessage : payload incomplet -> empty + pas de save")
        void onMessage_incompletePayload() {
            JsonNode partial = M.createObjectNode().put("thread_id", "t1");
            assertThat(service.onChannexMessage(partial)).isEmpty();
            verify(conversationRepository, never()).save(any());
        }

        @Test
        @DisplayName("onChannexMessage : mapping absent -> empty silencieux")
        void onMessage_mappingAbsent() throws Exception {
            JsonNode payload = M.readTree("""
                {"thread_id":"t1","property_id":"p1","channel":"AIRBNB",
                 "message":"Hi","author_type":"guest","id":"m1"}
                """);
            when(mappingRepository.findByChannexPropertyIdAnyOrg("p1"))
                .thenReturn(Optional.empty());

            assertThat(service.onChannexMessage(payload)).isEmpty();
            verify(conversationRepository, never()).save(any());
        }

        @Test
        @DisplayName("onChannexMessage : payload complet + mapping OK -> upsert conversation + save message")
        void onMessage_happyPath() throws Exception {
            JsonNode payload = M.readTree("""
                {"thread_id":"t1","property_id":"p1","channel":"AIRBNB",
                 "message":"Bonjour, est-ce que le check-in est flexible ?",
                 "author_type":"guest","author_name":"Alice","id":"m1"}
                """);
            when(mappingRepository.findByChannexPropertyIdAnyOrg("p1"))
                .thenReturn(Optional.of(mapping()));
            when(conversationRepository.findByOrganizationIdAndChannelAndExternalConversationId(
                eq(42L), eq(ConversationChannel.AIRBNB), eq("t1")))
                .thenReturn(Optional.empty());

            Optional<ConversationMessage> result = service.onChannexMessage(payload);

            assertThat(result).isPresent();
            ArgumentCaptor<Conversation> convCaptor = ArgumentCaptor.forClass(Conversation.class);
            verify(conversationRepository).save(convCaptor.capture());
            assertThat(convCaptor.getValue().getChannel()).isEqualTo(ConversationChannel.AIRBNB);
            assertThat(convCaptor.getValue().getExternalConversationId()).isEqualTo("t1");
            assertThat(convCaptor.getValue().isUnread()).isTrue();
            ArgumentCaptor<ConversationMessage> msgCaptor = ArgumentCaptor.forClass(ConversationMessage.class);
            verify(messageRepository).save(msgCaptor.capture());
            assertThat(msgCaptor.getValue().getContent()).contains("check-in");
            assertThat(msgCaptor.getValue().getExternalMessageId()).isEqualTo("m1");
        }

        @Test
        @DisplayName("listThreadsForProperty : pas de mapping -> empty (app non testee)")
        void listThreads_noMapping() {
            when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
                .thenReturn(Optional.empty());
            assertThat(service.listThreadsForProperty(100L, 42L)).isEmpty();
        }
    }

    // ─── Item 3 — Reviews App ───────────────────────────────────────────────

    @Nested
    @DisplayName("Item 3 — ChannexReviewsService")
    class ReviewsTests {

        @Mock private ChannexClient channexClient;
        @Mock private ChannexPropertyMappingRepository mappingRepository;

        private ChannexReviewsService service;

        @BeforeEach
        void setUp() {
            service = new ChannexReviewsService(channexClient, mappingRepository);
        }

        @Test
        @DisplayName("listReviews : sans propertyId -> delegue avec channexPropertyId null")
        void listReviews_orgWide() {
            JsonNode stub = M.createObjectNode().put("count", 5);
            when(channexClient.fetchReviews(eq(null), eq(1), eq(20)))
                .thenReturn(Optional.of(stub));

            Optional<JsonNode> result = service.listReviews(null, 42L, 1, 20);

            assertThat(result).isPresent();
            assertThat(result.get().path("count").asInt()).isEqualTo(5);
        }

        @Test
        @DisplayName("listReviews : propertyId sans mapping -> empty + pas d'appel API")
        void listReviews_noMapping() {
            when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
                .thenReturn(Optional.empty());

            assertThat(service.listReviews(100L, 42L, 1, 20)).isEmpty();
            verify(channexClient, never()).fetchReviews(any(), anyInt(), anyInt());
        }

        @Test
        @DisplayName("replyToReview : text vide -> empty silencieux sans appel")
        void replyToReview_emptyText() {
            assertThat(service.replyToReview("r1", "")).isEmpty();
            assertThat(service.replyToReview("r1", null)).isEmpty();
            verify(channexClient, never()).replyToReview(any(), any());
        }

        @Test
        @DisplayName("replyToReview : text valide -> delegue")
        void replyToReview_valid() {
            JsonNode stub = M.createObjectNode().put("status", "replied");
            when(channexClient.replyToReview(eq("r1"), eq("Merci !"))).thenReturn(Optional.of(stub));

            assertThat(service.replyToReview("r1", "Merci !")).isPresent();
        }

        @Test
        @DisplayName("getPropertyScore + detailed : pas de mapping -> empty")
        void scores_noMapping() {
            when(mappingRepository.findByClenzyPropertyId(eq(100L), eq(42L)))
                .thenReturn(Optional.empty());

            assertThat(service.getPropertyScore(100L, 42L)).isEmpty();
            assertThat(service.getPropertyScoreDetailed(100L, 42L)).isEmpty();
        }
    }

    // ─── Item 4 — Stripe Tokenization App ───────────────────────────────────

    @Nested
    @DisplayName("Item 4 — ChannexStripeTokenizationService")
    class StripeTokenizationTests {

        @Mock private ChannexClient channexClient;

        private ChannexStripeTokenizationService serviceWithDefault;
        private ChannexStripeTokenizationService serviceNoDefault;

        @BeforeEach
        void setUp() {
            serviceWithDefault = new ChannexStripeTokenizationService(channexClient, "acct_DEFAULT");
            serviceNoDefault = new ChannexStripeTokenizationService(channexClient, "");
        }

        @Test
        @DisplayName("tokenize : pas de Stripe account configure -> empty + pas d'appel API")
        void tokenize_noAccountConfigured() {
            assertThat(serviceNoDefault.tokenize("b1", null)).isEmpty();
            verify(channexClient, never()).stripeTokenizeBookingPaymentMethod(any(), any());
        }

        @Test
        @DisplayName("tokenize : Channex retourne empty -> empty")
        void tokenize_channexEmpty() {
            when(channexClient.stripeTokenizeBookingPaymentMethod(eq("b1"), eq("acct_DEFAULT")))
                .thenReturn(Optional.empty());

            assertThat(serviceWithDefault.tokenize("b1", null)).isEmpty();
        }

        @Test
        @DisplayName("tokenize : Channex retourne payment_method_id -> Optional avec l'id")
        void tokenize_happyPath() throws Exception {
            JsonNode stub = M.readTree(
                "{\"data\":{\"payment_method_id\":\"pm_test_123\"}}");
            when(channexClient.stripeTokenizeBookingPaymentMethod(eq("b1"), eq("acct_OVERRIDE")))
                .thenReturn(Optional.of(stub));

            Optional<String> result = serviceWithDefault.tokenize("b1", "acct_OVERRIDE");

            assertThat(result).contains("pm_test_123");
        }

        @Test
        @DisplayName("tokenize : Channex retourne data.id fallback (sans payment_method_id key)")
        void tokenize_fallbackToDataId() throws Exception {
            JsonNode stub = M.readTree("{\"data\":{\"id\":\"pm_fallback_456\"}}");
            when(channexClient.stripeTokenizeBookingPaymentMethod(eq("b1"), eq("acct_DEFAULT")))
                .thenReturn(Optional.of(stub));

            assertThat(serviceWithDefault.tokenize("b1", null)).contains("pm_fallback_456");
        }

        @Test
        @DisplayName("tokenize : reponse sans aucun id -> empty + log warn")
        void tokenize_noIdInResponse() {
            JsonNode stub = M.createObjectNode().put("data", "weird");
            when(channexClient.stripeTokenizeBookingPaymentMethod(any(), any()))
                .thenReturn(Optional.of(stub));

            assertThat(serviceWithDefault.tokenize("b1", null)).isEmpty();
        }
    }
}
