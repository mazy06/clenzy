package com.clenzy.dto;

import com.clenzy.dto.manager.*;
import com.clenzy.dto.noise.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import com.clenzy.model.UserRole;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Coverage tests for all DTO records and classes — exercises constructors, getters, setters.
 */
class DtoCoverageTest {

    // ─── Records ─────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Record DTOs")
    class RecordDtos {
        @Test void rateOverrideDto() {
            RateOverrideDto dto = new RateOverrideDto(1L, 2L, "2026-03-15", 150.0, "MANUAL", "EUR");
            assertThat(dto.id()).isEqualTo(1L);
            assertThat(dto.propertyId()).isEqualTo(2L);
            assertThat(dto.date()).isEqualTo("2026-03-15");
            assertThat(dto.nightlyPrice()).isEqualTo(150.0);
            assertThat(dto.source()).isEqualTo("MANUAL");
            assertThat(dto.currency()).isEqualTo("EUR");
        }
        @Test void ratePlanDto() {
            RatePlanDto dto = new RatePlanDto(1L, 2L, "Summer Rate", "SEASONAL", 1,
                    120.0, "EUR", "2026-06-01", "2026-08-31",
                    new Integer[]{1,2,3,4,5}, 2, true);
            assertThat(dto.id()).isEqualTo(1L);
            assertThat(dto.propertyId()).isEqualTo(2L);
            assertThat(dto.type()).isEqualTo("SEASONAL");
        }
        @Test void reservationDto() {
            ReservationDto dto = new ReservationDto(1L, 2L, "Villa Bleue", "Jean", 2,
                    "2026-03-01", "2026-03-05", "14:00", "11:00",
                    "CONFIRMED", "AIRBNB", "Airbnb", 500.0, "ABC123", "Notes");
            assertThat(dto.id()).isEqualTo(1L);
            assertThat(dto.propertyId()).isEqualTo(2L);
            assertThat(dto.guestName()).isEqualTo("Jean");
        }
        @Test void contactSendRequest() {
            ContactSendRequest r = new ContactSendRequest("r-1", "Subject", "Body", "HIGH", "URGENT");
            assertThat(r.recipientId()).isEqualTo("r-1");
            assertThat(r.subject()).isEqualTo("Subject");
            assertThat(r.message()).isEqualTo("Body");
            assertThat(r.priority()).isEqualTo("HIGH");
            assertThat(r.category()).isEqualTo("URGENT");
        }
        @Test void contactBulkStatusRequest() {
            ContactBulkStatusRequest r = new ContactBulkStatusRequest(List.of(1L, 2L), "READ");
            assertThat(r.ids()).hasSize(2);
            assertThat(r.status()).isEqualTo("READ");
        }
        @Test void contactBulkDeleteRequest() {
            ContactBulkDeleteRequest r = new ContactBulkDeleteRequest(List.of(1L, 2L));
            assertThat(r.ids()).hasSize(2);
        }
        @Test void contactAttachmentDto() {
            ContactAttachmentDto dto = new ContactAttachmentDto("uuid-1", "file.pdf", "file.pdf", 1024L, "application/pdf", "/path");
            assertThat(dto.id()).isEqualTo("uuid-1");
            assertThat(dto.filename()).isEqualTo("file.pdf");
            assertThat(dto.contentType()).isEqualTo("application/pdf");
            assertThat(dto.size()).isEqualTo(1024L);
        }
        @Test void contactUserDto() {
            ContactUserDto dto = new ContactUserDto("user-1", "Jean", "Dupont", "jean@test.com", "HOST");
            assertThat(dto.id()).isEqualTo("user-1");
            assertThat(dto.firstName()).isEqualTo("Jean");
            assertThat(dto.lastName()).isEqualTo("Dupont");
        }
        @Test void documentGenerationDto() {
            LocalDateTime now = LocalDateTime.now();
            DocumentGenerationDto dto = new DocumentGenerationDto(1L, 2L, "Template", "FACTURE",
                    3L, "INTERVENTION", "user-1", "admin@test.com", "facture.pdf", 1024L,
                    "COMPLETED", "client@test.com", "SENT", now, null, 500, now,
                    "FAC-001", "hash123", false, null, null);
            assertThat(dto.id()).isEqualTo(1L);
            assertThat(dto.documentType()).isEqualTo("FACTURE");
            assertThat(dto.legalNumber()).isEqualTo("FAC-001");
        }
        @Test void generateDocumentRequest() {
            GenerateDocumentRequest req = new GenerateDocumentRequest("FACTURE", 1L, "INTERVENTION",
                    "client@test.com", true);
            assertThat(req.documentType()).isEqualTo("FACTURE");
            assertThat(req.referenceId()).isEqualTo(1L);
            assertThat(req.sendEmail()).isTrue();
        }
        @Test void documentTemplateDto() {
            LocalDateTime now = LocalDateTime.now();
            DocumentTemplateDto dto = new DocumentTemplateDto(1L, "Template", "Desc",
                    "FACTURE", "MANUAL", "facture.odt", 2, true,
                    "Subject", "Body", "admin@test.com", now, now, List.of());
            assertThat(dto.id()).isEqualTo(1L);
            assertThat(dto.name()).isEqualTo("Template");
        }
        @Test void documentTemplateTagDto() {
            DocumentTemplateTagDto dto = new DocumentTemplateTagDto(1L, "guestName", "GUEST",
                    "reservation.guestName", "Guest name", "TEXT", true);
            assertThat(dto.tagName()).isEqualTo("guestName");
        }
        @Test void checkInInstructionsDto() {
            CheckInInstructionsDto dto = new CheckInInstructionsDto(1L, 2L, "code123",
                    "wifi", "pass", "Parking info", "Arrival instructions",
                    "Departure instructions", "House rules", "Emergency contact",
                    "Additional notes", "2026-01-01T10:00");
            assertThat(dto.propertyId()).isEqualTo(2L);
            assertThat(dto.accessCode()).isEqualTo("code123");
        }
        @Test void updateCheckInInstructionsDto() {
            UpdateCheckInInstructionsDto dto = new UpdateCheckInInstructionsDto("code", "wifi",
                    "pass", "parking", "arrival", "departure", "rules", "emergency", "notes");
            assertThat(dto.accessCode()).isEqualTo("code");
            assertThat(dto.parkingInfo()).isEqualTo("parking");
        }
        @Test void guestMessageLogDto() {
            GuestMessageLogDto dto = new GuestMessageLogDto(1L, 2L, 3L, "Jean Dupont", 4L,
                    "Check-in Template", "EMAIL", "guest@test.com", "Subject", "SENT", null, "2026-01-01T10:00");
            assertThat(dto.recipient()).isEqualTo("guest@test.com");
            assertThat(dto.guestName()).isEqualTo("Jean Dupont");
        }
        @Test void messageTemplateDto() {
            MessageTemplateDto dto = new MessageTemplateDto(1L, "Check-in Template", "CHECK_IN",
                    "Subject", "Body", "fr", true, "2026-01-01T10:00", "2026-01-01T10:00");
            assertThat(dto.type()).isEqualTo("CHECK_IN");
            assertThat(dto.name()).isEqualTo("Check-in Template");
        }
        @Test void messagingAutomationConfigDto() {
            MessagingAutomationConfigDto dto = new MessagingAutomationConfigDto(
                    true, true, 24, 2, 1L, 2L, false);
            assertThat(dto.autoSendCheckIn()).isTrue();
            assertThat(dto.hoursBeforeCheckIn()).isEqualTo(24);
        }
        @Test void securityAuditLogDto() {
            SecurityAuditLogDto dto = new SecurityAuditLogDto(1L, "2026-01-01", "LOGIN_SUCCESS",
                    "LOGIN", "user-1", "user@test.com", "127.0.0.1", "SUCCESS", "OK", "Mozilla");
            assertThat(dto.eventType()).isEqualTo("LOGIN_SUCCESS");
            assertThat(dto.actorId()).isEqualTo("user-1");
        }
        @Test void complianceReportDto() {
            ComplianceReportDto dto = new ComplianceReportDto(1L, 2L, "Facture", "FACTURE",
                    true, LocalDateTime.now(), "admin", List.of(), List.of(), List.of(), 100);
            assertThat(dto.templateId()).isEqualTo(2L);
            assertThat(dto.score()).isEqualTo(100);
        }
        @Test void complianceStatsDto() {
            ComplianceStatsDto dto = new ComplianceStatsDto(10, 8, 5, 4, 3, 2,
                    Map.of("FACTURE", 5L), LocalDateTime.now(), 95);
            assertThat(dto.totalDocuments()).isEqualTo(10);
            assertThat(dto.averageComplianceScore()).isEqualTo(95);
        }

