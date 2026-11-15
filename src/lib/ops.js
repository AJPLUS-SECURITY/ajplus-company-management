import { daysUntil } from './equipment'

export function contractState(c) {
  if (c.status === 'ended') return { label: 'Imeisha', cls: 'badge-paid', key: 'ended' }
  if (c.status === 'suspended') return { label: 'Imesimamishwa', cls: 'badge-pending', key: 'suspended' }
  const d = daysUntil(c.end_date)
  if (d !== null && d < 0) return { label: 'Muda umeisha', cls: 'badge-rejected', key: 'expired' }
  if (d !== null && d <= 60) return { label: `Inaisha siku ${d}`, cls: 'badge-pending', key: 'soon' }
  return { label: 'Hai', cls: 'badge-approved', key: 'ok' }
}
