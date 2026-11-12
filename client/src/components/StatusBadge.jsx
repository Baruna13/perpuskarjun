const TONE = { dipinjam: 'badge-ochre', dikembalikan: 'badge-sage', terlambat: 'badge-rust' };
export default function StatusBadge({ s }) {
  return <span className={`badge ${TONE[s] ?? 'badge-ink'}`}>{s}</span>;
}
