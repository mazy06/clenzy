package com.clenzy.service;

import com.clenzy.dto.amenity.*;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.*;
import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.dto.ChannexFacilityOptionDto;
import com.clenzy.repository.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Service de gestion des commodites OTA :
 *
 * <ul>
 *   <li><b>Aggregate</b> : liste les amenities OTA brutes detectees sur les
 *       properties de l'org, sans alias ni ignored existant.</li>
 *   <li><b>CRUD</b> : alias, custom amenities, ignored amenities.</li>
 *   <li><b>Reprocess</b> : applique les aliases + ignored a toutes les
 *       properties (fait migrer les raw_amenities vers amenities mappes).</li>
 * </ul>
 *
 * <p>Ne contient AUCUNE logique de scrape ou d'integration OTA — c'est
 * orthogonal a {@code ChannexImportService} qui injecte ce service pour
 * appliquer les aliases au moment de l'import.</p>
 */
@Service
public class AmenityManagementService {

    private static final Logger log = LoggerFactory.getLogger(AmenityManagementService.class);
    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};
    private static final Pattern NON_ALNUM = Pattern.compile("[^A-Z0-9]+");

    private final CustomAmenityRepository customAmenityRepository;
    private final AmenityAliasRepository aliasRepository;
    private final IgnoredAmenityRepository ignoredRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final ChannexClient channexClient;

    /** Cache simple en memoire du catalogue Channex facilities (180+ items statiques). */
    private volatile List<ChannexFacilityOptionDto> cachedChannexFacilities;
    private volatile long cachedChannexFacilitiesAt;
    private static final long CHANNEX_FACILITIES_CACHE_MS = 60L * 60 * 1000; // 1h

    public AmenityManagementService(CustomAmenityRepository customAmenityRepository,
                                      AmenityAliasRepository aliasRepository,
                                      IgnoredAmenityRepository ignoredRepository,
                                      PropertyRepository propertyRepository,
                                      UserRepository userRepository,
                                      ObjectMapper objectMapper,
                                      ChannexClient channexClient) {
        this.customAmenityRepository = customAmenityRepository;
        this.aliasRepository = aliasRepository;
        this.ignoredRepository = ignoredRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
        this.channexClient = channexClient;
    }

    // ─── Catalog Channex (suggestions pour les CustomAmenity) ────────────────

    /**
     * Retourne le catalogue global Channex des facilities (~180 entries
     * standards : Wi-Fi, Free Parking, Pool, etc.). Cache 1h en memoire pour
     * eviter d'appeler Channex a chaque fois (catalogue tres stable).
     *
     * <p>Sert a alimenter l'UI de mapping : quand l'admin cree une
     * CustomAmenity, il peut taper "Smoke alarm" et avoir une suggestion
     * autocomplete depuis ce catalogue (label standardise).</p>
     */
    public List<ChannexFacilityOptionDto> listChannexFacilityCatalog() {
        long now = System.currentTimeMillis();
        if (cachedChannexFacilities != null
            && (now - cachedChannexFacilitiesAt) < CHANNEX_FACILITIES_CACHE_MS) {
            return cachedChannexFacilities;
        }
        try {
            var fresh = channexClient.fetchPropertyFacilityCatalog();
            if (fresh != null && !fresh.isEmpty()) {
                cachedChannexFacilities = fresh;
                cachedChannexFacilitiesAt = now;
            }
            return fresh != null ? fresh : List.of();
        } catch (Exception e) {
            log.debug("Channex facility catalog KO : {}", e.getMessage());
            return cachedChannexFacilities != null ? cachedChannexFacilities : List.of();
        }
    }

    // ─── Aggregate "unmapped" ───────────────────────────────────────────────

    /**
     * Agregre toutes les amenities brutes des properties de l'org en filtrant
     * celles qui ont deja un alias ou sont ignorees. Retourne une liste
     * triee par frequence DESC (les plus communes en haut).
     */
    @Transactional(readOnly = true)
    public List<UnmappedAmenityDto> findUnmapped(Long orgId) {
        Set<String> aliasedLower = aliasRepository.findByOrganizationIdOrderByRawOtaNameAsc(orgId).stream()
            .map(a -> a.getRawOtaName().toLowerCase().trim())
            .collect(Collectors.toSet());
        Set<String> ignoredLower = ignoredRepository.findByOrganizationIdOrderByRawOtaNameAsc(orgId).stream()
            .map(i -> i.getRawOtaName().toLowerCase().trim())
            .collect(Collectors.toSet());

        // Aggregation : raw_name → { count, [property refs] }
        Map<String, AggregateEntry> agg = new HashMap<>();
        List<Property> props = propertyRepository.findByOrgWithRawAmenities(orgId);
        for (Property p : props) {
            List<String> raws = parseJsonList(p.getOtaRawAmenities());
            for (String raw : raws) {
                String lower = raw.toLowerCase().trim();
                if (aliasedLower.contains(lower) || ignoredLower.contains(lower)) continue;
                agg.computeIfAbsent(raw, k -> new AggregateEntry()).add(p);
            }
        }

        return agg.entrySet().stream()
            .map(e -> new UnmappedAmenityDto(
                e.getKey(),
                e.getValue().count,
                e.getValue().properties.stream()
                    .limit(5)
                    .map(p -> new UnmappedAmenityDto.PropertyRef(p.getId(), p.getName()))
                    .toList(),
                // Source OTA inconnue ici (on ne stocke pas le mapping per-property).
                // On peut deviner via les mappings Channex mais c'est best-effort.
                List.of("OTA")
            ))
            .sorted((a, b) -> Integer.compare(b.occurrences(), a.occurrences()))
            .toList();
    }

    private static class AggregateEntry {
        int count = 0;
        List<Property> properties = new ArrayList<>();
        void add(Property p) { count++; properties.add(p); }
    }

    // ─── Custom Amenities CRUD ──────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<CustomAmenityDto> listCustomAmenities(Long orgId) {
        return customAmenityRepository.findByOrganizationIdOrderByLabelFrAsc(orgId).stream()
            .map(this::toDto).toList();
    }

    @Transactional
    public CustomAmenityDto createCustomAmenity(Long orgId, String requesterKeycloakId,
                                                  CreateCustomAmenityRequest req) {
        // Slugify code si non fourni
        String code = (req.code() != null && !req.code().isBlank())
            ? req.code().trim().toUpperCase()
            : slugifyCode(req.labelFr());
        if (customAmenityRepository.existsByOrganizationIdAndCode(orgId, code)) {
            throw new IllegalArgumentException("Une commodite avec le code " + code + " existe deja.");
        }
        CustomAmenity ca = new CustomAmenity();
        ca.setOrganizationId(orgId);
        ca.setCode(code);
        ca.setLabelFr(req.labelFr().trim());
        ca.setLabelEn(req.labelEn() != null && !req.labelEn().isBlank() ? req.labelEn().trim() : null);
        ca.setCategory(req.category() != null && !req.category().isBlank() ? req.category() : "custom");
        if (requesterKeycloakId != null) {
            userRepository.findByKeycloakId(requesterKeycloakId).ifPresent(ca::setCreatedBy);
        }
        ca = customAmenityRepository.save(ca);
        log.info("Amenity: created custom code={} org={}", code, orgId);

        // Cree un alias automatique si demande (cas typique : "je cree
        // SMOKE_ALARM et je veux que 'Smoke alarm' OTA y soit automatiquement
        // mappe").
        if (req.createAliasForRaw() != null && !req.createAliasForRaw().isBlank()) {
            CreateAliasRequest aliasReq = new CreateAliasRequest(
                req.createAliasForRaw().trim(), code, null, req.applyToProperties());
            try {
                createAlias(orgId, requesterKeycloakId, aliasReq);
            } catch (IllegalArgumentException e) {
                log.warn("Amenity: alias auto KO (deja existant ?) raw={} : {}",
                    req.createAliasForRaw(), e.getMessage());
            }
        }
        return toDto(ca);
    }

    @Transactional
    public void deleteCustomAmenity(Long orgId, Long id) {
        CustomAmenity ca = customAmenityRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("Custom amenity " + id + " introuvable"));
        if (!Objects.equals(ca.getOrganizationId(), orgId)) {
            throw new SecurityException("Cette custom amenity n'appartient pas a votre organisation.");
        }
        // Supprimer les aliases qui pointaient dessus (cleanup orphelins)
        List<AmenityAlias> related = aliasRepository.findByOrganizationIdAndClenzyCode(orgId, ca.getCode());
        if (!related.isEmpty()) {
            aliasRepository.deleteAll(related);
            log.info("Amenity: removed {} aliases pointing to deleted custom code={}",
                related.size(), ca.getCode());
        }
        customAmenityRepository.delete(ca);
    }

    // ─── Aliases CRUD ───────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<AmenityAliasDto> listAliases(Long orgId) {
        return aliasRepository.findByOrganizationIdOrderByRawOtaNameAsc(orgId).stream()
            .map(this::toDto).toList();
    }

    @Transactional
    public AmenityAliasDto createAlias(Long orgId, String requesterKeycloakId, CreateAliasRequest req) {
        if (aliasRepository.existsByOrganizationIdAndRawOtaName(orgId, req.rawOtaName().trim())) {
            throw new IllegalArgumentException(
                "Un alias existe deja pour le nom OTA : " + req.rawOtaName());
        }
        AmenityAlias a = new AmenityAlias();
        a.setOrganizationId(orgId);
        a.setRawOtaName(req.rawOtaName().trim());
        a.setClenzyCode(req.clenzyCode().trim().toUpperCase());
        a.setOtaSource(req.otaSource() != null && !req.otaSource().isBlank() ? req.otaSource() : null);
        if (requesterKeycloakId != null) {
            userRepository.findByKeycloakId(requesterKeycloakId).ifPresent(a::setCreatedBy);
        }
        a = aliasRepository.save(a);
        log.info("Amenity: created alias '{}' → {} org={}", a.getRawOtaName(), a.getClenzyCode(), orgId);
        if (req.applyToProperties()) {
            reprocess(orgId);
        }
        return toDto(a);
    }

    @Transactional
    public ReprocessResult bulkCreateAliases(Long orgId, String requesterKeycloakId,
                                               CreateAliasRequest.BulkRequest req) {
        for (String raw : req.rawOtaNames()) {
            if (raw == null || raw.isBlank()) continue;
            if (aliasRepository.existsByOrganizationIdAndRawOtaName(orgId, raw.trim())) continue;
            AmenityAlias a = new AmenityAlias();
            a.setOrganizationId(orgId);
            a.setRawOtaName(raw.trim());
            a.setClenzyCode(req.clenzyCode().trim().toUpperCase());
            a.setOtaSource(req.otaSource());
            if (requesterKeycloakId != null) {
                userRepository.findByKeycloakId(requesterKeycloakId).ifPresent(a::setCreatedBy);
            }
            aliasRepository.save(a);
        }
        return req.applyToProperties() ? reprocess(orgId) : emptyReprocessResult();
    }

    @Transactional
    public void deleteAlias(Long orgId, Long id) {
        AmenityAlias a = aliasRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("Alias " + id + " introuvable"));
        if (!Objects.equals(a.getOrganizationId(), orgId)) {
            throw new SecurityException("Cet alias n'appartient pas a votre organisation.");
        }
        aliasRepository.delete(a);
    }

    // ─── Ignored CRUD ───────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<IgnoredAmenityDto> listIgnored(Long orgId) {
        return ignoredRepository.findByOrganizationIdOrderByRawOtaNameAsc(orgId).stream()
            .map(this::toDto).toList();
    }

    @Transactional
    public IgnoredAmenityDto createIgnored(Long orgId, String requesterKeycloakId, CreateIgnoredRequest req) {
        if (ignoredRepository.existsByOrganizationIdAndRawOtaName(orgId, req.rawOtaName().trim())) {
            throw new IllegalArgumentException("Deja marque comme ignore : " + req.rawOtaName());
        }
        IgnoredAmenity i = new IgnoredAmenity();
        i.setOrganizationId(orgId);
        i.setRawOtaName(req.rawOtaName().trim());
        i.setOtaSource(req.otaSource());
        if (requesterKeycloakId != null) {
            userRepository.findByKeycloakId(requesterKeycloakId).ifPresent(i::setCreatedBy);
        }
        i = ignoredRepository.save(i);
        if (req.applyToProperties()) {
            reprocess(orgId);
        }
        return toDto(i);
    }

    @Transactional
    public void deleteIgnored(Long orgId, Long id) {
        IgnoredAmenity i = ignoredRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("Ignored " + id + " introuvable"));
        if (!Objects.equals(i.getOrganizationId(), orgId)) {
            throw new SecurityException("Cet ignored n'appartient pas a votre organisation.");
        }
        ignoredRepository.delete(i);
    }

    // ─── Reprocess ──────────────────────────────────────────────────────────

    /**
     * Pour chaque property de l'org ayant des raw amenities :
     * <ol>
     *   <li>Lit la liste raw</li>
     *   <li>Pour chaque raw : si alias existe → ajoute le code a amenities ;
     *       si ignored → skip ; sinon → reste dans raw</li>
     *   <li>Met a jour properties.amenities + properties.ota_raw_amenities</li>
     * </ol>
     */
    @Transactional
    public ReprocessResult reprocess(Long orgId) {
        Map<String, String> aliasMap = aliasRepository.findByOrganizationIdOrderByRawOtaNameAsc(orgId)
            .stream().collect(Collectors.toMap(
                a -> a.getRawOtaName().toLowerCase().trim(),
                AmenityAlias::getClenzyCode));
        Set<String> ignoredSet = ignoredRepository.findByOrganizationIdOrderByRawOtaNameAsc(orgId)
            .stream().map(i -> i.getRawOtaName().toLowerCase().trim())
            .collect(Collectors.toSet());

        List<Property> props = propertyRepository.findByOrgWithRawAmenities(orgId);
        int scanned = 0, updated = 0;
        int totalRaw = 0, totalMapped = 0, totalIgnored = 0, totalLeft = 0;

        for (Property p : props) {
            scanned++;
            List<String> raws = parseJsonList(p.getOtaRawAmenities());
            totalRaw += raws.size();

            // Codes deja sur la property (preservation)
            Set<String> currentAmenities = new LinkedHashSet<>(parseJsonList(p.getAmenities()));
            List<String> remainingRaw = new ArrayList<>();
            int addedHere = 0, ignoredHere = 0;

            for (String raw : raws) {
                String lower = raw.toLowerCase().trim();
                if (ignoredSet.contains(lower)) {
                    ignoredHere++;
                    continue;
                }
                String code = aliasMap.get(lower);
                if (code != null) {
                    if (currentAmenities.add(code)) addedHere++;
                } else {
                    remainingRaw.add(raw);
                }
            }

            boolean changed = (addedHere > 0 || ignoredHere > 0
                || remainingRaw.size() != raws.size());
            if (changed) {
                try {
                    p.setAmenities(currentAmenities.isEmpty()
                        ? null
                        : objectMapper.writeValueAsString(currentAmenities));
                    p.setOtaRawAmenities(remainingRaw.isEmpty()
                        ? null
                        : objectMapper.writeValueAsString(remainingRaw));
                    propertyRepository.save(p);
                    updated++;
                    totalMapped += addedHere;
                    totalIgnored += ignoredHere;
                } catch (Exception e) {
                    log.warn("Amenity reprocess: serialisation KO property={} : {}",
                        p.getId(), e.getMessage());
                }
            }
            totalLeft += remainingRaw.size();
        }
        log.info("Amenity reprocess org={} : scanned={} updated={} mapped={} ignored={} left={}",
            orgId, scanned, updated, totalMapped, totalIgnored, totalLeft);
        return new ReprocessResult(scanned, updated, totalRaw, totalMapped, totalIgnored, totalLeft);
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    /**
     * Public : lookup case-insensitive raw → code. Utilise par
     * {@code ChannexImportService} au moment de l'import pour appliquer
     * les aliases avant de stocker en raw.
     */
    @Transactional(readOnly = true)
    public Map<String, String> loadAliasesByOrg(Long orgId) {
        return aliasRepository.findByOrganizationIdOrderByRawOtaNameAsc(orgId).stream()
            .collect(Collectors.toMap(
                a -> a.getRawOtaName().toLowerCase().trim(),
                AmenityAlias::getClenzyCode,
                (a, b) -> a));
    }

    /** Public : lookup ignored. */
    @Transactional(readOnly = true)
    public Set<String> loadIgnoredByOrg(Long orgId) {
        return ignoredRepository.findByOrganizationIdOrderByRawOtaNameAsc(orgId).stream()
            .map(i -> i.getRawOtaName().toLowerCase().trim())
            .collect(Collectors.toSet());
    }

    private List<String> parseJsonList(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, STRING_LIST);
        } catch (Exception e) {
            log.debug("parseJsonList KO : {}", e.getMessage());
            return List.of();
        }
    }

    /**
     * Transforme un label en code SCREAMING_SNAKE_CASE.
     * Ex : "Détecteur de fumée" → "DETECTEUR_DE_FUMEE"
     */
    private static String slugifyCode(String label) {
        String normalized = Normalizer.normalize(label, Normalizer.Form.NFD)
            .replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
            .toUpperCase();
        String slug = NON_ALNUM.matcher(normalized).replaceAll("_");
        // Trim underscores aux extremites
        slug = slug.replaceAll("^_+|_+$", "");
        return slug.isEmpty() ? "CUSTOM_" + System.currentTimeMillis() : slug;
    }

    private CustomAmenityDto toDto(CustomAmenity ca) {
        String email = null;
        try { email = ca.getCreatedBy() != null ? ca.getCreatedBy().getEmail() : null; }
        catch (Exception ignored) {}
        return new CustomAmenityDto(ca.getId(), ca.getCode(), ca.getLabelFr(),
            ca.getLabelEn(), ca.getCategory(), ca.getCreatedAt(), email);
    }

    private AmenityAliasDto toDto(AmenityAlias a) {
        String email = null;
        try { email = a.getCreatedBy() != null ? a.getCreatedBy().getEmail() : null; }
        catch (Exception ignored) {}
        return new AmenityAliasDto(a.getId(), a.getRawOtaName(), a.getClenzyCode(),
            a.getOtaSource(), a.getCreatedAt(), email);
    }

    private IgnoredAmenityDto toDto(IgnoredAmenity i) {
        return new IgnoredAmenityDto(i.getId(), i.getRawOtaName(),
            i.getOtaSource(), i.getCreatedAt());
    }

    private static ReprocessResult emptyReprocessResult() {
        return new ReprocessResult(0, 0, 0, 0, 0, 0);
    }
}
