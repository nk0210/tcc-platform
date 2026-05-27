import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'tcc-secret-key';
const users: any[] = [];

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  handle: z.string().min(3)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, handle } = registerSchema.parse(req.body);
    const exists = users.find(u => u.email === email);
    if (exists) return res.status(400).json({ error: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const paddedNum = String(users.length + 1).padStart(8, '0');
    const tccId = `TCC-GL-TRD-${paddedNum}`;

    const user = {
      id: Date.now().toString(),
      email, handle,
      password: hashedPassword,
      skillLevel: 'ROOKIE',
      tccId,
      createdAt: new Date()
    };
    users.push(user);

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    return res.status(201).json({
      token,
      user: { id: user.id, email: user.email, handle: user.handle, skillLevel: user.skillLevel, tccId: user.tccId }
    });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = users.find(u => u.email === email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({
      token,
      user: { id: user.id, email: user.email, handle: user.handle, skillLevel: user.skillLevel, tccId: user.tccId }
    });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

router.get('/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token' });
  try {
    const token = authHeader.split(' ')[1];
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const user = users.find(u => u.id === decoded.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ id: user.id, email: user.email, handle: user.handle, skillLevel: user.skillLevel, tccId: user.tccId });
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;