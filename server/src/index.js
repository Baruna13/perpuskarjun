import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import auth from './routes/auth.js';
import users from './routes/users.js';
import members from './routes/members.js';
import categories from './routes/categories.js';
import books from './routes/books.js';
import borrowings from './routes/borrowings.js';

const app = express();
const origins = (process.env.CLIENT_ORIGIN ?? '').split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);
app.use(cors({ origin: (origin, cb) => cb(null, !origin || origins.includes(origin)), credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', auth);
app.use('/api/users', users);
app.use('/api/members', members);
app.use('/api/categories', categories);
app.use('/api/books', books);
app.use('/api/borrowings', borrowings);

app.use((_req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan' }));

const port = process.env.PORT || 4000;
if (!process.env.VERCEL) app.listen(port, () => console.log(`DigiLib API :${port}`));
export default app;
