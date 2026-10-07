package com.clenzy.model;

/** Le bénéficiaire légal est une personne OU une organisation, jamais un membre d'équipe implicite. */
public record PayoutBeneficiary(Long userId, Long organizationId) {
    public PayoutBeneficiary {
        if ((userId == null) == (organizationId == null)
                || userId != null && userId <= 0 || organizationId != null && organizationId <= 0) {
            throw new IllegalArgumentException("Un bénéficiaire unique et valide est requis.");
        }
    }
    public static PayoutBeneficiary user(Long id) { return new PayoutBeneficiary(id, null); }
    public static PayoutBeneficiary organization(Long id) { return new PayoutBeneficiary(null, id); }
}
