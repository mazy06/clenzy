const metrics = {
  overview: { revenue: 'revenue', occupancy: 'occupancy', adr: 'adr', revpan: 'revpan', margin: 'margin', stay: 'stay' },
  revenue: { total: 'revenue', margin: 'margin', adr: 'adr', revpan: 'revpan', perBooking: 'perBooking', roi: 'roi' },
  occupancy: { rate: 'occupancy', gap: 'gap', bookings: 'bookings', stay: 'stay', guests: 'guests' },
  pricing: { optimal: 'optimal', f30: 'f30', f90: 'f90', f365: 'f365', occ30: 'occ30', elasticity: 'elasticity' },
  pace: { otb: 'otb', stly: 'stly', pickup7: 'pickup7', pickup28: 'pickup28', occ: 'occ' },
  properties: { properties: 'properties', interventions: 'interventions', cost: 'cost', avgCost: 'avgCost', revpan: 'revpan' },
  interventions: { total: 'interventions', rate: 'completion', pending: 'pending', inProgress: 'inProgress', avg: 'perMonth' },
  teams: { teams: 'teams', tasks: 'tasks', rate: 'completion', pending: 'pending', avg: 'perTeam' },
} as const;

export type BaitlyReportKind = keyof typeof metrics;

// Libellés autonomes : les anciennes légendes (« de revenus ») complétaient une phrase.
const labels: Record<string, readonly [string, string, string]> = {
  revenue: ['Revenus', 'Revenue', 'الإيرادات'], occupancy: ['Occupation', 'Occupancy', 'الإشغال'],
  adr: ['ADR', 'ADR', 'ADR'], revpan: ['RevPAN', 'RevPAN', 'RevPAN'], margin: ['Marge nette', 'Net margin', 'صافي الهامش'],
  stay: ['Nuits par séjour', 'Nights per stay', 'الليالي لكل إقامة'], perBooking: ['Revenu par réservation', 'Revenue per booking', 'الإيراد لكل حجز'],
  roi: ['ROI', 'ROI', 'العائد على الاستثمار'], gap: ['Nuits vacantes', 'Vacant nights', 'الليالي الشاغرة'],
  bookings: ['Réservations', 'Bookings', 'الحجوزات'], guests: ['Voyageurs par séjour', 'Guests per stay', 'الضيوف لكل إقامة'],
  optimal: ['Prix conseillé', 'Suggested price', 'السعر المقترح'], f30: ['Revenus prévus à 30 j', '30-day revenue forecast', 'الإيرادات المتوقعة خلال 30 يوماً'],
  f90: ['Revenus prévus à 90 j', '90-day revenue forecast', 'الإيرادات المتوقعة خلال 90 يوماً'],
  f365: ['Revenus prévus à 12 mois', '12-month revenue forecast', 'الإيرادات المتوقعة خلال 12 شهراً'],
  occ30: ['Occupation prévue', 'Forecast occupancy', 'الإشغال المتوقع'], elasticity: ['Élasticité du prix', 'Price elasticity', 'مرونة السعر'],
  otb: ['Nuits réservées à 6 mois', 'Nights booked over 6 months', 'الليالي المحجوزة خلال 6 أشهر'],
  stly: ['Nuits à N-1, même recul', 'Last year, same lead time', 'العام الماضي، نفس مهلة الحجز'],
  pickup7: ['Pickup à 7 jours', '7-day pickup', 'الحجوزات المضافة خلال 7 أيام'],
  pickup28: ['Pickup à 28 jours', '28-day pickup', 'الحجوزات المضافة خلال 28 يوماً'],
  occ: ['Occupation OTB moyenne', 'Average OTB occupancy', 'متوسط الإشغال المحجوز'],
  properties: ['Biens suivis', 'Tracked properties', 'العقارات المتابعة'], interventions: ['Interventions', 'Interventions', 'التدخلات'],
  cost: ['Coûts d’exploitation', 'Operating costs', 'تكاليف التشغيل'], avgCost: ['Coût par bien', 'Cost per property', 'التكلفة لكل عقار'],
  completion: ['Taux de réalisation', 'Completion rate', 'نسبة الإنجاز'], pending: ['En attente', 'Pending', 'قيد الانتظار'],
  inProgress: ['En cours', 'In progress', 'قيد التنفيذ'], perMonth: ['Interventions par mois', 'Interventions per month', 'التدخلات لكل شهر'],
  teams: ['Équipes', 'Teams', 'الفرق'], tasks: ['Tâches', 'Tasks', 'المهام'], perTeam: ['Tâches par équipe', 'Tasks per team', 'المهام لكل فريق'],
};

const artwork: Record<string, string> = {
  revenue: 'revenue', adr: 'adr', revpan: 'revpan', margin: 'revenue', roi: 'revenue', perBooking: 'revenue',
  occupancy: 'occupancy', stay: 'occupancy', gap: 'occupancy', guests: 'rating', bookings: 'bookings',
  optimal: 'adr', f30: 'revenue', f90: 'revenue', f365: 'revenue', occ30: 'occupancy', elasticity: 'adr',
  otb: 'bookings', stly: 'bookings', pickup7: 'bookings', pickup28: 'bookings', occ: 'occupancy',
  properties: 'revpan', cost: 'revenue', avgCost: 'revenue',
};

export function reportMetric(report: BaitlyReportKind, key: string, language: string, fallback: string) {
  const semantic = (metrics[report] as Record<string, string>)[key] ?? key;
  const index = language.startsWith('ar') ? 2 : language.startsWith('en') ? 1 : 0;
  return {
    label: labels[semantic]?.[index] ?? fallback,
    artwork: artwork[semantic] ? `/images/dashboard-kpis/${artwork[semantic]}.webp`
      : `/images/finance-kpis/${semantic === 'pending' ? 'pending' : 'documents'}.png`,
    hint: [
      'Les graphiques de ce rapport détaillent cet indicateur sur le même périmètre.',
      'The charts in this report break down this metric over the same scope.',
      'توضح الرسوم البيانية في هذا التقرير تفاصيل هذا المؤشر ضمن النطاق نفسه.',
    ][index],
  };
}
