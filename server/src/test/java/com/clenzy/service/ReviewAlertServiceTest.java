package com.clenzy.service;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.GuestReview;
import com.clenzy.model.NotificationKey;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReviewAlertServiceTest {

    @Mock private ReviewService reviewService;
    @Mock private NotificationService notificationService;

    @InjectMocks
    private ReviewAlertService service;

    private static final Long ORG_ID = 1L;

    private GuestReview negativeReview;

    @BeforeEach
    void setUp() {
        negativeReview = new GuestReview();
        negativeReview.setId(1L);
        negativeReview.setOrganizationId(ORG_ID);
        negativeReview.setPropertyId(100L);
        negativeReview.setChannelName(ChannelName.AIRBNB);
        negativeReview.setGuestName("Unhappy Guest");
        negativeReview.setRating(2);
        negativeReview.setReviewText("Terrible experience, dirty and noisy.");
        negativeReview.setReviewDate(LocalDate.now());
    }

    @Test
    void checkAndAlertNegativeReviews_withNegativeReviews_createsAlerts() {
        when(reviewService.findNegativeWithoutResponse(ORG_ID, 3))
            .thenReturn(List.of(negativeReview));

        int alertCount = service.checkAndAlertNegativeReviews(ORG_ID);

        assertEquals(1, alertCount);
        verify(notificationService).notifyAdminsAndManagers(
            eq(NotificationKey.REVIEW_NEGATIVE_ALERT),
            eq("Avis negatif recu"),
            contains("Unhappy Guest"),
            eq("/reviews")
        );
    }

    @Test
    void checkAndAlertNegativeReviews_withNoNegativeReviews_returnsZero() {
        when(reviewService.findNegativeWithoutResponse(ORG_ID, 3))
            .thenReturn(List.of());

        int alertCount = service.checkAndAlertNegativeReviews(ORG_ID);

        assertEquals(0, alertCount);
        verifyNoInteractions(notificationService);
    }

    @Test
    void checkAndAlertNegativeReviews_withCustomThreshold_usesThreshold() {
        when(reviewService.findNegativeWithoutResponse(ORG_ID, 2))
            .thenReturn(List.of(negativeReview));

        int alertCount = service.checkAndAlertNegativeReviews(ORG_ID, 2);

        assertEquals(1, alertCount);
        verify(reviewService).findNegativeWithoutResponse(ORG_ID, 2);
    }

    @Test
    void checkAndAlertNegativeReviews_notificationFailure_continuesWithOthers() {
        GuestReview review2 = new GuestReview();
        review2.setId(2L);
        review2.setOrganizationId(ORG_ID);
        review2.setPropertyId(200L);
        review2.setChannelName(ChannelName.BOOKING);
        review2.setGuestName("Another Guest");
        review2.setRating(1);
        review2.setReviewText("Worst stay ever");
        review2.setReviewDate(LocalDate.now());

        when(reviewService.findNegativeWithoutResponse(ORG_ID, 3))
            .thenReturn(List.of(negativeReview, review2));

        // First notification fails, second succeeds
        doThrow(new RuntimeException("Notification error"))
            .doNothing()
            .when(notificationService).notifyAdminsAndManagers(
                any(NotificationKey.class), anyString(), anyString(), anyString());

        int alertCount = service.checkAndAlertNegativeReviews(ORG_ID);

        assertEquals(1, alertCount);
        verify(notificationService, times(2)).notifyAdminsAndManagers(
            any(NotificationKey.class), anyString(), anyString(), anyString());
    }
}
