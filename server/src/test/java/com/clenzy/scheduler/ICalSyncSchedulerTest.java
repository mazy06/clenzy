package com.clenzy.scheduler;

import com.clenzy.model.ICalFeed;
import com.clenzy.model.Property;
import com.clenzy.repository.ICalFeedRepository;
import com.clenzy.service.ICalImportService;
import com.clenzy.tenant.TenantScopedExecutor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Tests for {@link ICalSyncScheduler}.
 * Validates multi-tenant feed grouping, error isolation, and tenant-scoped
 * sync delegation (Z2-EFFETS-02 : chaque org est traitee via
 * {@link TenantScopedExecutor} pour que le filtre Hibernate soit actif).
 */
@ExtendWith(MockitoExtension.class)
class ICalSyncSchedulerTest {

    @Mock
    private ICalImportService iCalImportService;
    @Mock
    private ICalFeedRepository iCalFeedRepository;
    @Mock
    private TenantScopedExecutor tenantScopedExecutor;

    private ICalSyncScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new ICalSyncScheduler(iCalImportService, iCalFeedRepository, tenantScopedExecutor);
        // Par defaut l'executor execute l'action (comportement reel) : les
        // verifications sur iCalImportService restent possibles.
        lenient().doAnswer(invocation -> {
            Runnable action = invocation.getArgument(1);
            action.run();
            return null;
        }).when(tenantScopedExecutor).runAsOrganization(anyLong(), any(Runnable.class));
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
            verify(tenantScopedExecutor, never()).runAsOrganization(anyLong(), any(Runnable.class));
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
            verify(tenantScopedExecutor).runAsOrganization(eq(1L), any(Runnable.class));
            verify(tenantScopedExecutor).runAsOrganization(eq(2L), any(Runnable.class));
        }

        @Test
        void whenOneFeedHasNullProperty_thenFilteredOut() {
            ICalFeed feedWithProperty = createFeed(1L);
            ICalFeed feedWithoutProperty = new ICalFeed(); // No property

            when(iCalFeedRepository.findBySyncEnabledTrue()).thenReturn(List.of(feedWithProperty, feedWithoutProperty));

            scheduler.syncActiveFeeds();

            // Only one org group should be processed
            verify(iCalImportService, times(1)).syncFeeds(anyList());
            verify(tenantScopedExecutor, times(1)).runAsOrganization(anyLong(), any(Runnable.class));
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

        @Test
        void whenSyncRuns_thenImportInvokedInsideTenantScopedExecution() {
            // Arrange : l'executor mock N'EXECUTE PAS l'action -> si l'import
            // etait appele hors du scope tenant (filtre Hibernate inactif),
            // syncFeeds serait quand meme invoque et ce test echouerait.
            ICalFeed feed1 = createFeed(1L);
            when(iCalFeedRepository.findBySyncEnabledTrue()).thenReturn(List.of(feed1));
            doNothing().when(tenantScopedExecutor).runAsOrganization(anyLong(), any(Runnable.class));

            // Act
            scheduler.syncActiveFeeds();

            // Assert : l'import n'est atteignable QUE via l'execution tenant-scoped
            verify(tenantScopedExecutor).runAsOrganization(eq(1L), any(Runnable.class));
            verify(iCalImportService, never()).syncFeeds(anyList());
        }

        @Test
        void whenExecutorThrows_thenSchedulerContinuesWithOtherOrgs() {
            // Arrange : echec du scoping (ex: contexte tenant deja pose) sur org 1
            ICalFeed feed1 = createFeed(1L);
            ICalFeed feed2 = createFeed(2L);
            when(iCalFeedRepository.findBySyncEnabledTrue()).thenReturn(List.of(feed1, feed2));
            doThrow(new IllegalStateException("contexte tenant deja pose"))
                    .when(tenantScopedExecutor).runAsOrganization(eq(1L), any(Runnable.class));

            // Act
            scheduler.syncActiveFeeds();

            // Assert : org 2 est quand meme traitee
            verify(tenantScopedExecutor).runAsOrganization(eq(2L), any(Runnable.class));
        }
    }
}
