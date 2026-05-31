package com.clenzy.dto;

import com.clenzy.model.Prospect;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ProspectDtoTest {

    @Test
    void recordAccessors_returnAllConstructorValues() {
        ProspectDto dto = new ProspectDto(
                1L,
                "Acme Corp",
                "contact@acme.com",
                "+33123456789",
                "Paris",
                "Conciergerie premium",
                "CONCIERGERIES",
                "TO_CONTACT",
                "Lead chaud",
                "https://acme.com",
                "https://linkedin.com/company/acme",
                "1M-5M EUR",
                "10-50"
        );

        assertEquals(1L, dto.id());
        assertEquals("Acme Corp", dto.name());
        assertEquals("contact@acme.com", dto.email());
        assertEquals("+33123456789", dto.phone());
        assertEquals("Paris", dto.city());
        assertEquals("Conciergerie premium", dto.specialty());
        assertEquals("CONCIERGERIES", dto.category());
        assertEquals("TO_CONTACT", dto.status());
        assertEquals("Lead chaud", dto.notes());
        assertEquals("https://acme.com", dto.website());
        assertEquals("https://linkedin.com/company/acme", dto.linkedIn());
        assertEquals("1M-5M EUR", dto.revenue());
        assertEquals("10-50", dto.employees());
    }

    @Test
    void fromEntity_mapsAllFields() {
        Prospect p = new Prospect();
        p.setId(42L);
        p.setName("Beta Cleaning");
        p.setEmail("hello@beta.com");
        p.setPhone("0102030405");
        p.setCity("Lyon");
        p.setSpecialty("Menage");
        p.setCategory(Prospect.ProspectCategory.MENAGE);
        p.setStatus(Prospect.ProspectStatus.IN_DISCUSSION);
        p.setNotes("Note libre");
        p.setWebsite("https://beta.com");
        p.setLinkedIn("https://linkedin.com/in/beta");
        p.setRevenue("500K");
        p.setEmployees("5");

        ProspectDto dto = ProspectDto.fromEntity(p);

        assertEquals(42L, dto.id());
        assertEquals("Beta Cleaning", dto.name());
        assertEquals("hello@beta.com", dto.email());
        assertEquals("0102030405", dto.phone());
        assertEquals("Lyon", dto.city());
        assertEquals("Menage", dto.specialty());
        assertEquals("MENAGE", dto.category());
        assertEquals("IN_DISCUSSION", dto.status());
        assertEquals("Note libre", dto.notes());
        assertEquals("https://beta.com", dto.website());
        assertEquals("https://linkedin.com/in/beta", dto.linkedIn());
        assertEquals("500K", dto.revenue());
        assertEquals("5", dto.employees());
    }

    @Test
    void fromEntity_nullCategory_returnsNullCategory() {
        Prospect p = new Prospect();
        p.setName("X");
        p.setStatus(Prospect.ProspectStatus.PARTNER);
        // category not set

        ProspectDto dto = ProspectDto.fromEntity(p);

        assertNull(dto.category());
        assertEquals("PARTNER", dto.status());
    }

    @Test
    void fromEntity_nullStatus_returnsNullStatus() {
        Prospect p = new Prospect();
        p.setName("X");
        p.setCategory(Prospect.ProspectCategory.ARTISANS);
        p.setStatus(null);

        ProspectDto dto = ProspectDto.fromEntity(p);

        assertEquals("ARTISANS", dto.category());
        assertNull(dto.status());
    }

    @Test
    void fromEntity_allEnumValues_mappedToString() {
        for (Prospect.ProspectCategory cat : Prospect.ProspectCategory.values()) {
            Prospect p = new Prospect();
            p.setName("X");
            p.setCategory(cat);
            p.setStatus(Prospect.ProspectStatus.TO_CONTACT);
            ProspectDto dto = ProspectDto.fromEntity(p);
            assertEquals(cat.name(), dto.category());
        }
        for (Prospect.ProspectStatus st : Prospect.ProspectStatus.values()) {
            Prospect p = new Prospect();
            p.setName("X");
            p.setCategory(Prospect.ProspectCategory.BLANCHISSERIES);
            p.setStatus(st);
            ProspectDto dto = ProspectDto.fromEntity(p);
            assertEquals(st.name(), dto.status());
        }
    }
}
