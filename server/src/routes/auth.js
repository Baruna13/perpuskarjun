import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';

const router = Router();
// Info user login (profil + data anggota bila ada)
router.get('/me', authenticate, (req, res) => res.json(req.user));
export default router;
