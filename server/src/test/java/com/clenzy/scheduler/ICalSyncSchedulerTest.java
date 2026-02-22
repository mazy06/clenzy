package com.clenzy.scheduler;

import com.clenzy.model.ICalFeed;
import com.clenzy.model.Property;
import com.clenzy.repository.ICalFeedRepository;
import com.clenzy.service.ICalImportService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

/**
 * Tests for {@link ICalSyncScheduler}.
 * Validates multi-tenant feed grouping, error isolation, and sync delegation.
 */
@ExtendWith(MockitoExtension.class)
class ICalSyncSchedulerTest {

    @Mock
    private ICalImportService iCalImportService;
    @Mock
    private ICalFeedRepository iCalFeedRepository;

    private ICalSyncScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new ICalSyncScheduler(iCalImportService, iCalFeedRepository);
    }

    private ICalFeed createFeed(Long orgId) {
        ICalFeed feed = new ICalFeed();
        Property property = new Property();
        property.setOrganizationId(orgId);
        feed.setProperty(property);
        return feed;
    }

    @Nested
    @DisplayName("syncActiveFeeds")
    class SyncActiveFeeds {

        @Test
        void whenNoActiveFeeds_thenDoesNothing() {
            when(iCalFeedRepository.findBySyncEnabledTrue()).thenReturn(List.of());

            scheduler.syncActiveFeeds();

            verify(iCalImportService, never()).syncFeeds(anyList());
        }

        @Test
        void whenActiveFeedsExist_thenSyncsGroupedByOrg() {
            ICalFeed feed1 = createFeed(1L);
            ICalFeed feed2 = createFeed(1L);
            ICalFeed feed3 = createFeed(2L);

            when(iCalFeedRepository.findBySyncEnabledTrue()).thenReturn(List.of(feed1, feed2, feed3));

            scheduler.syncActiveFeeds();

            // Should call syncFeeds twice: once for org 1, once for org 2
            verify(iCalImportService, times(2)).syncFeeds(anyList());
        }

        @Test
        void whenOneFeedHasNullProperty_thenFilteredOut() {
            ICalFeed feedWithProperty = createFeed(1L);
            ICalFeed feedWithoutProperty = new ICalFeed(); // No property

            when(iCalFeedRepository.findBySyncEnabledTrue()).thenReturn(List.of(feedWithProperty, feedWithoutProperty));

            scheduler.syncActiveFeeds();

            // Only one org group should be processed
            verify(iCalImportService, times(1)).syncFeeds(anyList());
        }

        @Test
        void whenSyncFailsForOneOrg_thenContinuesWithOthers() {
            ICalFeed feed1 = createFeed(1L);
            ICalFeed feed2 = createFeed(2L);

            when(iCalFeedRepository.findBySyncEnabledTrue()).thenReturn(List.of(feed1, feed2));
            doThrow(new RuntimeException("Sync failed")).when(iCalImportService).syncFeeds(argThat(
                    list -> list.stream().anyMatch(f -> f.getProperty().getOrganizationId() == 1L)
            ));

            scheduler.syncActiveFeeds();

            // Should still call sync for org 2
            verify(iCalImportService, times(2)).syncFeeds(anyList());
        }
    }
}