        // Manager records
        @Test void assignmentResultDto() {
            AssignmentResultDto dto = new AssignmentResultDto("OK", 3, 5, 1L);
            assertThat(dto.message()).isEqualTo("OK");
            assertThat(dto.clientsAssigned()).isEqualTo(3);
        }
        @Test void unassignmentResultDto() {
            UnassignmentResultDto dto = new UnassignmentResultDto("OK", 2);
            assertThat(dto.message()).isEqualTo("OK");
            assertThat(dto.removedCount()).isEqualTo(2);
        }
        @Test void reassignmentResultDto() {
            ReassignmentResultDto dto = new ReassignmentResultDto("OK", 1L, 2L, 3L);
            assertThat(dto.message()).isEqualTo("OK");
            assertThat(dto.clientId()).isEqualTo(1L);
        }
        @Test void propertyAssignmentResultDto() {
            PropertyAssignmentResultDto dto = new PropertyAssignmentResultDto("OK", 1L);
            assertThat(dto.message()).isEqualTo("OK");
            assertThat(dto.propertyId()).isEqualTo(1L);
        }
        @Test void teamUserAssignmentResultDto() {
            TeamUserAssignmentResultDto dto = new TeamUserAssignmentResultDto("OK", 3, 5);
            assertThat(dto.message()).isEqualTo("OK");
            assertThat(dto.teamsAssigned()).isEqualTo(3);
        }
        @Test void managerUserSummaryDto() {
            ManagerUserSummaryDto dto = new ManagerUserSummaryDto(1L, "Jean", "Dupont", "jean@test.com", "HOST", true);
            assertThat(dto.id()).isEqualTo(1L);
            assertThat(dto.firstName()).isEqualTo("Jean");
        }
        @Test void managerTeamSummaryDto() {
            ManagerTeamSummaryDto dto = new ManagerTeamSummaryDto(1L, "Equipe A", "Desc", "CLEANING", 3, true);
            assertThat(dto.id()).isEqualTo(1L);
            assertThat(dto.memberCount()).isEqualTo(3);
        }
        @Test void propertyByClientDto() {
            PropertyByClientDto dto = new PropertyByClientDto(1L, "Villa", "123 rue", "Paris", "VILLA", "ACTIVE", 2L, "Jean", true);
            assertThat(dto.id()).isEqualTo(1L);
            assertThat(dto.name()).isEqualTo("Villa");
        }

        // Noise records
        @Test void noiseAlertDto() {
            NoiseAlertDto dto = new NoiseAlertDto(1L, 2L, "Property A", 3L, "Device A", "WARNING",
                    85.5, 70, "Night", "MINUT", true, true, false, false, null, null, null, LocalDateTime.now());
            assertThat(dto.measuredDb()).isEqualTo(85.5);
            assertThat(dto.severity()).isEqualTo("WARNING");
        }
        @Test void noiseAlertConfigDto() {
            NoiseAlertConfigDto dto = new NoiseAlertConfigDto(1L, 2L, "Property A",
                    true, true, true, false, false, false, 30, "admin@test.com", List.of());
            assertThat(dto.enabled()).isTrue();
            assertThat(dto.cooldownMinutes()).isEqualTo(30);
        }
        @Test void saveNoiseAlertConfigDto() {
            SaveNoiseAlertConfigDto dto = new SaveNoiseAlertConfigDto(true, true, true, false,
                    false, false, 30, "admin@test.com", List.of());
            assertThat(dto.enabled()).isTrue();
            assertThat(dto.cooldownMinutes()).isEqualTo(30);
        }
    }

