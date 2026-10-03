-- Taxe de séjour MAROC — référentiel plateforme (aucun organization_id, hors filtre tenant).
--
-- Aucun jeu de données public des tarifs par commune n'existe. La loi fixe des FOURCHETTES
-- par catégorie et chaque commune arrête son tarif par arrêté fiscal :
--   * loi 47-06, art. 73 (B.O. 5584 du 03/12/2007), modifiée par la loi 07-20 (dahir
--     1-20-91 du 31/12/2020, B.O. 6948) qui étend la taxe aux « autres formes
--     d'hébergement touristique » — dont les logements loués aux touristes via les
--     plateformes — catégorie « riads et maisons louées aux touristes » : 10 à 25 DH ;
--   * enfants de moins de 12 ans exonérés (art. 71), versement trimestriel (art. 76).
-- Lignes chargées :
--   * fourchettes légales (city_key = '*'), valables partout — verified : texte de loi ;
--   * tarifs exacts de villes : arrêtés ou pages communales officielles (verified = true),
--     ou sources non officielles (presse, guides) explicitement marquées verified = false.
-- Le barème d'un logement reste DÉCLARÉ et confirmé par l'opérateur : ce référentiel ne
-- fait que le suggérer, l'opérateur le corrige s'il est absent, faux ou approximatif.
CREATE TABLE IF NOT EXISTS ma_tourist_tax_rates (
    id           BIGSERIAL PRIMARY KEY,
    city_key     VARCHAR(80)   NOT NULL,
    city_label   VARCHAR(120)  NOT NULL,
    category     VARCHAR(40)   NOT NULL,
    min_rate     NUMERIC(8, 2),
    max_rate     NUMERIC(8, 2),
    rate         NUMERIC(8, 2),
    source_label VARCHAR(300)  NOT NULL,
    source_url   VARCHAR(500),
    as_of        DATE,
    verified     BOOLEAN       NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_ma_tourist_tax_rates UNIQUE (city_key, category)
);

-- Fourchettes légales (MAD par personne et par nuit), art. 73 modifié par la loi 07-20.
INSERT INTO ma_tourist_tax_rates (city_key, city_label, category, min_rate, max_rate, source_label, source_url, as_of, verified) VALUES
('*', 'Maroc (fourchette légale)', 'MAISON_HOTES',          15, 30, 'Loi 47-06 art. 73 modifiée par la loi 07-20 — maisons d''hôtes, palais des congrès, hôtels de luxe', 'https://rabat.eregulations.org/media/Loi%2047-06%20relative%20aux%20collectivit%C3%A9s%20locales.pdf', '2021-01-01', TRUE),
('*', 'Maroc (fourchette légale)', 'HOTEL_5',               10, 25, 'Loi 47-06 art. 73 modifiée par la loi 07-20', 'https://rabat.eregulations.org/media/Loi%2047-06%20relative%20aux%20collectivit%C3%A9s%20locales.pdf', '2021-01-01', TRUE),
('*', 'Maroc (fourchette légale)', 'HOTEL_4',                5, 10, 'Loi 47-06 art. 73 modifiée par la loi 07-20', 'https://rabat.eregulations.org/media/Loi%2047-06%20relative%20aux%20collectivit%C3%A9s%20locales.pdf', '2021-01-01', TRUE),
('*', 'Maroc (fourchette légale)', 'HOTEL_3',                3,  7, 'Loi 47-06 art. 73 modifiée par la loi 07-20', 'https://rabat.eregulations.org/media/Loi%2047-06%20relative%20aux%20collectivit%C3%A9s%20locales.pdf', '2021-01-01', TRUE),
('*', 'Maroc (fourchette légale)', 'HOTEL_1_2',              2,  5, 'Loi 47-06 art. 73 modifiée par la loi 07-20', 'https://rabat.eregulations.org/media/Loi%2047-06%20relative%20aux%20collectivit%C3%A9s%20locales.pdf', '2021-01-01', TRUE),
('*', 'Maroc (fourchette légale)', 'CLUB',                  10, 25, 'Loi 47-06 art. 73 modifiée par la loi 07-20 — clubs hôteliers', 'https://rabat.eregulations.org/media/Loi%2047-06%20relative%20aux%20collectivit%C3%A9s%20locales.pdf', '2021-01-01', TRUE),
('*', 'Maroc (fourchette légale)', 'RIAD_MAISON',           10, 25, 'Loi 07-20 — riads et maisons louées aux touristes (modèle d''arrêté fiscal 2021)', 'https://www.fctmaroc.com/2021/01/decision%20fiscale%202021.html', '2021-01-01', TRUE),
('*', 'Maroc (fourchette légale)', 'VILLAGE_VACANCES',       5, 10, 'Loi 47-06 art. 73 modifiée par la loi 07-20', 'https://rabat.eregulations.org/media/Loi%2047-06%20relative%20aux%20collectivit%C3%A9s%20locales.pdf', '2021-01-01', TRUE),
('*', 'Maroc (fourchette légale)', 'RESIDENCE_TOURISTIQUE',  3,  7, 'Loi 47-06 art. 73 modifiée par la loi 07-20', 'https://rabat.eregulations.org/media/Loi%2047-06%20relative%20aux%20collectivit%C3%A9s%20locales.pdf', '2021-01-01', TRUE),
('*', 'Maroc (fourchette légale)', 'AUTRES',                 2,  5, 'Loi 47-06 art. 73 modifiée par la loi 07-20 — autres établissements et formes d''hébergement', 'https://rabat.eregulations.org/media/Loi%2047-06%20relative%20aux%20collectivit%C3%A9s%20locales.pdf', '2021-01-01', TRUE)
ON CONFLICT (city_key, category) DO NOTHING;

