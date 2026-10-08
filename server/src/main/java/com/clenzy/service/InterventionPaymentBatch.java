package com.clenzy.service;

/** Source distincte : une session de lot ne doit jamais suivre la confirmation unitaire. */
public final class InterventionPaymentBatch {
    public static final String SOURCE_TYPE = "INTERVENTION_BATCH";
    private InterventionPaymentBatch() {}

    /** Valide l'intégralité du lot, jamais une somme partielle ni des métadonnées client. */
    public static void validate(com.clenzy.model.PaymentTransaction tx,
            java.util.List<com.clenzy.model.InterventionPaymentAllocation> allocations) {
        require(SOURCE_TYPE.equals(tx.getSourceType()) && tx.getOrganizationId() != null
                && tx.getPaymentType() == com.clenzy.model.TransactionType.CHECKOUT
                && tx.getProviderType() == com.clenzy.model.PaymentProviderType.STRIPE,
                "Transaction de lot invalide");
        require(tx.getAmount() != null && tx.getAmount().signum() > 0
                && tx.getCurrency() != null && tx.getCurrency().matches("[A-Z]{3}"), "Montant ou devise du lot invalide");
        Object rawIds = tx.getMetadata() == null ? null : tx.getMetadata().get("interventionIds");
        require(rawIds instanceof String, "Interventions du lot absentes");
        var expected = new java.util.TreeSet<Long>();
        for (String raw : ((String) rawIds).split(",", -1)) {
            long id;
            try { id = Long.parseLong(raw); } catch (NumberFormatException ex) { throw new IllegalStateException("Lot invalide", ex); }
            require(id > 0 && Long.toString(id).equals(raw) && expected.add(id), "Identifiants du lot invalides");
        }
        require(expected.contains(tx.getSourceId()), "Intervention principale absente");
        var actual = new java.util.TreeSet<Long>();
        var total = java.math.BigDecimal.ZERO;
        for (var part : allocations) {
            require(java.util.Objects.equals(tx.getOrganizationId(), part.getOrganizationId())
                    && java.util.Objects.equals(tx.getTransactionRef(), part.getTransaction().getTransactionRef())
                    && tx.getCurrency().equals(part.getCurrency()) && part.getAmount().signum() > 0
                    && actual.add(part.getInterventionId()), "Répartition du lot incohérente");
            total = total.add(part.getAmount());
        }
        require(expected.equals(actual) && total.compareTo(tx.getAmount()) == 0, "Répartition du lot incomplète");
    }

    static void require(boolean valid, String message) {
        if (!valid) throw new IllegalStateException(message);
    }
}
