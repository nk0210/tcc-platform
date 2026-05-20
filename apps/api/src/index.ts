import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'TCC API running', timestamp: new Date() });
});

app.use('/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`TCC API running on http://localhost:${PORT}`);
});

export default app;