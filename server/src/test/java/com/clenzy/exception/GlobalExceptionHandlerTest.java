package com.clenzy.exception;

import com.clenzy.config.SyncMetrics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

/**
 * Tests for {@link GlobalExceptionHandler}.
 * Validates HTTP status codes, response bodies, and metric increments.
 */
@ExtendWith(MockitoExtension.class)
class GlobalExceptionHandlerTest {

    @Mock
    private SyncMetrics syncMetrics;

    private GlobalExceptionHandler handler;

    @BeforeEach
    void setUp() {
        handler = new GlobalExceptionHandler(syncMetrics);
    }

    @Nested
    @DisplayName("CalendarConflictException → 409")
    class CalendarConflict {

        @Test
        void whenCalendarConflict_thenReturns409WithDetails() {
            LocalDate from = LocalDate.of(2026, 3, 1);
            LocalDate to = LocalDate.of(2026, 3, 5);
            CalendarConflictException ex = new CalendarConflictException(42L, from, to, 3);

            ResponseEntity<Map<String, Object>> response = handler.handleCalendarConflict(ex);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
            Map<String, Object> body = response.getBody();
            assertThat(body).isNotNull();
            assertThat(body.get("error")).isEqualTo("Conflit de calendrier");
            assertThat(body.get("propertyId")).isEqualTo(42L);
            assertThat(body.get("from")).isEqualTo(from.toString());
            assertThat(body.get("to")).isEqualTo(to.toString());
            assertThat(body.get("conflictCount")).isEqualTo(3L);
            assertThat(body.get("status")).isEqualTo(409);
            verify(syncMetrics).incrementConflictDetected();
        }

        @Test
        void whenCalendarConflictWithNullDates_thenHandlesGracefully() {
            CalendarConflictException ex = new CalendarConflictException(1L, null, null, 0);

            ResponseEntity<Map<String, Object>> response = handler.handleCalendarConflict(ex);

            Map<String, Object> body = response.getBody();
            assertThat(body).isNotNull();
            assertThat(body.get("from")).isNull();
            assertThat(body.get("to")).isNull();
        }
    }

    @Nested
    @DisplayName("RestrictionViolationException → 422")
    class RestrictionViolation {

        @Test
        void whenRestrictionViolation_thenReturns422WithViolations() {
            LocalDate checkIn = LocalDate.of(2026, 4, 1);
            LocalDate checkOut = LocalDate.of(2026, 4, 3);
            List<String> violations = List.of("min_stay: 3 nuits", "closed_to_arrival");
            RestrictionViolationException ex = new RestrictionViolationException(10L, checkIn, checkOut, violations);

            ResponseEntity<Map<String, Object>> response = handler.handleRestrictionViolation(ex);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
            Map<String, Object> body = response.getBody();
            assertThat(body).isNotNull();
            assertThat(body.get("error")).isEqualTo("Restriction de reservation non respectee");
            assertThat(body.get("propertyId")).isEqualTo(10L);
            assertThat(body.get("checkIn")).isEqualTo(checkIn.toString());
            assertThat(body.get("checkOut")).isEqualTo(checkOut.toString());
            assertThat((List<?>) body.get("violations")).hasSize(2);
            assertThat(body.get("status")).isEqualTo(422);
        }

        @Test
        void whenRestrictionViolationWithNullDates_thenHandlesGracefully() {
            RestrictionViolationException ex = new RestrictionViolationException(1L, null, null, List.of("test"));

            ResponseEntity<Map<String, Object>> response = handler.handleRestrictionViolation(ex);

            Map<String, Object> body = response.getBody();
            assertThat(body).isNotNull();
            assertThat(body.get("checkIn")).isNull();
            assertThat(body.get("checkOut")).isNull();
        }
    }

    @Nested
    @DisplayName("CalendarLockException → 429")
    class CalendarLock {

        @Test
        void whenCalendarLock_thenReturns429WithRetryAfter() {
            CalendarLockException ex = new CalendarLockException(7L);

            ResponseEntity<Map<String, Object>> response = handler.handleCalendarLock(ex);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
            assertThat(response.getHeaders().getFirst("Retry-After")).isEqualTo("2");
            Map<String, Object> body = response.getBody();
            assertThat(body).isNotNull();
            assertThat(body.get("propertyId")).isEqualTo(7L);
            assertThat(body.get("retryAfter")).isEqualTo(2);
            assertThat(body.get("status")).isEqualTo(429);
            verify(syncMetrics).incrementLockContention();
        }
    }

    @Nested
    @DisplayName("RuntimeException → 500")
    class RuntimeExceptionHandler {

        @Test
        void whenRuntimeException_thenReturns500() {
            RuntimeException ex = new RuntimeException("Something went wrong");

            ResponseEntity<Map<String, Object>> response = handler.handleRuntimeException(ex);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
            Map<String, Object> body = response.getBody();
            assertThat(body).isNotNull();
            assertThat(body.get("message")).isEqualTo("Something went wrong");
            assertThat(body.get("status")).isEqualTo(500);
        }

        @Test
        void whenRuntimeExceptionWithNullMessage_thenDefaultMessage() {
            RuntimeException ex = new RuntimeException((String) null);

            ResponseEntity<Map<String, Object>> response = handler.handleRuntimeException(ex);

            Map<String, Object> body = response.getBody();
            assertThat(body).isNotNull();
            assertThat(body.get("message")).isEqualTo("Une erreur inattendue s'est produite");
        }
    }

    @Nested
    @DisplayName("Exception → 500")
    class GenericExceptionHandler {

        @Test
        void whenCheckedException_thenReturns500() {
            Exception ex = new Exception("Generic error");

            ResponseEntity<Map<String, Object>> response = handler.handleException(ex);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
            Map<String, Object> body = response.getBody();
            assertThat(body).isNotNull();
            assertThat(body.get("message")).isEqualTo("Generic error");
        }

        @Test
        void whenCheckedExceptionWithNullMessage_thenDefaultMessage() {
            Exception ex = new Exception((String) null);

            ResponseEntity<Map<String, Object>> response = handler.handleException(ex);

            Map<String, Object> body = response.getBody();
            assertThat(body).isNotNull();
            assertThat(body.get("message")).isEqualTo("Une erreur inattendue s'est produite");
        }
    }

    @Nested
    @DisplayName("NotFoundException → 404")
    class NotFoundHandler {

        @Test
        void whenNotFoundException_thenReturns404() {
            NotFoundException ex = new NotFoundException("Propriete introuvable");

            ResponseEntity<Map<String, Object>> response = handler.handleNotFoundException(ex);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
            Map<String, Object> body = response.getBody();
            assertThat(body).isNotNull();
            assertThat(body.get("error")).isEqualTo("Ressource non trouvée");
            assertThat(body.get("message")).isEqualTo("Propriete introuvable");
            assertThat(body.get("status")).isEqualTo(404);
        }
    }

    @Nested
    @DisplayName("UnauthorizedException → 401")
    class UnauthorizedHandler {

        @Test
        void whenUnauthorizedException_thenReturns401() {
            UnauthorizedException ex = new UnauthorizedException("Token invalide");

            ResponseEntity<Map<String, Object>> response = handler.handleUnauthorizedException(ex);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
            Map<String, Object> body = response.getBody();
            assertThat(body).isNotNull();
            assertThat(body.get("error")).isEqualTo("Accès non autorisé");
            assertThat(body.get("message")).isEqualTo("Token invalide");
            assertThat(body.get("status")).isEqualTo(401);
        }
    }
}
