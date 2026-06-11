package com.clenzy.service;

import com.clenzy.dto.SecurityAuditLogDto;
import com.clenzy.model.SecurityAuditEventType;
import com.clenzy.model.SecurityAuditLog;
import com.clenzy.model.UserStatus;
import com.clenzy.repository.SecurityAuditLogRepository;
import com.clenzy.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests pour {@link MonitoringQueryService} — logique extraite de
 * {@code MonitoringController} (T-ARCH-01) : recherche de logs d'audit avec
 * filtres dynamiques, metriques utilisateurs et indicateurs securite 7j.
 */
@ExtendWith(MockitoExtension.class)
class MonitoringQueryServiceTest {

    @Mock private SecurityAuditLogRepository auditLogRepository;
    @Mock private UserRepository userRepository;

    private MonitoringQueryService service;

    @BeforeEach
    void setUp() {
        service = new MonitoringQueryService(auditLogRepository, userRepository);
    }

    @Nested
    @DisplayName("searchAuditLogs")
    class SearchAuditLogs {

        @Test
        @DisplayName("when no filters then maps entities to DTOs")
        void whenNoFilters_thenMapsEntitiesToDtos() {
            SecurityAuditLog log1 = new SecurityAuditLog(
                SecurityAuditEventType.LOGIN_SUCCESS, "POST /api/auth", "SUCCESS");
            log1.setId(1L);
            log1.setActorEmail("admin@example.com");

            Page<SecurityAuditLog> mockPage = new PageImpl<>(List.of(log1));
            when(auditLogRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(mockPage);

            Page<SecurityAuditLogDto> result = service.searchAuditLogs(
                null, null, null, PageRequest.of(0, 20));

            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().get(0).eventType()).isEqualTo("LOGIN_SUCCESS");
            assertThat(result.getContent().get(0).actorEmail()).isEqualTo("admin@example.com");
        }

        @Test
        @DisplayName("when filters provided then queries repository with specification")
        void whenFilters_thenQueriesRepositoryWithSpecification() {
            Page<SecurityAuditLog> emptyPage = new PageImpl<>(List.of());
            when(auditLogRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(emptyPage);

            Page<SecurityAuditLogDto> result = service.searchAuditLogs(
                SecurityAuditEventType.LOGIN_FAILURE, "actor-1", "DENIED", PageRequest.of(0, 20));

            assertThat(result.getContent()).isEmpty();
            verify(auditLogRepository).findAll(any(Specification.class), any(Pageable.class));
        }

        @Test
        @DisplayName("when blank filters then still queries (filters ignored)")
        void whenBlankFilters_thenStillQueries() {
            Page<SecurityAuditLog> emptyPage = new PageImpl<>(List.of());
            when(auditLogRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(emptyPage);

            Page<SecurityAuditLogDto> result = service.searchAuditLogs(
                null, "   ", "  ", PageRequest.of(0, 20));

            assertThat(result.getTotalElements()).isZero();
        }
    }

    @Nested
    @DisplayName("userMetrics")
    class UserMetrics {

        @Test
        @DisplayName("when called then computes total/active/inactive/newThisWeek")
        void whenCalled_thenComputesCounters() {
            when(userRepository.count()).thenReturn(42L);
            when(userRepository.countByStatus(UserStatus.ACTIVE)).thenReturn(38L);
            when(userRepository.countByCreatedAtAfter(any())).thenReturn(3L);

            Map<String, Object> users = service.userMetrics();

            assertThat(users).containsEntry("total", 42L)
                    .containsEntry("active", 38L)
                    .containsEntry("inactive", 4L)
                    .containsEntry("newThisWeek", 3L);
        }
    }

    @Nested
    @DisplayName("securityMetrics")
    class SecurityMetrics {

        @Test
        @DisplayName("when no incident then lastIncident is null")
        void whenNoIncident_thenLastIncidentNull() {
            when(auditLogRepository.countByEventTypeAndCreatedAtAfter(
                eq(SecurityAuditEventType.LOGIN_FAILURE), any())).thenReturn(5L);
            when(auditLogRepository.countByEventTypeAndCreatedAtAfter(
                eq(SecurityAuditEventType.PERMISSION_DENIED), any())).thenReturn(2L);
            when(auditLogRepository.countByEventTypeAndCreatedAtAfter(
                eq(SecurityAuditEventType.SUSPICIOUS_ACTIVITY), any())).thenReturn(0L);
            when(auditLogRepository.findTopByEventTypeInOrderByCreatedAtDesc(anyList()))
                .thenReturn(Optional.empty());

            Map<String, Object> security = service.securityMetrics();

            assertThat(security).containsEntry("failedLogins", 5L)
                    .containsEntry("permissionDenied", 2L)
                    .containsEntry("suspiciousActivity", 0L);
            assertThat(security.get("lastIncident")).isNull();
        }

        @Test
        @DisplayName("when last incident exists then returns its timestamp")
        void whenLastIncidentExists_thenReturnsTimestamp() {
            when(auditLogRepository.countByEventTypeAndCreatedAtAfter(any(), any())).thenReturn(0L);

            SecurityAuditLog incident = new SecurityAuditLog(
                SecurityAuditEventType.LOGIN_FAILURE, "POST /api/auth", "DENIED");
            Instant incidentTime = Instant.parse("2026-02-20T14:30:00Z");
            incident.setCreatedAt(incidentTime);
            when(auditLogRepository.findTopByEventTypeInOrderByCreatedAtDesc(anyList()))
                .thenReturn(Optional.of(incident));

            Map<String, Object> security = service.securityMetrics();

            assertThat(security.get("lastIncident")).isEqualTo(incidentTime.toString());
        }
    }
}
