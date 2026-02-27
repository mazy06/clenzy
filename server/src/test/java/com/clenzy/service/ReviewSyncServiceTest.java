package com.clenzy.service;

import com.clenzy.integration.channel.ChannelCapability;
import com.clenzy.integration.channel.ChannelConnector;
import com.clenzy.integration.channel.ChannelConnectorRegistry;
import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.GuestReview;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReviewSyncServiceTest {

    @Mock private ChannelConnectorRegistry connectorRegistry;
    @Mock private ReviewService reviewService;

    @InjectMocks
    private ReviewSyncService service;

    private static final Long PROPERTY_ID = 100L;
    private static final Long ORG_ID = 1L;

    @Test
    void syncReviewsForProperty_withNoConnectors_returnsZero() {
        when(connectorRegistry.getConnectorsWithCapability(ChannelCapability.REVIEWS))
            .thenReturn(List.of());

        int result = service.syncReviewsForProperty(PROPERTY_ID, ORG_ID);

        assertEquals(0, result);
        verifyNoInteractions(reviewService);
    }

    @Test
    void syncReviewsForProperty_syncsFromMultipleConnectors() {
        ChannelConnector airbnbConnector = mock(ChannelConnector.class);
        ChannelConnector bookingConnector = mock(ChannelConnector.class);

        GuestReview review1 = new GuestReview();
        review1.setExternalReviewId("airbnb-1");
        review1.setRating(5);

        GuestReview review2 = new GuestReview();
        review2.setExternalReviewId("booking-1");
        review2.setRating(4);

        GuestReview review3 = new GuestReview();
        review3.setExternalReviewId("booking-2");
        review3.setRating(3);

        when(connectorRegistry.getConnectorsWithCapability(ChannelCapability.REVIEWS))
            .thenReturn(List.of(airbnbConnector, bookingConnector));
        when(airbnbConnector.getChannelName()).thenReturn(ChannelName.AIRBNB);
        when(bookingConnector.getChannelName()).thenReturn(ChannelName.BOOKING);
        when(airbnbConnector.pullReviews(eq(PROPERTY_ID), eq(ORG_ID), any(LocalDate.class)))
            .thenReturn(List.of(review1));
        when(bookingConnector.pullReviews(eq(PROPERTY_ID), eq(ORG_ID), any(LocalDate.class)))
            .thenReturn(List.of(review2, review3));
        when(reviewService.addOrUpdateFromSync(any(GuestReview.class)))
            .thenAnswer(inv -> inv.getArgument(0));

        int result = service.syncReviewsForProperty(PROPERTY_ID, ORG_ID);

        assertEquals(3, result);
        verify(reviewService, times(3)).addOrUpdateFromSync(any(GuestReview.class));
    }

    @Test
    void syncReviewsForProperty_setsOrgIdAndPropertyId() {
        ChannelConnector connector = mock(ChannelConnector.class);
        GuestReview review = new GuestReview();
        review.setRating(4);

        when(connectorRegistry.getConnectorsWithCapability(ChannelCapability.REVIEWS))
            .thenReturn(List.of(connector));
        when(connector.getChannelName()).thenReturn(ChannelName.AIRBNB);
        when(connector.pullReviews(eq(PROPERTY_ID), eq(ORG_ID), any(LocalDate.class)))
            .thenReturn(List.of(review));
        when(reviewService.addOrUpdateFromSync(any(GuestReview.class)))
            .thenAnswer(inv -> inv.getArgument(0));

        service.syncReviewsForProperty(PROPERTY_ID, ORG_ID);

        assertEquals(ORG_ID, review.getOrganizationId());
        assertEquals(PROPERTY_ID, review.getPropertyId());
    }

    @Test
    void syncReviewsForProperty_connectorError_continuesWithOthers() {
        ChannelConnector failingConnector = mock(ChannelConnector.class);
        ChannelConnector workingConnector = mock(ChannelConnector.class);

        GuestReview review = new GuestReview();
        review.setRating(5);

        when(connectorRegistry.getConnectorsWithCapability(ChannelCapability.REVIEWS))
            .thenReturn(List.of(failingConnector, workingConnector));
        when(failingConnector.getChannelName()).thenReturn(ChannelName.BOOKING);
        when(failingConnector.pullReviews(eq(PROPERTY_ID), eq(ORG_ID), any(LocalDate.class)))
            .thenThrow(new RuntimeException("API error"));
        when(workingConnector.getChannelName()).thenReturn(ChannelName.AIRBNB);
        when(workingConnector.pullReviews(eq(PROPERTY_ID), eq(ORG_ID), any(LocalDate.class)))
            .thenReturn(List.of(review));
        when(reviewService.addOrUpdateFromSync(any(GuestReview.class)))
            .thenAnswer(inv -> inv.getArgument(0));

        int result = service.syncReviewsForProperty(PROPERTY_ID, ORG_ID);

        assertEquals(1, result);
        verify(reviewService, times(1)).addOrUpdateFromSync(any(GuestReview.class));
    }

    @Test
    void syncReviewsForProperty_connectorReturnsEmpty_returnsZero() {
        ChannelConnector connector = mock(ChannelConnector.class);

        when(connectorRegistry.getConnectorsWithCapability(ChannelCapability.REVIEWS))
            .thenReturn(List.of(connector));
        when(connector.getChannelName()).thenReturn(ChannelName.AIRBNB);
        when(connector.pullReviews(eq(PROPERTY_ID), eq(ORG_ID), any(LocalDate.class)))
            .thenReturn(List.of());

        int result = service.syncReviewsForProperty(PROPERTY_ID, ORG_ID);

        assertEquals(0, result);
        verifyNoInteractions(reviewService);
    }
}