-- Tarifs communaux publiés par une source OFFICIELLE (site de la commune, arrêté fiscal).
INSERT INTO ma_tourist_tax_rates (city_key, city_label, category, rate, source_label, source_url, as_of, verified) VALUES
('casablanca', 'Casablanca', 'MAISON_HOTES',          30, 'Commune de Casablanca — page officielle « Taxe de séjour »', 'https://www.casablancacity.ma/fr/article/286/taxe-de-sejour', '2026-10-02', TRUE),
('casablanca', 'Casablanca', 'HOTEL_5',               25, 'Commune de Casablanca — page officielle « Taxe de séjour »', 'https://www.casablancacity.ma/fr/article/286/taxe-de-sejour', '2026-10-02', TRUE),
('casablanca', 'Casablanca', 'HOTEL_4',               10, 'Commune de Casablanca — page officielle « Taxe de séjour »', 'https://www.casablancacity.ma/fr/article/286/taxe-de-sejour', '2026-10-02', TRUE),
('casablanca', 'Casablanca', 'HOTEL_3',                7, 'Commune de Casablanca — page officielle « Taxe de séjour »', 'https://www.casablancacity.ma/fr/article/286/taxe-de-sejour', '2026-10-02', TRUE),
('casablanca', 'Casablanca', 'HOTEL_1_2',              5, 'Commune de Casablanca — page officielle « Taxe de séjour »', 'https://www.casablancacity.ma/fr/article/286/taxe-de-sejour', '2026-10-02', TRUE),
('casablanca', 'Casablanca', 'CLUB',                  25, 'Commune de Casablanca — page officielle « Taxe de séjour »', 'https://www.casablancacity.ma/fr/article/286/taxe-de-sejour', '2026-10-02', TRUE),
('casablanca', 'Casablanca', 'VILLAGE_VACANCES',       5, 'Commune de Casablanca — page officielle « Taxe de séjour » (stations balnéaires)', 'https://www.casablancacity.ma/fr/article/286/taxe-de-sejour', '2026-10-02', TRUE),
('casablanca', 'Casablanca', 'RESIDENCE_TOURISTIQUE',  7, 'Commune de Casablanca — page officielle « Taxe de séjour »', 'https://www.casablancacity.ma/fr/article/286/taxe-de-sejour', '2026-10-02', TRUE),
('casablanca', 'Casablanca', 'AUTRES',                 4, 'Commune de Casablanca — page officielle « Taxe de séjour »', 'https://www.casablancacity.ma/fr/article/286/taxe-de-sejour', '2026-10-02', TRUE),
('khemisset',  'Khémisset',  'MAISON_HOTES',          15, 'Commune de Khémisset — arrêté fiscal modificatif n° 363 du 18/02/2021', 'https://www.communekhemisset.ma/sites/default/files/inline-files/%D8%A7%D9%84%D9%82%D8%B1%D8%A7%D8%B1%20%D8%A7%D9%84%D8%AC%D8%A8%D8%A7%D8%A6%D9%8A.pdf', '2021-02-18', TRUE),
('khemisset',  'Khémisset',  'HOTEL_5',               10, 'Commune de Khémisset — arrêté fiscal modificatif n° 363 du 18/02/2021', 'https://www.communekhemisset.ma/sites/default/files/inline-files/%D8%A7%D9%84%D9%82%D8%B1%D8%A7%D8%B1%20%D8%A7%D9%84%D8%AC%D8%A8%D8%A7%D8%A6%D9%8A.pdf', '2021-02-18', TRUE),
('khemisset',  'Khémisset',  'HOTEL_4',                7, 'Commune de Khémisset — arrêté fiscal modificatif n° 363 du 18/02/2021', 'https://www.communekhemisset.ma/sites/default/files/inline-files/%D8%A7%D9%84%D9%82%D8%B1%D8%A7%D8%B1%20%D8%A7%D9%84%D8%AC%D8%A8%D8%A7%D8%A6%D9%8A.pdf', '2021-02-18', TRUE),
('khemisset',  'Khémisset',  'HOTEL_3',                5, 'Commune de Khémisset — arrêté fiscal modificatif n° 363 du 18/02/2021', 'https://www.communekhemisset.ma/sites/default/files/inline-files/%D8%A7%D9%84%D9%82%D8%B1%D8%A7%D8%B1%20%D8%A7%D9%84%D8%AC%D8%A8%D8%A7%D8%A6%D9%8A.pdf', '2021-02-18', TRUE),
('khemisset',  'Khémisset',  'HOTEL_1_2',              3, 'Commune de Khémisset — arrêté fiscal modificatif n° 363 du 18/02/2021', 'https://www.communekhemisset.ma/sites/default/files/inline-files/%D8%A7%D9%84%D9%82%D8%B1%D8%A7%D8%B1%20%D8%A7%D9%84%D8%AC%D8%A8%D8%A7%D8%A6%D9%8A.pdf', '2021-02-18', TRUE),
('khemisset',  'Khémisset',  'RESIDENCE_TOURISTIQUE',  3, 'Commune de Khémisset — arrêté fiscal modificatif n° 363 du 18/02/2021', 'https://www.communekhemisset.ma/sites/default/files/inline-files/%D8%A7%D9%84%D9%82%D8%B1%D8%A7%D8%B1%20%D8%A7%D9%84%D8%AC%D8%A8%D8%A7%D8%A6%D9%8A.pdf', '2021-02-18', TRUE),
('khemisset',  'Khémisset',  'AUTRES',                 2, 'Commune de Khémisset — arrêté fiscal modificatif n° 363 du 18/02/2021', 'https://www.communekhemisset.ma/sites/default/files/inline-files/%D8%A7%D9%84%D9%82%D8%B1%D8%A7%D8%B1%20%D8%A7%D9%84%D8%AC%D8%A8%D8%A7%D8%A6%D9%8A.pdf', '2021-02-18', TRUE)
ON CONFLICT (city_key, category) DO NOTHING;

