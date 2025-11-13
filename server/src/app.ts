import express from 'express';
import cors from 'cors';
import analyticsRoutes from './routes/analytics';

const app = express();

app.use(cors());
app.use(express.json());

// Register routes
app.use('/api/analytics', analyticsRoutes);

// ... rest of your routes ...

export default app; 