export const CATEGORIES = {
  mawasiliano: 'Mawasiliano (redio, simu)',
  cctv: 'CCTV, Alarm na Electric Fence',
  usafiri: 'Usafiri (magari, pikipiki)',
  ulinzi: 'Vifaa vya ulinzi (tochi, jackets, n.k.)',
  silaha: 'Silaha (zenye leseni)',
  usafi: 'Mashine na vifaa vya usafi',
  ofisi: 'Ofisi na IT (kompyuta, printer)',
  media: 'Media (kamera, vifaa vya studio)',
  nyingine: 'Nyingine',
}

export const STATUSES = {
  active: 'Linafanya kazi',
  maintenance: 'Matengenezo',
  damaged: 'Limeharibika',
  lost: 'Limepotea',
  retired: 'Limeondolewa',
}

export function daysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.round((target - today) / 86400000)
}
