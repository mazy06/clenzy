package com.clenzy.model;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class PendingInscriptionTest {

    @Test
    void defaults_organizationTypeBillingPeriodStatus() {
        PendingInscription p = new PendingInscription();
        assertEquals("INDIVIDUAL", p.getOrganizationType());
        assertEquals("MONTHLY", p.getBillingPeriod());
        assertEquals(PendingInscriptionStatus.PENDING_PAYMENT, p.getStatus());
        assertFalse(p.isNewsletterOptIn());
    }

    @Test
    void settersAndGetters_basicFields() {
        PendingInscription p = new PendingInscription();
        p.setId(99L);
        p.setFirstName("Jean");
        p.setLastName("Dupont");
        p.setEmail("jean@example.com");
        p.setPassword("hash");
        p.setPhoneNumber("+33600000000");
        p.setCompanyName("Acme");
        p.setOrganizationType("COMPANY");
        p.setForfait("PRO");

        assertEquals(99L, p.getId());
        assertEquals("Jean", p.getFirstName());
        assertEquals("Dupont", p.getLastName());
        assertEquals("jean@example.com", p.getEmail());
        assertEquals("hash", p.getPassword());
        assertEquals("+33600000000", p.getPhoneNumber());
        assertEquals("Acme", p.getCompanyName());
        assertEquals("COMPANY", p.getOrganizationType());
        assertEquals("PRO", p.getForfait());
    }

    @Test
    void settersAndGetters_devisFields() {
        PendingInscription p = new PendingInscription();
        p.setCity("Paris");
        p.setPostalCode("75001");
        p.setPropertyType("apartment");
        p.setPropertyCount(3);
        p.setSurface(120);
        p.setGuestCapacity(6);
        p.setBookingFrequency("weekly");
        p.setCleaningSchedule("after_each");
        p.setCalendarSync("airbnb");
        p.setServices("photos,linens");
        p.setServicesDevis("maintenance");
        p.setBillingPeriod("YEARLY");

        assertEquals("Paris", p.getCity());
        assertEquals("75001", p.getPostalCode());
        assertEquals("apartment", p.getPropertyType());
        assertEquals(3, p.getPropertyCount());
        assertEquals(120, p.getSurface());
        assertEquals(6, p.getGuestCapacity());
        assertEquals("weekly", p.getBookingFrequency());
        assertEquals("after_each", p.getCleaningSchedule());
        assertEquals("airbnb", p.getCalendarSync());
        assertEquals("photos,linens", p.getServices());
        assertEquals("maintenance", p.getServicesDevis());
        assertEquals("YEARLY", p.getBillingPeriod());
    }

    @Test
    void settersAndGetters_gdprAndStripe() {
        PendingInscription p = new PendingInscription();
        LocalDateTime now = LocalDateTime.now();
        p.setAcceptedTermsAt(now);
        p.setNewsletterOptIn(true);
        p.setPromoCode("WELCOME10");
        p.setReferralSource("google");
        p.setConfirmationTokenHash("sha-hash");
        p.setStripeSessionId("cs_test");
        p.setStripeCustomerId("cus_x");
        p.setStripeSubscriptionId("sub_x");
        p.setStatus(PendingInscriptionStatus.PAYMENT_CONFIRMED);
        p.setCreatedAt(now);
        p.setExpiresAt(now.plusHours(1));

        assertEquals(now, p.getAcceptedTermsAt());
        assertTrue(p.isNewsletterOptIn());
        assertEquals("WELCOME10", p.getPromoCode());
        assertEquals("google", p.getReferralSource());
        assertEquals("sha-hash", p.getConfirmationTokenHash());
        assertEquals("cs_test", p.getStripeSessionId());
        assertEquals("cus_x", p.getStripeCustomerId());
        assertEquals("sub_x", p.getStripeSubscriptionId());
        assertEquals(PendingInscriptionStatus.PAYMENT_CONFIRMED, p.getStatus());
        assertEquals(now, p.getCreatedAt());
        assertEquals(now.plusHours(1), p.getExpiresAt());
    }

    @Test
    void getFullName_concatenatesFirstAndLast() {
        PendingInscription p = new PendingInscription();
        p.setFirstName("Marie");
        p.setLastName("Curie");
        assertEquals("Marie Curie", p.getFullName());
    }

    @Test
    void toString_includesIdEmailForfaitStatus() {
        PendingInscription p = new PendingInscription();
        p.setId(1L);
        p.setEmail("test@example.com");
        p.setForfait("STARTER");
        p.setStripeSessionId("cs_123");
        String s = p.toString();
        assertTrue(s.contains("id=1"));
        assertTrue(s.contains("email='test@example.com'"));
        assertTrue(s.contains("forfait='STARTER'"));
        // PendingInscriptionStatus overrides toString() to a French display name
        assertTrue(s.contains("status=En attente de paiement"));
        assertTrue(s.contains("stripeSessionId='cs_123'"));
    }
}
