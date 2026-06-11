package com.clenzy.service;

import com.clenzy.model.Incident;
import com.clenzy.model.Incident.IncidentSeverity;
import com.clenzy.model.Incident.IncidentStatus;
import com.clenzy.model.Incident.IncidentType;
import com.clenzy.model.NotificationKey;
import com.clenzy.repository.IncidentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Tests pour {@link IncidentService} : cycle de vie + notifications.
 *
 * <p>Focus : verifier que la creation/resolution d'un incident dispatche
 * bien une notification {@code INCIDENT_OPENED} / {@code INCIDENT_RESOLVED}
 * aux SUPER_ADMIN/SUPER_MANAGER via {@link NotificationService#notifyAllPlatformStaff}.</p>
 */
@ExtendWith(MockitoExtension.class)
class IncidentServiceTest {

    @Mock private IncidentRepository incidentRepository;
    @Mock private NotificationService notificationService;
    @Mock private ObjectProvider<NotificationService> notificationServiceProvider;

    private IncidentService service;

    @BeforeEach
    void setUp() {
        // ObjectProvider#ifAvailable : execute le consumer si le bean est resolvable.
        // Stub lenient — pas tous les tests ne le declenchent (ex : incident
        // deja ouvert → pas d'appel a la notif → stub non utilise).
        lenient().doAnswer(invocation -> {
            Consumer<NotificationService> consumer = invocation.getArgument(0);
            consumer.accept(notificationService);
            return null;
        }).when(notificationServiceProvider).ifAvailable(any());

        service = new IncidentService(incidentRepository, notificationServiceProvider);
    }

    @Nested
    @DisplayName("openIncident")
    class OpenIncident {

        @Test
        void whenNoIncidentOpen_thenCreatesAndNotifies() {
            when(incidentRepository.findByTypeAndServiceNameAndStatus(
                    IncidentType.SERVICE_DOWN, "stripe", IncidentStatus.OPEN))
                    .thenReturn(Optional.empty());
            when(incidentRepository.save(any(Incident.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            Incident result = service.openIncident(
                    IncidentType.SERVICE_DOWN, "stripe",
                    "STRIPE service down",
                    "Stripe unreachable: HTTP 503");

            assertThat(result).isNotNull();
            assertThat(result.getType()).isEqualTo(IncidentType.SERVICE_DOWN);

            // Notification dispatched
            ArgumentCaptor<String> titleCaptor = ArgumentCaptor.forClass(String.class);
            ArgumentCaptor<String> messageCaptor = ArgumentCaptor.forClass(String.class);
            verify(notificationService).notifyAllPlatformStaff(
                    eq(NotificationKey.INCIDENT_OPENED),
                    titleCaptor.capture(),
                    messageCaptor.capture(),
                    eq("/admin/monitoring")
            );
            assertThat(titleCaptor.getValue()).isEqualTo("STRIPE service down");
            assertThat(messageCaptor.getValue()).isEqualTo("Stripe unreachable: HTTP 503");
        }

        @Test
        void whenIncidentAlreadyOpen_thenSkipsNotification() {
            Incident existing = new Incident();
            existing.setType(IncidentType.SERVICE_DOWN);
            existing.setServiceName("stripe");
            existing.setStatus(IncidentStatus.OPEN);
            when(incidentRepository.findByTypeAndServiceNameAndStatus(
                    IncidentType.SERVICE_DOWN, "stripe", IncidentStatus.OPEN))
                    .thenReturn(Optional.of(existing));

            Incident result = service.openIncident(
                    IncidentType.SERVICE_DOWN, "stripe", "STRIPE service down", "Same as before");

            assertThat(result).isSameAs(existing);
            verify(incidentRepository, never()).save(any());
            verify(notificationService, never()).notifyAllPlatformStaff(any(), any(), any(), any());
        }

        @Test
        void whenDescriptionNullOrBlank_thenUsesFallbackMessage() {
            when(incidentRepository.findByTypeAndServiceNameAndStatus(any(), any(), any()))
                    .thenReturn(Optional.empty());
            when(incidentRepository.save(any(Incident.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            service.openIncident(IncidentType.SERVICE_DOWN, "redis", "Redis down", null);

            ArgumentCaptor<String> messageCaptor = ArgumentCaptor.forClass(String.class);
            verify(notificationService).notifyAllPlatformStaff(
                    eq(NotificationKey.INCIDENT_OPENED),
                    any(), messageCaptor.capture(), any()
            );
            assertThat(messageCaptor.getValue()).isEqualTo("Service redis indisponible.");
        }

        @Test
        void whenNotificationServiceUnavailable_thenIncidentStillCreated() {
            // ObjectProvider#ifAvailable : si pas dispo, ne fait rien
            doNothing().when(notificationServiceProvider).ifAvailable(any());

            when(incidentRepository.findByTypeAndServiceNameAndStatus(any(), any(), any()))
                    .thenReturn(Optional.empty());
            when(incidentRepository.save(any(Incident.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            Incident result = service.openIncident(
                    IncidentType.SERVICE_DOWN, "smtp", "SMTP down", "SMTP unreachable");

            // Incident IS created even though notification couldn't dispatch
            assertThat(result).isNotNull();
            verify(incidentRepository).save(any(Incident.class));
        }
    }

    @Nested
    @DisplayName("resolveIncident")
    class ResolveIncident {

        @Test
        void whenIncidentOpen_thenResolvesAndNotifies() {
            Incident existing = new Incident();
            existing.setType(IncidentType.SERVICE_DOWN);
            existing.setServiceName("stripe");
            existing.setTitle("STRIPE service down");
            existing.setStatus(IncidentStatus.OPEN);
            existing.setOpenedAt(LocalDateTime.now().minusMinutes(15));
            when(incidentRepository.findByTypeAndServiceNameAndStatus(
                    IncidentType.SERVICE_DOWN, "stripe", IncidentStatus.OPEN))
                    .thenReturn(Optional.of(existing));

            service.resolveIncident(IncidentType.SERVICE_DOWN, "stripe");

            verify(incidentRepository).save(any(Incident.class));

            ArgumentCaptor<String> titleCaptor = ArgumentCaptor.forClass(String.class);
            verify(notificationService).notifyAllPlatformStaff(
                    eq(NotificationKey.INCIDENT_RESOLVED),
                    titleCaptor.capture(),
                    any(),
                    eq("/admin/monitoring")
            );
            assertThat(titleCaptor.getValue()).contains("STRIPE service down");
        }

        @Test
        void whenNoIncidentOpen_thenNoOp() {
            when(incidentRepository.findByTypeAndServiceNameAndStatus(any(), any(), any()))
                    .thenReturn(Optional.empty());

            service.resolveIncident(IncidentType.SERVICE_DOWN, "stripe");

            verify(incidentRepository, never()).save(any());
            verify(notificationService, never()).notifyAllPlatformStaff(any(), any(), any(), any());
        }

        @Test
        void whenNotificationServiceThrowsOnResolve_thenIncidentStillSaved() {
            Incident existing = new Incident();
            existing.setType(IncidentType.SERVICE_DOWN);
            existing.setServiceName("stripe");
            existing.setTitle("STRIPE down");
            existing.setStatus(IncidentStatus.OPEN);
            existing.setOpenedAt(LocalDateTime.now().minusMinutes(10));
            when(incidentRepository.findByTypeAndServiceNameAndStatus(any(), any(), any()))
                    .thenReturn(Optional.of(existing));
            doThrow(new RuntimeException("notif boom"))
                    .when(notificationService).notifyAllPlatformStaff(any(), any(), any(), any());

            service.resolveIncident(IncidentType.SERVICE_DOWN, "stripe");

            verify(incidentRepository).save(any(Incident.class));
            assertThat(existing.getStatus()).isEqualTo(IncidentStatus.RESOLVED);
        }

        @Test
        void whenIncidentHasNullTitle_thenResolveStillNotifies() {
            Incident existing = new Incident();
            existing.setType(IncidentType.SERVICE_DOWN);
            existing.setServiceName("redis");
            existing.setTitle(null); // covers null-title branch
            existing.setStatus(IncidentStatus.OPEN);
            existing.setOpenedAt(LocalDateTime.now().minusSeconds(30));
            when(incidentRepository.findByTypeAndServiceNameAndStatus(any(), any(), any()))
                    .thenReturn(Optional.of(existing));

            service.resolveIncident(IncidentType.SERVICE_DOWN, "redis");

            ArgumentCaptor<String> titleCaptor = ArgumentCaptor.forClass(String.class);
            verify(notificationService).notifyAllPlatformStaff(
                    eq(NotificationKey.INCIDENT_RESOLVED), titleCaptor.capture(),
                    any(), any());
            assertThat(titleCaptor.getValue()).contains("redis");
        }
    }

    @Nested
    @DisplayName("resolveIncidentById")
    class ResolveIncidentById {

        @Test
        void whenIncidentFoundAndOpen_thenResolves() {
            Incident incident = new Incident();
            incident.setStatus(IncidentStatus.OPEN);
            incident.setOpenedAt(LocalDateTime.now().minusMinutes(5));
            incident.setServiceName("smtp");
            when(incidentRepository.findById(1L)).thenReturn(Optional.of(incident));

            service.resolveIncidentById(1L);

            assertThat(incident.getStatus()).isEqualTo(IncidentStatus.RESOLVED);
            assertThat(incident.isAutoResolved()).isFalse();
            assertThat(incident.getResolvedAt()).isNotNull();
            assertThat(incident.getResolutionMinutes()).isNotNull();
            verify(incidentRepository).save(incident);
        }

        @Test
        void whenIncidentNotFound_thenNoOp() {
            when(incidentRepository.findById(999L)).thenReturn(Optional.empty());

            service.resolveIncidentById(999L);

            verify(incidentRepository, never()).save(any());
        }

        @Test
        void whenIncidentAlreadyResolved_thenNoOp() {
            Incident incident = new Incident();
            incident.setStatus(IncidentStatus.RESOLVED);
            when(incidentRepository.findById(2L)).thenReturn(Optional.of(incident));

            service.resolveIncidentById(2L);

            verify(incidentRepository, never()).save(any());
        }

        @Test
        void whenIncidentAcknowledged_thenSkipsResolve() {
            Incident incident = new Incident();
            incident.setStatus(IncidentStatus.ACKNOWLEDGED);
            when(incidentRepository.findById(3L)).thenReturn(Optional.of(incident));

            service.resolveIncidentById(3L);

            verify(incidentRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("getOpenIncidents")
    class GetOpenIncidents {

        @Test
        void delegatesToRepositoryWithOpenStatus() {
            Incident i1 = new Incident();
            i1.setStatus(IncidentStatus.OPEN);
            when(incidentRepository.findByStatus(IncidentStatus.OPEN))
                    .thenReturn(java.util.List.of(i1));

            var result = service.getOpenIncidents();

            assertThat(result).hasSize(1);
            verify(incidentRepository).findByStatus(IncidentStatus.OPEN);
        }

        @Test
        void whenNoOpenIncidents_thenReturnsEmpty() {
            when(incidentRepository.findByStatus(IncidentStatus.OPEN))
                    .thenReturn(java.util.List.of());

            assertThat(service.getOpenIncidents()).isEmpty();
        }
    }

    @Nested
    @DisplayName("getAverageP1ResolutionMinutes")
    class AvgP1 {

        @Test
        void returnsValueFromRepository() {
            when(incidentRepository.avgP1ResolutionMinutesSince(any(LocalDateTime.class)))
                    .thenReturn(Optional.of(12.5));

            double avg = service.getAverageP1ResolutionMinutes(30);

            assertThat(avg).isEqualTo(12.5);
        }

        @Test
        void returnsZeroWhenEmpty() {
            when(incidentRepository.avgP1ResolutionMinutesSince(any(LocalDateTime.class)))
                    .thenReturn(Optional.empty());

            assertThat(service.getAverageP1ResolutionMinutes(7)).isZero();
        }
    }

    @Nested
    @DisplayName("deleteIncident")
    class DeleteIncident {

        @Test
        void whenFound_thenDeletesAndReturnsTrue() {
            Incident incident = new Incident();
            incident.setId(42L);
            incident.setType(IncidentType.SERVICE_DOWN);
            incident.setServiceName("stripe");
            incident.setStatus(IncidentStatus.OPEN);
            when(incidentRepository.findById(42L)).thenReturn(Optional.of(incident));

            boolean result = service.deleteIncident(42L);

            assertThat(result).isTrue();
            verify(incidentRepository).deleteById(42L);
        }

        @Test
        void whenNotFound_thenReturnsFalse() {
            when(incidentRepository.findById(99L)).thenReturn(Optional.empty());

            boolean result = service.deleteIncident(99L);

            assertThat(result).isFalse();
            verify(incidentRepository, never()).deleteById(any());
        }
    }

    // ─── Logique de listing extraite d'IncidentController (T-ARCH-01) ───

    @Nested
    @DisplayName("searchIncidents")
    class SearchIncidents {

        private Incident incident(Long id, IncidentSeverity severity, IncidentStatus status,
                                  String serviceName) {
            Incident incident = new Incident();
            incident.setId(id);
            incident.setType(IncidentType.SERVICE_DOWN);
            incident.setSeverity(severity);
            incident.setStatus(status);
            incident.setServiceName(serviceName);
            incident.setOpenedAt(LocalDateTime.now().minusHours(2));
            return incident;
        }

        @Test
        @DisplayName("status=OPEN -> tous les OPEN sans limite d'age")
        void whenStatusOpen_thenUsesUnboundedOpenQuery() {
            Incident open = incident(1L, IncidentSeverity.P1, IncidentStatus.OPEN, "smtp");
            when(incidentRepository.findByStatusOrderByOpenedAtDesc(IncidentStatus.OPEN))
                    .thenReturn(List.of(open));

            List<Incident> result = service.searchIncidents(
                    IncidentStatus.OPEN, null, LocalDateTime.now().minusDays(30));

            assertThat(result).containsExactly(open);
            verify(incidentRepository, never()).findActiveSince(any());
        }

        @Test
        @DisplayName("status=RESOLVED -> requete scoped par date")
        void whenStatusResolved_thenUsesScopedQuery() {
            LocalDateTime since = LocalDateTime.now().minusDays(30);
            Incident resolved = incident(1L, IncidentSeverity.P1, IncidentStatus.RESOLVED, "kafka");
            when(incidentRepository.findByStatusAndOpenedAtAfterOrderByOpenedAtDesc(
                    IncidentStatus.RESOLVED, since)).thenReturn(List.of(resolved));

            List<Incident> result = service.searchIncidents(IncidentStatus.RESOLVED, null, since);

            assertThat(result).containsExactly(resolved);
        }

        @Test
        @DisplayName("status null -> mix OPEN (sans limite) + actifs hors OPEN")
        void whenStatusNull_thenMixesOpenAndActive() {
            LocalDateTime since = LocalDateTime.now().minusDays(30);
            Incident open = incident(1L, IncidentSeverity.P1, IncidentStatus.OPEN, "smtp");
            Incident resolved = incident(2L, IncidentSeverity.P1, IncidentStatus.RESOLVED, "kafka");
            when(incidentRepository.findByStatusOrderByOpenedAtDesc(IncidentStatus.OPEN))
                    .thenReturn(List.of(open));
            // findActiveSince retourne aussi l'OPEN : il doit etre deduplique (filtre != OPEN)
            when(incidentRepository.findActiveSince(since)).thenReturn(List.of(open, resolved));

            List<Incident> result = service.searchIncidents(null, null, since);

            assertThat(result).containsExactly(open, resolved);
        }

        @Test
        @DisplayName("filtre severity -> garde la severite demandee + les legacy null")
        void whenSeverityFilter_thenKeepsMatchingAndLegacyNull() {
            Incident p1 = incident(1L, IncidentSeverity.P1, IncidentStatus.OPEN, "smtp");
            Incident p2 = incident(2L, IncidentSeverity.P2, IncidentStatus.OPEN, "kafka");
            Incident legacy = incident(3L, null, IncidentStatus.OPEN, "redis");
            when(incidentRepository.findByStatusOrderByOpenedAtDesc(IncidentStatus.OPEN))
                    .thenReturn(List.of(p1, p2, legacy));

            List<Incident> result = service.searchIncidents(
                    IncidentStatus.OPEN, IncidentSeverity.P1, LocalDateTime.now().minusDays(30));

            assertThat(result).containsExactly(p1, legacy);
        }
    }

    @Nested
    @DisplayName("countOpenIncidents")
    class CountOpenIncidents {

        @Test
        void whenNoSeverity_thenCountsAllOpen() {
            when(incidentRepository.countByStatus(IncidentStatus.OPEN)).thenReturn(5L);

            assertThat(service.countOpenIncidents(null)).isEqualTo(5L);
        }

        @Test
        void whenSeverityP1_thenCountsBySeverity() {
            when(incidentRepository.countByStatusAndSeverity(IncidentStatus.OPEN, IncidentSeverity.P1))
                    .thenReturn(3L);

            assertThat(service.countOpenIncidents(IncidentSeverity.P1)).isEqualTo(3L);
        }
    }

    @Nested
    @DisplayName("findIncident")
    class FindIncident {

        @Test
        void whenFound_thenReturnsIncident() {
            Incident incident = new Incident();
            incident.setId(1L);
            when(incidentRepository.findById(1L)).thenReturn(Optional.of(incident));

            assertThat(service.findIncident(1L)).contains(incident);
        }

        @Test
        void whenNotFound_thenReturnsEmpty() {
            when(incidentRepository.findById(99L)).thenReturn(Optional.empty());

            assertThat(service.findIncident(99L)).isEmpty();
        }
    }
}