-- Tarifs relevés par des sources NON officielles (presse, guides) : à confirmer auprès de
-- la commune. Proposés faute de mieux, jamais présentés comme vérifiés.
INSERT INTO ma_tourist_tax_rates (city_key, city_label, category, rate, source_label, source_url, as_of, verified) VALUES
('marrakech', 'Marrakech', 'RIAD_MAISON',   10, 'Source non officielle (guide en ligne) — à confirmer auprès de la commune de Marrakech', 'https://www.legalstay.ma/blog/taxe-sejour-maroc-location-meublee', '2026-10-02', FALSE),
('marrakech', 'Marrakech', 'MAISON_HOTES',  15, 'Source non officielle (guide en ligne) — à confirmer auprès de la commune de Marrakech', 'https://www.legalstay.ma/blog/taxe-sejour-maroc-location-meublee', '2026-10-02', FALSE),
('fes',       'Fès',       'RIAD_MAISON',   10, 'Source non officielle (presse) — à confirmer auprès de la commune de Fès', 'https://leseco.ma/business/fes-la-commune-elargit-son-assiette-fiscale.html', '2026-10-02', FALSE),
('fes',       'Fès',       'RESIDENCE_TOURISTIQUE', 7, 'Source non officielle (presse) — à confirmer auprès de la commune de Fès', 'https://leseco.ma/business/fes-la-commune-elargit-son-assiette-fiscale.html', '2026-10-02', FALSE),
('fes',       'Fès',       'MAISON_HOTES',  30, 'Source non officielle (presse) — à confirmer auprès de la commune de Fès', 'https://leseco.ma/business/fes-la-commune-elargit-son-assiette-fiscale.html', '2026-10-02', FALSE),
('agadir',    'Agadir',    'RIAD_MAISON',   15, 'Source non officielle (guide en ligne) — à confirmer auprès de la commune d''Agadir', 'https://www.kribos.com/blog/taxe-sejour-maroc-calcul-declaration-hebergeurs', '2026-10-02', FALSE),
('tanger',    'Tanger',    'RIAD_MAISON',   10, 'Source non officielle (guide en ligne) — à confirmer auprès de la commune de Tanger', 'https://www.kribos.com/blog/taxe-sejour-maroc-calcul-declaration-hebergeurs', '2026-10-02', FALSE)
ON CONFLICT (city_key, category) DO NOTHING;
