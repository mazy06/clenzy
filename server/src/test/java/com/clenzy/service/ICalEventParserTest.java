package com.clenzy.service;

import com.clenzy.dto.ICalImportDto.ICalEventPreview;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Tests for {@link ICalEventParser}.
 * Validates iCal parsing, guest extraction, date handling, nights calculation, and DoS protection.
 */
class ICalEventParserTest {

    private InputStream toStream(String icalContent) {
        return new ByteArrayInputStream(icalContent.getBytes(StandardCharsets.UTF_8));
    }

    private String buildIcal(String... vevents) {
        StringBuilder sb = new StringBuilder();
        sb.append("BEGIN:VCALENDAR\r\n");
        sb.append("VERSION:2.0\r\n");
        sb.append("PRODID:-//Test//Test//EN\r\n");
        for (String vevent : vevents) {
            sb.append(vevent);
        }
        sb.append("END:VCALENDAR\r\n");
        return sb.toString();
    }

    private String buildVEvent(String uid, String summary, String dtStart, String dtEnd) {
        return buildVEvent(uid, summary, dtStart, dtEnd, null);
    }

    private String buildVEvent(String uid, String summary, String dtStart, String dtEnd, String description) {
        StringBuilder sb = new StringBuilder();
        sb.append("BEGIN:VEVENT\r\n");
        if (uid != null) sb.append("UID:").append(uid).append("\r\n");
        if (summary != null) sb.append("SUMMARY:").append(summary).append("\r\n");
        if (dtStart != null) {
            if (dtStart.length() == 8) {
                sb.append("DTSTART;VALUE=DATE:").append(dtStart).append("\r\n");
            } else {
                sb.append("DTSTART:").append(dtStart).append("\r\n");
            }
        }
        if (dtEnd != null) {
            if (dtEnd.length() == 8) {
                sb.append("DTEND;VALUE=DATE:").append(dtEnd).append("\r\n");
            } else {
                sb.append("DTEND:").append(dtEnd).append("\r\n");
            }
        }
        if (description != null) sb.append("DESCRIPTION:").append(description).append("\r\n");
        sb.append("END:VEVENT\r\n");
        return sb.toString();
    }

    @Nested
    @DisplayName("Basic parsing")
    class BasicParsing {

        @Test
        void whenEmptyCalendar_thenReturnsEmptyList() {
            String ical = buildIcal();

            List<ICalEventPreview> events = ICalEventParser.parseEvents(toStream(ical));

            assertThat(events).isEmpty();
        }

        @Test
        void whenSingleEvent_thenParsesCorrectly() {
            String ical = buildIcal(
                    buildVEvent("uid-1", "John Doe", "20260301", "20260305")
            );

            List<ICalEventPreview> events = ICalEventParser.parseEvents(toStream(ical));

            assertThat(events).hasSize(1);
            ICalEventPreview event = events.get(0);
            assertThat(event.getUid()).isEqualTo("uid-1");
            assertThat(event.getSummary()).isEqualTo("John Doe");
            assertThat(event.getDtStart()).isEqualTo(LocalDate.of(2026, 3, 1));
            assertThat(event.getDtEnd()).isEqualTo(LocalDate.of(2026, 3, 5));
            assertThat(event.getType()).isEqualTo("reservation");
        }

        @Test
        void whenMultipleEvents_thenSortedByStartDateAscending() {
            String ical = buildIcal(
                    buildVEvent("uid-2", "Late Guest", "20260315", "20260320"),
                    buildVEvent("uid-1", "Early Guest", "20260301", "20260305"),
                    buildVEvent("uid-3", "Mid Guest", "20260310", "20260312")
            );

            List<ICalEventPreview> events = ICalEventParser.parseEvents(toStream(ical));

            assertThat(events).hasSize(3);
            assertThat(events.get(0).getDtStart()).isEqualTo(LocalDate.of(2026, 3, 1));
            assertThat(events.get(1).getDtStart()).isEqualTo(LocalDate.of(2026, 3, 10));
            assertThat(events.get(2).getDtStart()).isEqualTo(LocalDate.of(2026, 3, 15));
        }
    }

    @Nested
    @DisplayName("Guest name and confirmation code extraction")
    class GuestExtraction {

        @Test
        void whenSummaryHasGuestAndCode_thenExtractsBoth() {
            String ical = buildIcal(
                    buildVEvent("uid-1", "John Doe (HMABCDEF12)", "20260301", "20260305")
            );

            List<ICalEventPreview> events = ICalEventParser.parseEvents(toStream(ical));

            assertThat(events.get(0).getGuestName()).isEqualTo("John Doe");
            assertThat(events.get(0).getConfirmationCode()).isEqualTo("HMABCDEF12");
        }

