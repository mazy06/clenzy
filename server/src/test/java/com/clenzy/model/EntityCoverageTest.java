package com.clenzy.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests exercising entity getters/setters, constructors, toString, and utility methods
 * to boost model package line coverage.
 */
class EntityCoverageTest {

    // ─── User ────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("User entity")
    class UserEntityTest {
        @Test void defaultConstructor() {
            User user = new User();
            assertThat(user.getId()).isNull();
            assertThat(user.getRole()).isEqualTo(UserRole.HOST);
            assertThat(user.getStatus()).isEqualTo(UserStatus.ACTIVE);
        }
        @Test void parameterizedConstructor() {
            User user = new User("Jean", "Dupont", "jean@test.com", "password");
            assertThat(user.getFirstName()).isEqualTo("Jean");
            assertThat(user.getLastName()).isEqualTo("Dupont");
            assertThat(user.getEmail()).isEqualTo("jean@test.com");
            assertThat(user.getPassword()).isEqualTo("password");
        }
        @Test void gettersAndSetters() {
            User user = new User();
            user.setId(1L);
            user.setFirstName("Jean");
            user.setLastName("Dupont");
            user.setEmail("jean@test.com");
            user.setPassword("pass123");
            user.setPhoneNumber("+33600000000");
            user.setRole(UserRole.SUPER_ADMIN);
            user.setStatus(UserStatus.ACTIVE);
            user.setProfilePictureUrl("http://img.com/pic.jpg");
            user.setCognitoUserId("cognito-1");
            user.setKeycloakId("kc-1");
            user.setStripeCustomerId("cus_xxx");
            user.setStripeSubscriptionId("sub_xxx");
            user.setCompanyName("Clenzy");
            user.setForfait("premium");
            user.setCity("Paris");
            user.setPostalCode("75001");
            user.setPropertyType("apartment");
            user.setPropertyCount(5);
            user.setSurface(80);
            user.setGuestCapacity(4);
            user.setBookingFrequency("weekly");
            user.setCleaningSchedule("after_checkout");
            user.setCalendarSync("manual");
            user.setServices("menage,linge");
            user.setServicesDevis("repassage");
            user.setBillingPeriod("monthly");
            user.setDeferredPayment(true);
            user.setEmailVerified(true);
            user.setPhoneVerified(false);
            user.setLastLogin(LocalDateTime.now());
            user.setCreatedAt(LocalDateTime.now());
            user.setUpdatedAt(LocalDateTime.now());
            user.setOrganizationId(1L);
            user.setEmailHash("hash123");
            user.setProperties(new HashSet<>());
            user.setServiceRequests(new HashSet<>());

            assertThat(user.getId()).isEqualTo(1L);
            assertThat(user.getFirstName()).isEqualTo("Jean");
            assertThat(user.getLastName()).isEqualTo("Dupont");
            assertThat(user.getEmail()).isEqualTo("jean@test.com");
            assertThat(user.getEmailHash()).isNotNull(); // setEmail computes hash
            assertThat(user.getPassword()).isEqualTo("pass123");
            assertThat(user.getPhoneNumber()).isEqualTo("+33600000000");
            assertThat(user.getRole()).isEqualTo(UserRole.SUPER_ADMIN);
            assertThat(user.getStatus()).isEqualTo(UserStatus.ACTIVE);
            assertThat(user.getProfilePictureUrl()).isEqualTo("http://img.com/pic.jpg");
            assertThat(user.getCognitoUserId()).isEqualTo("cognito-1");
            assertThat(user.getKeycloakId()).isEqualTo("kc-1");
            assertThat(user.getStripeCustomerId()).isEqualTo("cus_xxx");
            assertThat(user.getStripeSubscriptionId()).isEqualTo("sub_xxx");
            assertThat(user.getCompanyName()).isEqualTo("Clenzy");
            assertThat(user.getForfait()).isEqualTo("premium");
            assertThat(user.getCity()).isEqualTo("Paris");
            assertThat(user.getPostalCode()).isEqualTo("75001");
            assertThat(user.getPropertyType()).isEqualTo("apartment");
            assertThat(user.getPropertyCount()).isEqualTo(5);
            assertThat(user.getSurface()).isEqualTo(80);
            assertThat(user.getGuestCapacity()).isEqualTo(4);
            assertThat(user.getBookingFrequency()).isEqualTo("weekly");
            assertThat(user.getCleaningSchedule()).isEqualTo("after_checkout");
            assertThat(user.getCalendarSync()).isEqualTo("manual");
            assertThat(user.getServices()).isEqualTo("menage,linge");
            assertThat(user.getServicesDevis()).isEqualTo("repassage");
            assertThat(user.getBillingPeriod()).isEqualTo("monthly");
            assertThat(user.isDeferredPayment()).isTrue();
            assertThat(user.isEmailVerified()).isTrue();
            assertThat(user.isPhoneVerified()).isFalse();
            assertThat(user.getLastLogin()).isNotNull();
            assertThat(user.getCreatedAt()).isNotNull();
            assertThat(user.getUpdatedAt()).isNotNull();
            assertThat(user.getOrganizationId()).isEqualTo(1L);
            assertThat(user.getOrganization()).isNull();
            assertThat(user.getProperties()).isEmpty();
            assertThat(user.getServiceRequests()).isEmpty();
        }
        @Test void utilityMethods() {
            User user = new User("Jean", "Dupont", "jean@test.com", "pass");
            assertThat(user.getFullName()).isEqualTo("Jean Dupont");

            user.setRole(UserRole.SUPER_ADMIN);
            assertThat(user.isAdmin()).isTrue();
            assertThat(user.isTechnician()).isFalse();
            assertThat(user.isHost()).isFalse();

            user.setRole(UserRole.TECHNICIAN);
            assertThat(user.isAdmin()).isFalse();
            assertThat(user.isTechnician()).isTrue();
            assertThat(user.isHost()).isFalse();

            user.setRole(UserRole.HOST);
            assertThat(user.isHost()).isTrue();
        }
        @Test void toStringContainsFields() {
            User user = new User("Jean", "Dupont", "jean@test.com", "pass");
            user.setId(1L);
            assertThat(user.toString()).contains("Jean", "Dupont");
        }
    }

    // ─── Organization ────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Organization entity")
    class OrganizationEntityTest {
        @Test void gettersAndSetters() {
            Organization org = new Organization();
            org.setId(1L);
            org.setName("Test Org");
            org.setSlug("test-org");
            org.setType(OrganizationType.CONCIERGE);
            org.setCreatedAt(LocalDateTime.now());
            org.setUpdatedAt(LocalDateTime.now());

            assertThat(org.getId()).isEqualTo(1L);
            assertThat(org.getName()).isEqualTo("Test Org");
            assertThat(org.getSlug()).isEqualTo("test-org");
            assertThat(org.getType()).isEqualTo(OrganizationType.CONCIERGE);
            assertThat(org.getCreatedAt()).isNotNull();
            assertThat(org.getUpdatedAt()).isNotNull();
        }
    }

    // ─── Guest ───────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Guest entity")
    class GuestEntityTest {
        @Test void gettersAndSetters() {
            Guest guest = new Guest();
            guest.setId(1L);
            guest.setFirstName("Marie");
            guest.setLastName("Martin");
            guest.setEmail("marie@test.com");
            guest.setPhone("+33600000000");
            guest.setChannel(GuestChannel.AIRBNB);
            guest.setChannelGuestId("ext-1");
            guest.setOrganizationId(1L);
            guest.setCreatedAt(LocalDateTime.now());

            assertThat(guest.getId()).isEqualTo(1L);
            assertThat(guest.getFirstName()).isEqualTo("Marie");
            assertThat(guest.getLastName()).isEqualTo("Martin");
            assertThat(guest.getEmail()).isEqualTo("marie@test.com");
            assertThat(guest.getPhone()).isEqualTo("+33600000000");
            assertThat(guest.getChannel()).isEqualTo(GuestChannel.AIRBNB);
            assertThat(guest.getChannelGuestId()).isEqualTo("ext-1");
            assertThat(guest.getOrganizationId()).isEqualTo(1L);
        }
    }

    // ─── Reservation ─────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Reservation entity")
    class ReservationEntityTest {
        @Test void gettersAndSetters() {
            Reservation r = new Reservation();
            r.setId(1L);
            r.setCheckIn(LocalDate.of(2026, 3, 1));
            r.setCheckOut(LocalDate.of(2026, 3, 5));
            r.setGuestName("Jean Dupont");
            r.setSource("airbnb");
            r.setExternalUid("airbnb-123");
            r.setGuestCount(3);
            r.setTotalPrice(BigDecimal.valueOf(500));
            r.setOrganizationId(1L);
            r.setCreatedAt(LocalDateTime.now());

            assertThat(r.getId()).isEqualTo(1L);
            assertThat(r.getCheckIn()).isEqualTo(LocalDate.of(2026, 3, 1));
            assertThat(r.getCheckOut()).isEqualTo(LocalDate.of(2026, 3, 5));
            assertThat(r.getGuestName()).isEqualTo("Jean Dupont");
            assertThat(r.getSource()).isEqualTo("airbnb");
            assertThat(r.getExternalUid()).isEqualTo("airbnb-123");
            assertThat(r.getGuestCount()).isEqualTo(3);
            assertThat(r.getTotalPrice()).isEqualByComparingTo("500");
            assertThat(r.getOrganizationId()).isEqualTo(1L);
        }
    }

