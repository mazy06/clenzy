const fr = {
  lastExchange: 'Dernier échange', noExchange: 'Aucun échange', nextAction: 'Prochaine action',
  plan: 'Planifier une action', noAction: 'Aucune action prévue', edit: 'Mettre à jour le suivi',
  deadline: 'Échéance', today: 'Aujourd’hui', overdue: 'En retard', actionPlaceholder: 'Ex. Appeler pour confirmer les disponibilités',
  exchangedToday: 'Échange réalisé aujourd’hui', clearAction: 'Retirer l’action prévue',
  save: 'Enregistrer', cancel: 'Annuler', error: 'Le suivi n’a pas été enregistré. Réessayez.',
};
const en: typeof fr = {
  lastExchange: 'Last exchange', noExchange: 'No exchange yet', nextAction: 'Next action',
  plan: 'Plan an action', noAction: 'No action planned', edit: 'Update follow-up',
  deadline: 'Due date', today: 'Today', overdue: 'Overdue', actionPlaceholder: 'E.g. Call to confirm availability',
  exchangedToday: 'Exchanged today', clearAction: 'Remove planned action',
  save: 'Save', cancel: 'Cancel', error: 'Follow-up was not saved. Please try again.',
};
const ar: typeof fr = {
  lastExchange: 'آخر تواصل', noExchange: 'لم يحدث تواصل بعد', nextAction: 'الإجراء التالي',
  plan: 'تخطيط إجراء', noAction: 'لا يوجد إجراء مخطط', edit: 'تحديث المتابعة',
  deadline: 'الموعد المحدد', today: 'اليوم', overdue: 'متأخر', actionPlaceholder: 'مثال: الاتصال لتأكيد التوفر',
  exchangedToday: 'تم التواصل اليوم', clearAction: 'إزالة الإجراء المخطط',
  save: 'حفظ', cancel: 'إلغاء', error: 'لم يتم حفظ المتابعة. يرجى المحاولة مجدداً.',
};
export const crmFollowUpMessages = (language?: string) => language?.startsWith('ar') ? ar : language?.startsWith('en') ? en : fr;
