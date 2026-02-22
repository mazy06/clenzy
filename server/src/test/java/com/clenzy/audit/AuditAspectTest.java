package com.clenzy.audit;

import com.clenzy.model.AuditAction;
import com.clenzy.model.AuditSource;
import com.clenzy.service.AuditLogService;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.Signature;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuditAspectTest {

    @Mock private AuditLogService auditLogService;
    @Mock private JoinPoint joinPoint;
    @Mock private Signature signature;

    private AuditAspect auditAspect;

    @BeforeEach
    void setUp() {
        auditAspect = new AuditAspect(auditLogService);
    }

    // ── auditMethod ─────────────────────────────────────────────────

    @Nested
    @DisplayName("auditMethod")
    class AuditMethod {

        @Test
        @DisplayName("when method returns object with getId then logs action with entity id")
        void whenResultHasGetId_thenLogsWithEntityId() {
            // Arrange
            Audited audited = createAudited(AuditAction.CREATE, "Property", "Created new property");

            // Result object with getId()
            EntityWithId result = new EntityWithId(42L);

            // Act
            auditAspect.auditMethod(joinPoint, audited, result);

            // Assert
            verify(auditLogService).logAction(
                    eq(AuditAction.CREATE),
                    eq("Property"),
                    eq("42"),
                    isNull(),
                    contains("EntityWithId"),
                    eq("Created new property"),
                    eq(AuditSource.WEB)
            );
        }

        @Test
        @DisplayName("when description is empty then uses method signature")
        void whenDescriptionEmpty_thenUsesMethodSignature() {
            // Arrange
            Audited audited = createAudited(AuditAction.UPDATE, "Reservation", "");

            when(joinPoint.getSignature()).thenReturn(signature);
            when(signature.toShortString()).thenReturn("ReservationService.update(..)");

            // Act
            auditAspect.auditMethod(joinPoint, audited, "result-value");

            // Assert
            verify(auditLogService).logAction(
                    eq(AuditAction.UPDATE),
                    eq("Reservation"),
                    isNull(), // String has no getId()
                    isNull(),
                    eq("result-value"),
                    eq("ReservationService.update(..)"),
                    eq(AuditSource.WEB)
            );
        }

        @Test
        @DisplayName("when result is null then logs with null entity id and new value")
        void whenResultNull_thenLogsWithNullValues() {
            // Arrange
            Audited audited = createAudited(AuditAction.DELETE, "Intervention", "Deleted intervention");

            // Act
            auditAspect.auditMethod(joinPoint, audited, null);

            // Assert
            verify(auditLogService).logAction(
                    eq(AuditAction.DELETE),
                    eq("Intervention"),
                    isNull(),
                    isNull(),
                    isNull(),
                    eq("Deleted intervention"),
                    eq(AuditSource.WEB)
            );
        }

        @Test
        @DisplayName("when result toString is very long then summarizes to 500 chars")
        void whenResultStringLong_thenSummarizes() {
            // Arrange
            Audited audited = createAudited(AuditAction.READ, "Report", "Generated report");
            String longString = "x".repeat(600);

            // Act
            auditAspect.auditMethod(joinPoint, audited, longString);

            // Assert
            verify(auditLogService).logAction(
                    eq(AuditAction.READ),
                    eq("Report"),
                    isNull(),
                    isNull(),
                    argThat(s -> s.length() == 503 && s.endsWith("...")),
                    eq("Generated report"),
                    eq(AuditSource.WEB)
            );
        }

        @Test
        @DisplayName("when audit log service throws then exception is swallowed")
        void whenAuditServiceThrows_thenExceptionSwallowed() {
            // Arrange
            Audited audited = createAudited(AuditAction.CREATE, "Property", "test");

            when(joinPoint.getSignature()).thenReturn(signature);
            when(signature.toShortString()).thenReturn("SomeService.method(..)");
            doThrow(new RuntimeException("DB down")).when(auditLogService)
                    .logAction(any(), any(), any(), any(), any(), any(), any());

            // Act — should NOT throw
            auditAspect.auditMethod(joinPoint, audited, "result");

            // Assert — verify it was called (and failed silently)
            verify(auditLogService).logAction(any(), any(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("when result has no getId method then entity id is null")
        void whenResultHasNoGetId_thenEntityIdIsNull() {
            // Arrange
            Audited audited = createAudited(AuditAction.SYNC, "Listing", "Synced listing");

            // Act — pass a simple Map that has no getId()
            auditAspect.auditMethod(joinPoint, audited, java.util.Map.of("key", "value"));

            // Assert
            verify(auditLogService).logAction(
                    eq(AuditAction.SYNC),
                    eq("Listing"),
                    isNull(),
                    isNull(),
                    anyString(),
                    eq("Synced listing"),
                    eq(AuditSource.WEB)
            );
        }
    }

    // ── Helper classes ──────────────────────────────────────────────

    /**
     * Simple POJO with getId() to simulate domain entities.
     */
    static class EntityWithId {
        private final Long id;

        EntityWithId(Long id) {
            this.id = id;
        }

        public Long getId() {
            return id;
        }

        @Override
        public String toString() {
            return "EntityWithId{id=" + id + "}";
        }
    }

    /**
     * Creates a mock Audited annotation with the given values.
     */
    private Audited createAudited(AuditAction action, String entityType, String description) {
        Audited audited = mock(Audited.class);
        when(audited.action()).thenReturn(action);
        when(audited.entityType()).thenReturn(entityType);
        when(audited.description()).thenReturn(description);
        return audited;
    }
}
