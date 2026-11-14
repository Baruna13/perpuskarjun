import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Books from './pages/Books';
import Members from './pages/Members';
import Users from './pages/Users';
import Sirkulasi from './pages/Sirkulasi';
import Pinjaman from './pages/Pinjaman';
import Laporan from './pages/Laporan';
import Wishlist from './pages/Wishlist';
import Pengadaan from './pages/Pengadaan';
import Pengaturan from './pages/Pengaturan';
import Profil from './pages/Profil';

const STAFF = ['admin', 'pustakawan'];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="books" element={<Books />} />
        <Route path="sirkulasi" element={<ProtectedRoute roles={STAFF}><Sirkulasi /></ProtectedRoute>} />
        <Route path="laporan" element={<ProtectedRoute roles={STAFF}><Laporan /></ProtectedRoute>} />
        <Route path="wishlist" element={<ProtectedRoute roles={['anggota']}><Wishlist /></ProtectedRoute>} />
        <Route path="pengadaan" element={<ProtectedRoute roles={STAFF}><Pengadaan /></ProtectedRoute>} />
        <Route path="pengaturan" element={<ProtectedRoute roles={['admin']}><Pengaturan /></ProtectedRoute>} />
        <Route path="profil" element={<Profil />} />
        <Route path="pinjaman" element={<ProtectedRoute roles={['anggota']}><Pinjaman /></ProtectedRoute>} />
        <Route path="members" element={<ProtectedRoute roles={STAFF}><Members /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute roles={STAFF}><Users /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