    // ─── Classes with getters/setters ────────────────────────────────────────
    @Nested
    @DisplayName("Class DTOs")
    class ClassDtos {
        @Test void paymentSessionRequest() {
            PaymentSessionRequest req = new PaymentSessionRequest();
            req.setInterventionId(1L);
            req.setAmount(java.math.BigDecimal.valueOf(5000));
            assertThat(req.getInterventionId()).isEqualTo(1L);
            assertThat(req.getAmount()).isEqualByComparingTo("5000");
        }
        @Test void paymentSessionResponse() {
            PaymentSessionResponse resp = new PaymentSessionResponse();
            resp.setSessionId("sess_123");
            resp.setUrl("https://stripe.com/pay");
            assertThat(resp.getSessionId()).isEqualTo("sess_123");
            assertThat(resp.getUrl()).isEqualTo("https://stripe.com/pay");
        }
        @Test void paymentSummaryDto() {
            PaymentSummaryDto dto = new PaymentSummaryDto();
            dto.totalPaid = java.math.BigDecimal.valueOf(10000);
            dto.totalPending = java.math.BigDecimal.valueOf(2000);
            dto.totalRefunded = java.math.BigDecimal.valueOf(500);
            dto.transactionCount = 50;
            assertThat(dto.totalPaid).isEqualByComparingTo("10000");
            assertThat(dto.transactionCount).isEqualTo(50);
        }
        @Test void paymentHistoryDto() {
            PaymentHistoryDto dto = new PaymentHistoryDto();
            dto.interventionId = 1L;
            dto.propertyName = "Villa";
            dto.amount = java.math.BigDecimal.valueOf(100);
            dto.status = "PAID";
            assertThat(dto.interventionId).isEqualTo(1L);
        }
        @Test void sendInvitationRequest() {
            SendInvitationRequest req = new SendInvitationRequest();
            req.setEmail("invite@test.com");
            req.setRole("ADMIN");
            assertThat(req.getEmail()).isEqualTo("invite@test.com");
            assertThat(req.getRole()).isEqualTo("ADMIN");
        }
        @Test void acceptInvitationRequest() {
            AcceptInvitationRequest req = new AcceptInvitationRequest();
            req.setToken("token-123");
            assertThat(req.getToken()).isEqualTo("token-123");
        }
        @Test void apiError() {
            ApiError err = new ApiError();
            err.status = 400;
            err.error = "Bad Request";
            err.message = "Invalid input";
            err.timestamp = java.time.OffsetDateTime.now();
            assertThat(err.status).isEqualTo(400);
            assertThat(err.error).isEqualTo("Bad Request");
            assertThat(err.message).isEqualTo("Invalid input");
            assertThat(err.timestamp).isNotNull();
        }
        @Test void quoteResponseDto() {
            QuoteResponseDto dto = new QuoteResponseDto();
            dto.setStatus("OK");
            dto.setMessage("Quote generated");
            dto.setRecommendedPackage("CONFORT");
            dto.setRecommendedRate(45);
            assertThat(dto.getStatus()).isEqualTo("OK");
            assertThat(dto.getRecommendedPackage()).isEqualTo("CONFORT");
            assertThat(dto.getRecommendedRate()).isEqualTo(45);
        }
        @Test void notificationPreferenceDto() {
            NotificationPreferenceDto dto = new NotificationPreferenceDto();
            dto.preferences = Map.of("INTERVENTION_CREATED", true, "PAYMENT_RECEIVED", false);
            assertThat(dto.preferences).containsEntry("INTERVENTION_CREATED", true);
            assertThat(dto.preferences).containsEntry("PAYMENT_RECEIVED", false);
            // Also test the parameterized constructor
            NotificationPreferenceDto dto2 = new NotificationPreferenceDto(Map.of("KEY", true));
            assertThat(dto2.preferences).containsEntry("KEY", true);
        }
        @Test void changeOrgMemberRoleRequest() {
            ChangeOrgMemberRoleRequest req = new ChangeOrgMemberRoleRequest();
            req.setRole("ADMIN");
            assertThat(req.getRole()).isEqualTo("ADMIN");
        }
        @Test void organizationMemberDto() {
            OrganizationMemberDto dto = new OrganizationMemberDto();
            dto.setId(1L);
            dto.setUserId(2L);
            dto.setRoleInOrg("ADMIN");
            dto.setFirstName("Jean");
            dto.setLastName("Dupont");
            dto.setEmail("jean@test.com");
            assertThat(dto.getId()).isEqualTo(1L);
            assertThat(dto.getUserId()).isEqualTo(2L);
            assertThat(dto.getRoleInOrg()).isEqualTo("ADMIN");
        }
        @Test void invitationDto() {
            InvitationDto dto = new InvitationDto();
            dto.setId(1L);
            dto.setInvitedEmail("invite@test.com");
            dto.setRoleInvited("MEMBER");
            dto.setStatus("PENDING");
            dto.setOrganizationName("Test Org");
            assertThat(dto.getId()).isEqualTo(1L);
            assertThat(dto.getInvitedEmail()).isEqualTo("invite@test.com");
        }
        @Test void managerDto() {
            ManagerDto dto = new ManagerDto();
            dto.setId(1L);
            dto.setFirstName("Jean");
            dto.setLastName("Dupont");
            dto.setEmail("jean@test.com");
            dto.setRole(UserRole.SUPER_MANAGER);
            assertThat(dto.getId()).isEqualTo(1L);
            assertThat(dto.getRole()).isEqualTo(UserRole.SUPER_MANAGER);
        }
        @Test void managerAssociationsDto() {
            ManagerAssociationsDto dto = new ManagerAssociationsDto();
            dto.setClients(List.of());
            dto.setUsers(List.of());
            dto.setTeams(List.of());
            dto.setProperties(List.of());
            assertThat(dto.getClients()).isEmpty();
            assertThat(dto.getUsers()).isEmpty();
            assertThat(dto.getTeams()).isEmpty();
            assertThat(dto.getProperties()).isEmpty();
        }
        @Test void reassignmentRequest() {
            ReassignmentRequest req = new ReassignmentRequest();
            req.setNewManagerId(2L);
            req.setNotes("Reassignment notes");
            assertThat(req.getNewManagerId()).isEqualTo(2L);
            assertThat(req.getNotes()).isEqualTo("Reassignment notes");
        }
        @Test void assignmentRequest() {
            AssignmentRequest req = new AssignmentRequest();
            req.setClientIds(List.of(1L, 2L));
            req.setPropertyIds(List.of(3L, 4L));
            req.setNotes("Assignment notes");
            assertThat(req.getClientIds()).hasSize(2);
            assertThat(req.getPropertyIds()).hasSize(2);
            assertThat(req.getNotes()).isEqualTo("Assignment notes");
        }
        @Test void propertyTeamRequest() {
            PropertyTeamRequest req = new PropertyTeamRequest();
            req.setPropertyId(1L);
            req.setTeamId(2L);
            assertThat(req.getPropertyId()).isEqualTo(1L);
            assertThat(req.getTeamId()).isEqualTo(2L);
        }
        @Test void teamUserAssignmentRequest() {
            TeamUserAssignmentRequest req = new TeamUserAssignmentRequest();
            req.setManagerId(1L);
            req.setTeamIds(List.of(2L, 3L));
            req.setUserIds(List.of(4L, 5L));
            assertThat(req.getManagerId()).isEqualTo(1L);
            assertThat(req.getTeamIds()).hasSize(2);
            assertThat(req.getUserIds()).hasSize(2);
        }
        @Test void rolePermissionsDto() {
            RolePermissionsDto dto = new RolePermissionsDto();
            dto.setRole("ADMIN");
            dto.setPermissions(List.of("intervention.create", "intervention.read"));
            assertThat(dto.getRole()).isEqualTo("ADMIN");
            assertThat(dto.getPermissions()).hasSize(2);
        }
        @Test void noiseDataPointDto() {
            NoiseDataPointDto dto = new NoiseDataPointDto();
            dto.setTime("2026-01-01T10:00");
            dto.setDecibels(75.0);
            dto.setDeviceLabel("Living Room");
            assertThat(dto.getTime()).isEqualTo("2026-01-01T10:00");
            assertThat(dto.getDecibels()).isEqualTo(75.0);
            assertThat(dto.getDeviceLabel()).isEqualTo("Living Room");
        }
        @Test void noiseChartDataDto() {
            NoiseChartDataDto dto = new NoiseChartDataDto();
            dto.setDevices(List.of());
            dto.setChartData(List.of(Map.of("time", "10:00", "value", 70.0)));
            assertThat(dto.getDevices()).isEmpty();
            assertThat(dto.getChartData()).hasSize(1);
        }
        @Test void noiseDeviceDto() {
            NoiseDeviceDto dto = new NoiseDeviceDto();
            dto.setId(1L);
            dto.setExternalDeviceId("device-1");
            dto.setName("Living Room");
            dto.setPropertyId(2L);
            dto.setDeviceType("MINUT");
            assertThat(dto.getId()).isEqualTo(1L);
            assertThat(dto.getExternalDeviceId()).isEqualTo("device-1");
            assertThat(dto.getDeviceType()).isEqualTo("MINUT");
        }
        @Test void createNoiseDeviceDto() {
            CreateNoiseDeviceDto dto = new CreateNoiseDeviceDto();
            dto.setDeviceType("MINUT");
            dto.setName("Living Room");
            dto.setPropertyId(2L);
            dto.setExternalDeviceId("device-1");
            assertThat(dto.getDeviceType()).isEqualTo("MINUT");
            assertThat(dto.getExternalDeviceId()).isEqualTo("device-1");
        }
        @Test void minutConnectionStatusDto() {
            MinutConnectionStatusDto dto = new MinutConnectionStatusDto();
            dto.setConnected(true);
            dto.setDeviceCount(3L);
            assertThat(dto.isConnected()).isTrue();
            assertThat(dto.getDeviceCount()).isEqualTo(3L);
        }
        @Test void tuyaConnectionStatusDto() {
            TuyaConnectionStatusDto dto = new TuyaConnectionStatusDto();
            dto.setConnected(true);
            dto.setDeviceCount(5L);
            assertThat(dto.isConnected()).isTrue();
            assertThat(dto.getDeviceCount()).isEqualTo(5L);
        }
        @Test void clientAssociationDto() {
            ClientAssociationDto dto = new ClientAssociationDto();
            dto.setId(1L);
            dto.setFirstName("Jean");
            dto.setLastName("Dupont");
            assertThat(dto.getId()).isEqualTo(1L);
            assertThat(dto.getFirstName()).isEqualTo("Jean");
        }
        @Test void propertyAssociationDto() {
            PropertyAssociationDto dto = new PropertyAssociationDto();
            dto.setId(1L);
            dto.setName("Villa");
            assertThat(dto.getId()).isEqualTo(1L);
            assertThat(dto.getName()).isEqualTo("Villa");
        }
        @Test void teamAssociationDto() {
            TeamAssociationDto dto = new TeamAssociationDto();
            dto.setId(1L);
            dto.setName("Equipe A");
            assertThat(dto.getId()).isEqualTo(1L);
            assertThat(dto.getName()).isEqualTo("Equipe A");
        }
        @Test void userAssociationDto() {
            UserAssociationDto dto = new UserAssociationDto();
            dto.setId(1L);
            dto.setFirstName("Jean");
            dto.setLastName("Dupont");
            dto.setRole("HOST");
            assertThat(dto.getId()).isEqualTo(1L);
            assertThat(dto.getRole()).isEqualTo("HOST");
        }
    }