    // ─── Notification ────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Notification entity")
    class NotificationEntityTest {
        @Test void gettersAndSetters() {
            Notification n = new Notification();
            n.setId(1L);
            n.setTitle("Test");
            n.setMessage("Test message");
            n.setType(NotificationType.INFO);
            n.setCategory(NotificationCategory.INTERVENTION);
            n.setNotificationKey(NotificationKey.INTERVENTION_CREATED);
            n.setRead(false);
            n.setActionUrl("/interventions/1");
            n.setOrganizationId(1L);
            n.setCreatedAt(LocalDateTime.now());

            assertThat(n.getId()).isEqualTo(1L);
            assertThat(n.getTitle()).isEqualTo("Test");
            assertThat(n.getMessage()).isEqualTo("Test message");
            assertThat(n.getType()).isEqualTo(NotificationType.INFO);
            assertThat(n.getCategory()).isEqualTo(NotificationCategory.INTERVENTION);
            assertThat(n.getNotificationKey()).isEqualTo(NotificationKey.INTERVENTION_CREATED);
            assertThat(n.isRead()).isFalse();
            assertThat(n.getActionUrl()).isEqualTo("/interventions/1");
            assertThat(n.getOrganizationId()).isEqualTo(1L);
        }
    }

    // ─── Team & TeamMember ───────────────────────────────────────────────────
    @Nested
    @DisplayName("Team entity")
    class TeamEntityTest {
        @Test void gettersAndSetters() {
            Team team = new Team();
            team.setId(1L);
            team.setName("Equipe Paris");
            team.setDescription("Equipe de nettoyage Paris");
            team.setInterventionType("CLEANING");
            team.setOrganizationId(1L);
            team.setCreatedAt(LocalDateTime.now());

            assertThat(team.getId()).isEqualTo(1L);
            assertThat(team.getName()).isEqualTo("Equipe Paris");
            assertThat(team.getDescription()).isEqualTo("Equipe de nettoyage Paris");
            assertThat(team.getInterventionType()).isEqualTo("CLEANING");
            assertThat(team.getOrganizationId()).isEqualTo(1L);
        }
    }

    // ─── RatePlan ────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("RatePlan entity")
    class RatePlanEntityTest {
        @Test void gettersAndSetters() {
            RatePlan rp = new RatePlan();
            rp.setId(1L);
            rp.setType(RatePlanType.SEASONAL);
            rp.setStartDate(LocalDate.of(2026, 6, 1));
            rp.setEndDate(LocalDate.of(2026, 8, 31));
            rp.setNightlyPrice(BigDecimal.valueOf(120));
            rp.setMinStayOverride(2);
            rp.setOrganizationId(1L);

            assertThat(rp.getId()).isEqualTo(1L);
            assertThat(rp.getType()).isEqualTo(RatePlanType.SEASONAL);
            assertThat(rp.getStartDate()).isEqualTo(LocalDate.of(2026, 6, 1));
            assertThat(rp.getEndDate()).isEqualTo(LocalDate.of(2026, 8, 31));
            assertThat(rp.getNightlyPrice()).isEqualByComparingTo("120");
            assertThat(rp.getMinStayOverride()).isEqualTo(2);
        }
    }

    // ─── RateOverride ────────────────────────────────────────────────────────
    @Nested
    @DisplayName("RateOverride entity")
    class RateOverrideEntityTest {
        @Test void gettersAndSetters() {
            RateOverride ro = new RateOverride();
            ro.setId(1L);
            ro.setDate(LocalDate.of(2026, 3, 15));
            ro.setNightlyPrice(BigDecimal.valueOf(150));
            ro.setSource("MANUAL");
            ro.setOrganizationId(1L);

            assertThat(ro.getId()).isEqualTo(1L);
            assertThat(ro.getDate()).isEqualTo(LocalDate.of(2026, 3, 15));
            assertThat(ro.getNightlyPrice()).isEqualByComparingTo("150");
            assertThat(ro.getSource()).isEqualTo("MANUAL");
        }
    }

    // ─── DocumentTemplate ────────────────────────────────────────────────────
    @Nested
    @DisplayName("DocumentTemplate entity")
    class DocumentTemplateEntityTest {
        @Test void gettersAndSetters() {
            DocumentTemplate dt = new DocumentTemplate();
            dt.setId(1L);
            dt.setName("Facture template");
            dt.setDescription("Template pour factures");
            dt.setDocumentType(DocumentType.FACTURE);
            dt.setEventTrigger("MANUAL");
            dt.setFilePath("/templates/facture.odt");
            dt.setOriginalFilename("facture.odt");
            dt.setEmailSubject("Votre facture");
            dt.setEmailBody("Bonjour...");
            dt.setCreatedBy("admin@test.com");
            dt.setActive(true);
            dt.setOrganizationId(1L);
            dt.setVersion(2);

            assertThat(dt.getId()).isEqualTo(1L);
            assertThat(dt.getName()).isEqualTo("Facture template");
            assertThat(dt.getDescription()).isEqualTo("Template pour factures");
            assertThat(dt.getDocumentType()).isEqualTo(DocumentType.FACTURE);
            assertThat(dt.getEventTrigger()).isEqualTo("MANUAL");
            assertThat(dt.getFilePath()).isEqualTo("/templates/facture.odt");
            assertThat(dt.getOriginalFilename()).isEqualTo("facture.odt");
            assertThat(dt.getEmailSubject()).isEqualTo("Votre facture");
            assertThat(dt.getEmailBody()).isEqualTo("Bonjour...");
            assertThat(dt.getCreatedBy()).isEqualTo("admin@test.com");
            assertThat(dt.isActive()).isTrue();
            assertThat(dt.getVersion()).isEqualTo(2);
        }
    }

    // ─── NoiseAlertConfig & NoiseAlert ───────────────────────────────────────
    @Nested
    @DisplayName("NoiseAlert entities")
    class NoiseAlertEntitiesTest {
        @Test void noiseAlertConfig() {
            NoiseAlertConfig config = new NoiseAlertConfig();
            config.setId(1L);
            config.setEnabled(true);
            config.setNotifyInApp(true);
            config.setNotifyEmail(true);
            config.setNotifyGuestMessage(false);
            config.setNotifyWhatsapp(false);
            config.setNotifySms(false);
            config.setCooldownMinutes(30);
            config.setEmailRecipients("admin@test.com");
            config.setPropertyId(2L);
            config.setOrganizationId(1L);

            assertThat(config.getId()).isEqualTo(1L);
            assertThat(config.isEnabled()).isTrue();
            assertThat(config.isNotifyInApp()).isTrue();
            assertThat(config.isNotifyEmail()).isTrue();
            assertThat(config.getCooldownMinutes()).isEqualTo(30);
            assertThat(config.getPropertyId()).isEqualTo(2L);
            assertThat(config.getEmailRecipients()).isEqualTo("admin@test.com");
        }
        @Test void noiseAlert() {
            NoiseAlert alert = new NoiseAlert();
            alert.setId(1L);
            alert.setMeasuredDb(85.5);
            alert.setThresholdDb(70);
            alert.setAcknowledged(false);
            alert.setOrganizationId(1L);
            alert.setPropertyId(2L);
            alert.setDeviceId(3L);
            alert.setNotifiedInApp(true);
            alert.setNotifiedEmail(true);
            alert.setNotifiedGuest(false);
            alert.setNotes("Test note");

            assertThat(alert.getId()).isEqualTo(1L);
            assertThat(alert.getMeasuredDb()).isEqualTo(85.5);
            assertThat(alert.getThresholdDb()).isEqualTo(70);
            assertThat(alert.isAcknowledged()).isFalse();
            assertThat(alert.isNotifiedInApp()).isTrue();
            assertThat(alert.getNotes()).isEqualTo("Test note");
        }
    }

    // ─── AuditLog ────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("AuditLog entity")
    class AuditLogEntityTest {
        @Test void gettersAndSetters() {
            AuditLog log = new AuditLog();
            log.setId(1L);
            log.setAction(AuditAction.CREATE);
            log.setEntityType("User");
            log.setEntityId("1");
            log.setSource(AuditSource.WEB);
            log.setDetails("Created user");
            log.setOrganizationId(1L);
            log.setTimestamp(Instant.now());

            assertThat(log.getId()).isEqualTo(1L);
            assertThat(log.getAction()).isEqualTo(AuditAction.CREATE);
            assertThat(log.getEntityType()).isEqualTo("User");
            assertThat(log.getEntityId()).isEqualTo("1");
            assertThat(log.getSource()).isEqualTo(AuditSource.WEB);
            assertThat(log.getDetails()).isEqualTo("Created user");
        }
    }

    // ─── ContactMessage ──────────────────────────────────────────────────────
    @Nested
    @DisplayName("ContactMessage entity")
    class ContactMessageEntityTest {
        @Test void gettersAndSetters() {
            ContactMessage msg = new ContactMessage();
            msg.setId(1L);
            msg.setSubject("Test subject");
            msg.setMessage("Test body");
            msg.setStatus(ContactMessageStatus.SENT);
            msg.setPriority(ContactMessagePriority.HIGH);
            msg.setCategory(ContactMessageCategory.GENERAL);
            msg.setSenderKeycloakId("sender-kc-1");
            msg.setSenderFirstName("Jean");
            msg.setSenderLastName("Dupont");
            msg.setSenderEmail("jean@test.com");
            msg.setRecipientKeycloakId("recipient-kc-1");
            msg.setRecipientFirstName("Marie");
            msg.setRecipientLastName("Martin");
            msg.setRecipientEmail("marie@test.com");
            msg.setOrganizationId(1L);
            msg.setCreatedAt(LocalDateTime.now());

            assertThat(msg.getId()).isEqualTo(1L);
            assertThat(msg.getSubject()).isEqualTo("Test subject");
            assertThat(msg.getMessage()).isEqualTo("Test body");
            assertThat(msg.getStatus()).isEqualTo(ContactMessageStatus.SENT);
            assertThat(msg.getPriority()).isEqualTo(ContactMessagePriority.HIGH);
            assertThat(msg.getCategory()).isEqualTo(ContactMessageCategory.GENERAL);
            assertThat(msg.getSenderKeycloakId()).isEqualTo("sender-kc-1");
            assertThat(msg.getRecipientKeycloakId()).isEqualTo("recipient-kc-1");
        }
    }

