package com.clenzy.service.agent.tools;

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

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ReplyToReviewToolTest {

    private ReviewService reviewService;
    private ReplyToReviewTool tool;
    private ObjectMapper om;
    private AgentContext ctx;

    @BeforeEach
    void setUp() {
        reviewService = mock(ReviewService.class);
        om = new ObjectMapper();
        tool = new ReplyToReviewTool(reviewService, om);
        ctx = AgentContext.minimal(7L, "user-1");
    }

    private ObjectNode validArgs() {
        ObjectNode args = om.createObjectNode();
        args.put("reviewId", 99);
        args.put("responseText", "Merci pour votre sejour, au plaisir de vous revoir !");
        return args;
    }

    private GuestReview stubReview() {
        GuestReview r = new GuestReview();
        r.setId(99L);
        r.setOrganizationId(7L);
        r.setGuestName("Alice");
        r.setRating(5);
        r.setHostResponse("Merci pour votre sejour, au plaisir de vous revoir !");
        r.setHostRespondedAt(Instant.parse("2026-06-26T10:00:00Z"));
        return r;
    }

    @Test
    void name_andDescriptor_requireConfirmation() {
        assertEquals("reply_to_review", tool.name());
        assertEquals("reply_to_review", tool.descriptor().name());
        assertTrue(tool.descriptor().requiresConfirmation());
        JsonNode schema = tool.descriptor().jsonSchema();
        String req = schema.path("required").toString();
        assertTrue(req.contains("reviewId"));
        assertTrue(req.contains("responseText"));
    }

    @Test
    void missingReviewId_throws() {
        ObjectNode args = om.createObjectNode();
        args.put("responseText", "Merci");
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("reviewid"));
    }

    @Test
    void blankResponseText_throws() {
        ObjectNode args = om.createObjectNode();
        args.put("reviewId", 99);
        args.put("responseText", "   ");
        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(args, ctx));
        assertTrue(ex.getMessage().toLowerCase().contains("responsetext"));
    }

    @Test
    void happyPath_delegatesWithOrgIdAndText() throws Exception {
        when(reviewService.respondToReview(eq(99L), eq(7L), anyString()))
                .thenReturn(stubReview());

        ToolResult result = tool.execute(validArgs(), ctx);

        assertFalse(result.isError());
        assertEquals("summary", result.displayHint());

        verify(reviewService).respondToReview(
                99L, 7L, "Merci pour votre sejour, au plaisir de vous revoir !");

        JsonNode payload = om.readTree(result.content());
        assertEquals(99L, payload.path("id").asLong());
        assertEquals("Alice", payload.path("guestName").asText());
        assertEquals(5, payload.path("rating").asInt());
        assertEquals("Merci pour votre sejour, au plaisir de vous revoir !",
                payload.path("hostResponse").asText());
        assertEquals("2026-06-26T10:00:00Z", payload.path("respondedAt").asText());
        assertTrue(payload.path("message").asText().contains("99"));
    }

    @Test
    void serviceThrows_wrappedAsToolExecutionException() {
        when(reviewService.respondToReview(anyLong(), anyLong(), anyString()))
                .thenThrow(new IllegalArgumentException("Review not found: 99"));

        ToolExecutionException ex = assertThrows(ToolExecutionException.class,
                () -> tool.execute(validArgs(), ctx));
        assertTrue(ex.getMessage().contains("Review not found"));
        assertEquals("reply_to_review", ex.getToolName());
    }
}
