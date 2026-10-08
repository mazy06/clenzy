package com.clenzy.service.migration;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.CalendarEngine;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

@ExtendWith(MockitoExtension.class)
class PmsImportServiceTest {
    @Mock PmsImportBatchRepository batches;
    @Mock PmsImportBindingRepository bindings;
    @Mock PropertyRepository properties;
    @Mock GuestRepository guests;
    @Mock ReservationRepository reservations;
    @Mock UserRepository users;
    @Mock CalendarDayRepository days;
    @Mock CalendarEngine calendar;
    @Mock GuestReviewRepository reviews;
    @Mock RateOverrideRepository rates;
    @Mock InterventionRepository tasks;
    private final ObjectMapper json = new ObjectMapper().findAndRegisterModules();
    private final PmsImportService.Actor actor = new PmsImportService.Actor(1L, "owner", false);
    private PmsImportService service;
    private PmsImportBatch batch;

    @BeforeEach void setup() {
        service = new PmsImportService(batches, bindings, properties, guests, reservations, users, days, calendar,
            new PmsExportReader(json), json, reviews, rates, tasks);
        when(batches.save(any())).thenAnswer(call -> { batch = call.getArgument(0); return batch; });
    }
    private PmsImportService.View upload(String csv) throws Exception {
        var view = service.upload(List.of(new MockMultipartFile("files", "export.csv", "text/csv",
            csv.getBytes(StandardCharsets.UTF_8))), "Smoobu", "agency", "UTF-8", actor);
        when(batches.lockByIdAndOrg(view.id(), actor.orgId())).thenReturn(Optional.of(batch));
        return view;
    }
    private static final String GUEST = "id,first name,last name,email,custom\n0001,Salma,Alaoui,salma@example.com,VIP\n";
    private static final String BOOKING = "booking id,property id,guest name,arrival,departure,total,currency,status\nB1,P1,Salma Alaoui,2026-10-10,2026-10-12,120.30,EUR,confirmed\n";

