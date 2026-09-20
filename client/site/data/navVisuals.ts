import riad from '../assets/photos/baitly-riad.webp';
import balloon from '../assets/photos/balloon.jpg';
import bedroom from '../assets/photos/bedroom.jpg';
import excursion from '../assets/photos/excursion.jpg';
import food from '../assets/photos/food.jpg';
import guesthouse from '../assets/photos/guesthouse.jpg';
import pool from '../assets/photos/pool.jpg';
import terrace from '../assets/photos/terrace.jpg';

/**
 * Photos d'ambiance des vitrines du mega-menu.
 *
 * <p><b>Ce sont des ambiances, pas des captures d'ecran.</b> Un module est un
 * logiciel : le montrer par une photo de logement serait une promesse fausse.
 * Ce que la vitrine affirme du produit tient dans son texte et ses points ; la
 * photo, elle, tient le registre de la page — l'hospitalite au Maroc et en
 * Arabie saoudite. Le rapprochement est choisi quand il existe (le lit fait
 * pour le menage, la montgolfiere pour les experiences du livret) et assume
 * comme decor quand il n'existe pas.</p>
 *
 * <p>Huit photos pour neuf modules : <b>la terrasse sert deux fois</b>, en
 * premiere et en derniere entree — huit rangees d'ecart, et jamais deux
 * vitrines cote a cote. Les fichiers sont ceux des sections de la page, deja
 * dans le lot : le menu n'ajoute pas un octet.</p>
 */
export const MODULE_PHOTO: Record<string, string> = {
  'pms-channel-manager': terrace,
  'booking-engine': riad,
  'livret-accueil': balloon,
  'agents-ia': excursion,
  'revenue-market-data': pool,
  'paiements-finances': food,
  'operations-menage': bedroom,
  'objets-connectes': guesthouse,
  'portail-proprietaire': terrace,
};

/**
 * Les solutions, elles, designent de vrais types de biens et de vrais marches :
 * chaque photo y est un choix, pas un decor.
 *
 * <p>Deux lecteurs : la vitrine du menu Solutions et les rangees de la page
 * `/solutions`. Une solution, une image, partout ou elle apparait — c'est ce
 * qui fait qu'on la reconnait en arrivant sur la page depuis le menu.</p>
 */
export const SOLUTION_PHOTO: Record<string, string> = {
  conciergeries: guesthouse,
  'hotes-independants': terrace,
  'riads-maisons-dhotes': riad,
  'arabie-saoudite': pool,
  maroc: balloon,
  'multi-proprietaires': bedroom,
};
