package com.clenzy.controller;

import com.clenzy.dto.IncidentDto;
import com.clenzy.dto.RetestResultDto;
import com.clenzy.model.Incident;
import com.clenzy.model.Incident.IncidentSeverity;
import com.clenzy.model.Incident.IncidentStatus;
import com.clenzy.model.Incident.IncidentType;
import com.clenzy.repository.IncidentRepository;
import com.clenzy.service.IncidentService;
import com.clenzy.service.ServiceHealthChecker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link IncidentController}.
 *
 * Covers listing with filters (status/severity/date), open count + breakdown,
 * detail, delete (success/notFound/error), retest happy path + invalid status.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("IncidentController")
class IncidentControllerTest {

    @Mock private IncidentService incidentService;
    @Mock private IncidentRepository incidentRepository;
    @Mock private ServiceHealthChecker serviceHealthChecker;

    private IncidentController controller;

    @BeforeEach
    void setUp() {
        controller = new IncidentController(incidentService, incidentRepository, serviceHealthChecker);
    }

    private Incident newIncident(Long id, IncidentType type, IncidentSeverity sev,
                                  IncidentStatus status, String service) {
        Incident incident = new Incident();
        incident.setId(id);
        incident.setType(type);
        incident.setSeverity(sev);
        incident.setStatus(status);
        incident.setServiceName(service);
        incident.setTitle(service + " incident");
        incident.setOpenedAt(LocalDateTime.now().minusHours(2));
        return incident;
    }

    @Nested
    @DisplayName("listIncidents")
    class ListIncidents {

        @Test
        @DisplayName("status=OPEN -> findByStatusOrderByOpenedAtDesc")
        void whenStatusOpen_thenUsesOpenQuery() {
            Incident inc = newIncident(1L, IncidentType.SERVICE_DOWN, IncidentSeverity.P1,
                IncidentStatus.OPEN, "smtp");
            when(incidentRepository.findByStatusOrderByOpenedAtDesc(IncidentStatus.OPEN))
                .thenReturn(List.of(inc));

            ResponseEntity<?> response = controller.listIncidents(
                null, IncidentStatus.OPEN, 30, 0, 20);

            assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body).containsEntry("totalElements", 1);
            assertThat(body).containsEntry("page", 0);
        }

