package com.clenzy.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Comprehensive tests for all model enums — exercises values(), valueOf(),
 * display names, helper methods, fromString(), state transitions, etc.
 */
class EnumCoverageTest {

    // ─── UserRole ────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("UserRole")
    class UserRoleTests {
        @Test void allValuesExist() {
            assertThat(UserRole.values()).hasSize(8);
        }
        @Test void displayNamesNotBlank() {
            for (UserRole r : UserRole.values()) {
                assertThat(r.getDisplayName()).isNotBlank();
                assertThat(r.getDescription()).isNotBlank();
                assertThat(r.toString()).isEqualTo(r.getDisplayName());
            }
        }
        @Test void platformAdminOnly() {
            assertThat(UserRole.SUPER_ADMIN.isPlatformAdmin()).isTrue();
            assertThat(UserRole.SUPER_MANAGER.isPlatformAdmin()).isFalse();
            assertThat(UserRole.HOST.isPlatformAdmin()).isFalse();
        }
        @Test void platformStaff() {
            assertThat(UserRole.SUPER_ADMIN.isPlatformStaff()).isTrue();
            assertThat(UserRole.SUPER_MANAGER.isPlatformStaff()).isTrue();
            assertThat(UserRole.HOST.isPlatformStaff()).isFalse();
            assertThat(UserRole.TECHNICIAN.isPlatformStaff()).isFalse();
        }
        @Test void valueOf() {
            assertThat(UserRole.valueOf("HOST")).isEqualTo(UserRole.HOST);
            assertThat(UserRole.valueOf("HOUSEKEEPER")).isEqualTo(UserRole.HOUSEKEEPER);
            assertThat(UserRole.valueOf("SUPERVISOR")).isEqualTo(UserRole.SUPERVISOR);
            assertThat(UserRole.valueOf("LAUNDRY")).isEqualTo(UserRole.LAUNDRY);
            assertThat(UserRole.valueOf("EXTERIOR_TECH")).isEqualTo(UserRole.EXTERIOR_TECH);
        }
    }

    // ─── UserStatus ──────────────────────────────────────────────────────────
    @Nested
    @DisplayName("UserStatus")
    class UserStatusTests {
        @Test void allValuesExist() {
            assertThat(UserStatus.values()).hasSize(6);
        }
        @Test void displayNames() {
            for (UserStatus s : UserStatus.values()) {
                assertThat(s.getDisplayName()).isNotBlank();
                assertThat(s.getDescription()).isNotBlank();
                assertThat(s.toString()).isEqualTo(s.getDisplayName());
            }
        }
        @Test void canAccessPlatform() {
            assertThat(UserStatus.ACTIVE.canAccessPlatform()).isTrue();
            assertThat(UserStatus.SUSPENDED.canAccessPlatform()).isFalse();
            assertThat(UserStatus.DELETED.canAccessPlatform()).isFalse();
        }
        @Test void requiresUserAction() {
            assertThat(UserStatus.PENDING_VERIFICATION.requiresUserAction()).isTrue();
            assertThat(UserStatus.ACTIVE.requiresUserAction()).isFalse();
        }
        @Test void requiresAdminAction() {
            assertThat(UserStatus.SUSPENDED.requiresAdminAction()).isTrue();
            assertThat(UserStatus.BLOCKED.requiresAdminAction()).isTrue();
            assertThat(UserStatus.ACTIVE.requiresAdminAction()).isFalse();
        }
        @Test void isReversible() {
            assertThat(UserStatus.SUSPENDED.isReversible()).isTrue();
            assertThat(UserStatus.INACTIVE.isReversible()).isTrue();
            assertThat(UserStatus.PENDING_VERIFICATION.isReversible()).isTrue();
            assertThat(UserStatus.DELETED.isReversible()).isFalse();
        }
        @Test void isPermanent() {
            assertThat(UserStatus.DELETED.isPermanent()).isTrue();
            assertThat(UserStatus.ACTIVE.isPermanent()).isFalse();
        }
    }

