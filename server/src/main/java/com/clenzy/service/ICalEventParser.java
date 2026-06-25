package com.clenzy.service;

import com.clenzy.dto.ICalImportDto.ICalEventPreview;
import net.fortuna.ical4j.data.CalendarBuilder;
import net.fortuna.ical4j.data.ParserException;
import net.fortuna.ical4j.model.Calendar;
import net.fortuna.ical4j.model.Component;
import net.fortuna.ical4j.model.Parameter;
import net.fortuna.ical4j.model.Property;
import net.fortuna.ical4j.model.component.VEvent;
import net.fortuna.ical4j.model.property.Description;
import net.fortuna.ical4j.model.property.DtEnd;
import net.fortuna.ical4j.model.property.DtStart;
import net.fortuna.ical4j.model.property.Status;
import net.fortuna.ical4j.model.property.Summary;
import net.fortuna.ical4j.model.property.Uid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses iCal (RFC 5545) content into {@link ICalEventPreview} DTOs.
 * Handles VEVENT extraction, date parsing (DATE and DATE-TIME formats,
 * timezone-aware — voir {@link #parseICalDate(String, String, ZoneId)}),
 * guest name / confirmation code extraction from SUMMARY, and nights calculation.
 *
 * <p>Les variantes {@code parse(stream, propertyZone)} permettent a l'appelant de
 * fournir la timezone du logement : les DATE-TIME UTC ('Z') ou TZID y sont alors
 * convertis avant extraction de la date (Z6-SECBUGS-04, anti-overbooking). Sans
 * zone fournie, repli trace sur la timezone systeme.</p>
 */
public final class ICalEventParser {

    private static final Logger log = LoggerFactory.getLogger(ICalEventParser.class);

    // Pattern for extracting guest name and confirmation code from SUMMARY
    // e.g. "John Doe (HMXXXXXXXX)" or "Reservation - John Doe"
    private static final Pattern SUMMARY_GUEST_PATTERN =
            Pattern.compile("^(.+?)\\s*\\(([A-Z0-9]+)\\)$");

    private static final Pattern DESCRIPTION_NIGHTS_PATTERN =
            Pattern.compile("NIGHTS:\\s*(\\d+)", Pattern.CASE_INSENSITIVE);

    /**
     * Mots-cles indiquant un blocage de calendrier (pas une vraie reservation).
     * Ces evenements sont ignores a l'import.
     */
    private static final Set<String> BLOCKED_KEYWORDS = Set.of(
            "not available", "unavailable", "blocked", "closed", "airbnb (not available)"
    );

    /** Maximum number of VEVENTs to parse from a single feed (DoS protection). */
    private static final int MAX_EVENTS_PER_FEED = 5000;

    /** Partie heure d'un DATE-TIME iCal (RFC 5545 : HHMMSS). */
    private static final DateTimeFormatter ICAL_TIME = DateTimeFormatter.ofPattern("HHmmss");

    private ICalEventParser() {}

    /**
     * Resultat detaille du parsing d'un feed iCal.
     *
     * @param events           evenements valides, tries par date de debut croissante
     * @param unparsableEvents nombre d'evenements ecartes (DTSTART manquant ou non parsable) —
     *                         remonte dans le resultat de sync pour eviter toute perte silencieuse
     * @param unparsableUids   UID des evenements ecartes (quand present) : a exclure de la
     *                         detection d'orphelins pour ne pas annuler une reservation legitime
     * @param recurringEvents  nombre d'evenements porteurs d'une RRULE/RDATE — non expanses,
     *                         seule l'occurrence maitre est traitee (limite documentee)
     */
    public record ParseResult(List<ICalEventPreview> events,
                              int unparsableEvents,
                              Set<String> unparsableUids,
                              int recurringEvents) {}

    /**
     * Parses an iCal input stream into a sorted list of event previews.
     * Events are sorted by start date ascending (nulls last).
     * Retro-compatible : prefer {@link #parse(InputStream)} pour obtenir le comptage
     * des evenements ecartes (dates non parsables) et recurrents.
     *
     * @param inputStream the iCal content stream (caller is responsible for size-limiting)
     * @return sorted list of parsed events; events without DTSTART are excluded
     * @throws RuntimeException wrapping {@link ParserException} or {@link IOException}
     */
    public static List<ICalEventPreview> parseEvents(InputStream inputStream) {
        return parse(inputStream).events();
    }

    /**
     * Variante zone-aware de {@link #parseEvents(InputStream)} : les DATE-TIME
     * sont convertis vers {@code propertyZone} avant extraction de la date.
     */
    public static List<ICalEventPreview> parseEvents(InputStream inputStream, ZoneId propertyZone) {
        return parse(inputStream, propertyZone).events();
    }

    /**
     * Parses an iCal input stream into a {@link ParseResult} carrying both the valid
     * events and the counters of discarded/recurring events (no silent loss).
     * Les DATE-TIME (UTC 'Z' ou TZID) sont convertis vers la timezone systeme
     * (repli trace) : prefer {@link #parse(InputStream, ZoneId)} avec la timezone
     * du logement quand elle est connue de l'appelant.
     *
     * @throws RuntimeException wrapping {@link ParserException} or {@link IOException}
     */
    public static ParseResult parse(InputStream inputStream) {
        return parse(inputStream, null);
    }

    /**
     * Variante zone-aware (Z6-SECBUGS-04) : un DTSTART/DTEND en DATE-TIME UTC
     * ('Z') ou TZID proche de minuit est converti vers {@code propertyZone}
     * avant extraction de la date, evitant un decalage d'un jour (overbooking).
     *
     * @param propertyZone timezone du logement ; si {@code null}, repli trace
     *                     sur la timezone systeme
     * @throws RuntimeException wrapping {@link ParserException} or {@link IOException}
     */
    public static ParseResult parse(InputStream inputStream, ZoneId propertyZone) {
        ZoneId targetZone = resolveTargetZone(propertyZone);
        try {
            CalendarBuilder builder = new CalendarBuilder();
            Calendar calendar = builder.build(inputStream);
            return extractEvents(calendar, targetZone);
        } catch (ParserException e) {
            log.error("Erreur parsing iCal: {}", e.getMessage());
            throw new RuntimeException("Format de calendrier iCal invalide : " + e.getMessage());
        } catch (IOException e) {
            log.error("Erreur lecture iCal: {}", e.getMessage());
            throw new RuntimeException("Impossible de lire le calendrier iCal : " + e.getMessage());
        }
    }

    /** Zone cible des conversions DATE-TIME : celle du logement, sinon repli systeme trace. */
    private static ZoneId resolveTargetZone(ZoneId propertyZone) {
        if (propertyZone != null) {
            return propertyZone;
        }
        ZoneId systemZone = ZoneId.systemDefault();
        log.debug("Timezone du logement non fournie : les DATE-TIME iCal seront convertis vers la timezone systeme {}",
                systemZone);
        return systemZone;
    }

    /**
     * Extracts VEVENT components from a parsed Calendar, enforcing the event limit.
     * Les evenements sans DTSTART exploitable sont comptes (et leur UID collecte)
     * au lieu d'etre perdus silencieusement ; les RRULE/RDATE sont detectees et
     * comptees — ical4j n'est pas utilise pour les expanser car les reservations
     * OTA ne sont jamais recurrentes et une expansion partagerait le meme UID
     * entre occurrences (cassant dedup et detection d'orphelins).
     */
    private static ParseResult extractEvents(Calendar calendar, ZoneId targetZone) {
        var allVEvents = calendar.getComponents(Component.VEVENT);
        if (allVEvents.size() > MAX_EVENTS_PER_FEED) {
            throw new IllegalArgumentException(
                    "Le fichier iCal contient trop d'evenements (" + allVEvents.size()
                            + "). Maximum autorise : " + MAX_EVENTS_PER_FEED + ".");
        }

        List<ICalEventPreview> events = new ArrayList<>();
        int unparsableEvents = 0;
        Set<String> unparsableUids = new LinkedHashSet<>();
        int recurringEvents = 0;

        for (Object component : allVEvents) {
            VEvent vevent = (VEvent) component;
            if (hasRecurrence(vevent)) {
                recurringEvents++;
                log.warn("Evenement iCal recurrent (RRULE/RDATE) non expanse (uid={}) : seule l'occurrence maitre est traitee",
                        uidOf(vevent));
            }
            ICalEventPreview preview = parseVEvent(vevent, targetZone);
            if (preview == null) {
                continue; // blocage calendrier ("Not available", "Blocked"...) : ignore volontairement
            }
            if (preview.getDtStart() == null) {
                unparsableEvents++;
                if (preview.getUid() != null) {
                    unparsableUids.add(preview.getUid());
                }
                log.warn("Evenement iCal ignore (DTSTART manquant ou non parsable), uid={}", preview.getUid());
                continue;
            }
            events.add(preview);
        }

        // Sort by start date ascending
        events.sort(Comparator.comparing(
                ICalEventPreview::getDtStart, Comparator.nullsLast(Comparator.naturalOrder())));

        return new ParseResult(events, unparsableEvents, unparsableUids, recurringEvents);
    }

    /** Detecte une regle de recurrence (RRULE ou RDATE) sur un VEVENT. */
    private static boolean hasRecurrence(VEvent vevent) {
        return vevent.getProperty(Property.RRULE) != null
                || vevent.getProperty(Property.RDATE) != null;
    }

    /** UID d'un VEVENT pour les logs (jamais l'URL du feed — elle contient un token). */
    private static String uidOf(VEvent vevent) {
        Uid uid = vevent.getUid();
        return uid != null ? uid.getValue() : null;
    }

    /**
     * Parses a single VEVENT into an {@link ICalEventPreview}.
     * Un preview avec {@code dtStart == null} (DTSTART manquant ou non parsable)
     * est ecarte et compte par {@link #extractEvents(Calendar)}.
     *
     * @return the parsed preview, or {@code null} if the event is a calendar block
     */
    private static ICalEventPreview parseVEvent(VEvent vevent, ZoneId targetZone) {
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

        // Blocage de calendrier (ex: "Airbnb (Not available)", "Blocked", SUMMARY vide) :
        // ce n'est pas une reservation mais une plage rendue indisponible cote OTA. On
        // l'emet avec type="blocked" + ses dates afin de le reconcilier en CalendarDay
        // BLOCKED a l'import (visible au planning ET au booking engine Clenzy). On
        // n'extrait ni guest ni code de confirmation : non pertinents pour un blocage.
        if (isBlockedEvent(summaryText)) {
            preview.setType("blocked");
            parseDtStart(vevent, preview, targetZone);
            parseDtEnd(vevent, preview, targetZone);
            return preview;
        }

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
        parseDtStart(vevent, preview, targetZone);

        // DTEND
        parseDtEnd(vevent, preview, targetZone);

        // DESCRIPTION
        parseDescription(vevent, preview);

        // STATUS (RFC 5545: TENTATIVE, CONFIRMED, CANCELLED)
        parseStatus(vevent, preview);

        // Calculate nights if not found in description
        if (preview.getNights() == 0 && preview.getDtStart() != null && preview.getDtEnd() != null) {
            preview.setNights((int) (preview.getDtEnd().toEpochDay() - preview.getDtStart().toEpochDay()));
        }

        return preview;
    }

    private static void parseDtStart(VEvent vevent, ICalEventPreview preview, ZoneId targetZone) {
        DtStart dtStart = vevent.getStartDate();
        if (dtStart == null) return;
        try {
            preview.setDtStart(parseICalDate(dtStart.getValue(), tzidOf(dtStart), targetZone));
        } catch (Exception e) {
            log.warn("Impossible de parser DTSTART (uid={}): {}", preview.getUid(), e.getMessage());
        }
    }

    private static void parseDtEnd(VEvent vevent, ICalEventPreview preview, ZoneId targetZone) {
        DtEnd dtEnd = vevent.getEndDate();
        if (dtEnd == null) return;
        try {
            preview.setDtEnd(parseICalDate(dtEnd.getValue(), tzidOf(dtEnd), targetZone));
        } catch (Exception e) {
            log.warn("Impossible de parser DTEND (uid={}): {}", preview.getUid(), e.getMessage());
        }
    }

    /** Valeur du parametre TZID d'une propriete iCal, ou {@code null} si absent. */
    private static String tzidOf(Property property) {
        Parameter tzid = property.getParameter(Parameter.TZID);
        return tzid != null ? tzid.getValue() : null;
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
     * Maps the iCal STATUS property to our reservation status.
     * RFC 5545 VEVENT STATUS: TENTATIVE, CONFIRMED, CANCELLED.
     * If absent, status remains null (caller decides default).
     */
    private static void parseStatus(VEvent vevent, ICalEventPreview preview) {
        Status status = (Status) vevent.getProperty("STATUS");
        if (status == null) return;
        String value = status.getValue();
        if (value == null) return;
        switch (value.toUpperCase()) {
            case "CONFIRMED":
                preview.setStatus("confirmed");
                break;
            case "TENTATIVE":
                preview.setStatus("pending");
                break;
            case "CANCELLED":
                preview.setStatus("cancelled");
                break;
            default:
                log.debug("Statut iCal inconnu: {}", value);
                break;
        }
    }

    /**
     * Retro-compatible : delegue a {@link #parseICalDate(String, String, ZoneId)}
     * sans TZID, avec la timezone systeme comme zone cible.
     */
    static LocalDate parseICalDate(String dateStr) {
        return parseICalDate(dateStr, null, ZoneId.systemDefault());
    }

    /**
     * Parse une valeur de date iCal (RFC 5545) en {@link LocalDate} en respectant
     * le fuseau (Z6-SECBUGS-04). Semantique par forme :
     * <ul>
     *   <li><b>DATE</b> ({@code VALUE=DATE}, 8 caracteres "yyyyMMdd") : date civile
     *       sans fuseau, retournee telle quelle — convention OTA des nuitees en date
     *       locale du logement, jamais convertie ;</li>
     *   <li><b>DATE-TIME UTC</b> (suffixe 'Z', ex. "20260615T230000Z") : instant UTC
     *       converti vers {@code targetZone} avant extraction de la date — evite le
     *       decalage d'un jour pres de minuit (risque overbooking) ;</li>
     *   <li><b>DATE-TIME avec TZID</b> (parametre {@code TZID=...} de la propriete
     *       iCal) : heure murale interpretee dans la zone TZID puis convertie vers
     *       {@code targetZone} ;</li>
     *   <li><b>DATE-TIME flottant</b> (ni 'Z' ni TZID) : heure murale presumee locale
     *       au logement, partie date extraite sans conversion.</li>
     * </ul>
     * Replis robustes (le feed ne doit pas echouer) : TZID inconnu ou partie heure
     * illisible → trace en WARN et partie date conservee telle quelle.
     * Package-private pour les tests : une valeur plus courte que 8 caracteres leve
     * une IllegalArgumentException explicite (et non une
     * StringIndexOutOfBoundsException issue du substring).
     *
     * @param dateStr    valeur brute de la propriete iCal (DTSTART/DTEND)
     * @param tzid       valeur du parametre TZID de la propriete, ou {@code null}
     * @param targetZone timezone cible (logement si connue, sinon systeme)
     */
    static LocalDate parseICalDate(String dateStr, String tzid, ZoneId targetZone) {
        if (dateStr == null || dateStr.length() < 8) {
            throw new IllegalArgumentException("Valeur de date iCal invalide (longueur "
                    + (dateStr == null ? 0 : dateStr.length()) + " < 8)");
        }
        LocalDate datePart = LocalDate.parse(dateStr.substring(0, 8), DateTimeFormatter.BASIC_ISO_DATE);

        int timeSeparator = dateStr.indexOf('T');
        if (timeSeparator < 0) {
            return datePart; // forme DATE (VALUE=DATE) : date civile, aucune conversion
        }

        boolean utc = dateStr.endsWith("Z");
        LocalTime time = parseTimePart(dateStr, timeSeparator, utc);
        if (time == null) {
            return datePart; // partie heure illisible : repli sur la partie date
        }

        LocalDateTime wallTime = LocalDateTime.of(datePart, time);
        if (utc) {
            LocalDate converted = wallTime.atZone(ZoneOffset.UTC).withZoneSameInstant(targetZone).toLocalDate();
            traceConversion("UTC", dateStr, targetZone, datePart, converted);
            return converted;
        }
        if (tzid != null && !tzid.isBlank()) {
            return convertFromTzid(dateStr, tzid, wallTime, targetZone, datePart);
        }
        return datePart; // DATE-TIME flottant : heure murale presumee locale au logement
    }

    /** Partie heure (HHMMSS) d'un DATE-TIME, ou {@code null} si illisible (repli trace). */
    private static LocalTime parseTimePart(String dateStr, int timeSeparator, boolean utc) {
        String timePart = dateStr.substring(timeSeparator + 1, utc ? dateStr.length() - 1 : dateStr.length());
        try {
            return LocalTime.parse(timePart, ICAL_TIME);
        } catch (DateTimeParseException e) {
            log.warn("Partie heure iCal illisible ({}) : repli sur la partie date", dateStr);
            return null;
        }
    }

    /** Convertit une heure murale TZID vers la zone cible ; TZID inconnu = repli trace. */
    private static LocalDate convertFromTzid(String dateStr, String tzid, LocalDateTime wallTime,
                                             ZoneId targetZone, LocalDate datePart) {
        ZoneId sourceZone;
        try {
            sourceZone = ZoneId.of(tzid);
        } catch (DateTimeException e) {
            log.warn("TZID iCal inconnu '{}' ({}) : heure traitee comme flottante, partie date conservee",
                    tzid, dateStr);
            return datePart;
        }
        LocalDate converted = wallTime.atZone(sourceZone).withZoneSameInstant(targetZone).toLocalDate();
        traceConversion("TZID=" + tzid, dateStr, targetZone, datePart, converted);
        return converted;
    }

    private static void traceConversion(String sourceZoneLabel, String dateStr, ZoneId targetZone,
                                        LocalDate datePart, LocalDate converted) {
        if (!converted.equals(datePart)) {
            log.debug("DATE-TIME {} '{}' converti vers {} : {} -> {}",
                    sourceZoneLabel, dateStr, targetZone, datePart, converted);
        }
    }

    /**
     * Determine si un evenement iCal est un blocage de calendrier (pas une vraie reservation).
     * Exemples : "Airbnb (Not available)", "Not available", "Blocked".
     */
    private static boolean isBlockedEvent(String summary) {
        if (summary == null || summary.isBlank()) {
            return true; // Pas de SUMMARY = pas une reservation
        }
        String lower = summary.trim().toLowerCase();
        return BLOCKED_KEYWORDS.stream().anyMatch(lower::contains);
    }
}