        @Test
        void whenSummaryHasOnlyGuestName_thenSetsGuestNameOnly() {
            String ical = buildIcal(
                    buildVEvent("uid-1", "Jane Smith", "20260301", "20260305")
            );

            List<ICalEventPreview> events = ICalEventParser.parseEvents(toStream(ical));

            assertThat(events.get(0).getGuestName()).isEqualTo("Jane Smith");
            assertThat(events.get(0).getConfirmationCode()).isNull();
        }

        @Test
        void whenSummaryIsBlank_thenNoGuestName() {
            String ical = buildIcal(
                    buildVEvent("uid-1", "", "20260301", "20260305")
            );

            List<ICalEventPreview> events = ICalEventParser.parseEvents(toStream(ical));

            assertThat(events.get(0).getGuestName()).isNull();
        }
    }

    @Nested
    @DisplayName("Date parsing")
    class DateParsing {

        @Test
        void whenDateFormat_thenParsesCorrectly() {
            String ical = buildIcal(
                    buildVEvent("uid-1", "Guest", "20260615", "20260620")
            );

            List<ICalEventPreview> events = ICalEventParser.parseEvents(toStream(ical));

            assertThat(events.get(0).getDtStart()).isEqualTo(LocalDate.of(2026, 6, 15));
            assertThat(events.get(0).getDtEnd()).isEqualTo(LocalDate.of(2026, 6, 20));
        }

        @Test
        void whenDateTimeFormat_thenExtractsDatePart() {
            String ical = buildIcal(
                    buildVEvent("uid-1", "Guest", "20260615T150000Z", "20260620T110000Z")
            );

            List<ICalEventPreview> events = ICalEventParser.parseEvents(toStream(ical));

            assertThat(events.get(0).getDtStart()).isEqualTo(LocalDate.of(2026, 6, 15));
            assertThat(events.get(0).getDtEnd()).isEqualTo(LocalDate.of(2026, 6, 20));
        }

        @Test
        void whenEventHasNoDtStart_thenExcluded() {
            // Event without DTSTART should be filtered out
            String vevent = "BEGIN:VEVENT\r\nUID:uid-1\r\nSUMMARY:No Date\r\nEND:VEVENT\r\n";
            String ical = buildIcal(vevent);

            List<ICalEventPreview> events = ICalEventParser.parseEvents(toStream(ical));

            assertThat(events).isEmpty();
        }
    }

    @Nested
    @DisplayName("Nights calculation")
    class NightsCalculation {

        @Test
        void whenStartAndEndPresent_thenCalculatesNights() {
            String ical = buildIcal(
                    buildVEvent("uid-1", "Guest", "20260301", "20260304")
            );

            List<ICalEventPreview> events = ICalEventParser.parseEvents(toStream(ical));

            assertThat(events.get(0).getNights()).isEqualTo(3);
        }

        @Test
        void whenDescriptionContainsNights_thenUsesDescriptionValue() {
            String ical = buildIcal(
                    buildVEvent("uid-1", "Guest", "20260301", "20260304", "NIGHTS: 5")
            );

            List<ICalEventPreview> events = ICalEventParser.parseEvents(toStream(ical));

            // Description value (5) overrides calculated value (3)
            assertThat(events.get(0).getNights()).isEqualTo(5);
        }
    }

    @Nested
    @DisplayName("Description parsing")
    class DescriptionParsing {

        @Test
        void whenDescriptionPresent_thenStored() {
            String ical = buildIcal(
                    buildVEvent("uid-1", "Guest", "20260301", "20260305", "Check-in at 3pm")
            );

            List<ICalEventPreview> events = ICalEventParser.parseEvents(toStream(ical));

            assertThat(events.get(0).getDescription()).isEqualTo("Check-in at 3pm");
        }

        @Test
        void whenDescriptionContainsNightsPattern_thenExtractsNights() {
            String ical = buildIcal(
                    buildVEvent("uid-1", "Guest", "20260301", "20260305", "Booking details\\nNIGHTS: 7\\nGuests: 2")
            );

            List<ICalEventPreview> events = ICalEventParser.parseEvents(toStream(ical));

            assertThat(events.get(0).getNights()).isEqualTo(7);
        }
    }

    @Nested
    @DisplayName("Invalid input")
    class InvalidInput {

        @Test
        void whenInvalidICalFormat_thenThrowsRuntimeException() {
            InputStream stream = toStream("This is not valid iCal content");

            assertThatThrownBy(() -> ICalEventParser.parseEvents(stream))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("iCal");
        }
    }

    @Nested
    @DisplayName("UID handling")
    class UidHandling {

        @Test
        void whenNoUid_thenUidIsNull() {
            String vevent = "BEGIN:VEVENT\r\nSUMMARY:Guest\r\nDTSTART;VALUE=DATE:20260301\r\nDTEND;VALUE=DATE:20260305\r\nEND:VEVENT\r\n";
            String ical = buildIcal(vevent);

            List<ICalEventPreview> events = ICalEventParser.parseEvents(toStream(ical));

            assertThat(events).hasSize(1);
            assertThat(events.get(0).getUid()).isNull();
        }
    }
}
