package com.clenzy.service;

import com.clenzy.dto.ICalImportDto.ICalEventPreview;
import net.fortuna.ical4j.data.CalendarBuilder;
import net.fortuna.ical4j.data.ParserException;
import net.fortuna.ical4j.model.Calendar;
import net.fortuna.ical4j.model.Component;
import net.fortuna.ical4j.model.component.VEvent;
import net.fortuna.ical4j.model.property.Description;
import net.fortuna.ical4j.model.property.DtEnd;
import net.fortuna.ical4j.model.property.DtStart;
import net.fortuna.ical4j.model.property.Summary;
import net.fortuna.ical4j.model.property.Uid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses iCal (RFC 5545) content into {@link ICalEventPreview} DTOs.
 * Handles VEVENT extraction, date parsing (DATE and DATE-TIME formats),
 * guest name / confirmation code extraction from SUMMARY, and nights calculation.
 */
public final class ICalEventParser {

    private static final Logger log = LoggerFactory.getLogger(ICalEventParser.class);

    // Pattern for extracting guest name and confirmation code from SUMMARY
    // e.g. "John Doe (HMXXXXXXXX)" or "Reservation - John Doe"
    private static final Pattern SUMMARY_GUEST_PATTERN =
            Pattern.compile("^(.+?)\\s*\\(([A-Z0-9]+)\\)$");

    private static final Pattern DESCRIPTION_NIGHTS_PATTERN =
            Pattern.compile("NIGHTS:\\s*(\\d+)", Pattern.CASE_INSENSITIVE);

    /** Maximum number of VEVENTs to parse from a single feed (DoS protection). */
    private static final int MAX_EVENTS_PER_FEED = 5000;

    private ICalEventParser() {}

    /**
     * Parses an iCal input stream into a sorted list of event previews.
     * Events are sorted by start date ascending (nulls last).
     *
     * @param inputStream the iCal content stream (caller is responsible for size-limiting)
     * @return sorted list of parsed events; events without DTSTART are excluded
     * @throws RuntimeException wrapping {@link ParserException} or {@link IOException}
     */
    public static List<ICalEventPreview> parseEvents(InputStream inputStream) {
        try {
            CalendarBuilder builder = new CalendarBuilder();
            Calendar calendar = builder.build(inputStream);
            return extractEvents(calendar);
        } catch (ParserException e) {
            log.error("Erreur parsing iCal: {}", e.getMessage());
            throw new RuntimeException("Format de calendrier iCal invalide : " + e.getMessage());
        } catch (IOException e) {
            log.error("Erreur lecture iCal: {}", e.getMessage());
            throw new RuntimeException("Impossible de lire le calendrier iCal : " + e.getMessage());
        }
    }

    /**
     * Extracts VEVENT components from a parsed Calendar, enforcing the event limit.
     */
    private static List<ICalEventPreview> extractEvents(Calendar calendar) {
        var allVEvents = calendar.getComponents(Component.VEVENT);
        if (allVEvents.size() > MAX_EVENTS_PER_FEED) {
            throw new IllegalArgumentException(
                    "Le fichier iCal contient trop d'evenements (" + allVEvents.size()
                            + "). Maximum autorise : " + MAX_EVENTS_PER_FEED + ".");
        }

        List<ICalEventPreview> events = new ArrayList<>();
        int eventCount = 0;

        for (Object component : allVEvents) {
            if (++eventCount > MAX_EVENTS_PER_FEED) {
                log.warn("Feed iCal depasse la limite de {} evenements, troncature", MAX_EVENTS_PER_FEED);
                break;
            }
            VEvent vevent = (VEvent) component;
            ICalEventPreview preview = parseVEvent(vevent);
            if (preview != null) {
                events.add(preview);
            }
        }

        // Sort by start date ascending
        events.sort(Comparator.comparing(
                ICalEventPreview::getDtStart, Comparator.nullsLast(Comparator.naturalOrder())));

        return events;
    }

    /**
     * Parses a single VEVENT into an {@link ICalEventPreview}.
     *
     * @return the parsed preview, or {@code null} if the event has no DTSTART
     */
    private static ICalEventPreview parseVEvent(VEvent vevent) {
        ICalEventPreview preview = new ICalEventPreview();

        // UID
        Uid uid = vevent.getUid();
        if (uid != null) {
            preview.setUid(uid.getValue());
        }

        // SUMMARY
        Summary summary = vevent.getSummary();
        String summaryText = summary != null ? summary.getValue() : "";
        preview.setSummary(summaryText);

        // All iCal entries are treated as reservations
        preview.setType("reservation");

        // Extract guest name and confirmation code from SUMMARY
        Matcher matcher = SUMMARY_GUEST_PATTERN.matcher(summaryText.trim());
        if (matcher.matches()) {
            preview.setGuestName(matcher.group(1).trim());
            preview.setConfirmationCode(matcher.group(2).trim());
        } else if (!summaryText.isBlank()) {
            preview.setGuestName(summaryText.trim());
        }

        // DTSTART
        parseDtStart(vevent, preview);

        // DTEND
        parseDtEnd(vevent, preview);

        // DESCRIPTION
        parseDescription(vevent, preview);

        // Calculate nights if not found in description
        if (preview.getNights() == 0 && preview.getDtStart() != null && preview.getDtEnd() != null) {
            preview.setNights((int) (preview.getDtEnd().toEpochDay() - preview.getDtStart().toEpochDay()));
        }

        // Ignore events without dates
        if (preview.getDtStart() == null) {
            return null;
        }

        return preview;
    }

    private static void parseDtStart(VEvent vevent, ICalEventPreview preview) {
        DtStart dtStart = vevent.getStartDate();
        if (dtStart == null) return;
        try {
            preview.setDtStart(parseICalDate(dtStart.getValue()));
        } catch (Exception e) {
            log.warn("Impossible de parser DTSTART: {}", dtStart.getValue());
        }
    }

    private static void parseDtEnd(VEvent vevent, ICalEventPreview preview) {
        DtEnd dtEnd = vevent.getEndDate();
        if (dtEnd == null) return;
        try {
            preview.setDtEnd(parseICalDate(dtEnd.getValue()));
        } catch (Exception e) {
            log.warn("Impossible de parser DTEND: {}", dtEnd.getValue());
        }
    }

    private static void parseDescription(VEvent vevent, ICalEventPreview preview) {
        Description description = vevent.getDescription();
        if (description == null) return;

        preview.setDescription(description.getValue());

        // Parse nights count from description
        Matcher nightsMatcher = DESCRIPTION_NIGHTS_PATTERN.matcher(description.getValue());
        if (nightsMatcher.find()) {
            preview.setNights(Integer.parseInt(nightsMatcher.group(1)));
        }
    }

    /**
     * Parses an iCal date string in either DATE (yyyyMMdd) or DATE-TIME format.
     * For DATE-TIME, only the date portion is extracted.
     */
    private static LocalDate parseICalDate(String dateStr) {
        if (dateStr.length() == 8) {
            return LocalDate.parse(dateStr, DateTimeFormatter.BASIC_ISO_DATE);
        }
        // DATE-TIME: extract the first 8 characters as the date part
        return LocalDate.parse(dateStr.substring(0, 8), DateTimeFormatter.BASIC_ISO_DATE);
    }
}
