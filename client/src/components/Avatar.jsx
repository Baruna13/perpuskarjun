const initials = (n = '') => n.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('');

// Foto profil, atau inisial bila belum ada foto
export default function Avatar({ name = '', url, size = 'h-9 w-9', text = 'text-xs' }) {
  if (url) return <img src={url} alt={name} referrerPolicy="no-referrer" className={`${size} shrink-0 rounded-full bg-parchment object-cover`} />;
  return <div className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-[#FFDBCD] ${text} font-bold text-clay-deep`}>{initials(name)}</div>;
}