    // ─── ICalFeed ────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("ICalFeed entity")
    class ICalFeedEntityTest {
        @Test void gettersAndSetters() {
            ICalFeed feed = new ICalFeed();
            feed.setId(1L);
            feed.setUrl("https://calendar.example.com/feed.ics");
            feed.setSourceName("Airbnb Calendar");
            feed.setAutoCreateInterventions(true);
            feed.setOrganizationId(1L);

            assertThat(feed.getId()).isEqualTo(1L);
            assertThat(feed.getUrl()).isEqualTo("https://calendar.example.com/feed.ics");
            assertThat(feed.getSourceName()).isEqualTo("Airbnb Calendar");
            assertThat(feed.isAutoCreateInterventions()).isTrue();
        }
    }

    // ─── Permission & Role ───────────────────────────────────────────────────
    @Nested
    @DisplayName("Permission entity")
    class PermissionEntityTest {
        @Test void gettersAndSetters() {
            Permission p = new Permission();
            p.setId(1L);
            p.setName("intervention.create");
            p.setDescription("Create interventions");

            assertThat(p.getId()).isEqualTo(1L);
            assertThat(p.getName()).isEqualTo("intervention.create");
            assertThat(p.getDescription()).isEqualTo("Create interventions");
        }
    }

    // ─── OrganizationMember ──────────────────────────────────────────────────
    @Nested
    @DisplayName("OrganizationMember entity")
    class OrgMemberEntityTest {
        @Test void gettersAndSetters() {
            OrganizationMember member = new OrganizationMember();
            member.setId(1L);
            member.setRoleInOrg(OrgMemberRole.ADMIN);
            member.setJoinedAt(LocalDateTime.now());

            assertThat(member.getId()).isEqualTo(1L);
            assertThat(member.getRoleInOrg()).isEqualTo(OrgMemberRole.ADMIN);
            assertThat(member.getJoinedAt()).isNotNull();
        }
    }

    // ─── CalendarDay ─────────────────────────────────────────────────────────
    @Nested
    @DisplayName("CalendarDay entity")
    class CalendarDayEntityTest {
        @Test void gettersAndSetters() {
            CalendarDay day = new CalendarDay();
            day.setId(1L);
            day.setDate(LocalDate.of(2026, 3, 15));
            day.setStatus(CalendarDayStatus.AVAILABLE);
            day.setNightlyPrice(BigDecimal.valueOf(100));
            day.setMinStay(2);
            day.setOrganizationId(1L);

            assertThat(day.getId()).isEqualTo(1L);
            assertThat(day.getDate()).isEqualTo(LocalDate.of(2026, 3, 15));
            assertThat(day.getStatus()).isEqualTo(CalendarDayStatus.AVAILABLE);
            assertThat(day.getNightlyPrice()).isEqualByComparingTo("100");
            assertThat(day.getMinStay()).isEqualTo(2);
        }
    }

    // ─── BookingRestriction ──────────────────────────────────────────────────
    @Nested
    @DisplayName("BookingRestriction entity")
    class BookingRestrictionEntityTest {
        @Test void gettersAndSetters() {
            BookingRestriction br = new BookingRestriction();
            br.setId(1L);
            br.setStartDate(LocalDate.of(2026, 6, 1));
            br.setEndDate(LocalDate.of(2026, 8, 31));
            br.setMinStay(3);
            br.setMaxStay(14);
            br.setClosedToArrival(false);
            br.setClosedToDeparture(false);
            br.setOrganizationId(1L);

            assertThat(br.getId()).isEqualTo(1L);
            assertThat(br.getStartDate()).isEqualTo(LocalDate.of(2026, 6, 1));
            assertThat(br.getEndDate()).isEqualTo(LocalDate.of(2026, 8, 31));
            assertThat(br.getMinStay()).isEqualTo(3);
            assertThat(br.getMaxStay()).isEqualTo(14);
            assertThat(br.getClosedToArrival()).isFalse();
            assertThat(br.getClosedToDeparture()).isFalse();
        }
    }

    // ─── ReceivedForm ────────────────────────────────────────────────────────
    @Nested
    @DisplayName("ReceivedForm entity")
    class ReceivedFormEntityTest {
        @Test void gettersAndSetters() {
            ReceivedForm form = new ReceivedForm();
            form.setId(1L);
            form.setFormType("QUOTE");
            form.setStatus("NEW");
            form.setFullName("Jean Dupont");
            form.setEmail("jean@test.com");
            form.setCreatedAt(LocalDateTime.now());

            assertThat(form.getId()).isEqualTo(1L);
            assertThat(form.getFormType()).isEqualTo("QUOTE");
            assertThat(form.getStatus()).isEqualTo("NEW");
            assertThat(form.getFullName()).isEqualTo("Jean Dupont");
            assertThat(form.getEmail()).isEqualTo("jean@test.com");
        }
    }

    // ─── Portfolio ───────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Portfolio entity")
    class PortfolioEntityTest {
        @Test void gettersAndSetters() {
            Portfolio p = new Portfolio();
            p.setId(1L);
            p.setName("Test Portfolio");
            p.setDescription("Description");
            p.setOrganizationId(1L);

            assertThat(p.getId()).isEqualTo(1L);
            assertThat(p.getName()).isEqualTo("Test Portfolio");
            assertThat(p.getDescription()).isEqualTo("Description");
        }
    }

    // ─── OutboxEvent ─────────────────────────────────────────────────────────
    @Nested
    @DisplayName("OutboxEvent entity")
    class OutboxEventEntityTest {
        @Test void gettersAndSetters() {
            OutboxEvent event = new OutboxEvent();
            event.setId(1L);
            event.setAggregateType("Intervention");
            event.setAggregateId("42");
            event.setEventType("CREATED");
            event.setPayload("{\"id\":42}");
            event.setStatus("PENDING");
            event.setCreatedAt(LocalDateTime.now());

            assertThat(event.getId()).isEqualTo(1L);
            assertThat(event.getAggregateType()).isEqualTo("Intervention");
            assertThat(event.getAggregateId()).isEqualTo("42");
            assertThat(event.getEventType()).isEqualTo("CREATED");
            assertThat(event.getPayload()).isEqualTo("{\"id\":42}");
            assertThat(event.getStatus()).isEqualTo("PENDING");
        }
    }

    // ─── KpiSnapshot ─────────────────────────────────────────────────────────
    @Nested
    @DisplayName("KpiSnapshot entity")
    class KpiSnapshotEntityTest {
        @Test void gettersAndSetters() {
            KpiSnapshot kpi = new KpiSnapshot();
            kpi.setId(1L);
            kpi.setCapturedAt(LocalDateTime.now());
            kpi.setReadinessScore(BigDecimal.valueOf(85));
            kpi.setCriticalFailed(false);
            kpi.setDoubleBookings(0);
            kpi.setSource("SCHEDULED");

            assertThat(kpi.getId()).isEqualTo(1L);
            assertThat(kpi.getCapturedAt()).isNotNull();
            assertThat(kpi.getReadinessScore()).isEqualByComparingTo("85");
            assertThat(kpi.isCriticalFailed()).isFalse();
            assertThat(kpi.getDoubleBookings()).isEqualTo(0);
            assertThat(kpi.getSource()).isEqualTo("SCHEDULED");
        }
    }

    // ─── SecurityAuditLog ────────────────────────────────────────────────────
    @Nested
    @DisplayName("SecurityAuditLog entity")
    class SecurityAuditLogEntityTest {
        @Test void gettersAndSetters() {
            SecurityAuditLog log = new SecurityAuditLog();
            log.setId(1L);
            log.setEventType(SecurityAuditEventType.LOGIN_SUCCESS);
            log.setActorId("user-123");
            log.setActorIp("127.0.0.1");
            log.setDetails("Login successful");
            log.setCreatedAt(Instant.now());

            assertThat(log.getId()).isEqualTo(1L);
            assertThat(log.getEventType()).isEqualTo(SecurityAuditEventType.LOGIN_SUCCESS);
            assertThat(log.getActorId()).isEqualTo("user-123");
            assertThat(log.getActorIp()).isEqualTo("127.0.0.1");
            assertThat(log.getDetails()).isEqualTo("Login successful");
        }
    }

    // ─── PendingInscription ──────────────────────────────────────────────────
    @Nested
    @DisplayName("PendingInscription entity")
    class PendingInscriptionEntityTest {
        @Test void gettersAndSetters() {
            PendingInscription pi = new PendingInscription();
            pi.setId(1L);
            pi.setEmail("test@test.com");
            pi.setFirstName("Jean");
            pi.setLastName("Dupont");
            pi.setStatus(PendingInscriptionStatus.PENDING_PAYMENT);
            pi.setCreatedAt(LocalDateTime.now());

            assertThat(pi.getId()).isEqualTo(1L);
            assertThat(pi.getEmail()).isEqualTo("test@test.com");
            assertThat(pi.getFirstName()).isEqualTo("Jean");
            assertThat(pi.getLastName()).isEqualTo("Dupont");
            assertThat(pi.getStatus()).isEqualTo(PendingInscriptionStatus.PENDING_PAYMENT);
        }
    }

