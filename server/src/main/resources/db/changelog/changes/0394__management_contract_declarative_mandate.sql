-- Mandat DÉCLARATIF, à côté du mandat de gestion.
--
-- Le contrat savait répartir l'argent (encaissement, commission, frais OTA) et
-- le périmètre opérationnel (réservations, ménage, maintenance). Il ne disait
-- rien du déclaratif : la conciergerie télédéclarait avec SES identifiants pour
-- tous les biens de son périmètre, y compris ceux de propriétaires tiers, sans
-- qu'aucune trace n'établisse qu'elle y était autorisée. Un propriétaire qui
-- contestait une déclaration faite en son nom ne trouvait aucune pièce en face.
--
-- Trois champs, une obligation chacun, même vocabulaire que ota_fee_borne_by
-- (AGENCY | OWNER). Défaut AGENCY partout : l'existant ne change pas de
-- comportement, le choix devient explicite à la prochaine signature.
ALTER TABLE management_contracts
    ADD COLUMN IF NOT EXISTS police_declaration_by VARCHAR(20) NOT NULL DEFAULT 'AGENCY';
ALTER TABLE management_contracts
    ADD COLUMN IF NOT EXISTS tourist_tax_by VARCHAR(20) NOT NULL DEFAULT 'AGENCY';
ALTER TABLE management_contracts
    ADD COLUMN IF NOT EXISTS licence_held_by VARCHAR(20) NOT NULL DEFAULT 'AGENCY';

-- La fiche de police enregistre AU TITRE DE QUEL MANDAT elle a été soumise :
-- c'est la pièce qui manquait pour rendre la déclaration opposable.
ALTER TABLE guest_declarations
    ADD COLUMN IF NOT EXISTS management_contract_id BIGINT;
