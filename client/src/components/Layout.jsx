import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, BookOpen, IdCard, UserCog, LogOut, Library, ArrowLeftRight, BookCopy, Clock, BarChart3 } from 'lucide-react';
import NotificationBell from './NotificationBell';
import Onboarding from './Onboarding';
import { useAuth } from '../context/AuthContext';

const ALL = ['admin', 'pustakawan', 'anggota'];
const STAFF = ['admin', 'pustakawan'];
const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ALL, end: true },
  { to: '/books', label: 'Katalog Buku', icon: BookOpen, roles: ALL },
  { to: '/sirkulasi', label: 'Sirkulasi', icon: ArrowLeftRight, roles: STAFF },
  { to: '/laporan', label: 'Laporan', icon: BarChart3, roles: STAFF },
  { to: '/pinjaman', label: 'Pinjaman Saya', icon: BookCopy, roles: ['anggota'] },
  { to: '/members', label: 'Data Anggota', icon: IdCard, roles: STAFF },
  { to: '/users', label: 'Pengguna & Akses', icon: UserCog, roles: STAFF },
];
const ROLE_LABEL = { admin: 'Admin Perpustakaan', pustakawan: 'Pustakawan', anggota: 'Anggota' };
const initials = (n = '') => n.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('');

const Brand = ({ compact }) => (
  <div className="flex items-center gap-3 px-1">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-clay text-white" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25), 0 2px 6px rgba(194,109,69,.35)' }}>
      <Library size={20} />
    </div>
    {!compact && (
      <div className="leading-tight">
        <div className="font-serif text-xl font-semibold">DigiLib</div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Sistem Perpustakaan</div>
      </div>
    )}
  </div>
);

export default function Layout() {
  const { user, logout } = useAuth();
  const items = NAV.filter((n) => n.roles.includes(user.role));

  return (
    <div className="min-h-screen bg-linen md:flex">
      {/* Sidebar: rail ikon di tablet, penuh di desktop */}
      <aside className="no-print sticky top-0 hidden h-screen shrink-0 flex-col gap-6 border-r border-[#E5DAC8] bg-parchment p-4 md:flex md:w-20 lg:w-[260px]">
        <div className="hidden lg:block"><Brand /></div>
        <div className="flex justify-center lg:hidden"><Brand compact /></div>
        <div className="border-t border-[#E5DAC8]" />
        <nav className="flex flex-col gap-1.5">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} title={label}
              className={({ isActive }) => `relative flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold transition md:justify-center lg:justify-start ${isActive ? 'bg-white text-clay-deep shadow-sm' : 'text-muted hover:bg-white/60'}`}>
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-full bg-clay" />}
                  <Icon size={19} className={isActive ? 'text-clay' : ''} />
                  <span className="hidden lg:inline">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-2">
          <div className="rounded-2xl border border-[#E5DAC8] bg-white/70 p-3">
            <div className="flex items-center gap-3 md:justify-center lg:justify-start">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFDBCD] text-sm font-bold text-clay-deep">{initials(user.full_name)}</div>
              <div className="hidden min-w-0 lg:block">
                <div className="truncate text-sm font-bold">{user.full_name}</div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-clay-deep">{ROLE_LABEL[user.role]}</div>
              </div>
            </div>
            <button onClick={logout} title="Keluar" className="btn btn-ghost mt-3 w-full !py-2 md:!px-0 lg:!px-5">
              <LogOut size={16} /> <span className="hidden lg:inline">Keluar</span>
            </button>
          </div>
          <div className="hidden text-center text-[10px] font-bold uppercase tracking-wider text-[#8C7A6B] lg:block">DigiLib v0.2 · Sand & Cedar</div>
        </div>
      </aside>

      {/* Header mobile */}
      <header className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-[#E5DAC8] bg-parchment/95 px-4 py-2.5 backdrop-blur md:hidden">
        <Brand />
        <button onClick={logout} className="icon-btn" title="Keluar"><LogOut size={19} /></button>
      </header>

      <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 pb-28 md:p-8 md:pb-10">
        <div className="no-print mb-4 flex justify-end"><NotificationBell /></div>
        {user.role === 'anggota' && !user.member ? <Onboarding /> : (
          <>
            {user.role === 'anggota' && user.member && !user.member.is_active && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl bg-ochre-soft p-4 text-sm text-ochre">
                <Clock size={18} className="mt-0.5 shrink-0" />
                <div><b>Keanggotaan menunggu verifikasi.</b> Kode anggota Anda <b className="tnum">{user.member.member_code}</b>. Anda sudah bisa menjelajah katalog; peminjaman dan baca e-book aktif setelah pustakawan memverifikasi.</div>
              </div>
            )}
            <Outlet />
          </>
        )}
      </main>

      {/* Tab bawah mobile */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-10 flex border-t border-[#E5DAC8] bg-parchment/95 backdrop-blur md:hidden">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold ${isActive ? 'text-clay' : 'text-[#8C7A6B]'}`}>
            <Icon size={20} /> {label.split(' ')[0]}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
