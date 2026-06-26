package com.clenzy.service.agent.tools;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.GuestReview;
import com.clenzy.service.ReviewService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ListReviewsToolTest {

    private ReviewService reviewService;
    private ListReviewsTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        reviewService = mock(ReviewService.class);
        om = new ObjectMapper();
        tool = new ListReviewsTool(reviewService, om);
        ctx = AgentContext.minimal(7L, "user-abc");
    }

    private static GuestReview review(Long id, int rating, String text, ChannelName channel,
                                      Long propertyId, String guestName, LocalDate date) {
        GuestReview r = new GuestReview();
        r.setId(id);
        r.setRating(rating);
        r.setReviewText(text);
        r.setChannelName(channel);
        r.setPropertyId(propertyId);
        r.setGuestName(guestName);
        r.setReviewDate(date);
        return r;
    }

    @Test
    void name_matchesDescriptor() {
        assertEquals("list_reviews", tool.name());
        assertEquals("list_reviews", tool.descriptor().name());
        assertFalse(tool.descriptor().requiresConfirmation());
    }

    @Test
    void noChannel_listsAllReviews_viaGetAll() throws Exception {
        List<GuestReview> reviews = List.of(
                review(1L, 5, "Sejour parfait, logement impeccable.", ChannelName.AIRBNB,
                        10L, "Alice", LocalDate.of(2026, 6, 20)),
                review(2L, 3, "Correct mais bruyant.", ChannelName.BOOKING,
                        11L, "Bob", LocalDate.of(2026, 6, 18))
        );
        Page<GuestReview> page = new PageImpl<>(reviews, Pageable.ofSize(25), 2);
        when(reviewService.getAll(eq(7L), any())).thenReturn(page);

        ToolResult result = tool.execute(om.createObjectNode(), ctx);

        assertFalse(result.isError());
        assertEquals("list", result.displayHint());
        verify(reviewService).getAll(eq(7L), any());
        verify(reviewService, never()).getByChannel(any(), anyLong(), any());

        JsonNode payload = om.readTree(result.content());
        assertEquals(2, payload.path("count").asInt());
        assertEquals(2, payload.path("totalReviews").asLong());
        assertFalse(payload.has("channelFilter"));

        JsonNode first = payload.path("items").get(0);
        assertEquals(5, first.path("rating").asInt());
        assertEquals("Sejour parfait, logement impeccable.", first.path("comment").asText());
        assertEquals("AIRBNB", first.path("channel").asText());
        assertEquals(10L, first.path("propertyId").asLong());
        assertEquals("Alice", first.path("guestName").asText());
        assertEquals("2026-06-20", first.path("reviewDate").asText());
        assertFalse(first.path("hasHostResponse").asBoolean());
    }

    @Test
    void withChannel_filtersViaGetByChannel() throws Exception {
        List<GuestReview> reviews = List.of(
                review(3L, 4, "Bien.", ChannelName.AIRBNB, 12L, "Carol", LocalDate.of(2026, 6, 15))
        );
        Page<GuestReview> page = new PageImpl<>(reviews, Pageable.ofSize(25), 1);
        when(reviewService.getByChannel(eq(ChannelName.AIRBNB), eq(7L), any())).thenReturn(page);

        ObjectNode args = om.createObjectNode();
        args.put("channel", "airbnb");

        ToolResult result = tool.execute(args, ctx);

        assertFalse(result.isError());
        verify(reviewService).getByChannel(eq(ChannelName.AIRBNB), eq(7L), any());
        verify(reviewService, never()).getAll(anyLong(), any());

        JsonNode payload = om.readTree(result.content());
        assertEquals(1, payload.path("count").asInt());
        assertEquals("AIRBNB", payload.path("channelFilter").asText());
    }

    @Test
    void unknownChannel_throwsToolExecutionException() {
        ObjectNode args = om.createObjectNode();
        args.put("channel", "NOT_A_CHANNEL");

        assertThrows(ToolExecutionException.class, () -> tool.execute(args, ctx));
        verifyNoInteractions(reviewService);
    }

    @Test
    void longComment_isTruncated() throws Exception {
        String longText = "x".repeat(400);
        Page<GuestReview> page = new PageImpl<>(List.of(
                review(4L, 5, longText, ChannelName.DIRECT, 13L, "Dan", LocalDate.of(2026, 6, 10))
        ), Pageable.ofSize(25), 1);
        when(reviewService.getAll(eq(7L), any())).thenReturn(page);

        JsonNode item = om.readTree(tool.execute(om.createObjectNode(), ctx).content())
                .path("items").get(0);
        String comment = item.path("comment").asText();
        assertTrue(comment.endsWith("…"));
        assertTrue(comment.length() <= 281); // 280 chars + ellipsis
    }
}
