import express from 'express';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const rows = await prisma.yachtTag.findMany({
      select: { tag: true },
      distinct: ['tag'],
      orderBy: { tag: 'asc' },
    });
    const tags = rows.map(r => ({ _id: r.tag, Name: r.tag }));
    res.json({ tags });
  } catch (err) {
    next(err);
  }
});

export default router;
