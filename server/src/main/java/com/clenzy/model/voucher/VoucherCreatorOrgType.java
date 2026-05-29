package com.clenzy.model.voucher;

/**
 * Type d'organisation creatrice d'un voucher.
 *
 * <p>Determine les regles d'autorisation au moment de la creation :</p>
 * <ul>
 *   <li>{@link #HOST} : proprietaire du logement. Toujours autorise sur SES
 *       properties.</li>
 *   <li>{@link #MANAGEMENT_ORG} : conciergerie qui gere les properties d'un
 *       ou plusieurs hosts. Autorise UNIQUEMENT si :
 *       <ol>
 *         <li>{@code organization.has_voucher_contract = true} (contrat signe
 *             avec Baitly)</li>
 *         <li>{@code property.org_can_create_vouchers = true} pour CHAQUE
 *             property cible (consentement explicite du host pour ce
 *             logement)</li>
 *       </ol>
 *   </li>
 * </ul>
 */
public enum VoucherCreatorOrgType {
    HOST,
    MANAGEMENT_ORG
}
