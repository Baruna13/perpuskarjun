export const rupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
export const tgl = (s) => {
  if (!s) return '–';
  const d = new Date(s.length <= 10 ? `${s}T00:00:00` : s);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};