    // ─── ICalImportDto inner classes ─────────────────────────────────────────
    @Nested
    @DisplayName("ICalImportDto classes")
    class ICalImportDtoTests {
        @Test void previewRequest() {
            ICalImportDto.PreviewRequest req = new ICalImportDto.PreviewRequest();
            req.setUrl("https://example.com/feed.ics");
            req.setPropertyId(1L);
            assertThat(req.getUrl()).isEqualTo("https://example.com/feed.ics");
            assertThat(req.getPropertyId()).isEqualTo(1L);
        }
        @Test void importRequest() {
            ICalImportDto.ImportRequest req = new ICalImportDto.ImportRequest();
            req.setUrl("https://example.com/feed.ics");
            req.setPropertyId(1L);
            req.setSourceName("Airbnb");
            req.setAutoCreateInterventions(false);
            assertThat(req.getUrl()).isEqualTo("https://example.com/feed.ics");
            assertThat(req.getSourceName()).isEqualTo("Airbnb");
            assertThat(req.isAutoCreateInterventions()).isFalse();
        }
        @Test void iCalEventPreview() {
            ICalImportDto.ICalEventPreview ev = new ICalImportDto.ICalEventPreview();
            ev.setUid("uid-1");
            ev.setSummary("Reservation Jean");
            ev.setDtStart(LocalDate.of(2026, 3, 1));
            ev.setDtEnd(LocalDate.of(2026, 3, 5));
            ev.setDescription("Desc");
            ev.setType("reservation");
            ev.setGuestName("Jean");
            ev.setConfirmationCode("ABC123");
            ev.setNights(4);
            assertThat(ev.getUid()).isEqualTo("uid-1");
            assertThat(ev.getSummary()).isEqualTo("Reservation Jean");
            assertThat(ev.getDtStart()).isEqualTo(LocalDate.of(2026, 3, 1));
            assertThat(ev.getDtEnd()).isEqualTo(LocalDate.of(2026, 3, 5));
            assertThat(ev.getDescription()).isEqualTo("Desc");
            assertThat(ev.getType()).isEqualTo("reservation");
            assertThat(ev.getGuestName()).isEqualTo("Jean");
            assertThat(ev.getConfirmationCode()).isEqualTo("ABC123");
            assertThat(ev.getNights()).isEqualTo(4);
        }
        @Test void previewResponse() {
            ICalImportDto.PreviewResponse resp = new ICalImportDto.PreviewResponse();
            resp.setEvents(List.of());
            resp.setTotalReservations(5);
            resp.setTotalBlocked(2);
            resp.setPropertyName("Villa Bleue");
            assertThat(resp.getEvents()).isEmpty();
            assertThat(resp.getTotalReservations()).isEqualTo(5);
            assertThat(resp.getTotalBlocked()).isEqualTo(2);
            assertThat(resp.getPropertyName()).isEqualTo("Villa Bleue");
        }
        @Test void importResponse() {
            ICalImportDto.ImportResponse resp = new ICalImportDto.ImportResponse();
            resp.setImported(10);
            resp.setSkipped(2);
            resp.setErrors(List.of("err1"));
            resp.setFeedId(5L);
            assertThat(resp.getImported()).isEqualTo(10);
            assertThat(resp.getSkipped()).isEqualTo(2);
            assertThat(resp.getErrors()).hasSize(1);
            assertThat(resp.getFeedId()).isEqualTo(5L);
        }
        @Test void feedDto() {
            ICalImportDto.FeedDto fd = new ICalImportDto.FeedDto();
            fd.setId(1L);
            fd.setPropertyId(2L);
            fd.setPropertyName("Villa");
            fd.setUrl("https://example.com/feed.ics");
            fd.setSourceName("Airbnb");
            fd.setAutoCreateInterventions(true);
            fd.setSyncEnabled(true);
            fd.setLastSyncAt(LocalDateTime.now());
            fd.setLastSyncStatus("SUCCESS");
            fd.setEventsImported(15);
            assertThat(fd.getId()).isEqualTo(1L);
            assertThat(fd.getPropertyId()).isEqualTo(2L);
            assertThat(fd.getPropertyName()).isEqualTo("Villa");
            assertThat(fd.getUrl()).isEqualTo("https://example.com/feed.ics");
            assertThat(fd.getSourceName()).isEqualTo("Airbnb");
            assertThat(fd.isAutoCreateInterventions()).isTrue();
            assertThat(fd.isSyncEnabled()).isTrue();
            assertThat(fd.getLastSyncAt()).isNotNull();
            assertThat(fd.getLastSyncStatus()).isEqualTo("SUCCESS");
            assertThat(fd.getEventsImported()).isEqualTo(15);
        }
    }

