package com.clenzy.controller;

import com.clenzy.dto.CreateReviewRequest;
import com.clenzy.dto.GuestReviewDto;
import com.clenzy.dto.ReviewResponseRequest;
import com.clenzy.dto.ReviewStatsDto;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.GuestReview;
import com.clenzy.service.ReviewService;
import com.clenzy.service.ReviewSyncService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReviewControllerTest {

    @Mock private ReviewService reviewService;
    @Mock private ReviewSyncService syncService;
    @Mock private TenantContext tenantContext;

    private ReviewController controller;

    @BeforeEach
    void setUp() {
        controller = new ReviewController(reviewService, syncService, tenantContext);
        lenient().when(tenantContext.getOrganizationId()).thenReturn(1L);
    }

    private GuestReview stubReview() {
        GuestReview r = new GuestReview();
        r.setId(10L);
        r.setRating(4);
        r.setChannelName(ChannelName.AIRBNB);
        r.setGuestName("Bob");
        r.setReviewText("Great stay");
        r.setReviewDate(LocalDate.of(2026, 1, 1));
        return r;
    }

    @Test
    void getAll_noFilter_returnsAllReviews() {
        Page<GuestReview> page = new PageImpl<>(List.of(stubReview()));
        when(reviewService.getAll(eq(1L), any(PageRequest.class))).thenReturn(page);

        ResponseEntity<Page<GuestReviewDto>> resp = controller.getAll(0, 20, null, null);

        assertThat(resp.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(resp.getBody().getContent()).hasSize(1);
        verify(reviewService).getAll(eq(1L), any(PageRequest.class));
        verifyNoMoreInteractions(reviewService);
    }

    @Test
    void getAll_byProperty_callsGetByProperty() {
        Page<GuestReview> page = new PageImpl<>(List.of(stubReview()));
        when(reviewService.getByProperty(eq(100L), eq(1L), any(PageRequest.class))).thenReturn(page);

        ResponseEntity<Page<GuestReviewDto>> resp = controller.getAll(0, 20, 100L, null);

        assertThat(resp.getBody().getContent()).hasSize(1);
        verify(reviewService).getByProperty(eq(100L), eq(1L), any());
        verify(reviewService, never()).getAll(any(), any());
    }

    @Test
    void getAll_byChannel_callsGetByChannel() {
        Page<GuestReview> page = new PageImpl<>(List.of(stubReview()));
        when(reviewService.getByChannel(eq(ChannelName.AIRBNB), eq(1L), any(PageRequest.class)))
                .thenReturn(page);

        ResponseEntity<Page<GuestReviewDto>> resp = controller.getAll(0, 20, null, ChannelName.AIRBNB);

        assertThat(resp.getBody().getContent()).hasSize(1);
        verify(reviewService).getByChannel(eq(ChannelName.AIRBNB), eq(1L), any());
    }

    @Test
    void getAll_byProperty_winsOverChannel() {
        Page<GuestReview> page = new PageImpl<>(List.of());
        when(reviewService.getByProperty(eq(50L), eq(1L), any())).thenReturn(page);

        controller.getAll(0, 20, 50L, ChannelName.BOOKING);

        verify(reviewService).getByProperty(eq(50L), eq(1L), any());
        verify(reviewService, never()).getByChannel(any(), any(), any());
    }

    @Test
    void getById_returnsDto() {
        when(reviewService.getById(10L, 1L)).thenReturn(stubReview());

        ResponseEntity<GuestReviewDto> resp = controller.getById(10L);

        assertThat(resp.getBody().id()).isEqualTo(10L);
        assertThat(resp.getBody().rating()).isEqualTo(4);
    }

    @Test
    void getStats_delegatesToService() {
        ReviewStatsDto stats = new ReviewStatsDto(50L, 4.5, 20L, Map.of(), Map.of());
        when(reviewService.getStats(50L, 1L)).thenReturn(stats);

        ResponseEntity<ReviewStatsDto> resp = controller.getStats(50L);

        assertThat(resp.getBody()).isEqualTo(stats);
    }

    @Test
    void create_callsAddReview() {
        CreateReviewRequest req = new CreateReviewRequest(
                10L, null, ChannelName.AIRBNB, "G", 5, "Top", LocalDate.now(), "fr");
        when(reviewService.addReview(req, 1L)).thenReturn(stubReview());

        ResponseEntity<GuestReviewDto> resp = controller.create(req);

        assertThat(resp.getBody().id()).isEqualTo(10L);
    }

    @Test
    void respond_callsRespondToReview() {
        ReviewResponseRequest req = new ReviewResponseRequest("Thanks for staying!");
        when(reviewService.respondToReview(10L, 1L, "Thanks for staying!")).thenReturn(stubReview());

        ResponseEntity<GuestReviewDto> resp = controller.respond(10L, req);

        assertThat(resp.getBody().id()).isEqualTo(10L);
    }

    @Test
    void sync_callsSyncService() {
        when(syncService.syncReviewsForProperty(33L, 1L)).thenReturn(7);

        ResponseEntity<Map<String, Object>> resp = controller.sync(33L);

        assertThat(resp.getBody().get("synced")).isEqualTo(7);
        assertThat(resp.getBody().get("propertyId")).isEqualTo(33L);
    }
}
