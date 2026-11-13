import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import auth from './routes/auth.js';
import users from './routes/users.js';
import members from './routes/members.js';
import categories from './routes/categories.js';
import books from './routes/books.js';
import borrowings from './routes/borrowings.js';
import fines from './routes/fines.js';
import reservations from './routes/reservations.js';
import stats from './routes/stats.js';
import reports from './routes/reports.js';
import notifications from './routes/notifications.js';
import wishlist from './routes/wishlist.js';
import acquisitions from './routes/acquisitions.js';
import settings from './routes/settings.js';
import backup from './routes/backup.js';

const app = express();

// CORS: daftar origin dari CLIENT_ORIGIN (pisah koma) + URL preview Vercel milik project ini
const origins = (process.env.CLIENT_ORIGIN ?? '').split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);
const previewPattern = /^https:\/\/tugasperpus(-[a-z0-9]+)*-mochamademilbaruna-4283s-projects\.vercel\.app$/;
const allowed = (origin) => !origin || origins.includes(origin) || previewPattern.test(origin);
app.use(cors({ origin: (origin, cb) => cb(null, allowed(origin)), credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', auth);
app.use('/api/users', users);
app.use('/api/members', members);
app.use('/api/categories', categories);
app.use('/api/books', books);
app.use('/api/borrowings', borrowings);
app.use('/api/fines', fines);
app.use('/api/reservations', reservations);
app.use('/api/stats', stats);
app.use('/api/reports', reports);
app.use('/api/notifications', notifications);
app.use('/api/wishlist', wishlist);
app.use('/api/acquisitions', acquisitions);
app.use('/api/settings', settings);
app.use('/api/backup', backup);

app.use((_req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan' }));

const port = process.env.PORT || 4000;
if (!process.env.VERCEL) app.listen(port, () => console.log(`DigiLib API :${port}`));
export default app;
