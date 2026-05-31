package com.clenzy.integration.channel;

import com.clenzy.integration.channel.model.ChannelConnection;
import com.clenzy.integration.channel.model.ChannelSyncLog;
import com.clenzy.integration.channel.repository.ChannelConnectionRepository;
import com.clenzy.integration.channel.repository.ChannelSyncLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.concurrent.Callable;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests for {@link HostProfileSyncSupport}.
 *
 * Validates input checks, connection skip, success / failure / null returns,
 * exception capture, and {@link ChannelSyncLog} record shape including
 * {@code PENDING_WIRE_UP} status detection.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("HostProfileSyncSupport")
class HostProfileSyncSupportTest {

    @Mock private ChannelConnectionRepository connectionRepository;
    @Mock private ChannelSyncLogRepository syncLogRepository;

    private HostProfileSyncSupport support;

    private static final Long ORG_ID = 1L;
    private static final Long USER_ID = 99L;

    @BeforeEach
    void setUp() {
        support = new HostProfileSyncSupport(connectionRepository, syncLogRepository);
    }

    private HostProfileUpdate profile() {
        return new HostProfileUpdate(USER_ID, "Alice", "Martin",
                "alice@example.com", "+33611", "https://x/photo.jpg");
    }

    private ChannelConnection connection() {
        ChannelConnection c = new ChannelConnection(ORG_ID, ChannelName.AIRBNB);
        c.setId(7L);
        return c;
    }

    // ─── Input validation ──────────────────────────────────────────────────

    @Nested
    @DisplayName("dispatch — input validation")
    class InputValidation {

        @Test
        @DisplayName("null profile -> FAILED")
        void nullProfile() {
            SyncResult result = support.dispatch(ChannelName.AIRBNB, null, ORG_ID,
                    () -> SyncResult.success(1, 0));

            assertThat(result.isFailed()).isTrue();
            assertThat(result.getMessage()).contains("Invalid");
            verify(connectionRepository, never()).findByOrganizationIdAndChannel(any(), any());
        }

        @Test
        @DisplayName("null userId in profile -> FAILED")
        void nullUserIdInProfile() {
            HostProfileUpdate p = new HostProfileUpdate(null, "F", "L",
                    "e@x", "+1", null);

            SyncResult result = support.dispatch(ChannelName.AIRBNB, p, ORG_ID,
                    () -> SyncResult.success(1, 0));

            assertThat(result.isFailed()).isTrue();
            verify(connectionRepository, never()).findByOrganizationIdAndChannel(any(), any());
        }

        @Test
        @DisplayName("null orgId -> SKIPPED")
        void nullOrgId() {
            SyncResult result = support.dispatch(ChannelName.AIRBNB, profile(), null,
                    () -> SyncResult.success(1, 0));

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("No organization");
            verify(connectionRepository, never()).findByOrganizationIdAndChannel(any(), any());
        }
    }

    // ─── Connection lookup ─────────────────────────────────────────────────

    @Nested
    @DisplayName("dispatch — connection lookup")
    class ConnectionLookup {

        @Test
        @DisplayName("no connection -> SKIPPED + no log")
        void noConnection() {
            when(connectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.AIRBNB))
                    .thenReturn(Optional.empty());