    // ─── DocumentGeneration ──────────────────────────────────────────────────
    @Nested
    @DisplayName("DocumentGeneration entity")
    class DocumentGenerationEntityTest {
        @Test void builderAndGetters() {
            DocumentGeneration gen = DocumentGeneration.builder()
                    .documentType(DocumentType.FACTURE)
                    .referenceId(1L)
                    .referenceType(ReferenceType.INTERVENTION)
                    .userId("user-1")
                    .userEmail("user@test.com")
                    .status(DocumentGenerationStatus.GENERATING)
                    .emailTo("client@test.com")
                    .build();

            assertThat(gen.getDocumentType()).isEqualTo(DocumentType.FACTURE);
            assertThat(gen.getReferenceId()).isEqualTo(1L);
            assertThat(gen.getReferenceType()).isEqualTo(ReferenceType.INTERVENTION);
            assertThat(gen.getUserId()).isEqualTo("user-1");
            assertThat(gen.getUserEmail()).isEqualTo("user@test.com");
            assertThat(gen.getStatus()).isEqualTo(DocumentGenerationStatus.GENERATING);
            assertThat(gen.getEmailTo()).isEqualTo("client@test.com");
        }
        @Test void setters() {
            DocumentGeneration gen = new DocumentGeneration();
            gen.setId(1L);
            gen.setFilePath("/documents/facture.pdf");
            gen.setFileName("facture.pdf");
            gen.setFileSize(1024L);
            gen.setGenerationTimeMs(500);
            gen.setLegalNumber("FAC-2026-001");
            gen.setEmailStatus("SENT");
            gen.setEmailSentAt(LocalDateTime.now());
            gen.setErrorMessage(null);
            gen.setOrganizationId(1L);
            gen.setStatus(DocumentGenerationStatus.COMPLETED);

            assertThat(gen.getId()).isEqualTo(1L);
            assertThat(gen.getFilePath()).isEqualTo("/documents/facture.pdf");
            assertThat(gen.getFileName()).isEqualTo("facture.pdf");
            assertThat(gen.getFileSize()).isEqualTo(1024L);
            assertThat(gen.getGenerationTimeMs()).isEqualTo(500);
            assertThat(gen.getLegalNumber()).isEqualTo("FAC-2026-001");
            assertThat(gen.getEmailStatus()).isEqualTo("SENT");
            assertThat(gen.getEmailSentAt()).isNotNull();
            assertThat(gen.getStatus()).isEqualTo(DocumentGenerationStatus.COMPLETED);
        }
    }

    // ─── OrgMemberRole ───────────────────────────────────────────────────────
    @Nested
    @DisplayName("OrgMemberRole")
    class OrgMemberRoleTest {
        @Test void allValues() {
            assertThat(OrgMemberRole.values().length).isGreaterThan(0);
        }
        @Test void helperMethods() {
            assertThat(OrgMemberRole.OWNER.canManageOrg()).isTrue();
            assertThat(OrgMemberRole.ADMIN.canManageOrg()).isTrue();
            assertThat(OrgMemberRole.MEMBER.canManageOrg()).isFalse();

            assertThat(OrgMemberRole.MANAGER.canManageTeams()).isTrue();
            assertThat(OrgMemberRole.SUPERVISOR.canManageTeams()).isTrue();
            assertThat(OrgMemberRole.MEMBER.canManageTeams()).isFalse();

            assertThat(OrgMemberRole.TECHNICIAN.canManageInterventions()).isTrue();
            assertThat(OrgMemberRole.HOUSEKEEPER.canManageInterventions()).isTrue();
            assertThat(OrgMemberRole.MEMBER.canManageInterventions()).isFalse();

            assertThat(OrgMemberRole.OWNER.canViewFinancials()).isTrue();
            assertThat(OrgMemberRole.MEMBER.canViewFinancials()).isFalse();

            assertThat(OrgMemberRole.MANAGER.canInviteMembers()).isTrue();
            assertThat(OrgMemberRole.MEMBER.canInviteMembers()).isFalse();
        }
    }

    // ─── ServiceRequest ────────────────────────────────────────────────────────
    @Nested
    @DisplayName("ServiceRequest")
    class ServiceRequestTest {
        @Test void defaultConstructor() {
            ServiceRequest sr = new ServiceRequest();
            assertThat(sr.getPriority()).isEqualTo(Priority.NORMAL);
            assertThat(sr.getStatus()).isEqualTo(RequestStatus.PENDING);
            assertThat(sr.isUrgent()).isFalse();
            assertThat(sr.isRequiresApproval()).isFalse();
            assertThat(sr.getInterventions()).isEmpty();
            assertThat(sr.getPhotos()).isEmpty();
            assertThat(sr.getComments()).isEmpty();
        }
        @Test void parameterizedConstructor() {
            User user = new User();
            Property property = new Property();
            LocalDateTime date = LocalDateTime.now();
            ServiceRequest sr = new ServiceRequest("Fix faucet", ServiceType.PLUMBING_REPAIR, date, user, property);
            assertThat(sr.getTitle()).isEqualTo("Fix faucet");
            assertThat(sr.getServiceType()).isEqualTo(ServiceType.PLUMBING_REPAIR);
            assertThat(sr.getDesiredDate()).isEqualTo(date);
            assertThat(sr.getUser()).isEqualTo(user);
            assertThat(sr.getProperty()).isEqualTo(property);
        }
        @Test void utilityMethods() {
            ServiceRequest sr = new ServiceRequest();
            sr.setStatus(RequestStatus.PENDING);
            assertThat(sr.isPending()).isTrue();
            assertThat(sr.isInProgress()).isFalse();
            assertThat(sr.isCompleted()).isFalse();
            assertThat(sr.isCancelled()).isFalse();

            sr.setStatus(RequestStatus.IN_PROGRESS);
            assertThat(sr.isInProgress()).isTrue();

            sr.setStatus(RequestStatus.COMPLETED);
            assertThat(sr.isCompleted()).isTrue();

            sr.setStatus(RequestStatus.CANCELLED);
            assertThat(sr.isCancelled()).isTrue();
        }
        @Test void isHighPriority() {
            ServiceRequest sr = new ServiceRequest();
            sr.setPriority(Priority.HIGH);
            assertThat(sr.isHighPriority()).isTrue();

            sr.setPriority(Priority.NORMAL);
            sr.setUrgent(true);
            assertThat(sr.isHighPriority()).isTrue();

            sr.setUrgent(false);
            assertThat(sr.isHighPriority()).isFalse();
        }
        @Test void needsApprovalAndCanBeScheduled() {
            ServiceRequest sr = new ServiceRequest();
            sr.setRequiresApproval(true);
            sr.setStatus(RequestStatus.PENDING);
            assertThat(sr.needsApproval()).isTrue();
            assertThat(sr.canBeScheduled()).isFalse();

            sr.setStatus(RequestStatus.APPROVED);
            assertThat(sr.needsApproval()).isFalse();
            assertThat(sr.canBeScheduled()).isTrue();

            sr.setRequiresApproval(false);
            sr.setStatus(RequestStatus.PENDING);
            assertThat(sr.needsApproval()).isFalse();
            assertThat(sr.canBeScheduled()).isTrue();
        }
        @Test void settersAndGetters() {
            ServiceRequest sr = new ServiceRequest();
            sr.setId(1L);
            sr.setOrganizationId(2L);
            sr.setDescription("Desc");
            sr.setPreferredTimeSlot("AM");
            sr.setEstimatedDurationHours(3);
            sr.setEstimatedCost(java.math.BigDecimal.valueOf(100));
            sr.setActualCost(java.math.BigDecimal.valueOf(120));
            sr.setSpecialInstructions("Special");
            sr.setAccessNotes("Access");
            sr.setGuestCheckoutTime(LocalDateTime.now());
            sr.setGuestCheckinTime(LocalDateTime.now());
            sr.setApprovedBy("admin");
            sr.setApprovedAt(LocalDateTime.now());
            sr.setDevisAcceptedBy("mgr");
            sr.setDevisAcceptedAt(LocalDateTime.now());
            sr.setAssignedToId(10L);
            sr.setAssignedToType("user");
            sr.setCreatedAt(LocalDateTime.now());
            sr.setUpdatedAt(LocalDateTime.now());
            assertThat(sr.getId()).isEqualTo(1L);
            assertThat(sr.getOrganizationId()).isEqualTo(2L);
            assertThat(sr.getDescription()).isEqualTo("Desc");
            assertThat(sr.getPreferredTimeSlot()).isEqualTo("AM");
            assertThat(sr.getEstimatedDurationHours()).isEqualTo(3);
            assertThat(sr.getApprovedBy()).isEqualTo("admin");
            assertThat(sr.getDevisAcceptedBy()).isEqualTo("mgr");
            assertThat(sr.getAssignedToId()).isEqualTo(10L);
            assertThat(sr.getAssignedToType()).isEqualTo("user");
        }
        @Test void toStringTest() {
            ServiceRequest sr = new ServiceRequest();
            sr.setTitle("Test");
            assertThat(sr.toString()).contains("ServiceRequest");
        }
    }

    // ─── RolePermission ────────────────────────────────────────────────────────
    @Nested
    @DisplayName("RolePermission")
    class RolePermissionTest {
        @Test void defaultConstructor() {
            RolePermission rp = new RolePermission();
            assertThat(rp.getIsDefault()).isTrue();
            assertThat(rp.getIsActive()).isTrue();
            assertThat(rp.getCreatedAt()).isNotNull();
            assertThat(rp.getUpdatedAt()).isNotNull();
        }
        @Test void parameterizedConstructor() {
            Role role = new Role("ADMIN", "Admin", "Administrator");
            Permission permission = new Permission();
            permission.setName("intervention.create");
            RolePermission rp = new RolePermission(role, permission);
            assertThat(rp.getRole()).isEqualTo(role);
            assertThat(rp.getPermission()).isEqualTo(permission);
            assertThat(rp.getCreatedAt()).isNotNull();
        }
        @Test void preUpdate() {
            RolePermission rp = new RolePermission();
            LocalDateTime before = rp.getUpdatedAt();
            rp.preUpdate();
            assertThat(rp.getUpdatedAt()).isAfterOrEqualTo(before);
        }
        @Test void toStringWithNulls() {
            RolePermission rp = new RolePermission();
            assertThat(rp.toString()).contains("null");
        }
        @Test void toStringWithValues() {
            Role role = new Role("ADMIN", "Admin", "desc");
            Permission perm = new Permission();
            perm.setName("perm.read");
            RolePermission rp = new RolePermission(role, perm);
            assertThat(rp.toString()).contains("ADMIN");
            assertThat(rp.toString()).contains("perm.read");
        }
        @Test void setters() {
            RolePermission rp = new RolePermission();
            rp.setId(1L);
            rp.setIsDefault(false);
            rp.setIsActive(false);
            assertThat(rp.getId()).isEqualTo(1L);
            assertThat(rp.getIsDefault()).isFalse();
            assertThat(rp.getIsActive()).isFalse();
        }
    }