    @Test void previewDoesNotWriteBusinessDataAndExportRetainsUnknownFields() throws Exception {
        var view = upload(GUEST);
        var validated = service.validate(view.id(), view.plans(), actor);
        assertThat(validated.report().ready()).isEqualTo(1);
        verifyNoInteractions(guests, reservations, calendar);
        assertThat(service.export(view.id(), actor).toString()).contains("VIP", "custom");
    }
    @Test void commitRetryIsIdempotentAndUnvalidatedRequestsAreBlocked() throws Exception {
        var view = upload(GUEST);
        assertThatThrownBy(() -> service.commit(view.id(), "fake", actor)).hasMessage("VALIDATE_FIRST");
        var valid = service.validate(view.id(), view.plans(), actor);
        when(guests.save(any())).thenAnswer(call -> { Guest guest = call.getArgument(0); guest.setId(7L); return guest; });
        var result = service.commit(view.id(), valid.report().token(), actor);
        assertThat(result.status()).isEqualTo("COMPLETED");
        service.commit(view.id(), valid.report().token(), actor);
        verify(guests, times(1)).save(any());
        verify(bindings, times(1)).save(any());
    }
    @Test void anotherTenantOrActorCannotReadOrCommitBatch() throws Exception {
        var view = upload(GUEST);
        when(batches.lockByIdAndOrg(view.id(), 2L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.get(view.id(), new PmsImportService.Actor(2L, "owner", false)))
            .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.get(view.id(), new PmsImportService.Actor(1L, "other", true)))
            .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(guests, reservations, calendar);
    }
    @Test void changedSourceIdIsBlockedWithoutOverwritingAndSameRowIsSkipped() throws Exception {
        var view = upload(GUEST);
        var valid = service.validate(view.id(), view.plans(), actor);
        when(guests.save(any())).thenAnswer(call -> { Guest guest = call.getArgument(0); guest.setId(7L); return guest; });
        service.commit(view.id(), valid.report().token(), actor);
        var binding = ArgumentCaptor.forClass(PmsImportBinding.class);
        verify(bindings).save(binding.capture());
        var second = upload(GUEST);
        when(bindings.findByOrganizationIdAndSourceKeyIn(eq(1L), any())).thenReturn(List.of(binding.getValue()));
        var duplicate = service.validate(second.id(), second.plans(), actor);
        assertThat(duplicate.report().duplicates()).isEqualTo(1);
        assertThat(duplicate.report().issueCount()).isZero();
        var changed = upload(GUEST.replace("VIP", "new notes"));
        var conflict = service.validate(changed.id(), changed.plans(), actor);
        assertThat(conflict.report().issues()).extracting(PmsImportService.Issue::code).contains("SOURCE_CHANGED");
    }
    @Test void allRowsMustValidateBeforeAnyWrite() throws Exception {
        var view = upload(GUEST + "0002,,,broken,notes\n");
        var valid = service.validate(view.id(), view.plans(), actor);
        assertThat(valid.report().issueCount()).isEqualTo(1);
        assertThatThrownBy(() -> service.commit(view.id(), valid.report().token(), actor)).hasMessage("VALIDATION_CHANGED");
        verifyNoInteractions(guests, calendar);
    }
    @Test void reservationsRequireExplicitPropertyLinksAndOwnerAccess() throws Exception {
        var view = upload(BOOKING);
        var missing = service.validate(view.id(), view.plans(), actor);
        assertThat(missing.report().issues()).extracting(PmsImportService.Issue::code).contains("PROPERTY_LINK_REQUIRED");
        var plan = link(view.plans().getFirst(), 42L);
        when(properties.findByIdWithOwner(42L, 1L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.validate(view.id(), List.of(plan), actor)).isInstanceOf(AccessDeniedException.class);
    }
    @Test void reservationCommitKeepsFinancialAmountsAndPausesAutomation() throws Exception {
        var view = upload(BOOKING);
        var owner = new User(); owner.setKeycloakId("owner");
        var property = new Property(); property.setId(42L); property.setOrganizationId(1L); property.setOwner(owner);
        when(properties.findByIdWithOwner(42L, 1L)).thenReturn(Optional.of(property));
        var validated = service.validate(view.id(), List.of(link(view.plans().getFirst(), 42L)), actor);
        assertThat(validated.report().issueCount()).isZero();
        assertThat(validated.report().totals()).containsEntry("EUR", "120.30");
        when(days.acquirePropertyLock(42L)).thenReturn(true);
        when(reservations.save(any())).thenAnswer(call -> { Reservation r = call.getArgument(0); r.setId(80L); return r; });
        service.commit(view.id(), validated.report().token(), actor);
        var reservation = ArgumentCaptor.forClass(Reservation.class);
        verify(reservations).save(reservation.capture());
        assertThat(reservation.getValue().isMigrationAutomationPaused()).isTrue();
        assertThat(reservation.getValue().getTotalPrice()).isEqualByComparingTo("120.30");
        verify(calendar).importReservation(reservation.getValue(), "owner");
    }
    @Test void overlapsWithinBatchAreBlocking() throws Exception {
        var view = upload(BOOKING + "B2,P1,Karim Alaoui,2026-10-11,2026-10-13,80,EUR,confirmed\n");
        var report = service.validate(view.id(), view.plans(), actor).report();
        assertThat(report.issues()).extracting(PmsImportService.Issue::code).contains("BATCH_OVERLAP");
    }

    @Test void multiDatasetExportCreatesLinkedPropertyGuestAndReservationAndPreservesOriginal() throws Exception {
        String export = """
            {"properties":[{"id":"P1","name":"Riad Nour","address":"Marrakech","bedrooms":2,"bathrooms":1,"timezone":"Africa/Casablanca","currency":"MAD","type":"RIAD"}],
             "guests":[{"id":"G1","firstName":"Salma","lastName":"Alaoui","email":"salma@example.com"}],
             "reservations":[{"id":"B1","propertyRef":"P1","guestRef":"G1","guestName":"Salma Alaoui","checkIn":"2026-10-10","checkOut":"2026-10-12","totalPrice":"120.30","currency":"MAD","status":"confirmed"}]}
            """;
        var view = service.upload(List.of(new MockMultipartFile("files", "full.json", "application/json", export.getBytes(StandardCharsets.UTF_8))),
            "Local PMS", "account", "UTF-8", actor);
        when(batches.lockByIdAndOrg(view.id(), 1L)).thenReturn(Optional.of(batch));
        var validated = service.validate(view.id(), view.plans(), actor);
        assertThat(validated.report().issueCount()).isZero();
        assertThat(validated.report().ready()).isEqualTo(3);
        var owner = new User(); owner.setId(10L); owner.setOrganizationId(1L); owner.setKeycloakId("owner");
        when(users.findByKeycloakId("owner")).thenReturn(Optional.of(owner));
        var savedProperty = new java.util.concurrent.atomic.AtomicReference<Property>();
        var savedGuest = new java.util.concurrent.atomic.AtomicReference<Guest>();
        when(properties.save(any())).thenAnswer(call -> { Property p = call.getArgument(0); p.setId(42L); savedProperty.set(p); return p; });
        when(properties.findByIdWithOwner(42L, 1L)).thenAnswer(call -> Optional.of(savedProperty.get()));
        when(guests.save(any())).thenAnswer(call -> { Guest g = call.getArgument(0); g.setId(7L); savedGuest.set(g); return g; });
        when(guests.findByIdAndOrganizationId(7L, 1L)).thenAnswer(call -> Optional.of(savedGuest.get()));
        when(reservations.save(any())).thenAnswer(call -> { Reservation r = call.getArgument(0); r.setId(80L); return r; });
        service.commit(view.id(), validated.report().token(), actor);
        var reservation = ArgumentCaptor.forClass(Reservation.class);
        verify(reservations).save(reservation.capture());
        assertThat(reservation.getValue().getGuest()).isSameAs(savedGuest.get());
        assertThat(reservation.getValue().getProperty()).isSameAs(savedProperty.get());
        assertThat(reservation.getValue().getCurrency()).isEqualTo("MAD");
        PmsImportService.Payload payload = json.readValue(batch.getPayload(), PmsImportService.Payload.class);
        assertThat(new String(Base64.getDecoder().decode(payload.originals().getFirst().base64()), StandardCharsets.UTF_8)).isEqualTo(export);
    }

    @Test void hostCannotLinkAnotherOwnersPropertyEvenWithinSameOrganization() throws Exception {
        var view = upload(BOOKING);
        var other = new User(); other.setKeycloakId("another-owner");
        var property = new Property(); property.setId(42L); property.setOrganizationId(1L); property.setOwner(other);
        when(properties.findByIdWithOwner(42L, 1L)).thenReturn(Optional.of(property));
        assertThatThrownBy(() -> service.validate(view.id(), List.of(link(view.plans().getFirst(), 42L)), actor))
            .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(reservations, calendar);
    }
    @Test void requestsAndInquiriesAreCountedAsSkippedWithoutBlockingTheBatch() throws Exception {
        var view = upload(BOOKING + "B2,P1,Karim,2026-10-11,2026-10-13,,EUR,inquiry\nB3,P1,Lina,2026-11-01,2026-11-03,90,EUR,declined\n");
        var report = service.validate(view.id(), List.of(link(view.plans().getFirst(), 42L)), ownerProperty()).report();
        assertThat(report.skipped()).isEqualTo(2);
        assertThat(report.ready()).isEqualTo(1);
        assertThat(report.issueCount()).isZero();
    }
    @Test void reservationFeesAndTaxesAreKept() throws Exception {
        var view = upload("booking id,property id,guest name,arrival,departure,total,currency,status,cleaning fee,tourist tax,taxes\n"
            + "B1,P1,Salma,2026-10-10,2026-10-12,120.30,EUR,confirmed,25,4.40,10\n");
        var validated = service.validate(view.id(), List.of(link(view.plans().getFirst(), 42L)), ownerProperty());
        when(days.acquirePropertyLock(42L)).thenReturn(true);
        when(reservations.save(any())).thenAnswer(call -> { Reservation r = call.getArgument(0); r.setId(80L); return r; });
        service.commit(view.id(), validated.report().token(), actor);
        var reservation = ArgumentCaptor.forClass(Reservation.class);
        verify(reservations).save(reservation.capture());
        assertThat(reservation.getValue().getCleaningFee()).isEqualByComparingTo("25");
        assertThat(reservation.getValue().getTouristTaxAmount()).isEqualByComparingTo("4.40");
        assertThat(reservation.getValue().getTaxAmount()).isEqualByComparingTo("10");
    }
    @Test void reviewsRatesAndTasksBecomeBaitlyRecordsAfterValidation() throws Exception {
        String reviewsCsv = "review id,property id,rating,review date,channel,guest name,review\nR1,P1,9,2026-08-02T10:00:00Z,Booking.com,Salma,Parfait\n";
        String ratesCsv = "property id,date,price,currency\nP1,2026-12-24,180,EUR\n";
        String tasksCsv = "task id,property id,title,due date,type,status\nT1,P1,Ménage départ,2026-10-12,Cleaning,done\n";
        var view = service.upload(List.of(
            new MockMultipartFile("files", "reviews.csv", "text/csv", reviewsCsv.getBytes(StandardCharsets.UTF_8)),
            new MockMultipartFile("files", "rates.csv", "text/csv", ratesCsv.getBytes(StandardCharsets.UTF_8)),
            new MockMultipartFile("files", "tasks.csv", "text/csv", tasksCsv.getBytes(StandardCharsets.UTF_8))),
            "other pms", "agency", "UTF-8", actor);
        when(batches.lockByIdAndOrg(view.id(), actor.orgId())).thenReturn(Optional.of(batch));
        assertThat(view.plans()).extracting(ImportPlan::kind)
            .containsExactly(ImportPlan.Kind.REVIEW, ImportPlan.Kind.RATE, ImportPlan.Kind.TASK);
        var plans = view.plans().stream().map(p -> link(p, 42L)).toList();
        var validated = service.validate(view.id(), plans, ownerProperty());
        assertThat(validated.report().issueCount()).isZero();
        assertThat(validated.report().ready()).isEqualTo(3);
        verifyNoInteractions(tasks);
        var owner = new User(); owner.setId(10L); owner.setOrganizationId(1L); owner.setKeycloakId("owner");
        when(users.findByKeycloakId("owner")).thenReturn(Optional.of(owner));
        when(days.acquirePropertyLock(42L)).thenReturn(true);
        when(reviews.save(any())).thenAnswer(call -> { GuestReview r = call.getArgument(0); r.setId(1L); return r; });
        when(rates.save(any())).thenAnswer(call -> { RateOverride r = call.getArgument(0); r.setId(2L); return r; });
        when(tasks.save(any())).thenAnswer(call -> { Intervention t = call.getArgument(0); t.setId(3L); return t; });
        service.commit(view.id(), validated.report().token(), actor);
        var review = ArgumentCaptor.forClass(GuestReview.class);
        verify(reviews).save(review.capture());
        assertThat(review.getValue().getRating()).isEqualTo(5);
        assertThat(review.getValue().getReviewDate()).isEqualTo(java.time.LocalDate.of(2026, 8, 2));
        assertThat(review.getValue().getChannelName()).isEqualTo(com.clenzy.integration.channel.ChannelName.BOOKING);
        var rate = ArgumentCaptor.forClass(RateOverride.class);
        verify(rates).save(rate.capture());
        assertThat(rate.getValue().getNightlyPrice()).isEqualByComparingTo("180");
        assertThat(rate.getValue().getSource()).isEqualTo("PMS_IMPORT");
        var task = ArgumentCaptor.forClass(Intervention.class);
        verify(tasks).save(task.capture());
        assertThat(task.getValue().getStatus()).isEqualTo(InterventionStatus.COMPLETED);
        assertThat(task.getValue().getType()).isEqualTo("CLEANING");
        verifyNoInteractions(calendar);
    }
    @Test void existingNightlyRateIsReportedNotOverwritten() throws Exception {
        var view = service.upload(List.of(new MockMultipartFile("files", "rates.csv", "text/csv",
            "property id,date,price,currency\nP1,2026-12-24,180,EUR\n".getBytes(StandardCharsets.UTF_8))), "x", "a", "UTF-8", actor);
        when(batches.lockByIdAndOrg(view.id(), actor.orgId())).thenReturn(Optional.of(batch));
        when(rates.findByPropertyIdAndDate(42L, java.time.LocalDate.of(2026, 12, 24), 1L)).thenReturn(Optional.of(new RateOverride()));
        var report = service.validate(view.id(), List.of(link(view.plans().getFirst(), 42L)), ownerProperty()).report();
        assertThat(report.issues()).extracting(PmsImportService.Issue::code).containsExactly("RATE_EXISTS");
    }
    @Test void vendorProfileMapsApiFieldNamesForTheChosenSource() throws Exception {
        String hostaway = """
            {"result":[{"id":991,"listingMapId":55,"guestName":"Salma","arrivalDate":"2026-10-10","departureDate":"2026-10-12",
              "totalPrice":"120.30","currency":"EUR","status":"new","channelName":"airbnbOfficial","channelReservationId":"HM123"}]}
            """;
        var view = service.upload(List.of(new MockMultipartFile("files", "reservations.json", "application/json",
            hostaway.getBytes(StandardCharsets.UTF_8))), "hostaway", "acct", "UTF-8", actor);
        var plan = view.plans().getFirst();
        assertThat(plan.kind()).isEqualTo(ImportPlan.Kind.RESERVATION);
        assertThat(plan.fields()).containsEntry("checkIn", "arrivalDate").containsEntry("propertyRef", "listingMapId")
            .containsEntry("confirmationCode", "channelReservationId").containsEntry("sourceId", "id");
    }
    private PmsImportService.Actor ownerProperty() {
        var owner = new User(); owner.setKeycloakId("owner");
        var property = new Property(); property.setId(42L); property.setOrganizationId(1L); property.setOwner(owner);
        lenient().when(properties.findByIdWithOwner(42L, 1L)).thenReturn(Optional.of(property));
        return actor;
    }
    private ImportPlan link(ImportPlan plan, long id) {
        return new ImportPlan(plan.documentId(), plan.kind(), plan.fields(), plan.defaults(), Map.of("P1", id), plan.dateFormat(), plan.decimalSeparator());
    }
}
