package com.clenzy.service;

import com.clenzy.dto.ProspectDto;
import com.clenzy.model.Prospect;
import com.clenzy.model.Prospect.ProspectCategory;
import com.clenzy.model.Prospect.ProspectStatus;
import com.clenzy.repository.ProspectRepository;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Transactional
public class ProspectService {

    private static final Logger log = LoggerFactory.getLogger(ProspectService.class);

    private final ProspectRepository prospectRepository;
    private final TenantContext tenantContext;

    public ProspectService(ProspectRepository prospectRepository, TenantContext tenantContext) {
        this.prospectRepository = prospectRepository;
        this.tenantContext = tenantContext;
    }

    // ─── Read ───────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ProspectDto> getAll() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return prospectRepository.findByOrganizationId(orgId)
            .stream()
            .map(ProspectDto::fromEntity)
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ProspectDto> getByCategory(ProspectCategory category) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return prospectRepository.findByOrganizationIdAndCategory(orgId, category)
            .stream()
            .map(ProspectDto::fromEntity)
            .collect(Collectors.toList());
    }

    // ─── Update ─────────────────────────────────────────────────────────────────

    public ProspectDto update(Long id, ProspectDto dto) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Prospect prospect = prospectRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Prospect introuvable: " + id));

        if (!prospect.getOrganizationId().equals(orgId)) {
            throw new SecurityException("Acces refuse");
        }

        if (dto.name() != null) prospect.setName(dto.name());
        if (dto.email() != null) prospect.setEmail(dto.email());
        if (dto.phone() != null) prospect.setPhone(dto.phone());
        if (dto.city() != null) prospect.setCity(dto.city());
        if (dto.specialty() != null) prospect.setSpecialty(dto.specialty());
        if (dto.status() != null) {
            prospect.setStatus(ProspectStatus.valueOf(dto.status()));
        }
        if (dto.notes() != null) prospect.setNotes(dto.notes());
        if (dto.website() != null) prospect.setWebsite(dto.website());
        if (dto.linkedIn() != null) prospect.setLinkedIn(dto.linkedIn());
        if (dto.revenue() != null) prospect.setRevenue(dto.revenue());
        if (dto.employees() != null) prospect.setEmployees(dto.employees());

        return ProspectDto.fromEntity(prospectRepository.save(prospect));
    }

    // ─── Delete ─────────────────────────────────────────────────────────────────

    public void delete(Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Prospect prospect = prospectRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Prospect introuvable: " + id));

        if (!prospect.getOrganizationId().equals(orgId)) {
            throw new SecurityException("Acces refuse");
        }

        prospectRepository.delete(prospect);
    }

    // ─── CSV Import ─────────────────────────────────────────────────────────────

    /**
     * Importe un fichier CSV Vibe Prospecting.
     * Le CSV est au format standard avec en-tetes en premiere ligne.
     * Colonnes attendues (flexibles) : business_name, domain, city, linkedin_url,
     * number_of_employees_range, revenue_range, linkedin_categories, etc.
     *
     * @param file     fichier CSV uploade
     * @param category categorie de prospect
     * @return nombre de prospects importes
     */
    public int importFromCsv(MultipartFile file, ProspectCategory category) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        List<Prospect> prospects = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {

            String headerLine = reader.readLine();
            if (headerLine == null) {
                throw new IllegalArgumentException("Fichier CSV vide");
            }

            // Parse header → index mapping
            String[] headers = parseCsvLine(headerLine);
            Map<String, Integer> headerMap = new java.util.HashMap<>();
            for (int i = 0; i < headers.length; i++) {
                headerMap.put(headers[i].trim().toLowerCase(), i);
            }

            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) continue;

                String[] values = parseCsvLine(line);
                Prospect p = new Prospect();
                p.setOrganizationId(orgId);
                p.setCategory(category);
                p.setStatus(ProspectStatus.TO_CONTACT);

                // Nom : business_name ou name
                p.setName(getCsvValue(values, headerMap, "business_name", "name", "company_name"));

                if (p.getName() == null || p.getName().isBlank()) {
                    continue; // skip lignes sans nom
                }

                // Email
                p.setEmail(getCsvValue(values, headerMap, "email", "contact_email", "business_email"));

                // Telephone
                p.setPhone(getCsvValue(values, headerMap, "phone", "phone_number", "telephone"));

                // Ville
                p.setCity(getCsvValue(values, headerMap, "city", "headquarters_city", "location"));

                // Specialite (linkedin_categories ou industry)
                p.setSpecialty(getCsvValue(values, headerMap, "linkedin_categories", "industry", "specialty", "naics_labels"));

                // Site web
                String website = getCsvValue(values, headerMap, "domain", "website", "website_url");
                if (website != null && !website.isBlank() && !website.startsWith("http")) {
                    website = "https://" + website;
                }
                p.setWebsite(website);

                // LinkedIn
                p.setLinkedIn(getCsvValue(values, headerMap, "linkedin_url", "linkedin", "linkedin_company_url"));

                // Revenue
                p.setRevenue(getCsvValue(values, headerMap, "revenue_range", "revenue", "annual_revenue"));

                // Employes
                p.setEmployees(getCsvValue(values, headerMap, "number_of_employees_range", "employees", "employee_count", "company_size"));

                prospects.add(p);
            }

        } catch (java.io.IOException e) {
            throw new RuntimeException("Erreur lors de la lecture du fichier CSV", e);
        }

        if (!prospects.isEmpty()) {
            prospectRepository.saveAll(prospects);
            log.info("Imported {} prospects in category {} for org {}", prospects.size(), category, orgId);
        }

        return prospects.size();
    }

    // ─── CSV Helpers ────────────────────────────────────────────────────────────

    /**
     * Parse une ligne CSV en gerant les champs entre guillemets.
     */
    private String[] parseCsvLine(String line) {
        List<String> result = new ArrayList<>();
        boolean inQuotes = false;
        StringBuilder current = new StringBuilder();

        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                inQuotes = !inQuotes;
            } else if (c == ',' && !inQuotes) {
                result.add(current.toString().trim());
                current = new StringBuilder();
            } else {
                current.append(c);
            }
        }
        result.add(current.toString().trim());

        return result.toArray(new String[0]);
    }

    /**
     * Cherche la premiere colonne correspondante parmi plusieurs noms possibles.
     */
    private String getCsvValue(String[] values, Map<String, Integer> headerMap, String... possibleNames) {
        for (String name : possibleNames) {
            Integer idx = headerMap.get(name.toLowerCase());
            if (idx != null && idx < values.length) {
                String val = values[idx].trim();
                if (!val.isEmpty() && !val.equalsIgnoreCase("null")) {
                    return val;
                }
            }
        }
        return null;
    }
}
