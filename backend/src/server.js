import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';
import inspectionRoutes from './routes/inspections.js';
import userRoutes from './routes/users.js';
import scheduleRoutes from './routes/schedules.js';
import reportRoutes from './routes/reports.js';
import aiRoutes from './routes/ai.js';
import integrationRoutes from './routes/integrations.js';
import mailingRoutes from './routes/mailing.js';
import { initDatabase } from './config/database.js';
import { initSocketHandlers } from './services/socketService.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: true, // Reflects the request origin, effectively allowing all
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.options('*', cors()); // Enable pre-flight for all routes

// Request logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - Origin: ${req.headers.origin}`);
  next();
});

app.use(helmet());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Routes
app.use('/api/auth', userRoutes);
app.use('/api/inspections', authMiddleware, inspectionRoutes);
app.use('/api/schedules', authMiddleware, scheduleRoutes);
app.use('/api/reports', authMiddleware, reportRoutes);
app.use('/api/ai', authMiddleware, aiRoutes);
app.use('/api/integrations', authMiddleware, integrationRoutes);
app.use('/api/mailing', authMiddleware, mailingRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.io handlers
initSocketHandlers(io);

// Error handling
app.use(errorHandler);

// Initialize database and start server
// Initialize database and start server
const PORT = process.env.PORT || 3000;

console.log('Starting server initialization...');

initDatabase().then(() => {
  console.log('Database initialized successfully');
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    logger.info(`Server running on port ${PORT}`);
  });

  httpServer.on('error', (err) => {
    console.error('Server failed to start:', err);
    logger.error('Server failed to start:', err);
    process.exit(1);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  logger.error('Failed to initialize database:', err);
  process.exit(1);
});

export default app;