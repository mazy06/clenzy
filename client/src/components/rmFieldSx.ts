/**
 * sx partagé du champ « Signature » à libellé flottant (.rm-field / .rm-input).
 * Source de vérité unique du pattern de champ des modales Signature, repris
 * fidèlement de la maquette « Modale Nouvelle Réservation » :
 *   - input : h44, fond var(--field), rayon 11, bordure var(--field-line)
 *   - focus : bordure var(--accent) + halo var(--accent-soft) + fond var(--card)
 *   - LIBELLÉ : chip notché sur la bordure haute, 14px×scale(0.75)=10.5px, fw600,
 *     var(--muted) (reste neutre au focus). REQUIERT `InputLabelProps={{ shrink: true }}`
 *     sur chaque champ pour que le libellé soit TOUJOURS notché (sinon il flotte
 *     dans le champ et la taille/position varient selon la valeur).
 *
 * Usage : <TextField sx={RM_FIELD_SX} InputLabelProps={{ shrink: true }} … />
 *         (et `select` pour les listes déroulantes — même rendu notché).
 */
export const RM_FIELD_SX = {
  '& .MuiOutlinedInput-root': {
    minHeight: 44,
    borderRadius: '11px',
    backgroundColor: 'var(--field)',
    fontFamily: 'inherit',
    fontSize: '13.5px',
    fontWeight: 600,
    color: 'var(--ink)',
    transition: 'box-shadow .14s, background-color .14s',
    '& fieldset': { borderColor: 'var(--field-line)', transition: 'border-color .14s' },
    '&:hover fieldset': { borderColor: 'var(--field-line)' },
    '&.Mui-focused': { backgroundColor: 'var(--card)', boxShadow: '0 0 0 3px var(--accent-soft)' },
    '&.Mui-focused fieldset': { borderColor: 'var(--accent)', borderWidth: '1px' },
    '&.MuiInputBase-adornedStart': { paddingLeft: '13px' },
    '&.Mui-disabled': { backgroundColor: 'var(--field)' },
  },
  '& .MuiOutlinedInput-input': { padding: '0 13px', height: 44, boxSizing: 'border-box' },
  '& .MuiInputBase-adornedStart .MuiOutlinedInput-input': { paddingLeft: '8px' },
  '& .MuiSelect-select': { display: 'flex', alignItems: 'center', height: 44, paddingTop: 0, paddingBottom: 0, boxSizing: 'border-box' },
  '& .MuiOutlinedInput-input::placeholder': { color: 'var(--faint)', fontWeight: 500, opacity: 1 },
  '& .MuiOutlinedInput-input.Mui-disabled': { WebkitTextFillColor: 'var(--body)' },
  '& .MuiInputLabel-root': {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--muted)',
    '&.Mui-focused': { color: 'var(--muted)' },
    '&.Mui-disabled': { color: 'var(--muted)' },
  },
  '& .MuiFormHelperText-root': { fontSize: '11px', color: 'var(--muted)', marginTop: '6px', marginLeft: 0 },
} as const;