        @Test
        @DisplayName("status=RESOLVED -> findByStatusAndOpenedAtAfter")
        void whenStatusResolved_thenUsesScopedQuery() {
            Incident inc = newIncident(1L, IncidentType.SERVICE_DOWN, IncidentSeverity.P1,
                IncidentStatus.RESOLVED, "kafka");
            when(incidentRepository.findByStatusAndOpenedAtAfterOrderByOpenedAtDesc(
                org.mockito.ArgumentMatchers.eq(IncidentStatus.RESOLVED), any()))
                .thenReturn(List.of(inc));

            ResponseEntity<?> response = controller.listIncidents(
                null, IncidentStatus.RESOLVED, 30, 0, 20);

            assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body).containsEntry("totalElements", 1);
        }

        @Test
        @DisplayName("status null -> mix open + active")
        void whenStatusNull_thenMixesOpenAndActive() {
            Incident open = newIncident(1L, IncidentType.SERVICE_DOWN, IncidentSeverity.P1,
                IncidentStatus.OPEN, "smtp");
            Incident resolved = newIncident(2L, IncidentType.SERVICE_DOWN, IncidentSeverity.P1,
                IncidentStatus.RESOLVED, "kafka");
            when(incidentRepository.findByStatusOrderByOpenedAtDesc(IncidentStatus.OPEN))
                .thenReturn(List.of(open));
            when(incidentRepository.findActiveSince(any())).thenReturn(List.of(open, resolved));

            ResponseEntity<?> response = controller.listIncidents(null, null, 30, 0, 20);

            assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            // open=1, plus active filtered (status != OPEN) = 1 (only resolved kept)
            assertThat(body).containsEntry("totalElements", 2);
        }

        @Test
        @DisplayName("severity filter -> keeps matching + null severity (legacy)")
        void whenSeverityFilter_thenIncludesNullSeverity() {
            Incident p1 = newIncident(1L, IncidentType.SERVICE_DOWN, IncidentSeverity.P1,
                IncidentStatus.OPEN, "smtp");
            Incident p2 = newIncident(2L, IncidentType.SERVICE_DOWN, IncidentSeverity.P2,
                IncidentStatus.OPEN, "kafka");
            Incident legacy = newIncident(3L, IncidentType.SERVICE_DOWN, null,
                IncidentStatus.OPEN, "redis");
            when(incidentRepository.findByStatusOrderByOpenedAtDesc(IncidentStatus.OPEN))
                .thenReturn(List.of(p1, p2, legacy));

            ResponseEntity<?> response = controller.listIncidents(
                IncidentSeverity.P1, IncidentStatus.OPEN, 30, 0, 20);

            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body).containsEntry("totalElements", 2); // p1 + legacy
        }

        @Test
        @DisplayName("page=0 size=2 with 3 results -> first 2")
        void whenPaginated_thenPaginates() {
            Incident i1 = newIncident(1L, IncidentType.SERVICE_DOWN, IncidentSeverity.P1,
                IncidentStatus.OPEN, "a");
            Incident i2 = newIncident(2L, IncidentType.SERVICE_DOWN, IncidentSeverity.P1,
                IncidentStatus.OPEN, "b");
            Incident i3 = newIncident(3L, IncidentType.SERVICE_DOWN, IncidentSeverity.P1,
                IncidentStatus.OPEN, "c");
            when(incidentRepository.findByStatusOrderByOpenedAtDesc(IncidentStatus.OPEN))
                .thenReturn(List.of(i1, i2, i3));

            ResponseEntity<?> response = controller.listIncidents(
                null, IncidentStatus.OPEN, 30, 0, 2);

            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body).containsEntry("totalElements", 3);
            assertThat(body).containsEntry("totalPages", 2);
            @SuppressWarnings("unchecked")
            List<IncidentDto> content = (List<IncidentDto>) body.get("content");
            assertThat(content).hasSize(2);
        }

        @Test
        @DisplayName("page=1 size=2 with 3 results -> last 1")
        void whenSecondPage_thenReturnsLast() {
            Incident i1 = newIncident(1L, IncidentType.SERVICE_DOWN, IncidentSeverity.P1,
                IncidentStatus.OPEN, "a");
            Incident i2 = newIncident(2L, IncidentType.SERVICE_DOWN, IncidentSeverity.P1,
                IncidentStatus.OPEN, "b");
            Incident i3 = newIncident(3L, IncidentType.SERVICE_DOWN, IncidentSeverity.P1,
                IncidentStatus.OPEN, "c");
            when(incidentRepository.findByStatusOrderByOpenedAtDesc(IncidentStatus.OPEN))
                .thenReturn(List.of(i1, i2, i3));

            ResponseEntity<?> response = controller.listIncidents(
                null, IncidentStatus.OPEN, 30, 1, 2);

            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            @SuppressWarnings("unchecked")
            List<IncidentDto> content = (List<IncidentDto>) body.get("content");
            assertThat(content).hasSize(1);
        }

        @Test
        @DisplayName("size capped at 100, days capped at 365")
        void whenLimitsExceeded_thenCaps() {
            when(incidentRepository.findByStatusOrderByOpenedAtDesc(IncidentStatus.OPEN))
                .thenReturn(List.of());

            ResponseEntity<?> response = controller.listIncidents(
                null, IncidentStatus.OPEN, 9999, 0, 500);

            assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body).containsEntry("size", 100);
        }

        @Test
        @DisplayName("repository throws -> 500")
        void whenRepositoryFails_thenReturns500() {
            when(incidentRepository.findByStatusOrderByOpenedAtDesc(IncidentStatus.OPEN))
                .thenThrow(new RuntimeException("DB down"));

            ResponseEntity<?> response = controller.listIncidents(
                null, IncidentStatus.OPEN, 30, 0, 20);

            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }

    @Nested
    @DisplayName("getOpenCount")
    class GetOpenCount {

        @Test
        @DisplayName("no severity -> count all")
        void whenNoSeverity_thenCountsAllOpen() {
            when(incidentRepository.countByStatus(IncidentStatus.OPEN)).thenReturn(5L);

            ResponseEntity<?> response = controller.getOpenCount(null, false);

            assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body).containsEntry("count", 5L);
        }

        @Test
        @DisplayName("severity P1 -> count by severity")
        void whenSeverityP1_thenCountsP1() {
            when(incidentRepository.countByStatusAndSeverity(IncidentStatus.OPEN, IncidentSeverity.P1))
                .thenReturn(3L);

            ResponseEntity<?> response = controller.getOpenCount(IncidentSeverity.P1, false);

            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body).containsEntry("count", 3L);
        }

        @Test
        @DisplayName("severityBreakdown=true -> includes totalAllSeverities")
        void whenBreakdown_thenIncludesTotal() {
            when(incidentRepository.countByStatusAndSeverity(IncidentStatus.OPEN, IncidentSeverity.P1))
                .thenReturn(2L);
            when(incidentRepository.countByStatus(IncidentStatus.OPEN)).thenReturn(5L);

            ResponseEntity<?> response = controller.getOpenCount(IncidentSeverity.P1, true);

            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body).containsEntry("count", 2L);
            assertThat(body).containsEntry("totalAllSeverities", 5L);
        }

        @Test
        @DisplayName("repo throws -> 500")
        void whenRepoFails_thenReturns500() {
            when(incidentRepository.countByStatus(any())).thenThrow(new RuntimeException("boom"));
            ResponseEntity<?> response = controller.getOpenCount(null, false);
            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }

    @Nested
    @DisplayName("getIncident")
    class GetIncidentById {

        @Test
        @DisplayName("found -> 200 + IncidentDto")
        void whenFound_thenReturnsDto() {
            Incident inc = newIncident(1L, IncidentType.SERVICE_DOWN, IncidentSeverity.P1,
                IncidentStatus.OPEN, "smtp");
            when(incidentRepository.findById(1L)).thenReturn(Optional.of(inc));

            ResponseEntity<?> response = controller.getIncident(1L);

            assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
            assertThat(response.getBody()).isInstanceOf(IncidentDto.class);
        }

        @Test
        @DisplayName("not found -> 404")
        void whenNotFound_thenReturns404() {
            when(incidentRepository.findById(99L)).thenReturn(Optional.empty());
            ResponseEntity<?> response = controller.getIncident(99L);
            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }

        @Test
        @DisplayName("repo throws -> 500")
        void whenRepoFails_thenReturns500() {
            when(incidentRepository.findById(anyLong())).thenThrow(new RuntimeException("DB"));
            ResponseEntity<?> response = controller.getIncident(1L);
            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }

    @Nested
    @DisplayName("deleteIncident")
    class DeleteIncident {

        @Test
        @DisplayName("found -> 200 + deleted=true")
        void whenDeleted_thenReturns200() {
            when(incidentService.deleteIncident(1L)).thenReturn(true);

            ResponseEntity<?> response = controller.deleteIncident(1L);

            assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            assertThat(body).containsEntry("deleted", true);
            assertThat(body).containsEntry("id", 1L);
        }

        @Test
        @DisplayName("not found -> 404")
        void whenNotFound_thenReturns404() {
            when(incidentService.deleteIncident(99L)).thenReturn(false);
            ResponseEntity<?> response = controller.deleteIncident(99L);
            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }

        @Test
        @DisplayName("service throws -> 500")
        void whenServiceFails_thenReturns500() {
            when(incidentService.deleteIncident(anyLong())).thenThrow(new RuntimeException("FK violation"));
            ResponseEntity<?> response = controller.deleteIncident(1L);
            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }

    @Nested
    @DisplayName("retestIncident")
    class RetestIncident {

        @Test
        @DisplayName("not found -> 404")
        void whenNotFound_thenReturns404() {
            when(incidentRepository.findById(99L)).thenReturn(Optional.empty());
            ResponseEntity<?> response = controller.retestIncident(99L);
            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }

        @Test
        @DisplayName("not OPEN -> 400 (cannot retest resolved)")
        void whenNotOpen_thenReturns400() {
            Incident resolved = newIncident(1L, IncidentType.SERVICE_DOWN, IncidentSeverity.P1,
                IncidentStatus.RESOLVED, "smtp");
            when(incidentRepository.findById(1L)).thenReturn(Optional.of(resolved));

            ResponseEntity<?> response = controller.retestIncident(1L);

            assertThat(response.getStatusCode().value()).isEqualTo(400);
        }

        @Test
        @DisplayName("service UP -> resolves incident + 200 with resolved=true")
        void whenServiceUp_thenResolves() {
            Incident open = newIncident(1L, IncidentType.SERVICE_DOWN, IncidentSeverity.P1,
                IncidentStatus.OPEN, "smtp");
            when(incidentRepository.findById(1L)).thenReturn(Optional.of(open));
            ServiceHealthChecker.HealthResult up = new ServiceHealthChecker.HealthResult(
                "smtp", "UP", "OK");
            when(serviceHealthChecker.check("smtp")).thenReturn(up);

            ResponseEntity<?> response = controller.retestIncident(1L);

            assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
            RetestResultDto body = (RetestResultDto) response.getBody();
            assertThat(body.resolved()).isTrue();
            assertThat(body.status()).isEqualTo("UP");
            verify(incidentService).resolveIncidentById(1L);
        }

        @Test
        @DisplayName("service DOWN -> stays open + 200 with resolved=false")
        void whenServiceDown_thenStaysOpen() {
            Incident open = newIncident(1L, IncidentType.SERVICE_DOWN, IncidentSeverity.P1,
                IncidentStatus.OPEN, "smtp");
            when(incidentRepository.findById(1L)).thenReturn(Optional.of(open));
            ServiceHealthChecker.HealthResult down = new ServiceHealthChecker.HealthResult(
                "smtp", "DOWN", "Still failing");
            when(serviceHealthChecker.check("smtp")).thenReturn(down);

            ResponseEntity<?> response = controller.retestIncident(1L);

            assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
            RetestResultDto body = (RetestResultDto) response.getBody();
            assertThat(body.resolved()).isFalse();
            verify(incidentService, never()).resolveIncidentById(anyLong());
        }

        @Test
        @DisplayName("checker throws -> 500")
        void whenCheckerThrows_thenReturns500() {
            Incident open = newIncident(1L, IncidentType.SERVICE_DOWN, IncidentSeverity.P1,
                IncidentStatus.OPEN, "smtp");
            when(incidentRepository.findById(1L)).thenReturn(Optional.of(open));
            when(serviceHealthChecker.check("smtp")).thenThrow(new RuntimeException("boom"));

            ResponseEntity<?> response = controller.retestIncident(1L);
            assertThat(response.getStatusCode().value()).isEqualTo(500);
        }
    }
}