    // ─── GdprConsent ───────────────────────────────────────────────────────────
    @Nested
    @DisplayName("GdprConsent")
    class GdprConsentTest {
        @Test void defaultConstructor() {
            GdprConsent gc = new GdprConsent();
            assertThat(gc.getVersion()).isEqualTo(1);
        }
        @Test void parameterizedConstructor() {
            User user = new User();
            GdprConsent gc = new GdprConsent(user, GdprConsent.ConsentType.DATA_PROCESSING, true, "127.0.0.1");
            assertThat(gc.getUser()).isEqualTo(user);
            assertThat(gc.getConsentType()).isEqualTo(GdprConsent.ConsentType.DATA_PROCESSING);
            assertThat(gc.isGranted()).isTrue();
            assertThat(gc.getIpAddress()).isEqualTo("127.0.0.1");
            assertThat(gc.getGrantedAt()).isNotNull();
        }
        @Test void consentTypeEnum() {
            assertThat(GdprConsent.ConsentType.values()).hasSize(5);
            assertThat(GdprConsent.ConsentType.valueOf("MARKETING")).isEqualTo(GdprConsent.ConsentType.MARKETING);
            assertThat(GdprConsent.ConsentType.valueOf("ANALYTICS")).isEqualTo(GdprConsent.ConsentType.ANALYTICS);
            assertThat(GdprConsent.ConsentType.valueOf("THIRD_PARTY_SHARING")).isEqualTo(GdprConsent.ConsentType.THIRD_PARTY_SHARING);
            assertThat(GdprConsent.ConsentType.valueOf("COOKIES")).isEqualTo(GdprConsent.ConsentType.COOKIES);
        }
        @Test void prePersist() {
            GdprConsent gc = new GdprConsent();
            gc.prePersist();
            assertThat(gc.getCreatedAt()).isNotNull();
            assertThat(gc.getGrantedAt()).isNotNull();
        }
        @Test void prePersistPreservesGrantedAt() {
            GdprConsent gc = new GdprConsent();
            LocalDateTime fixed = LocalDateTime.of(2025, 1, 1, 0, 0);
            gc.setGrantedAt(fixed);
            gc.prePersist();
            assertThat(gc.getGrantedAt()).isEqualTo(fixed);
        }
        @Test void setters() {
            GdprConsent gc = new GdprConsent();
            gc.setId(1L);
            gc.setOrganizationId(2L);
            gc.setUserId(3L);
            gc.setGranted(false);
            gc.setVersion(2);
            gc.setRevokedAt(LocalDateTime.now());
            gc.setCreatedAt(LocalDateTime.now());
            assertThat(gc.getId()).isEqualTo(1L);
            assertThat(gc.getOrganizationId()).isEqualTo(2L);
            assertThat(gc.getUserId()).isEqualTo(3L);
            assertThat(gc.isGranted()).isFalse();
            assertThat(gc.getVersion()).isEqualTo(2);
            assertThat(gc.getRevokedAt()).isNotNull();
        }
        @Test void toStringTest() {
            GdprConsent gc = new GdprConsent();
            gc.setConsentType(GdprConsent.ConsentType.MARKETING);
            assertThat(gc.toString()).contains("GdprConsent");
        }
    }

    // ─── NoiseDevice ───────────────────────────────────────────────────────────
    @Nested
    @DisplayName("NoiseDevice")
    class NoiseDeviceTest {
        @Test void defaults() {
            NoiseDevice nd = new NoiseDevice();
            assertThat(nd.getStatus()).isEqualTo(NoiseDevice.DeviceStatus.ACTIVE);
        }
        @Test void enums() {
            assertThat(NoiseDevice.DeviceType.values()).hasSize(2);
            assertThat(NoiseDevice.DeviceType.valueOf("MINUT")).isEqualTo(NoiseDevice.DeviceType.MINUT);
            assertThat(NoiseDevice.DeviceType.valueOf("TUYA")).isEqualTo(NoiseDevice.DeviceType.TUYA);
            assertThat(NoiseDevice.DeviceStatus.values()).hasSize(3);
        }
        @Test void prePersist() {
            NoiseDevice nd = new NoiseDevice();
            nd.prePersist();
            assertThat(nd.getCreatedAt()).isNotNull();
            assertThat(nd.getUpdatedAt()).isNotNull();
        }
        @Test void preUpdate() {
            NoiseDevice nd = new NoiseDevice();
            nd.prePersist();
            LocalDateTime before = nd.getUpdatedAt();
            nd.preUpdate();
            assertThat(nd.getUpdatedAt()).isAfterOrEqualTo(before);
        }
        @Test void chartLabelWithoutProperty() {
            NoiseDevice nd = new NoiseDevice();
            nd.setName("Sensor-1");
            assertThat(nd.getChartLabel()).isEqualTo("Sensor-1");
        }
        @Test void setters() {
            NoiseDevice nd = new NoiseDevice();
            nd.setId(1L);
            nd.setOrganizationId(2L);
            nd.setUserId("user-1");
            nd.setDeviceType(NoiseDevice.DeviceType.TUYA);
            nd.setName("Salon");
            nd.setPropertyId(3L);
            nd.setRoomName("Living Room");
            nd.setExternalDeviceId("ext-1");
            nd.setExternalHomeId("home-1");
            nd.setStatus(NoiseDevice.DeviceStatus.INACTIVE);
            assertThat(nd.getId()).isEqualTo(1L);
            assertThat(nd.getOrganizationId()).isEqualTo(2L);
            assertThat(nd.getUserId()).isEqualTo("user-1");
            assertThat(nd.getDeviceType()).isEqualTo(NoiseDevice.DeviceType.TUYA);
            assertThat(nd.getName()).isEqualTo("Salon");
            assertThat(nd.getPropertyId()).isEqualTo(3L);
            assertThat(nd.getRoomName()).isEqualTo("Living Room");
            assertThat(nd.getExternalDeviceId()).isEqualTo("ext-1");
            assertThat(nd.getExternalHomeId()).isEqualTo("home-1");
            assertThat(nd.getStatus()).isEqualTo(NoiseDevice.DeviceStatus.INACTIVE);
        }
    }

