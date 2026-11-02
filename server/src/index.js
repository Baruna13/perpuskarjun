import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import borrowings from './routes/borrowings.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/borrowings', borrowings);

const port = process.env.PORT || 4000;
if (!process.env.VERCEL) app.listen(port, () => console.log(`DigiLib API :${port}`));
export default app;