    // ─── PricingConfigDto ─────────────────────────────────────────────────────
    @Nested
    @DisplayName("PricingConfigDto and nested classes")
    class PricingConfigDtoTests {
        @Test void mainDto() {
            PricingConfigDto dto = new PricingConfigDto();
            dto.setId(1L);
            dto.setPropertyTypeCoeffs(Map.of("APARTMENT", 1.0));
            dto.setPropertyCountCoeffs(Map.of("1-5", 1.0));
            dto.setGuestCapacityCoeffs(Map.of("1-4", 1.0));
            dto.setFrequencyCoeffs(Map.of("WEEKLY", 1.2));
            dto.setBasePriceEssentiel(30);
            dto.setBasePriceConfort(45);
            dto.setBasePricePremium(60);
            dto.setMinPrice(25);
            dto.setPmsMonthlyPriceCents(2900);
            dto.setPmsSyncPriceCents(500);
            dto.setAutomationBasicSurcharge(10);
            dto.setAutomationFullSurcharge(25);
            dto.setUpdatedAt("2026-01-01");
            dto.setForfaitConfigs(List.of());
            dto.setTravauxConfig(List.of());
            dto.setExterieurConfig(List.of());
            dto.setBlanchisserieConfig(List.of());
            dto.setCommissionConfigs(List.of());
            dto.setAvailablePrestations(List.of());
            dto.setAvailableSurcharges(List.of());
            dto.setSurfaceTiers(List.of());
            assertThat(dto.getId()).isEqualTo(1L);
            assertThat(dto.getPropertyTypeCoeffs()).containsEntry("APARTMENT", 1.0);
            assertThat(dto.getBasePriceEssentiel()).isEqualTo(30);
            assertThat(dto.getBasePriceConfort()).isEqualTo(45);
            assertThat(dto.getBasePricePremium()).isEqualTo(60);
            assertThat(dto.getMinPrice()).isEqualTo(25);
            assertThat(dto.getPmsMonthlyPriceCents()).isEqualTo(2900);
            assertThat(dto.getPmsSyncPriceCents()).isEqualTo(500);
            assertThat(dto.getAutomationBasicSurcharge()).isEqualTo(10);
            assertThat(dto.getAutomationFullSurcharge()).isEqualTo(25);
            assertThat(dto.getUpdatedAt()).isEqualTo("2026-01-01");
            assertThat(dto.getForfaitConfigs()).isEmpty();
            assertThat(dto.getTravauxConfig()).isEmpty();
            assertThat(dto.getExterieurConfig()).isEmpty();
            assertThat(dto.getBlanchisserieConfig()).isEmpty();
            assertThat(dto.getCommissionConfigs()).isEmpty();
            assertThat(dto.getAvailablePrestations()).isEmpty();
            assertThat(dto.getAvailableSurcharges()).isEmpty();
            assertThat(dto.getSurfaceTiers()).isEmpty();
            assertThat(dto.getPropertyCountCoeffs()).isNotNull();
            assertThat(dto.getGuestCapacityCoeffs()).isNotNull();
            assertThat(dto.getFrequencyCoeffs()).isNotNull();
        }
        @Test void forfaitConfig() {
            PricingConfigDto.ForfaitConfig fc = new PricingConfigDto.ForfaitConfig();
            fc.setKey("CLEANING");
            fc.setLabel("Standard");
            fc.setCoeffMin(0.8);
            fc.setCoeffMax(1.2);
            fc.setServiceTypes(List.of("CLEANING"));
            fc.setIncludedPrestations(List.of("vacuum"));
            fc.setExtraPrestations(List.of("ironing"));
            fc.setEligibleTeamIds(List.of(1L, 2L));
            fc.setSurcharges(Map.of("perBedroom", 5.0));
            fc.setSurfaceBasePrices(List.of());
            assertThat(fc.getKey()).isEqualTo("CLEANING");
            assertThat(fc.getLabel()).isEqualTo("Standard");
            assertThat(fc.getCoeffMin()).isEqualTo(0.8);
            assertThat(fc.getCoeffMax()).isEqualTo(1.2);
            assertThat(fc.getServiceTypes()).hasSize(1);
            assertThat(fc.getIncludedPrestations()).hasSize(1);
            assertThat(fc.getExtraPrestations()).hasSize(1);
            assertThat(fc.getEligibleTeamIds()).hasSize(2);
            assertThat(fc.getSurcharges()).containsEntry("perBedroom", 5.0);
            assertThat(fc.getSurfaceBasePrices()).isEmpty();
        }
        @Test void surfaceBasePrice() {
            PricingConfigDto.SurfaceBasePrice sbp = new PricingConfigDto.SurfaceBasePrice();
            sbp.setMaxSurface(50);
            sbp.setBase(30);
            assertThat(sbp.getMaxSurface()).isEqualTo(50);
            assertThat(sbp.getBase()).isEqualTo(30);

            PricingConfigDto.SurfaceBasePrice sbp2 = new PricingConfigDto.SurfaceBasePrice(100, 45);
            assertThat(sbp2.getMaxSurface()).isEqualTo(100);
            assertThat(sbp2.getBase()).isEqualTo(45);
        }
        @Test void servicePriceConfig() {
            PricingConfigDto.ServicePriceConfig spc = new PricingConfigDto.ServicePriceConfig();
            spc.setInterventionType("PLUMBING");
            spc.setBasePrice(80.0);
            spc.setEnabled(true);
            assertThat(spc.getInterventionType()).isEqualTo("PLUMBING");
            assertThat(spc.getBasePrice()).isEqualTo(80.0);
            assertThat(spc.isEnabled()).isTrue();

            PricingConfigDto.ServicePriceConfig spc2 = new PricingConfigDto.ServicePriceConfig("ELECTRICAL", 100.0, false);
            assertThat(spc2.getInterventionType()).isEqualTo("ELECTRICAL");
            assertThat(spc2.isEnabled()).isFalse();
        }
        @Test void blanchisserieItem() {
            PricingConfigDto.BlanchisserieItem bi = new PricingConfigDto.BlanchisserieItem();
            bi.setKey("SHEETS");
            bi.setLabel("Draps");
            bi.setPrice(5.0);
            bi.setEnabled(true);
            assertThat(bi.getKey()).isEqualTo("SHEETS");
            assertThat(bi.getLabel()).isEqualTo("Draps");
            assertThat(bi.getPrice()).isEqualTo(5.0);
            assertThat(bi.isEnabled()).isTrue();

            PricingConfigDto.BlanchisserieItem bi2 = new PricingConfigDto.BlanchisserieItem("TOWELS", "Serviettes", 3.0, false);
            assertThat(bi2.getKey()).isEqualTo("TOWELS");
            assertThat(bi2.isEnabled()).isFalse();
        }
        @Test void commissionConfig() {
            PricingConfigDto.CommissionConfig cc = new PricingConfigDto.CommissionConfig();
            cc.setCategory("CLEANING");
            cc.setEnabled(true);
            cc.setRate(0.15);
            assertThat(cc.getCategory()).isEqualTo("CLEANING");
            assertThat(cc.isEnabled()).isTrue();
            assertThat(cc.getRate()).isEqualTo(0.15);

            PricingConfigDto.CommissionConfig cc2 = new PricingConfigDto.CommissionConfig("REPAIR", false, 0.20);
            assertThat(cc2.getCategory()).isEqualTo("REPAIR");
            assertThat(cc2.isEnabled()).isFalse();
        }
        @Test void prestationOption() {
            PricingConfigDto.PrestationOption po = new PricingConfigDto.PrestationOption();
            po.setKey("ironing");
            po.setLabel("Repassage");
            assertThat(po.getKey()).isEqualTo("ironing");
            assertThat(po.getLabel()).isEqualTo("Repassage");

            PricingConfigDto.PrestationOption po2 = new PricingConfigDto.PrestationOption("deep_kitchen", "Cuisine en profondeur");
            assertThat(po2.getKey()).isEqualTo("deep_kitchen");
            assertThat(po2.getLabel()).isEqualTo("Cuisine en profondeur");
        }
        @Test void surchargeOption() {
            PricingConfigDto.SurchargeOption so = new PricingConfigDto.SurchargeOption();
            so.setKey("perBedroom");
            so.setLabel("Par chambre");
            so.setUnit("EUR");
            assertThat(so.getKey()).isEqualTo("perBedroom");
            assertThat(so.getLabel()).isEqualTo("Par chambre");
            assertThat(so.getUnit()).isEqualTo("EUR");

            PricingConfigDto.SurchargeOption so2 = new PricingConfigDto.SurchargeOption("perFloor", "Par etage", "%");
            assertThat(so2.getKey()).isEqualTo("perFloor");
            assertThat(so2.getUnit()).isEqualTo("%");
        }
        @Test void surfaceTier() {
            PricingConfigDto.SurfaceTier st = new PricingConfigDto.SurfaceTier();
            st.setMaxSurface(50);
            st.setCoeff(1.0);
            st.setLabel("Small");
            assertThat(st.getMaxSurface()).isEqualTo(50);
            assertThat(st.getCoeff()).isEqualTo(1.0);
            assertThat(st.getLabel()).isEqualTo("Small");

            PricingConfigDto.SurfaceTier st2 = new PricingConfigDto.SurfaceTier(100, 1.5, "Medium");
            assertThat(st2.getMaxSurface()).isEqualTo(100);
            assertThat(st2.getCoeff()).isEqualTo(1.5);
        }
    }

