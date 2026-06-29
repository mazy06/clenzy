-- users.first_name / last_name portent le ciphertext AES (EncryptedFieldConverter), bien plus long
-- que le texte clair (≤50 car validé par @Size). L'entité ne fixait pas de longueur de colonne, si bien
-- qu'Hibernate dimensionnait sur le @Size → varchar(50), trop court (WARN ddl-auto au boot dev :
-- « value too long for type character varying(50) »). On aligne sur la convention des PII chiffrées
-- (Guest = varchar(500), cf. 0047) : élargissement sûr (aucune perte, la donnée existante tient).
ALTER TABLE users ALTER COLUMN first_name TYPE VARCHAR(500);
ALTER TABLE users ALTER COLUMN last_name TYPE VARCHAR(500);
