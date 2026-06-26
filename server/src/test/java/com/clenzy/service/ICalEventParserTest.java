package com.clenzy.service;

import com.clenzy.dto.ICalImportDto.ICalEventPreview;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
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
        void whenSummaryIsBlank_thenEmittedAsBlockedEvent() {
            // Un SUMMARY vide est traite comme un blocage de calendrier : emis avec
            // type="blocked" + ses dates (reconcilie en CalendarDay BLOCKED a l'import).
            String ical = buildIcal(
                    buildVEvent("uid-1", "", "20260301", "20260305")
            );

            List<ICalEventPreview> events = ICalEventParser.parseEvents(toStream(ical));

            assertThat(events).hasSize(1);
            assertThat(events.get(0).getType()).isEqualTo("blocked");
            assertThat(events.get(0).getDtStart()).isEqualTo(LocalDate.of(2026, 3, 1));
            assertThat(events.get(0).getDtEnd()).isEqualTo(LocalDate.of(2026, 3, 5));
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

    @Nested
    @DisplayName("ParseResult : comptage des evenements ecartes et recurrents (Z6-SECBUGS-05/07)")
    class ParseResultCounting {

        @Test
        void whenEventHasNoDtStart_thenCountedAsUnparsableWithUid() {
            // Arrange
            String broken = "BEGIN:VEVENT\r\nUID:uid-broken\r\nSUMMARY:No Date\r\nEND:VEVENT\r\n";
            String ical = buildIcal(broken, buildVEvent("uid-ok", "Guest", "20260301", "20260305"));

            // Act
            ICalEventParser.ParseResult result = ICalEventParser.parse(toStream(ical));

            // Assert : pas de perte silencieuse — l'evenement ecarte est compte avec son UID
            assertThat(result.events()).hasSize(1);
            assertThat(result.events().get(0).getUid()).isEqualTo("uid-ok");
            assertThat(result.unparsableEvents()).isEqualTo(1);
            assertThat(result.unparsableUids()).containsExactly("uid-broken");
            assertThat(result.recurringEvents()).isZero();
        }

        @Test
        void whenBlockedEvent_thenEmittedAsBlockedNotUnparsable() {
            String ical = buildIcal(buildVEvent("uid-block", "Not available", "20260301", "20260305"));

            ICalEventParser.ParseResult result = ICalEventParser.parse(toStream(ical));

            // Blocage calendrier = evenement de type "blocked" (reconcilie a l'import),
            // pas une anomalie de parsing.
            assertThat(result.events()).hasSize(1);
            assertThat(result.events().get(0).getType()).isEqualTo("blocked");
            assertThat(result.unparsableEvents()).isZero();
            assertThat(result.unparsableUids()).isEmpty();
        }

        @Test
        void whenRrulePresent_thenRecurringCountedAndMasterKept() {
            String vevent = "BEGIN:VEVENT\r\nUID:uid-rec\r\nSUMMARY:Recurring Guest\r\n"
                    + "DTSTART;VALUE=DATE:20260301\r\nDTEND;VALUE=DATE:20260303\r\n"
                    + "RRULE:FREQ=WEEKLY;COUNT=4\r\nEND:VEVENT\r\n";

            ICalEventParser.ParseResult result = ICalEventParser.parse(toStream(buildIcal(vevent)));

            // L'occurrence maitre est conservee, la recurrence est detectee et comptee
            assertThat(result.events()).hasSize(1);
            assertThat(result.recurringEvents()).isEqualTo(1);
            assertThat(result.unparsableEvents()).isZero();
        }

        @Test
        void whenNoAnomalies_thenCountersAreZero() {
            String ical = buildIcal(buildVEvent("uid-1", "Guest", "20260301", "20260305"));

            ICalEventParser.ParseResult result = ICalEventParser.parse(toStream(ical));

            assertThat(result.events()).hasSize(1);
            assertThat(result.unparsableEvents()).isZero();
            assertThat(result.recurringEvents()).isZero();
        }
    }

    @Nested
    @DisplayName("parseICalDate robustness (Z6-SECBUGS-05)")
    class ParseICalDateRobustness {

        @Test
        void whenDateValueShorterThanEight_thenThrowsIllegalArgumentNotIndexOutOfBounds() {
            assertThatThrownBy(() -> ICalEventParser.parseICalDate("2026"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("invalide");
        }

        @Test
        void whenDateValueNull_thenThrowsIllegalArgument() {
            assertThatThrownBy(() -> ICalEventParser.parseICalDate(null))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("invalide");
        }

        @Test
        void whenDateValue_thenParses() {
            assertThat(ICalEventParser.parseICalDate("20260615"))
                    .isEqualTo(LocalDate.of(2026, 6, 15));
        }

        @Test
        void whenDateTimeValue_thenParsesDatePart() {
            assertThat(ICalEventParser.parseICalDate("20260615T150000Z"))
                    .isEqualTo(LocalDate.of(2026, 6, 15));
        }
    }

    @Nested
    @DisplayName("Timezone des DATE-TIME (Z6-SECBUGS-04)")
    class TimezoneHandling {

        private final ZoneId paris = ZoneId.of("Europe/Paris");

        @Test
        void whenUtcDateTimeNearMidnight_thenConvertedToPropertyZoneDate() {
            // Arrange : 23:00 UTC le 15 juin = 01:00 le 16 juin a Paris (UTC+2 en ete)
            String vevent = "BEGIN:VEVENT\r\nUID:uid-utc\r\nSUMMARY:Guest\r\n"
                    + "DTSTART:20260615T230000Z\r\nDTEND:20260620T220000Z\r\nEND:VEVENT\r\n";

            // Act
            ICalEventParser.ParseResult result = ICalEventParser.parse(toStream(buildIcal(vevent)), paris);

            // Assert : pas de decalage d'un jour (risque overbooking)
            assertThat(result.events()).hasSize(1);
            assertThat(result.events().get(0).getDtStart()).isEqualTo(LocalDate.of(2026, 6, 16));
            assertThat(result.events().get(0).getDtEnd()).isEqualTo(LocalDate.of(2026, 6, 21));
        }

        @Test
        void whenUtcDateTimeNearMidnight_thenParseICalDateConvertsToTargetZone() {
            // 23:00Z le 15 : deja le 16 a Paris (UTC+2), encore le 15 a New York (UTC-4)
            assertThat(ICalEventParser.parseICalDate("20260615T230000Z", null, paris))
                    .isEqualTo(LocalDate.of(2026, 6, 16));
            assertThat(ICalEventParser.parseICalDate("20260615T230000Z", null, ZoneId.of("America/New_York")))
                    .isEqualTo(LocalDate.of(2026, 6, 15));
        }

        @Test
        void whenTzidParameterPresent_thenWallTimeInterpretedInThatZone() {
            // Arrange : 23:00 a New York (UTC-4 en ete) le 15 = 05:00 a Paris le 16
            String vevent = "BEGIN:VEVENT\r\nUID:uid-tzid\r\nSUMMARY:Guest\r\n"
                    + "DTSTART;TZID=America/New_York:20260615T230000\r\n"
                    + "DTEND;TZID=America/New_York:20260620T230000\r\nEND:VEVENT\r\n";

            // Act
            ICalEventParser.ParseResult result = ICalEventParser.parse(toStream(buildIcal(vevent)), paris);

            // Assert
            assertThat(result.events()).hasSize(1);
            assertThat(result.events().get(0).getDtStart()).isEqualTo(LocalDate.of(2026, 6, 16));
            assertThat(result.events().get(0).getDtEnd()).isEqualTo(LocalDate.of(2026, 6, 21));
        }

        @Test
        void whenExoticTzid_thenConvertedCorrectly() {
            // Pacific/Kiritimati = UTC+14 : 00:30 le 16 la-bas = 12:30 le 15 a Paris
            assertThat(ICalEventParser.parseICalDate("20260616T003000", "Pacific/Kiritimati", paris))
                    .isEqualTo(LocalDate.of(2026, 6, 15));
        }

        @Test
        void whenUnknownTzid_thenFallsBackToWallClockDate() {
            // TZID inconnu : pas d'echec du feed, heure traitee comme flottante
            assertThat(ICalEventParser.parseICalDate("20260615T230000", "Mars/Olympus", paris))
                    .isEqualTo(LocalDate.of(2026, 6, 15));
        }

        @Test
        void whenFloatingDateTime_thenDatePartKeptAsPropertyLocal() {
            // Ni 'Z' ni TZID : heure murale presumee locale au logement
            assertThat(ICalEventParser.parseICalDate("20260615T230000", null, paris))
                    .isEqualTo(LocalDate.of(2026, 6, 15));
        }

        @Test
        void whenPureDateValue_thenNeverShiftedByZone() {
            // VALUE=DATE = date civile : jamais convertie, quel que soit le fuseau cible
            assertThat(ICalEventParser.parseICalDate("20260615", null, ZoneId.of("Pacific/Kiritimati")))
                    .isEqualTo(LocalDate.of(2026, 6, 15));
        }

        @Test
        void whenTimePartUnreadable_thenFallsBackToDatePart() {
            // Heure malformee : repli sur la partie date (comportement historique, pas d'echec)
            assertThat(ICalEventParser.parseICalDate("20260615Tgarbage", null, paris))
                    .isEqualTo(LocalDate.of(2026, 6, 15));
        }
    }
}
