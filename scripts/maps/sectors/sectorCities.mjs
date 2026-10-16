// Villes de la liste fermée de client/src/data/coverageCountries.ts, avec les requêtes
// Nominatim essayées dans l'ordre (ville, puis gouvernorat / préfecture) et les autres
// graphies qu'un prestataire peut saisir. Toute ville ajoutée là-bas doit l'être ici.

/** Clé d'un secteur — même règle que SectorKey côté serveur. */
export function sectorKey({ country, department, arrondissement, city }) {
  if (arrondissement) return `FR-A-${arrondissement}`;
  if (country === 'FR' && department && city) return `FR-C-${department.toUpperCase()}-${normalizeCity(city)}`;
  if (department) return `FR-D-${department.toUpperCase()}`;
  return `${country}-C-${normalizeCity(city)}`;
}

export function normalizeCity(value) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replaceAll('œ', 'oe').replaceAll('æ', 'ae')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const ma = (name, ...queries) => ({ country: 'MA', name, queries: [`${name}, Maroc`, ...queries] });
const sa = (name, ...queries) => ({ country: 'SA', name, queries: [...queries] });
// Ville réduite à un point dans OSM : contour du gouvernorat (relation OSM), restreint à
// un disque autour du centre-ville — un gouvernorat saoudien peut englober du désert.
const governorate = (city, relation, radiusKm) => ({ ...city, governorate: { relation, radiusKm } });

export const CITY_QUERIES = [
  ma('Agadir', 'Préfecture d\'Agadir Ida-Outanane'),
  ma('Casablanca', 'Préfecture de Casablanca'),
  ma('Dakhla', 'Dakhla, Oued Ed-Dahab'),
  ma('El Jadida', 'Province d\'El Jadida'),
  ma('Errachidia', 'Province d\'Errachidia'),
  ma('Essaouira', 'Province d\'Essaouira'),
  ma('Fes', 'Fès', 'Préfecture de Fès'),
  ma('Kenitra', 'Kénitra', 'Province de Kénitra'),
  ma('Khouribga', 'Province de Khouribga'),
  ma('Laayoune', 'Laâyoune'),
  ma('Marrakech', 'Préfecture de Marrakech'),
  ma('Meknes', 'Meknès', 'Préfecture de Meknès'),
  ma('Mohammedia', 'Préfecture de Mohammedia'),
  ma('Nador', 'Province de Nador'),
  ma('Ouarzazate', 'Province d\'Ouarzazate'),
  ma('Oujda', 'Oujda-Angad'),
  ma('Rabat', 'Préfecture de Rabat'),
  ma('Safi', 'Province de Safi'),
  ma('Sale', 'Salé', 'Préfecture de Salé'),
  ma('Tanger', 'Tanger-Assilah'),
  ma('Taroudant', 'Province de Taroudant'),
  ma('Tetouan', 'Tétouan', 'Préfecture de Tétouan'),
  governorate(sa('Abha', 'Abha'), 'R12436473', 15),
  sa('Al Khobar', 'Al Khobar', 'Al Khobar Governorate', 'محافظة الخبر'),
  governorate(sa('Buraidah', 'Buraydah'), 'R12406852', 20),
  sa('Dammam', 'Dammam', 'Dammam Governorate'),
  governorate(sa('Hail', 'Ha\'il'), 'R12413060', 15),
  governorate(sa('Hofuf', 'Al Hofuf'), 'R12400642', 20),
  governorate(sa('Jeddah', 'Jeddah'), 'R12429519', 30),
  sa('Jizan', 'Jazan', 'Jazan Governorate'),
  governorate(sa('Khamis Mushait', 'Khamis Mushait'), 'R12436486', 15),
  sa('La Mecque', 'Mecca', 'Makkah Governorate'),
  governorate(sa('Medine', 'Medina'), 'R12429007', 25),
  sa('Najran', 'Najran', 'Najran Governorate'),
  governorate(sa('Riyad', 'Riyadh'), 'R12423679', 40),
  governorate(sa('Tabuk', 'Tabuk'), 'R12420159', 20),
  governorate(sa('Taif', 'Taif'), 'R12429515', 20),
  sa('Yanbu', 'Yanbu', 'Yanbu Governorate'),
];