    // ─── PortfolioStatsDto ────────────────────────────────────────────────────
    @Nested
    @DisplayName("PortfolioStatsDto and nested classes")
    class PortfolioStatsDtoTests {
        @Test void mainDto() {
            PortfolioStatsDto dto = new PortfolioStatsDto();
            dto.setTotalPortfolios(5);
            dto.setTotalClients(20);
            dto.setTotalProperties(15);
            dto.setTotalTeamMembers(8);
            dto.setActivePortfolios(4);
            dto.setInactivePortfolios(1);
            dto.setRecentAssignments(List.of());
            dto.setPortfolioBreakdown(List.of());
            assertThat(dto.getTotalPortfolios()).isEqualTo(5);
            assertThat(dto.getTotalClients()).isEqualTo(20);
            assertThat(dto.getTotalProperties()).isEqualTo(15);
            assertThat(dto.getTotalTeamMembers()).isEqualTo(8);
            assertThat(dto.getActivePortfolios()).isEqualTo(4);
            assertThat(dto.getInactivePortfolios()).isEqualTo(1);
            assertThat(dto.getRecentAssignments()).isEmpty();
            assertThat(dto.getPortfolioBreakdown()).isEmpty();
        }
        @Test void recentAssignment() {
            PortfolioStatsDto.RecentAssignment ra = new PortfolioStatsDto.RecentAssignment();
            ra.setId(1L);
            ra.setType("CLIENT");
            ra.setName("Jean");
            ra.setPortfolioName("Portfolio A");
            ra.setAssignedAt(LocalDateTime.now());
            assertThat(ra.getId()).isEqualTo(1L);
            assertThat(ra.getType()).isEqualTo("CLIENT");
            assertThat(ra.getName()).isEqualTo("Jean");
            assertThat(ra.getPortfolioName()).isEqualTo("Portfolio A");
            assertThat(ra.getAssignedAt()).isNotNull();

            PortfolioStatsDto.RecentAssignment ra2 = new PortfolioStatsDto.RecentAssignment(2L, "TEAM", "Bob", "PF-B", LocalDateTime.now());
            assertThat(ra2.getId()).isEqualTo(2L);
            assertThat(ra2.getType()).isEqualTo("TEAM");
        }
        @Test void portfolioBreakdown() {
            PortfolioStatsDto.PortfolioBreakdown pb = new PortfolioStatsDto.PortfolioBreakdown();
            pb.setPortfolioId(1L);
            pb.setPortfolioName("PF-A");
            pb.setClientCount(5);
            pb.setTeamMemberCount(3);
            pb.setIsActive(true);
            assertThat(pb.getPortfolioId()).isEqualTo(1L);
            assertThat(pb.getPortfolioName()).isEqualTo("PF-A");
            assertThat(pb.getClientCount()).isEqualTo(5);
            assertThat(pb.getTeamMemberCount()).isEqualTo(3);
            assertThat(pb.getIsActive()).isTrue();

            PortfolioStatsDto.PortfolioBreakdown pb2 = new PortfolioStatsDto.PortfolioBreakdown(2L, "PF-B", 10, 5, false);
            assertThat(pb2.getPortfolioId()).isEqualTo(2L);
            assertThat(pb2.getIsActive()).isFalse();
        }
    }