    // ─── NotificationCategory ──────────────────────────────────────────────────
    @Nested
    @DisplayName("NotificationCategory")
    class NotificationCategoryTest {
        @Test void allValues() {
            assertThat(NotificationCategory.values()).hasSize(10);
        }
        @Test void getValueJsonMapping() {
            assertThat(NotificationCategory.INTERVENTION.getValue()).isEqualTo("intervention");
            assertThat(NotificationCategory.SERVICE_REQUEST.getValue()).isEqualTo("service_request");
            assertThat(NotificationCategory.NOISE_ALERT.getValue()).isEqualTo("noise_alert");
        }
        @Test void fromValueCaseInsensitive() {
            assertThat(NotificationCategory.fromValue("intervention")).isEqualTo(NotificationCategory.INTERVENTION);
            assertThat(NotificationCategory.fromValue("INTERVENTION")).isEqualTo(NotificationCategory.INTERVENTION);
            assertThat(NotificationCategory.fromValue("Noise_Alert")).isEqualTo(NotificationCategory.NOISE_ALERT);
        }
        @Test void fromValueUnknownThrows() {
            org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class,
                    () -> NotificationCategory.fromValue("unknown"));
        }
    }

    // ─── NotificationType ──────────────────────────────────────────────────────
    @Nested
    @DisplayName("NotificationType")
    class NotificationTypeTest {
        @Test void allValues() {
            assertThat(NotificationType.values()).hasSize(4);
        }
        @Test void getValueJsonMapping() {
            assertThat(NotificationType.INFO.getValue()).isEqualTo("info");
            assertThat(NotificationType.SUCCESS.getValue()).isEqualTo("success");
            assertThat(NotificationType.WARNING.getValue()).isEqualTo("warning");
            assertThat(NotificationType.ERROR.getValue()).isEqualTo("error");
        }
        @Test void fromValue() {
            assertThat(NotificationType.fromValue("info")).isEqualTo(NotificationType.INFO);
            assertThat(NotificationType.fromValue("ERROR")).isEqualTo(NotificationType.ERROR);
        }
        @Test void fromValueUnknownThrows() {
            org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class,
                    () -> NotificationType.fromValue("unknown"));
        }
    }

    // ─── OrganizationInvitation ────────────────────────────────────────────────
    @Nested
    @DisplayName("OrganizationInvitation")
    class OrganizationInvitationTest {
        @Test void defaults() {
            OrganizationInvitation inv = new OrganizationInvitation();
            assertThat(inv.getRoleInvited()).isEqualTo(OrgMemberRole.MEMBER);
            assertThat(inv.getStatus()).isEqualTo(InvitationStatus.PENDING);
        }
        @Test void isExpiredTrue() {
            OrganizationInvitation inv = new OrganizationInvitation();
            inv.setExpiresAt(LocalDateTime.now().minusDays(1));
            assertThat(inv.isExpired()).isTrue();
        }
        @Test void isExpiredFalse() {
            OrganizationInvitation inv = new OrganizationInvitation();
            inv.setExpiresAt(LocalDateTime.now().plusDays(1));
            assertThat(inv.isExpired()).isFalse();
        }
        @Test void isPendingTrue() {
            OrganizationInvitation inv = new OrganizationInvitation();
            inv.setStatus(InvitationStatus.PENDING);
            inv.setExpiresAt(LocalDateTime.now().plusDays(1));
            assertThat(inv.isPending()).isTrue();
        }
        @Test void isPendingFalseWhenExpired() {
            OrganizationInvitation inv = new OrganizationInvitation();
            inv.setStatus(InvitationStatus.PENDING);
            inv.setExpiresAt(LocalDateTime.now().minusDays(1));
            assertThat(inv.isPending()).isFalse();
        }
        @Test void isPendingFalseWhenAccepted() {
            OrganizationInvitation inv = new OrganizationInvitation();
            inv.setStatus(InvitationStatus.ACCEPTED);
            inv.setExpiresAt(LocalDateTime.now().plusDays(1));
            assertThat(inv.isPending()).isFalse();
        }
        @Test void setters() {
            OrganizationInvitation inv = new OrganizationInvitation();
            inv.setId(1L);
            inv.setInvitedEmail("test@test.com");
            inv.setTokenHash("hash123");
            inv.setRoleInvited(OrgMemberRole.ADMIN);
            inv.setAcceptedAt(LocalDateTime.now());
            inv.setCreatedAt(LocalDateTime.now());
            Organization org = new Organization();
            inv.setOrganization(org);
            User inviter = new User();
            inv.setInvitedBy(inviter);
            User accepter = new User();
            inv.setAcceptedByUser(accepter);
            assertThat(inv.getId()).isEqualTo(1L);
            assertThat(inv.getInvitedEmail()).isEqualTo("test@test.com");
            assertThat(inv.getTokenHash()).isEqualTo("hash123");
            assertThat(inv.getRoleInvited()).isEqualTo(OrgMemberRole.ADMIN);
            assertThat(inv.getOrganization()).isEqualTo(org);
            assertThat(inv.getInvitedBy()).isEqualTo(inviter);
            assertThat(inv.getAcceptedByUser()).isEqualTo(accepter);
        }
    }

    // ─── InvitationStatus ──────────────────────────────────────────────────────
    @Nested
    @DisplayName("InvitationStatus")
    class InvitationStatusTest {
        @Test void allValues() {
            assertThat(InvitationStatus.values()).hasSize(4);
            assertThat(InvitationStatus.valueOf("PENDING")).isEqualTo(InvitationStatus.PENDING);
            assertThat(InvitationStatus.valueOf("ACCEPTED")).isEqualTo(InvitationStatus.ACCEPTED);
            assertThat(InvitationStatus.valueOf("EXPIRED")).isEqualTo(InvitationStatus.EXPIRED);
            assertThat(InvitationStatus.valueOf("CANCELLED")).isEqualTo(InvitationStatus.CANCELLED);
        }
    }

    // ─── RateAuditLog ──────────────────────────────────────────────────────────
    @Nested
    @DisplayName("RateAuditLog")
    class RateAuditLogTest {
        @Test void defaultConstructor() {
            RateAuditLog log = new RateAuditLog();
            assertThat(log.getChangedAt()).isNotNull();
        }
        @Test void parameterizedConstructor() {
            java.time.LocalDate date = java.time.LocalDate.of(2026, 1, 15);
            RateAuditLog log = new RateAuditLog(1L, 2L, date, "100", "120", "admin", "MANUAL");
            assertThat(log.getOrganizationId()).isEqualTo(1L);
            assertThat(log.getPropertyId()).isEqualTo(2L);
            assertThat(log.getDate()).isEqualTo(date);
            assertThat(log.getOldValue()).isEqualTo("100");
            assertThat(log.getNewValue()).isEqualTo("120");
            assertThat(log.getChangedBy()).isEqualTo("admin");
            assertThat(log.getSource()).isEqualTo("MANUAL");
        }
        @Test void setters() {
            RateAuditLog log = new RateAuditLog();
            log.setId(1L);
            log.setRatePlanId(5L);
            log.setChangedAt(LocalDateTime.now());
            assertThat(log.getId()).isEqualTo(1L);
            assertThat(log.getRatePlanId()).isEqualTo(5L);
        }
    }

    // ─── RequestComment ────────────────────────────────────────────────────────
    @Nested
    @DisplayName("RequestComment")
    class RequestCommentTest {
        @Test void defaultConstructor() {
            RequestComment rc = new RequestComment();
            assertThat(rc.getId()).isNull();
        }
        @Test void parameterizedConstructor() {
            User author = new User();
            ServiceRequest sr = new ServiceRequest();
            RequestComment rc = new RequestComment("Great job", author, sr);
            assertThat(rc.getContent()).isEqualTo("Great job");
            assertThat(rc.getAuthor()).isEqualTo(author);
            assertThat(rc.getServiceRequest()).isEqualTo(sr);
        }
        @Test void setters() {
            RequestComment rc = new RequestComment();
            rc.setId(1L);
            rc.setContent("Updated");
            rc.setCreatedAt(LocalDateTime.now());
            assertThat(rc.getId()).isEqualTo(1L);
            assertThat(rc.getContent()).isEqualTo("Updated");
            assertThat(rc.getCreatedAt()).isNotNull();
        }
    }

    // ─── RequestPhoto ──────────────────────────────────────────────────────────
    @Nested
    @DisplayName("RequestPhoto")
    class RequestPhotoTest {
        @Test void defaultConstructor() {
            RequestPhoto rp = new RequestPhoto();
            assertThat(rp.getId()).isNull();
        }
        @Test void parameterizedConstructor() {
            ServiceRequest sr = new ServiceRequest();
            RequestPhoto rp = new RequestPhoto("https://img.com/photo.jpg", sr);
            assertThat(rp.getUrl()).isEqualTo("https://img.com/photo.jpg");
            assertThat(rp.getServiceRequest()).isEqualTo(sr);
        }
        @Test void setters() {
            RequestPhoto rp = new RequestPhoto();
            rp.setId(1L);
            rp.setUrl("https://img.com/1.jpg");
            rp.setCaption("Before repair");
            rp.setCreatedAt(LocalDateTime.now());
            assertThat(rp.getId()).isEqualTo(1L);
            assertThat(rp.getUrl()).isEqualTo("https://img.com/1.jpg");
            assertThat(rp.getCaption()).isEqualTo("Before repair");
        }
    }

    // ─── PropertyPhoto ─────────────────────────────────────────────────────────
    @Nested
    @DisplayName("PropertyPhoto")
    class PropertyPhotoTest {
        @Test void defaultConstructor() {
            PropertyPhoto pp = new PropertyPhoto();
            assertThat(pp.getId()).isNull();
        }
        @Test void parameterizedConstructor() {
            Property prop = new Property();
            PropertyPhoto pp = new PropertyPhoto("https://img.com/prop.jpg", prop);
            assertThat(pp.getUrl()).isEqualTo("https://img.com/prop.jpg");
            assertThat(pp.getProperty()).isEqualTo(prop);
        }
        @Test void setters() {
            PropertyPhoto pp = new PropertyPhoto();
            pp.setId(1L);
            pp.setUrl("https://img.com/1.jpg");
            pp.setCaption("Front view");
            pp.setCreatedAt(LocalDateTime.now());
            assertThat(pp.getId()).isEqualTo(1L);
            assertThat(pp.getCaption()).isEqualTo("Front view");
        }
    }

    // ─── PortfolioTeam ─────────────────────────────────────────────────────────
    @Nested
    @DisplayName("PortfolioTeam")
    class PortfolioTeamTest {
        @Test void defaultConstructor() {
            PortfolioTeam pt = new PortfolioTeam();
            assertThat(pt.getIsActive()).isTrue();
            assertThat(pt.getAssignedAt()).isNotNull();
        }
        @Test void parameterizedConstructor() {
            Portfolio portfolio = new Portfolio();
            User member = new User();
            PortfolioTeam pt = new PortfolioTeam(portfolio, member, TeamRole.TECHNICIAN);
            assertThat(pt.getPortfolio()).isEqualTo(portfolio);
            assertThat(pt.getTeamMember()).isEqualTo(member);
            assertThat(pt.getRoleInTeam()).isEqualTo(TeamRole.TECHNICIAN);
        }
        @Test void setters() {
            PortfolioTeam pt = new PortfolioTeam();
            pt.setId(1L);
            pt.setOrganizationId(2L);
            pt.setIsActive(false);
            pt.setNotes("Test notes");
            pt.setAssignedAt(LocalDateTime.now());
            assertThat(pt.getId()).isEqualTo(1L);
            assertThat(pt.getOrganizationId()).isEqualTo(2L);
            assertThat(pt.getIsActive()).isFalse();
            assertThat(pt.getNotes()).isEqualTo("Test notes");
        }
    }

    // ─── PortfolioClient ───────────────────────────────────────────────────────
    @Nested
    @DisplayName("PortfolioClient")
    class PortfolioClientTest {
        @Test void defaultConstructor() {
            PortfolioClient pc = new PortfolioClient();
            assertThat(pc.getIsActive()).isTrue();
            assertThat(pc.getAssignedAt()).isNotNull();
        }
        @Test void parameterizedConstructor() {
            Portfolio portfolio = new Portfolio();
            User client = new User();
            PortfolioClient pc = new PortfolioClient(portfolio, client);
            assertThat(pc.getPortfolio()).isEqualTo(portfolio);
            assertThat(pc.getClient()).isEqualTo(client);
        }
        @Test void setters() {
            PortfolioClient pc = new PortfolioClient();
            pc.setId(1L);
            pc.setOrganizationId(2L);
            pc.setIsActive(false);
            pc.setNotes("Client notes");
            assertThat(pc.getId()).isEqualTo(1L);
            assertThat(pc.getOrganizationId()).isEqualTo(2L);
            assertThat(pc.getIsActive()).isFalse();
            assertThat(pc.getNotes()).isEqualTo("Client notes");
        }
    }

    // ─── ManagerProperty ───────────────────────────────────────────────────────
    @Nested
    @DisplayName("ManagerProperty")
    class ManagerPropertyTest {
        @Test void defaultConstructor() {
            ManagerProperty mp = new ManagerProperty();
            assertThat(mp.getAssignedAt()).isNotNull();
            assertThat(mp.getCreatedAt()).isNotNull();
        }
        @Test void twoArgConstructor() {
            ManagerProperty mp = new ManagerProperty(1L, 2L);
            assertThat(mp.getManagerId()).isEqualTo(1L);
            assertThat(mp.getPropertyId()).isEqualTo(2L);
            assertThat(mp.getAssignedAt()).isNotNull();
        }
        @Test void threeArgConstructor() {
            ManagerProperty mp = new ManagerProperty(1L, 2L, "Priority property");
            assertThat(mp.getManagerId()).isEqualTo(1L);
            assertThat(mp.getPropertyId()).isEqualTo(2L);
            assertThat(mp.getNotes()).isEqualTo("Priority property");
        }
        @Test void setters() {
            ManagerProperty mp = new ManagerProperty();
            mp.setId(1L);
            mp.setOrganizationId(2L);
            mp.setManagerId(3L);
            mp.setPropertyId(4L);
            mp.setNotes("Notes");
            User mgr = new User();
            mp.setManager(mgr);
            Property prop = new Property();
            mp.setProperty(prop);
            assertThat(mp.getId()).isEqualTo(1L);
            assertThat(mp.getOrganizationId()).isEqualTo(2L);
            assertThat(mp.getManager()).isEqualTo(mgr);
            assertThat(mp.getProperty()).isEqualTo(prop);
        }
    }

    // ─── ManagerUser ───────────────────────────────────────────────────────────
    @Nested
    @DisplayName("ManagerUser")
    class ManagerUserTest {
        @Test void defaultConstructor() {
            ManagerUser mu = new ManagerUser();
            assertThat(mu.getAssignedAt()).isNotNull();
            assertThat(mu.getCreatedAt()).isNotNull();
            assertThat(mu.getUpdatedAt()).isNotNull();
            assertThat(mu.getIsActive()).isTrue();
        }
        @Test void parameterizedConstructor() {
            ManagerUser mu = new ManagerUser(1L, 2L);
            assertThat(mu.getManagerId()).isEqualTo(1L);
            assertThat(mu.getUserId()).isEqualTo(2L);
            assertThat(mu.getAssignedAt()).isNotNull();
        }
        @Test void setters() {
            ManagerUser mu = new ManagerUser();
            mu.setId(1L);
            mu.setOrganizationId(2L);
            mu.setIsActive(false);
            User mgr = new User();
            mu.setManager(mgr);
            User user = new User();
            mu.setUser(user);
            assertThat(mu.getId()).isEqualTo(1L);
            assertThat(mu.getOrganizationId()).isEqualTo(2L);
            assertThat(mu.getIsActive()).isFalse();
            assertThat(mu.getManager()).isEqualTo(mgr);
            assertThat(mu.getUser()).isEqualTo(user);
        }
    }

    // ─── ManagerTeam ───────────────────────────────────────────────────────────
    @Nested
    @DisplayName("ManagerTeam")
    class ManagerTeamTest {
        @Test void defaultConstructor() {
            ManagerTeam mt = new ManagerTeam();
            assertThat(mt.getAssignedAt()).isNotNull();
            assertThat(mt.getCreatedAt()).isNotNull();
            assertThat(mt.getUpdatedAt()).isNotNull();
            assertThat(mt.getIsActive()).isTrue();
        }
        @Test void parameterizedConstructor() {
            ManagerTeam mt = new ManagerTeam(1L, 2L);
            assertThat(mt.getManagerId()).isEqualTo(1L);
            assertThat(mt.getTeamId()).isEqualTo(2L);
        }
        @Test void setters() {
            ManagerTeam mt = new ManagerTeam();
            mt.setId(1L);
            mt.setOrganizationId(2L);
            mt.setIsActive(false);
            User mgr = new User();
            mt.setManager(mgr);
            Team team = new Team();
            mt.setTeam(team);
            assertThat(mt.getId()).isEqualTo(1L);
            assertThat(mt.getOrganizationId()).isEqualTo(2L);
            assertThat(mt.getIsActive()).isFalse();
            assertThat(mt.getManager()).isEqualTo(mgr);
            assertThat(mt.getTeam()).isEqualTo(team);
        }
    }

    // ─── Property (extended coverage) ──────────────────────────────────────────
    @Nested
    @DisplayName("Property extended")
    class PropertyExtendedTest {
        @Test void parameterizedConstructor() {
            User owner = new User();
            Property p = new Property("Villa Bleue", "123 Rue Test", 3, 2, owner);
            assertThat(p.getName()).isEqualTo("Villa Bleue");
            assertThat(p.getAddress()).isEqualTo("123 Rue Test");
            assertThat(p.getBedroomCount()).isEqualTo(3);
            assertThat(p.getBathroomCount()).isEqualTo(2);
            assertThat(p.getOwner()).isEqualTo(owner);
        }
        @Test void defaults() {
            Property p = new Property();
            assertThat(p.getType()).isEqualTo(PropertyType.APARTMENT);
            assertThat(p.getStatus()).isEqualTo(PropertyStatus.ACTIVE);
            assertThat(p.getCleaningFrequency()).isEqualTo(CleaningFrequency.AFTER_EACH_STAY);
            assertThat(p.isMaintenanceContract()).isFalse();
            assertThat(p.getDefaultCheckInTime()).isEqualTo("15:00");
            assertThat(p.getDefaultCheckOutTime()).isEqualTo("11:00");
            assertThat(p.getHasExterior()).isFalse();
            assertThat(p.getHasLaundry()).isTrue();
            assertThat(p.getWindowCount()).isEqualTo(0);
            assertThat(p.getFrenchDoorCount()).isEqualTo(0);
            assertThat(p.getSlidingDoorCount()).isEqualTo(0);
            assertThat(p.getHasIroning()).isFalse();
            assertThat(p.getHasDeepKitchen()).isFalse();
            assertThat(p.getHasDisinfection()).isFalse();
        }
        @Test void getFullAddress() {
            Property p = new Property();
            p.setAddress("10 Rue de la Paix");
            assertThat(p.getFullAddress()).isEqualTo("10 Rue de la Paix");

            p.setPostalCode("75002");
            assertThat(p.getFullAddress()).isEqualTo("10 Rue de la Paix, 75002");

            p.setCity("Paris");
            assertThat(p.getFullAddress()).isEqualTo("10 Rue de la Paix, 75002 Paris");

            p.setCountry("France");
            assertThat(p.getFullAddress()).isEqualTo("10 Rue de la Paix, 75002 Paris, France");
        }
        @Test void hasCoordinates() {
            Property p = new Property();
            assertThat(p.hasCoordinates()).isFalse();
            p.setLatitude(java.math.BigDecimal.valueOf(48.8566));
            assertThat(p.hasCoordinates()).isFalse();
            p.setLongitude(java.math.BigDecimal.valueOf(2.3522));
            assertThat(p.hasCoordinates()).isTrue();
        }
        @Test void isActive() {
            Property p = new Property();
            assertThat(p.isActive()).isTrue();
            p.setStatus(PropertyStatus.INACTIVE);
            assertThat(p.isActive()).isFalse();
        }
        @Test void cleaningFields() {
            Property p = new Property();
            p.setCleaningBasePrice(java.math.BigDecimal.valueOf(50));
            p.setCleaningDurationMinutes(120);
            p.setNumberOfFloors(2);
            p.setHasExterior(true);
            p.setHasLaundry(false);
            p.setWindowCount(8);
            p.setFrenchDoorCount(2);
            p.setSlidingDoorCount(1);
            p.setHasIroning(true);
            p.setHasDeepKitchen(true);
            p.setHasDisinfection(true);
            p.setAmenities("Pool, Sauna");
            p.setCleaningNotes("Deep clean");
            assertThat(p.getCleaningBasePrice()).isEqualByComparingTo("50");
            assertThat(p.getCleaningDurationMinutes()).isEqualTo(120);
            assertThat(p.getNumberOfFloors()).isEqualTo(2);
            assertThat(p.getHasExterior()).isTrue();
            assertThat(p.getAmenities()).isEqualTo("Pool, Sauna");
            assertThat(p.getCleaningNotes()).isEqualTo("Deep clean");
        }
        @Test void additionalSetters() {
            Property p = new Property();
            p.setDepartment("75");
            p.setArrondissement("75002");
            p.setEmergencyContact("Jean Dupont");
            p.setEmergencyPhone("0612345678");
            p.setAccessInstructions("Code: 1234");
            p.setSpecialRequirements("Allergies");
            p.setAirbnbListingId("listing-1");
            p.setAirbnbUrl("https://airbnb.com/rooms/1");
            p.setMaintenanceContract(true);
            p.setMaxGuests(6);
            p.setSquareMeters(80);
            p.setNightlyPrice(java.math.BigDecimal.valueOf(150));
            p.setDefaultCheckInTime("16:00");
            p.setDefaultCheckOutTime("10:00");
            assertThat(p.getDepartment()).isEqualTo("75");
            assertThat(p.getArrondissement()).isEqualTo("75002");
            assertThat(p.getEmergencyContact()).isEqualTo("Jean Dupont");
            assertThat(p.getEmergencyPhone()).isEqualTo("0612345678");
            assertThat(p.getAccessInstructions()).isEqualTo("Code: 1234");
            assertThat(p.getAirbnbListingId()).isEqualTo("listing-1");
            assertThat(p.isMaintenanceContract()).isTrue();
            assertThat(p.getMaxGuests()).isEqualTo(6);
        }
        @Test void toStringTest() {
            Property p = new Property();
            p.setName("Test");
            p.setAddress("Addr");
            assertThat(p.toString()).contains("Property");
        }
    }

    // ─── Intervention (extended coverage) ──────────────────────────────────────
    @Nested
    @DisplayName("Intervention extended")
    class InterventionExtendedTest {
        @Test void defaultConstructor() {
            Intervention i = new Intervention();
            assertThat(i.getStatus()).isEqualTo(InterventionStatus.PENDING);
            assertThat(i.getPriority()).isEqualTo("NORMAL");
            assertThat(i.getProgressPercentage()).isEqualTo(0);
            assertThat(i.getIsUrgent()).isFalse();
            assertThat(i.getRequiresFollowUp()).isFalse();
            assertThat(i.getPaymentStatus()).isEqualTo(PaymentStatus.PENDING);
            assertThat(i.getCreatedAt()).isNotNull();
            assertThat(i.getStartTime()).isNotNull();
            assertThat(i.getInterventionPhotos()).isEmpty();
        }
        @Test void parameterizedConstructor() {
            Property prop = new Property();
            User requestor = new User();
            ServiceRequest sr = new ServiceRequest();
            Intervention i = new Intervention("Title", "Desc", "CLEANING", prop, requestor, sr);
            assertThat(i.getTitle()).isEqualTo("Title");
            assertThat(i.getDescription()).isEqualTo("Desc");
            assertThat(i.getType()).isEqualTo("CLEANING");
            assertThat(i.getProperty()).isEqualTo(prop);
            assertThat(i.getRequestor()).isEqualTo(requestor);
            assertThat(i.getServiceRequest()).isEqualTo(sr);
            assertThat(i.getStatus()).isEqualTo(InterventionStatus.PENDING);
        }
        @Test void assignedToMethodsWithUser() {
            Intervention i = new Intervention();
            User user = new User();
            user.setId(10L);
            user.setFirstName("Jean");
            user.setLastName("Dupont");
            i.setAssignedUser(user);
            i.setTeamId(5L);
            assertThat(i.getAssignedToType()).isEqualTo("user");
            assertThat(i.getAssignedToId()).isEqualTo(10L);
            assertThat(i.getAssignedToName()).isEqualTo("Jean Dupont");
        }
        @Test void assignedToMethodsWithTeam() {
            Intervention i = new Intervention();
            i.setTeamId(5L);
            assertThat(i.getAssignedToType()).isEqualTo("team");
            assertThat(i.getAssignedToId()).isEqualTo(5L);
            assertThat(i.getAssignedToName()).contains("5");
        }
        @Test void assignedToMethodsNull() {
            Intervention i = new Intervention();
            assertThat(i.getAssignedToType()).isNull();
            assertThat(i.getAssignedToId()).isNull();
            assertThat(i.getAssignedToName()).isNull();
        }
        @Test void preUpdateSetsCompletedAt() {
            Intervention i = new Intervention();
            i.setStatus(InterventionStatus.COMPLETED);
            i.preUpdate();
            assertThat(i.getUpdatedAt()).isNotNull();
            assertThat(i.getCompletedAt()).isNotNull();
        }
        @Test void preUpdateDoesNotOverrideCompletedAt() {
            Intervention i = new Intervention();
            LocalDateTime fixed = LocalDateTime.of(2025, 6, 1, 12, 0);
            i.setCompletedAt(fixed);
            i.setStatus(InterventionStatus.COMPLETED);
            i.preUpdate();
            assertThat(i.getCompletedAt()).isEqualTo(fixed);
        }
        @Test void preUpdateNonCompleted() {
            Intervention i = new Intervention();
            i.setStatus(InterventionStatus.IN_PROGRESS);
            i.preUpdate();
            assertThat(i.getUpdatedAt()).isNotNull();
            assertThat(i.getCompletedAt()).isNull();
        }
        @Test void addAndRemovePhoto() {
            Intervention i = new Intervention();
            InterventionPhoto photo = new InterventionPhoto();
            i.addPhoto(photo);
            assertThat(i.getInterventionPhotos()).hasSize(1);
            assertThat(photo.getIntervention()).isEqualTo(i);

            i.removePhoto(photo);
            assertThat(i.getInterventionPhotos()).isEmpty();
            assertThat(photo.getIntervention()).isNull();
        }
        @Test void paymentFields() {
            Intervention i = new Intervention();
            i.setPaymentStatus(PaymentStatus.PAID);
            i.setStripePaymentIntentId("pi_123");
            i.setStripeSessionId("sess_123");
            i.setPaidAt(LocalDateTime.now());
            assertThat(i.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(i.getStripePaymentIntentId()).isEqualTo("pi_123");
            assertThat(i.getStripeSessionId()).isEqualTo("sess_123");
            assertThat(i.getPaidAt()).isNotNull();
        }
        @Test void additionalFields() {
            Intervention i = new Intervention();
            i.setAssignedTechnicianId(5L);
            i.setEndTime(LocalDateTime.now());
            i.setMaterialsUsed("Paint");
            i.setTechnicianNotes("Done well");
            i.setCustomerFeedback("Great");
            i.setCustomerRating(5);
            i.setFollowUpNotes("Follow up");
            i.setAfterPhotosUrls("url1,url2");
            i.setBeforePhotosUrls("url3");
            i.setValidatedRooms("[0,1]");
            i.setCompletedSteps("[\"inspection\"]");
            i.setScheduledDate(LocalDateTime.now());
            i.setEstimatedDurationHours(3);
            i.setActualDurationMinutes(150);
            i.setEstimatedCost(java.math.BigDecimal.valueOf(200));
            i.setActualCost(java.math.BigDecimal.valueOf(180));
            i.setSpecialInstructions("Be careful");
            i.setAccessNotes("Key under mat");
            i.setPreferredTimeSlot("AM");
            i.setGuestCheckoutTime(LocalDateTime.now());
            i.setGuestCheckinTime(LocalDateTime.now());
            assertThat(i.getAssignedTechnicianId()).isEqualTo(5L);
            assertThat(i.getMaterialsUsed()).isEqualTo("Paint");
            assertThat(i.getCustomerRating()).isEqualTo(5);
            assertThat(i.getValidatedRooms()).isEqualTo("[0,1]");
            assertThat(i.getCompletedSteps()).isEqualTo("[\"inspection\"]");
            assertThat(i.getEstimatedDurationHours()).isEqualTo(3);
            assertThat(i.getActualDurationMinutes()).isEqualTo(150);
        }
    }

    // ─── RequestStatus ─────────────────────────────────────────────────────────
    @Nested
    @DisplayName("RequestStatus")
    class RequestStatusTest {
        @Test void allValues() {
            assertThat(RequestStatus.values()).hasSize(7);
        }
        @Test void displayName() {
            assertThat(RequestStatus.PENDING.getDisplayName()).isEqualTo("En attente");
            assertThat(RequestStatus.COMPLETED.getDisplayName()).isEqualTo("Terminé");
        }
        @Test void canTransitionTo() {
            assertThat(RequestStatus.PENDING.canTransitionTo(RequestStatus.APPROVED)).isTrue();
            assertThat(RequestStatus.PENDING.canTransitionTo(RequestStatus.COMPLETED)).isFalse();
            assertThat(RequestStatus.COMPLETED.canTransitionTo(RequestStatus.PENDING)).isFalse();
            assertThat(RequestStatus.REJECTED.canTransitionTo(RequestStatus.PENDING)).isTrue();
        }
        @Test void fromString() {
            assertThat(RequestStatus.fromString("pending")).isEqualTo(RequestStatus.PENDING);
            assertThat(RequestStatus.fromString("COMPLETED")).isEqualTo(RequestStatus.COMPLETED);
            assertThat(RequestStatus.fromString(null)).isNull();
        }
        @Test void fromStringInvalidThrows() {
            org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class,
                    () -> RequestStatus.fromString("INVALID"));
        }
    }

    // ─── TeamRole ──────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("TeamRole")
    class TeamRoleTest {
        @Test void allValues() {
            assertThat(TeamRole.values().length).isGreaterThan(0);
        }
        @Test void labels() {
            assertThat(TeamRole.TECHNICIAN.getLabel()).isNotNull();
            assertThat(TeamRole.HOUSEKEEPER.getLabel()).isNotNull();
            assertThat(TeamRole.SUPERVISOR.getLabel()).isNotNull();
        }
    }

    // ─── InterventionPhoto ─────────────────────────────────────────────────────
    @Nested
    @DisplayName("InterventionPhoto")
    class InterventionPhotoTest {
        @Test void defaultConstructor() {
            InterventionPhoto ip = new InterventionPhoto();
            assertThat(ip.getId()).isNull();
        }
        @Test void parameterizedConstructor() {
            Intervention intervention = new Intervention();
            byte[] data = new byte[]{1, 2, 3};
            InterventionPhoto ip = new InterventionPhoto(intervention, data, "image/jpeg");
            assertThat(ip.getIntervention()).isEqualTo(intervention);
            assertThat(ip.getPhotoData()).isEqualTo(data);
            assertThat(ip.getContentType()).isEqualTo("image/jpeg");
        }
        @Test void setters() {
            InterventionPhoto ip = new InterventionPhoto();
            ip.setId(1L);
            ip.setFileName("photo.jpg");
            ip.setCaption("After repair");
            ip.setPhotoType("AFTER");
            ip.setCreatedAt(LocalDateTime.now());
            assertThat(ip.getId()).isEqualTo(1L);
            assertThat(ip.getFileName()).isEqualTo("photo.jpg");
            assertThat(ip.getCaption()).isEqualTo("After repair");
            assertThat(ip.getPhotoType()).isEqualTo("AFTER");
        }
    }
}