            SyncResult result = support.dispatch(ChannelName.AIRBNB, profile(), ORG_ID,
                    () -> SyncResult.success(1, 0));

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("No active");
            verify(syncLogRepository, never()).save(any());
        }
    }

    // ─── Successful dispatch ───────────────────────────────────────────────

    @Nested
    @DisplayName("dispatch — success path")
    class SuccessPath {

        @Test
        @DisplayName("success result is recorded as SUCCESS")
        void successResult() {
            when(connectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.AIRBNB))
                    .thenReturn(Optional.of(connection()));

            SyncResult result = support.dispatch(ChannelName.AIRBNB, profile(), ORG_ID,
                    () -> SyncResult.success("OK", 1, 50));

            assertThat(result.isSuccess()).isTrue();

            ArgumentCaptor<ChannelSyncLog> cap = ArgumentCaptor.forClass(ChannelSyncLog.class);
            verify(syncLogRepository).save(cap.capture());
            ChannelSyncLog log = cap.getValue();
            assertThat(log.getStatus()).isEqualTo("SUCCESS");
            assertThat(log.getOrganizationId()).isEqualTo(ORG_ID);
            assertThat(log.getEventType()).isEqualTo(HostProfileSyncSupport.EVENT_TYPE);
            assertThat(log.getDirection()).isEqualTo(SyncDirection.OUTBOUND);
            assertThat(log.getDetails()).contains("userId=" + USER_ID);
            assertThat(log.getDetails()).contains("firstName=Alice");
            assertThat(log.getDetails()).contains("lastName=Martin");
            assertThat(log.getDetails()).contains("photo=true");
            assertThat(log.getErrorMessage()).isNull();
            assertThat(log.getDurationMs()).isNotNull();
        }

        @Test
        @DisplayName("success without photoUrl -> details say photo=false")
        void successNoPhoto() {
            when(connectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.AIRBNB))
                    .thenReturn(Optional.of(connection()));
            HostProfileUpdate p = new HostProfileUpdate(USER_ID, "Bob", "K",
                    "b@x", "+1", null);

            support.dispatch(ChannelName.AIRBNB, p, ORG_ID,
                    () -> SyncResult.success(1, 0));

            ArgumentCaptor<ChannelSyncLog> cap = ArgumentCaptor.forClass(ChannelSyncLog.class);
            verify(syncLogRepository).save(cap.capture());
            assertThat(cap.getValue().getDetails()).contains("photo=false");
        }
    }

    // ─── Failure dispatch ──────────────────────────────────────────────────

    @Nested
    @DisplayName("dispatch — failure paths")
    class FailurePaths {

        @Test
        @DisplayName("null result is treated as FAILED")
        void nullResult() {
            when(connectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.AIRBNB))
                    .thenReturn(Optional.of(connection()));

            SyncResult result = support.dispatch(ChannelName.AIRBNB, profile(), ORG_ID,
                    () -> null);

            assertThat(result.isFailed()).isTrue();
            assertThat(result.getMessage()).contains("null");

            ArgumentCaptor<ChannelSyncLog> cap = ArgumentCaptor.forClass(ChannelSyncLog.class);
            verify(syncLogRepository).save(cap.capture());
            assertThat(cap.getValue().getStatus()).isEqualTo("FAILED");
            assertThat(cap.getValue().getErrorMessage()).contains("null");
        }

        @Test
        @DisplayName("explicit FAILED result is logged with error message")
        void failedResult() {
            when(connectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.AIRBNB))
                    .thenReturn(Optional.of(connection()));

            SyncResult result = support.dispatch(ChannelName.AIRBNB, profile(), ORG_ID,
                    () -> SyncResult.failed("bad request"));

            assertThat(result.isFailed()).isTrue();

            ArgumentCaptor<ChannelSyncLog> cap = ArgumentCaptor.forClass(ChannelSyncLog.class);
            verify(syncLogRepository).save(cap.capture());
            assertThat(cap.getValue().getStatus()).isEqualTo("FAILED");
            assertThat(cap.getValue().getErrorMessage()).isEqualTo("bad request");
        }

        @Test
        @DisplayName("callable exception is captured as FAILED")
        void exceptionCaptured() {
            when(connectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.AIRBNB))
                    .thenReturn(Optional.of(connection()));
            Callable<SyncResult> failing = () -> { throw new RuntimeException("boom"); };

            SyncResult result = support.dispatch(ChannelName.AIRBNB, profile(), ORG_ID, failing);

            assertThat(result.isFailed()).isTrue();
            assertThat(result.getMessage()).isEqualTo("boom");

            ArgumentCaptor<ChannelSyncLog> cap = ArgumentCaptor.forClass(ChannelSyncLog.class);
            verify(syncLogRepository).save(cap.capture());
            assertThat(cap.getValue().getStatus()).isEqualTo("FAILED");
            assertThat(cap.getValue().getErrorMessage()).isEqualTo("boom");
        }

        @Test
        @DisplayName("logging failure does not bubble up")
        void loggingFailureSwallowed() {
            when(connectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.AIRBNB))
                    .thenReturn(Optional.of(connection()));
            when(syncLogRepository.save(any()))
                    .thenThrow(new RuntimeException("db down"));

            // Should NOT throw
            SyncResult result = support.dispatch(ChannelName.AIRBNB, profile(), ORG_ID,
                    () -> SyncResult.success(1, 0));

            assertThat(result.isSuccess()).isTrue();
        }
    }

    // ─── recordPendingWireUp ───────────────────────────────────────────────

    @Nested
    @DisplayName("recordPendingWireUp")
    class PendingWireUp {

        @Test
        @DisplayName("records as PENDING_WIRE_UP when connection exists")
        void records() {
            when(connectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.AGODA))
                    .thenReturn(Optional.of(connection()));

            SyncResult result = support.recordPendingWireUp(ChannelName.AGODA, profile(), ORG_ID);

            assertThat(result.isSuccess()).isTrue();
            assertThat(result.getMessage()).contains("wire-up pending");

            ArgumentCaptor<ChannelSyncLog> cap = ArgumentCaptor.forClass(ChannelSyncLog.class);
            verify(syncLogRepository).save(cap.capture());
            assertThat(cap.getValue().getStatus()).isEqualTo(HostProfileSyncSupport.STATUS_PENDING_WIRE_UP);
        }

        @Test
        @DisplayName("returns SKIPPED when no connection")
        void noConnection() {
            when(connectionRepository.findByOrganizationIdAndChannel(ORG_ID, ChannelName.AGODA))
                    .thenReturn(Optional.empty());

            SyncResult result = support.recordPendingWireUp(ChannelName.AGODA, profile(), ORG_ID);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            verify(syncLogRepository, never()).save(any());
        }

        @Test
        @DisplayName("with null profile -> FAILED")
        void nullProfile() {
            SyncResult result = support.recordPendingWireUp(ChannelName.AGODA, null, ORG_ID);

            assertThat(result.isFailed()).isTrue();
        }
    }

    // ─── Constants exposed ─────────────────────────────────────────────────

    @Nested
    @DisplayName("constants")
    class Constants {

        @Test
        void eventTypeIsConstant() {
            assertThat(HostProfileSyncSupport.EVENT_TYPE).isEqualTo("HOST_PROFILE_PUSH");
        }

        @Test
        void pendingWireUpIsConstant() {
            assertThat(HostProfileSyncSupport.STATUS_PENDING_WIRE_UP).isEqualTo("PENDING_WIRE_UP");
        }
    }
}