    // ─── PortfolioDto ─────────────────────────────────────────────────────────
    @Nested
    @DisplayName("PortfolioDto")
    class PortfolioDtoTests {
        @Test void defaultConstructor() {
            PortfolioDto dto = new PortfolioDto();
            assertThat(dto.getIsActive()).isTrue();
        }
        @Test void parameterizedConstructor() {
            PortfolioDto dto = new PortfolioDto(1L, "Portfolio A", "Description");
            assertThat(dto.getManagerId()).isEqualTo(1L);
            assertThat(dto.getName()).isEqualTo("Portfolio A");
            assertThat(dto.getDescription()).isEqualTo("Description");
        }
        @Test void setters() {
            PortfolioDto dto = new PortfolioDto();
            dto.setId(1L);
            dto.setManagerId(2L);
            dto.setName("PF");
            dto.setDescription("Desc");
            dto.setIsActive(false);
            dto.setCreatedAt(LocalDateTime.now());
            dto.setUpdatedAt(LocalDateTime.now());
            dto.setManagerName("Jean Dupont");
            dto.setClients(List.of());
            dto.setTeamMembers(List.of());
            dto.setClientCount(5L);
            dto.setTeamMemberCount(3L);
            assertThat(dto.getId()).isEqualTo(1L);
            assertThat(dto.getManagerId()).isEqualTo(2L);
            assertThat(dto.getIsActive()).isFalse();
            assertThat(dto.getManagerName()).isEqualTo("Jean Dupont");
            assertThat(dto.getClients()).isEmpty();
            assertThat(dto.getTeamMembers()).isEmpty();
            assertThat(dto.getClientCount()).isEqualTo(5L);
            assertThat(dto.getTeamMemberCount()).isEqualTo(3L);
        }
    }

    // ─── PortfolioTeamDto ─────────────────────────────────────────────────────
    @Nested
    @DisplayName("PortfolioTeamDto")
    class PortfolioTeamDtoTests {
        @Test void defaultConstructor() {
            PortfolioTeamDto dto = new PortfolioTeamDto();
            assertThat(dto.getId()).isNull();
        }
        @Test void parameterizedConstructor() {
            PortfolioTeamDto dto = new PortfolioTeamDto(1L, 2L, com.clenzy.model.TeamRole.TECHNICIAN);
            assertThat(dto.getPortfolioId()).isEqualTo(1L);
            assertThat(dto.getTeamMemberId()).isEqualTo(2L);
            assertThat(dto.getRoleInTeam()).isEqualTo(com.clenzy.model.TeamRole.TECHNICIAN);
        }
        @Test void setters() {
            PortfolioTeamDto dto = new PortfolioTeamDto();
            dto.setId(1L);
            dto.setPortfolioId(2L);
            dto.setTeamMemberId(3L);
            dto.setTeamMemberName("Jean");
            dto.setTeamMemberEmail("jean@test.com");
            dto.setRoleInTeam(com.clenzy.model.TeamRole.HOUSEKEEPER);
            dto.setAssignedAt(LocalDateTime.now());
            dto.setIsActive(true);
            dto.setNotes("Notes");
            assertThat(dto.getId()).isEqualTo(1L);
            assertThat(dto.getTeamMemberName()).isEqualTo("Jean");
            assertThat(dto.getTeamMemberEmail()).isEqualTo("jean@test.com");
            assertThat(dto.getRoleInTeam()).isEqualTo(com.clenzy.model.TeamRole.HOUSEKEEPER);
            assertThat(dto.getIsActive()).isTrue();
            assertThat(dto.getNotes()).isEqualTo("Notes");
        }
    }

    // ─── PortfolioClientDto ───────────────────────────────────────────────────
    @Nested
    @DisplayName("PortfolioClientDto")
    class PortfolioClientDtoTests {
        @Test void defaultConstructor() {
            PortfolioClientDto dto = new PortfolioClientDto();
            assertThat(dto.getId()).isNull();
        }
        @Test void parameterizedConstructor() {
            PortfolioClientDto dto = new PortfolioClientDto(1L, 2L);
            assertThat(dto.getPortfolioId()).isEqualTo(1L);
            assertThat(dto.getClientId()).isEqualTo(2L);
        }
        @Test void setters() {
            PortfolioClientDto dto = new PortfolioClientDto();
            dto.setId(1L);
            dto.setPortfolioId(2L);
            dto.setClientId(3L);
            dto.setClientName("Jean");
            dto.setClientEmail("jean@test.com");
            dto.setClientRole("HOST");
            dto.setAssignedAt(LocalDateTime.now());
            dto.setIsActive(true);
            dto.setNotes("Notes");
            assertThat(dto.getId()).isEqualTo(1L);
            assertThat(dto.getClientName()).isEqualTo("Jean");
            assertThat(dto.getClientEmail()).isEqualTo("jean@test.com");
            assertThat(dto.getClientRole()).isEqualTo("HOST");
            assertThat(dto.getIsActive()).isTrue();
        }
    }