    // ─── InterventionStatus ──────────────────────────────────────────────────
    @Nested
    @DisplayName("InterventionStatus")
    class InterventionStatusTests {
        @Test void allValues() {
            assertThat(InterventionStatus.values()).hasSize(6);
        }
        @Test void displayNames() {
            for (InterventionStatus s : InterventionStatus.values()) {
                assertThat(s.getDisplayName()).isNotBlank();
            }
        }
        @Test void transitions_pending() {
            assertThat(InterventionStatus.PENDING.canTransitionTo(InterventionStatus.AWAITING_VALIDATION)).isTrue();
            assertThat(InterventionStatus.PENDING.canTransitionTo(InterventionStatus.IN_PROGRESS)).isTrue();
            assertThat(InterventionStatus.PENDING.canTransitionTo(InterventionStatus.CANCELLED)).isTrue();
            assertThat(InterventionStatus.PENDING.canTransitionTo(InterventionStatus.COMPLETED)).isFalse();
        }
        @Test void transitions_awaitingValidation() {
            assertThat(InterventionStatus.AWAITING_VALIDATION.canTransitionTo(InterventionStatus.AWAITING_PAYMENT)).isTrue();
            assertThat(InterventionStatus.AWAITING_VALIDATION.canTransitionTo(InterventionStatus.IN_PROGRESS)).isTrue();
            assertThat(InterventionStatus.AWAITING_VALIDATION.canTransitionTo(InterventionStatus.CANCELLED)).isTrue();
        }
        @Test void transitions_awaitingPayment() {
            assertThat(InterventionStatus.AWAITING_PAYMENT.canTransitionTo(InterventionStatus.IN_PROGRESS)).isTrue();
            assertThat(InterventionStatus.AWAITING_PAYMENT.canTransitionTo(InterventionStatus.CANCELLED)).isTrue();
        }
        @Test void transitions_inProgress() {
            assertThat(InterventionStatus.IN_PROGRESS.canTransitionTo(InterventionStatus.COMPLETED)).isTrue();
            assertThat(InterventionStatus.IN_PROGRESS.canTransitionTo(InterventionStatus.CANCELLED)).isTrue();
        }
        @Test void transitions_completed() {
            assertThat(InterventionStatus.COMPLETED.canTransitionTo(InterventionStatus.IN_PROGRESS)).isTrue();
            assertThat(InterventionStatus.COMPLETED.canTransitionTo(InterventionStatus.CANCELLED)).isFalse();
        }
        @Test void transitions_cancelled() {
            for (InterventionStatus s : InterventionStatus.values()) {
                assertThat(InterventionStatus.CANCELLED.canTransitionTo(s)).isFalse();
            }
        }
        @Test void fromString_valid() {
            assertThat(InterventionStatus.fromString("PENDING")).isEqualTo(InterventionStatus.PENDING);
            assertThat(InterventionStatus.fromString("completed")).isEqualTo(InterventionStatus.COMPLETED);
        }
        @Test void fromString_null() {
            assertThat(InterventionStatus.fromString(null)).isNull();
        }
        @Test void fromString_invalid() {
            assertThatThrownBy(() -> InterventionStatus.fromString("INVALID"))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    // ─── PaymentStatus ───────────────────────────────────────────────────────
    @Nested
    @DisplayName("PaymentStatus")
    class PaymentStatusTests {
        @Test void allValues() {
            assertThat(PaymentStatus.values()).hasSize(6);
        }
        @Test void displayNames() {
            for (PaymentStatus s : PaymentStatus.values()) {
                assertThat(s.getDisplayName()).isNotBlank();
            }
        }
        @Test void fromString_valid() {
            assertThat(PaymentStatus.fromString("PAID")).isEqualTo(PaymentStatus.PAID);
            assertThat(PaymentStatus.fromString("pending")).isEqualTo(PaymentStatus.PENDING);
            assertThat(PaymentStatus.fromString("REFUNDED")).isEqualTo(PaymentStatus.REFUNDED);
            assertThat(PaymentStatus.fromString("PROCESSING")).isEqualTo(PaymentStatus.PROCESSING);
            assertThat(PaymentStatus.fromString("FAILED")).isEqualTo(PaymentStatus.FAILED);
            assertThat(PaymentStatus.fromString("CANCELLED")).isEqualTo(PaymentStatus.CANCELLED);
        }
        @Test void fromString_null() {
            assertThat(PaymentStatus.fromString(null)).isNull();
        }
        @Test void fromString_invalid() {
            assertThatThrownBy(() -> PaymentStatus.fromString("INVALID"))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    // ─── PropertyStatus ──────────────────────────────────────────────────────
    @Nested
    @DisplayName("PropertyStatus")
    class PropertyStatusTests {
        @Test void allValues() {
            assertThat(PropertyStatus.values()).hasSize(4);
        }
        @Test void displayNames() {
            for (PropertyStatus s : PropertyStatus.values()) {
                assertThat(s.getDisplayName()).isNotBlank();
            }
        }
        @Test void fromString_valid() {
            assertThat(PropertyStatus.fromString("ACTIVE")).isEqualTo(PropertyStatus.ACTIVE);
            assertThat(PropertyStatus.fromString("inactive")).isEqualTo(PropertyStatus.INACTIVE);
            assertThat(PropertyStatus.fromString("UNDER_MAINTENANCE")).isEqualTo(PropertyStatus.UNDER_MAINTENANCE);
            assertThat(PropertyStatus.fromString("ARCHIVED")).isEqualTo(PropertyStatus.ARCHIVED);
        }
        @Test void fromString_null() {
            assertThat(PropertyStatus.fromString(null)).isNull();
        }
        @Test void fromString_invalid() {
            assertThatThrownBy(() -> PropertyStatus.fromString("INVALID"))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    // ─── PropertyType ────────────────────────────────────────────────────────
    @Nested
    @DisplayName("PropertyType")
    class PropertyTypeTests {
        @Test void allValues() {
            assertThat(PropertyType.values()).hasSize(10);
        }
        @Test void displayNames() {
            for (PropertyType t : PropertyType.values()) {
                assertThat(t.getDisplayName()).isNotBlank();
                assertThat(t.getDescription()).isNotBlank();
                assertThat(t.toString()).isEqualTo(t.getDisplayName());
            }
        }
        @Test void requiresExteriorCleaning() {
            assertThat(PropertyType.HOUSE.requiresExteriorCleaning()).isTrue();
            assertThat(PropertyType.VILLA.requiresExteriorCleaning()).isTrue();
            assertThat(PropertyType.COTTAGE.requiresExteriorCleaning()).isTrue();
            assertThat(PropertyType.CHALET.requiresExteriorCleaning()).isTrue();
            assertThat(PropertyType.APARTMENT.requiresExteriorCleaning()).isFalse();
            assertThat(PropertyType.STUDIO.requiresExteriorCleaning()).isFalse();
        }
        @Test void requiresSpecificMaintenance() {
            assertThat(PropertyType.BOAT.requiresSpecificMaintenance()).isTrue();
            assertThat(PropertyType.CHALET.requiresSpecificMaintenance()).isTrue();
            assertThat(PropertyType.APARTMENT.requiresSpecificMaintenance()).isFalse();
        }
        @Test void isFamilyFriendly() {
            assertThat(PropertyType.HOUSE.isFamilyFriendly()).isTrue();
            assertThat(PropertyType.VILLA.isFamilyFriendly()).isTrue();
            assertThat(PropertyType.COTTAGE.isFamilyFriendly()).isTrue();
            assertThat(PropertyType.CHALET.isFamilyFriendly()).isTrue();
            assertThat(PropertyType.STUDIO.isFamilyFriendly()).isFalse();
        }
        @Test void isUrban() {
            assertThat(PropertyType.APARTMENT.isUrban()).isTrue();
            assertThat(PropertyType.STUDIO.isUrban()).isTrue();
            assertThat(PropertyType.LOFT.isUrban()).isTrue();
            assertThat(PropertyType.HOUSE.isUrban()).isFalse();
            assertThat(PropertyType.BOAT.isUrban()).isFalse();
            assertThat(PropertyType.GUEST_ROOM.isUrban()).isFalse();
            assertThat(PropertyType.OTHER.isUrban()).isFalse();
        }
    }

    // ─── DocumentType ────────────────────────────────────────────────────────
    @Nested
    @DisplayName("DocumentType")
    class DocumentTypeTests {
        @Test void allValues() {
            assertThat(DocumentType.values()).hasSize(8);
        }
        @Test void labels() {
            for (DocumentType t : DocumentType.values()) {
                assertThat(t.getLabel()).isNotBlank();
                assertThat(t.toValue()).isEqualTo(t.name());
            }
        }
        @Test void valueOf() {
            assertThat(DocumentType.valueOf("DEVIS")).isEqualTo(DocumentType.DEVIS);
            assertThat(DocumentType.valueOf("FACTURE")).isEqualTo(DocumentType.FACTURE);
            assertThat(DocumentType.valueOf("MANDAT_GESTION")).isEqualTo(DocumentType.MANDAT_GESTION);
            assertThat(DocumentType.valueOf("BON_INTERVENTION")).isEqualTo(DocumentType.BON_INTERVENTION);
        }
    }

    // ─── RequestStatus ───────────────────────────────────────────────────────
    @Nested
    @DisplayName("RequestStatus")
    class RequestStatusTests {
        @Test void allValues() {
            assertThat(RequestStatus.values()).hasSize(7);
        }
        @Test void displayNames() {
            for (RequestStatus s : RequestStatus.values()) {
                assertThat(s.getDisplayName()).isNotBlank();
            }
        }
        @Test void transitions_pending() {
            assertThat(RequestStatus.PENDING.canTransitionTo(RequestStatus.APPROVED)).isTrue();
            assertThat(RequestStatus.PENDING.canTransitionTo(RequestStatus.REJECTED)).isTrue();
            assertThat(RequestStatus.PENDING.canTransitionTo(RequestStatus.CANCELLED)).isTrue();
            assertThat(RequestStatus.PENDING.canTransitionTo(RequestStatus.COMPLETED)).isFalse();
        }
        @Test void transitions_approved() {
            assertThat(RequestStatus.APPROVED.canTransitionTo(RequestStatus.DEVIS_ACCEPTED)).isTrue();
            assertThat(RequestStatus.APPROVED.canTransitionTo(RequestStatus.IN_PROGRESS)).isTrue();
            assertThat(RequestStatus.APPROVED.canTransitionTo(RequestStatus.CANCELLED)).isTrue();
        }
        @Test void transitions_devisAccepted() {
            assertThat(RequestStatus.DEVIS_ACCEPTED.canTransitionTo(RequestStatus.IN_PROGRESS)).isTrue();
            assertThat(RequestStatus.DEVIS_ACCEPTED.canTransitionTo(RequestStatus.CANCELLED)).isTrue();
        }
        @Test void transitions_inProgress() {
            assertThat(RequestStatus.IN_PROGRESS.canTransitionTo(RequestStatus.COMPLETED)).isTrue();
            assertThat(RequestStatus.IN_PROGRESS.canTransitionTo(RequestStatus.CANCELLED)).isTrue();
        }
        @Test void transitions_completed() {
            for (RequestStatus s : RequestStatus.values()) {
                assertThat(RequestStatus.COMPLETED.canTransitionTo(s)).isFalse();
            }
        }
        @Test void transitions_cancelled() {
            for (RequestStatus s : RequestStatus.values()) {
                assertThat(RequestStatus.CANCELLED.canTransitionTo(s)).isFalse();
            }
        }
        @Test void transitions_rejected() {
            assertThat(RequestStatus.REJECTED.canTransitionTo(RequestStatus.PENDING)).isTrue();
            assertThat(RequestStatus.REJECTED.canTransitionTo(RequestStatus.APPROVED)).isFalse();
        }
        @Test void fromString_valid() {
            assertThat(RequestStatus.fromString("PENDING")).isEqualTo(RequestStatus.PENDING);
            assertThat(RequestStatus.fromString("approved")).isEqualTo(RequestStatus.APPROVED);
        }
        @Test void fromString_null() {
            assertThat(RequestStatus.fromString(null)).isNull();
        }
        @Test void fromString_invalid() {
            assertThatThrownBy(() -> RequestStatus.fromString("INVALID"))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    // ─── Priority ────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Priority")
    class PriorityTests {
        @Test void allValues() {
            assertThat(Priority.values()).hasSize(4);
        }
        @Test void displayNames() {
            for (Priority p : Priority.values()) {
                assertThat(p.getDisplayName()).isNotBlank();
            }
        }
        @Test void fromString_valid() {
            assertThat(Priority.fromString("LOW")).isEqualTo(Priority.LOW);
            assertThat(Priority.fromString("normal")).isEqualTo(Priority.NORMAL);
            assertThat(Priority.fromString("HIGH")).isEqualTo(Priority.HIGH);
            assertThat(Priority.fromString("CRITICAL")).isEqualTo(Priority.CRITICAL);
        }
        @Test void fromString_null() {
            assertThat(Priority.fromString(null)).isNull();
        }
        @Test void fromString_invalid() {
            assertThatThrownBy(() -> Priority.fromString("INVALID"))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    // ─── ServiceType ─────────────────────────────────────────────────────────
    @Nested
    @DisplayName("ServiceType")
    class ServiceTypeTests {
        @Test void allValues() {
            assertThat(ServiceType.values()).hasSize(19);
        }
        @Test void displayNames() {
            for (ServiceType s : ServiceType.values()) {
                assertThat(s.getDisplayName()).isNotBlank();
                assertThat(s.getDescription()).isNotBlank();
                assertThat(s.getEstimatedHours()).isPositive();
                assertThat(s.toString()).isEqualTo(s.getDisplayName());
            }
        }
        @Test void isCleaningService() {
            assertThat(ServiceType.CLEANING.isCleaningService()).isTrue();
            assertThat(ServiceType.EXPRESS_CLEANING.isCleaningService()).isTrue();
            assertThat(ServiceType.DEEP_CLEANING.isCleaningService()).isTrue();
            assertThat(ServiceType.WINDOW_CLEANING.isCleaningService()).isTrue();
            assertThat(ServiceType.FLOOR_CLEANING.isCleaningService()).isTrue();
            assertThat(ServiceType.KITCHEN_CLEANING.isCleaningService()).isTrue();
            assertThat(ServiceType.BATHROOM_CLEANING.isCleaningService()).isTrue();
            assertThat(ServiceType.EXTERIOR_CLEANING.isCleaningService()).isTrue();
            assertThat(ServiceType.DISINFECTION.isCleaningService()).isTrue();
            assertThat(ServiceType.EMERGENCY_REPAIR.isCleaningService()).isFalse();
            assertThat(ServiceType.GARDENING.isCleaningService()).isFalse();
            assertThat(ServiceType.OTHER.isCleaningService()).isFalse();
        }
        @Test void isMaintenanceService() {
            assertThat(ServiceType.PREVENTIVE_MAINTENANCE.isMaintenanceService()).isTrue();
            assertThat(ServiceType.EMERGENCY_REPAIR.isMaintenanceService()).isTrue();
            assertThat(ServiceType.ELECTRICAL_REPAIR.isMaintenanceService()).isTrue();
            assertThat(ServiceType.PLUMBING_REPAIR.isMaintenanceService()).isTrue();
            assertThat(ServiceType.HVAC_REPAIR.isMaintenanceService()).isTrue();
            assertThat(ServiceType.APPLIANCE_REPAIR.isMaintenanceService()).isTrue();
            assertThat(ServiceType.CLEANING.isMaintenanceService()).isFalse();
        }
        @Test void requiresTechnicalSkills() {
            assertThat(ServiceType.EMERGENCY_REPAIR.requiresTechnicalSkills()).isTrue();
            assertThat(ServiceType.ELECTRICAL_REPAIR.requiresTechnicalSkills()).isTrue();
            assertThat(ServiceType.PLUMBING_REPAIR.requiresTechnicalSkills()).isTrue();
            assertThat(ServiceType.HVAC_REPAIR.requiresTechnicalSkills()).isTrue();
            assertThat(ServiceType.APPLIANCE_REPAIR.requiresTechnicalSkills()).isTrue();
            assertThat(ServiceType.CLEANING.requiresTechnicalSkills()).isFalse();
            assertThat(ServiceType.PREVENTIVE_MAINTENANCE.requiresTechnicalSkills()).isFalse();
        }
        @Test void isPlannable() {
            assertThat(ServiceType.EMERGENCY_REPAIR.isPlannable()).isFalse();
            assertThat(ServiceType.CLEANING.isPlannable()).isTrue();
            assertThat(ServiceType.PREVENTIVE_MAINTENANCE.isPlannable()).isTrue();
        }
        @Test void requiresSpecificProducts() {
            assertThat(ServiceType.DISINFECTION.requiresSpecificProducts()).isTrue();
            assertThat(ServiceType.PEST_CONTROL.requiresSpecificProducts()).isTrue();
            assertThat(ServiceType.DEEP_CLEANING.requiresSpecificProducts()).isTrue();
            assertThat(ServiceType.CLEANING.requiresSpecificProducts()).isFalse();
        }
    }

    // ─── InterventionType ────────────────────────────────────────────────────
    @Nested
    @DisplayName("InterventionType")
    class InterventionTypeTests {
        @Test void allValues() {
            assertThat(InterventionType.values()).hasSize(19);
        }
        @Test void displayNames() {
            for (InterventionType t : InterventionType.values()) {
                assertThat(t.getDisplayName()).isNotBlank();
                assertThat(t.toString()).isEqualTo(t.name());
            }
        }
        @Test void isCleaning() {
            assertThat(InterventionType.CLEANING.isCleaning()).isTrue();
            assertThat(InterventionType.EXPRESS_CLEANING.isCleaning()).isTrue();
            assertThat(InterventionType.DEEP_CLEANING.isCleaning()).isTrue();
            assertThat(InterventionType.WINDOW_CLEANING.isCleaning()).isTrue();
            assertThat(InterventionType.FLOOR_CLEANING.isCleaning()).isTrue();
            assertThat(InterventionType.KITCHEN_CLEANING.isCleaning()).isTrue();
            assertThat(InterventionType.BATHROOM_CLEANING.isCleaning()).isTrue();
            assertThat(InterventionType.EMERGENCY_REPAIR.isCleaning()).isFalse();
        }
        @Test void isMaintenance() {
            assertThat(InterventionType.PREVENTIVE_MAINTENANCE.isMaintenance()).isTrue();
            assertThat(InterventionType.EMERGENCY_REPAIR.isMaintenance()).isTrue();
            assertThat(InterventionType.ELECTRICAL_REPAIR.isMaintenance()).isTrue();
            assertThat(InterventionType.PLUMBING_REPAIR.isMaintenance()).isTrue();
            assertThat(InterventionType.HVAC_REPAIR.isMaintenance()).isTrue();
            assertThat(InterventionType.APPLIANCE_REPAIR.isMaintenance()).isTrue();
            assertThat(InterventionType.CLEANING.isMaintenance()).isFalse();
        }
        @Test void isSpecialized() {
            assertThat(InterventionType.GARDENING.isSpecialized()).isTrue();
            assertThat(InterventionType.EXTERIOR_CLEANING.isSpecialized()).isTrue();
            assertThat(InterventionType.PEST_CONTROL.isSpecialized()).isTrue();
            assertThat(InterventionType.DISINFECTION.isSpecialized()).isTrue();
            assertThat(InterventionType.RESTORATION.isSpecialized()).isTrue();
            assertThat(InterventionType.CLEANING.isSpecialized()).isFalse();
        }
        @Test void getCategory() {
            assertThat(InterventionType.CLEANING.getCategory()).isEqualTo("cleaning");
            assertThat(InterventionType.EMERGENCY_REPAIR.getCategory()).isEqualTo("maintenance");
            assertThat(InterventionType.GARDENING.getCategory()).isEqualTo("specialized");
            assertThat(InterventionType.OTHER.getCategory()).isEqualTo("other");
        }
        @Test void fromString_valid() {
            assertThat(InterventionType.fromString("CLEANING")).isEqualTo(InterventionType.CLEANING);
            assertThat(InterventionType.fromString("cleaning")).isEqualTo(InterventionType.CLEANING);
        }
        @Test void fromString_null() {
            assertThat(InterventionType.fromString(null)).isNull();
        }
        @Test void fromString_unknown() {
            assertThat(InterventionType.fromString("UNKNOWN_TYPE")).isEqualTo(InterventionType.OTHER);
        }
    }

    // ─── DocumentGenerationStatus ────────────────────────────────────────────
    @Nested
    @DisplayName("DocumentGenerationStatus")
    class DocGenStatusTests {
        @Test void allValues() {
            assertThat(DocumentGenerationStatus.values()).contains(
                    DocumentGenerationStatus.GENERATING,
                    DocumentGenerationStatus.COMPLETED,
                    DocumentGenerationStatus.FAILED,
                    DocumentGenerationStatus.SENT
            );
        }
    }

    // ─── Simple enums ────────────────────────────────────────────────────────
    @Nested
    @DisplayName("SimpleEnums")
    class SimpleEnumTests {
        @Test void auditAction() {
            assertThat(AuditAction.values().length).isGreaterThan(0);
            for (AuditAction a : AuditAction.values()) {
                assertThat(a.name()).isNotBlank();
            }
        }
        @Test void auditSource() {
            assertThat(AuditSource.values().length).isGreaterThan(0);
            for (AuditSource s : AuditSource.values()) {
                assertThat(s.name()).isNotBlank();
            }
        }
        @Test void calendarCommandType() {
            assertThat(CalendarCommandType.values().length).isGreaterThan(0);
        }
        @Test void calendarDayStatus() {
            assertThat(CalendarDayStatus.values().length).isGreaterThan(0);
        }
        @Test void cleaningFrequency() {
            assertThat(CleaningFrequency.values().length).isGreaterThan(0);
        }
        @Test void contactMessageCategory() {
            assertThat(ContactMessageCategory.values().length).isGreaterThan(0);
        }
        @Test void contactMessagePriority() {
            assertThat(ContactMessagePriority.values().length).isGreaterThan(0);
        }
        @Test void contactMessageStatus() {
            assertThat(ContactMessageStatus.values().length).isGreaterThan(0);
        }
        @Test void guestChannel() {
            assertThat(GuestChannel.values().length).isGreaterThan(0);
        }
        @Test void invitationStatus() {
            assertThat(InvitationStatus.values().length).isGreaterThan(0);
        }
        @Test void messageChannelType() {
            assertThat(MessageChannelType.values().length).isGreaterThan(0);
        }
        @Test void messageStatus() {
            assertThat(MessageStatus.values().length).isGreaterThan(0);
        }
        @Test void messageTemplateType() {
            assertThat(MessageTemplateType.values().length).isGreaterThan(0);
        }
        @Test void notificationType() {
            for (NotificationType t : NotificationType.values()) {
                assertThat(t.name()).isNotBlank();
            }
        }
        @Test void notificationCategory() {
            for (NotificationCategory c : NotificationCategory.values()) {
                assertThat(c.name()).isNotBlank();
            }
        }
        @Test void organizationType() {
            assertThat(OrganizationType.values().length).isGreaterThan(0);
        }
        @Test void pendingInscriptionStatus() {
            assertThat(PendingInscriptionStatus.values().length).isGreaterThan(0);
        }
        @Test void ratePlanType() {
            assertThat(RatePlanType.values().length).isGreaterThan(0);
        }
        @Test void referenceType() {
            assertThat(ReferenceType.values().length).isGreaterThan(0);
        }
        @Test void securityAuditEventType() {
            assertThat(SecurityAuditEventType.values().length).isGreaterThan(0);
        }
        @Test void tagCategory() {
            assertThat(TagCategory.values().length).isGreaterThan(0);
        }
        @Test void tagType() {
            assertThat(TagType.values().length).isGreaterThan(0);
        }
        @Test void teamRole() {
            assertThat(TeamRole.values().length).isGreaterThan(0);
        }
    }

    // ─── NotificationKey ─────────────────────────────────────────────────────
    @Nested
    @DisplayName("NotificationKey")
    class NotificationKeyTests {
        @Test void allValues() {
            assertThat(NotificationKey.values().length).isGreaterThan(50);
        }
        @Test void eachKeyHasTypeAndCategory() {
            for (NotificationKey key : NotificationKey.values()) {
                assertThat(key.getDefaultType()).isNotNull();
                assertThat(key.getCategory()).isNotNull();
            }
        }
    }
}
