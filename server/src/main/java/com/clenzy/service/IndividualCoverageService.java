package com.clenzy.service;

import com.clenzy.marketplace.model.MarketplaceProviderZone;
import com.clenzy.marketplace.repository.MarketplaceProviderZoneRepository;
import com.clenzy.repository.UserRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Locale;

/** Une déclaration géographique par personne, quel que soit le client courant. */
@Service
public class IndividualCoverageService {
    private final MarketplaceProviderZoneRepository zones;
    private final UserRepository users;
    private final PersonalTeamService personalTeams;

    public IndividualCoverageService(MarketplaceProviderZoneRepository zones, UserRepository users, PersonalTeamService personalTeams) {
        this.zones = zones; this.users = users; this.personalTeams = personalTeams;
    }

    @Transactional(readOnly = true)
    public List<Zone> getMine(String subject) { return read(owner(subject)); }

    @Transactional
    public List<Zone> replace(String subject, List<Input> inputs) {
        if (inputs == null || inputs.size() > 100) throw new IllegalArgumentException("Liste de zones invalide");
        for (Input input : inputs) {
            if (input == null || input.country() == null || !input.country().trim().matches("[a-zA-Z]{2}")
                || tooLong(input.department(), 3) || tooLong(input.arrondissement(), 5) || tooLong(input.city(), 100))
                throw new IllegalArgumentException("Zone invalide");
            if ("FR".equalsIgnoreCase(input.country().trim()) ? blank(input.department()) : blank(input.city()))
                throw new IllegalArgumentException("Indiquez un département en France ou une ville dans les autres pays");
        }
        Long userId = owner(subject);
        // L'équipe représente la personne dans l'org, mais ne possède pas ses zones.
        personalTeams.getOrCreate(userId);
        zones.lockIndividual(userId);
        zones.initializeIndividual(userId);
        zones.deleteIndividualZones(userId);
        int position = 0;
        for (Input input : inputs.stream().distinct().toList()) {
            var zone = new MarketplaceProviderZone(); zone.setUserId(userId);
            zone.setCountryCode(input.country().trim().toUpperCase(Locale.ROOT));
            zone.setDepartment(clean(input.department())); zone.setArrondissement(clean(input.arrondissement()));
            zone.setCity(clean(input.city())); zone.setPrimary(position++ == 0);
            zones.save(zone);
        }
        zones.flush();
        return read(userId);
    }

    private List<Zone> read(Long userId) {
        return zones.findByUserIdOrderByIdAsc(userId).stream().map(z ->
            new Zone(z.getId(), z.getCountryCode(), z.getDepartment(), z.getArrondissement(), z.getCity())).toList();
    }
    private Long owner(String subject) {
        if (subject == null || subject.isBlank()) throw new AccessDeniedException("Identité requise");
        return users.findByKeycloakId(subject).orElseThrow(() -> new AccessDeniedException("Compte introuvable")).getId();
    }
    private static boolean blank(String value) { return value == null || value.isBlank(); }
    private static boolean tooLong(String value, int max) { return value != null && value.trim().length() > max; }
    private static String clean(String value) { return blank(value) ? null : value.trim(); }
    public record Input(String country, String department, String arrondissement, String city) {}
    public record Zone(Long id, String country, String department, String arrondissement, String city) {}
}