    // ─── UserProfileDto ───────────────────────────────────────────────────────
    @Nested
    @DisplayName("UserProfileDto")
    class UserProfileDtoTests {
        @Test void defaultConstructor() {
            UserProfileDto dto = new UserProfileDto();
            assertThat(dto.getId()).isNull();
        }
        @Test void parameterizedConstructor() {
            UserProfileDto dto = new UserProfileDto("user-1", "jean@test.com", "Jean", "Dupont");
            assertThat(dto.getId()).isEqualTo("user-1");
            assertThat(dto.getEmail()).isEqualTo("jean@test.com");
            assertThat(dto.getFirstName()).isEqualTo("Jean");
            assertThat(dto.getLastName()).isEqualTo("Dupont");
        }
        @Test void getFullNameBothNames() {
            UserProfileDto dto = new UserProfileDto("id", "e@t.com", "Jean", "Dupont");
            assertThat(dto.getFullName()).isEqualTo("Jean Dupont");
        }
        @Test void getFullNameFirstOnly() {
            UserProfileDto dto = new UserProfileDto();
            dto.setFirstName("Jean");
            assertThat(dto.getFullName()).isEqualTo("Jean");
        }
        @Test void getFullNameLastOnly() {
            UserProfileDto dto = new UserProfileDto();
            dto.setLastName("Dupont");
            assertThat(dto.getFullName()).isEqualTo("Dupont");
        }
        @Test void getFullNameEmailFallback() {
            UserProfileDto dto = new UserProfileDto();
            dto.setEmail("jean@test.com");
            assertThat(dto.getFullName()).isEqualTo("jean@test.com");
        }
        @Test void getFullNameIdFallback() {
            UserProfileDto dto = new UserProfileDto();
            dto.setId("user-1");
            assertThat(dto.getFullName()).isEqualTo("user-1");
        }
        @Test void setters() {
            UserProfileDto dto = new UserProfileDto();
            dto.setEnabled(true);
            dto.setEmailVerified(true);
            dto.setCreatedTimestamp(LocalDateTime.now());
            dto.setRole(UserRole.HOST);
            dto.setStatus(com.clenzy.model.UserStatus.ACTIVE);
            dto.setPhone("0612345678");
            dto.setAddress("Paris");
            dto.setCreatedAt(LocalDateTime.now());
            dto.setUpdatedAt(LocalDateTime.now());
            assertThat(dto.getEnabled()).isTrue();
            assertThat(dto.getEmailVerified()).isTrue();
            assertThat(dto.getRole()).isEqualTo(UserRole.HOST);
            assertThat(dto.getStatus()).isEqualTo(com.clenzy.model.UserStatus.ACTIVE);
            assertThat(dto.getPhone()).isEqualTo("0612345678");
            assertThat(dto.getAddress()).isEqualTo("Paris");
        }
        @Test void toStringTest() {
            UserProfileDto dto = new UserProfileDto("id", "e@t.com", "Jean", "Dupont");
            assertThat(dto.toString()).contains("UserProfileDto");
        }
    }

    // ─── UpdateUserDto ────────────────────────────────────────────────────────
    @Nested
    @DisplayName("UpdateUserDto")
    class UpdateUserDtoTests {
        @Test void defaultConstructor() {
            UpdateUserDto dto = new UpdateUserDto();
            assertThat(dto.getFirstName()).isNull();
        }
        @Test void parameterizedConstructor() {
            UpdateUserDto dto = new UpdateUserDto("Jean", "Dupont", "jean@test.com", "HOST");
            assertThat(dto.getFirstName()).isEqualTo("Jean");
            assertThat(dto.getLastName()).isEqualTo("Dupont");
            assertThat(dto.getEmail()).isEqualTo("jean@test.com");
            assertThat(dto.getRole()).isEqualTo("HOST");
        }
        @Test void setters() {
            UpdateUserDto dto = new UpdateUserDto();
            dto.setFirstName("Jean");
            dto.setLastName("Dupont");
            dto.setEmail("jean@test.com");
            dto.setRole("ADMIN");
            assertThat(dto.getFirstName()).isEqualTo("Jean");
            assertThat(dto.getLastName()).isEqualTo("Dupont");
            assertThat(dto.getEmail()).isEqualTo("jean@test.com");
            assertThat(dto.getRole()).isEqualTo("ADMIN");
        }
        @Test void toStringTest() {
            UpdateUserDto dto = new UpdateUserDto("A", "B", "c@d.com", "HOST");
            assertThat(dto.toString()).contains("UpdateUserDto");
        }
    }

    // ─── NotificationDto ──────────────────────────────────────────────────────
    @Nested
    @DisplayName("NotificationDto")
    class NotificationDtoTests {
        @Test void defaultConstructor() {
            NotificationDto dto = new NotificationDto();
            assertThat(dto.id).isNull();
            assertThat(dto.read).isFalse();
        }
        @Test void fromEntity() {
            com.clenzy.model.Notification entity = new com.clenzy.model.Notification();
            entity.setUserId("user-1");
            entity.setTitle("Title");
            entity.setMessage("Message");
            entity.setType(com.clenzy.model.NotificationType.INFO);
            entity.setCategory(com.clenzy.model.NotificationCategory.SYSTEM);
            entity.setRead(true);
            entity.setActionUrl("/dashboard");
            NotificationDto dto = NotificationDto.fromEntity(entity);
            assertThat(dto.userId).isEqualTo("user-1");
            assertThat(dto.title).isEqualTo("Title");
            assertThat(dto.message).isEqualTo("Message");
            assertThat(dto.type).isEqualTo("info");
            assertThat(dto.category).isEqualTo("system");
            assertThat(dto.read).isTrue();
            assertThat(dto.actionUrl).isEqualTo("/dashboard");
        }
        @Test void toEntity() {
            NotificationDto dto = new NotificationDto();
            dto.userId = "user-1";
            dto.title = "Title";
            dto.message = "Message";
            dto.type = "warning";
            dto.category = "intervention";
            dto.read = false;
            dto.actionUrl = "/interventions/1";
            com.clenzy.model.Notification entity = dto.toEntity();
            assertThat(entity.getUserId()).isEqualTo("user-1");
            assertThat(entity.getTitle()).isEqualTo("Title");
            assertThat(entity.getType()).isEqualTo(com.clenzy.model.NotificationType.WARNING);
            assertThat(entity.getCategory()).isEqualTo(com.clenzy.model.NotificationCategory.INTERVENTION);
            assertThat(entity.isRead()).isFalse();
            assertThat(entity.getActionUrl()).isEqualTo("/interventions/1");
        }
        @Test void toEntityWithNulls() {
            NotificationDto dto = new NotificationDto();
            dto.userId = "user-1";
            dto.title = "Title";
            dto.message = "Message";
            com.clenzy.model.Notification entity = dto.toEntity();
            assertThat(entity.getType()).isEqualTo(com.clenzy.model.NotificationType.INFO);
            assertThat(entity.getCategory()).isEqualTo(com.clenzy.model.NotificationCategory.SYSTEM);
        }
    }
}
