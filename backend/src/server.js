require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const pathologyRoutes = require('./routes/pathology.routes');
const dbRoutes = require('./routes/db.routes');
const compatibilityRoutes = require('./routes/compatibility.routes');
const chronicRoutes = require('./routes/chronic.routes');
const mfrRoutes = require('./routes/mfr.routes');
const radiologyRoutes = require('./routes/radiology.routes');
const chatRoutes = require('./routes/chat.routes');
const authRoutes = require('./routes/auth.routes');
const mentalRoutes = require('./routes/mental.routes');
const inviteRoutes = require('./routes/invite.routes');
const { healthCheck } = require('./controllers/pathology.controller');
const { initDB, cleanupOldReports } = require('./services/storage/postgres.service');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

const rateLimit = require('express-rate-limit');

// Middleware
const isProduction = process.env.NODE_ENV === 'production';
const envOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://fresh-engines-testing.vercel.app',
  ...envOrigins
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) {
      callback(null, true);
    } else if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else if (!isProduction && /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(origin)) {
      // Dynamically allow local network IP origins in dev (e.g. http://192.168.x.x:3000)
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Global Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 requests per `window` (here, per minute)
  message: 'Too many requests from this IP, please try again after a minute',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

// Routes
app.get('/health', healthCheck);
app.use('/api/pathology', pathologyRoutes);
app.use('/api/db', dbRoutes);
app.use('/api/compatibility', compatibilityRoutes);
app.use('/api/chronic', chronicRoutes);
app.use('/api/mfr', mfrRoutes);
app.use('/api/radiology', radiologyRoutes);
app.use('/api/usg', radiologyRoutes); // Backwards compatibility redirect
app.use('/api/chat', chatRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/mental', mentalRoutes);
app.use('/api/invite', inviteRoutes);

// Global Error Handler (must be after routes)
app.use(errorHandler);

// Scheduled job for cleanup (Every hour)
setInterval(async () => {
  logger.info('Running scheduled cleanup of old reports...');
  try {
    const deletedCount = await cleanupOldReports();
    logger.info(`Cleanup finished. Deleted ${deletedCount} old reports.`);
  } catch (error) {
    logger.error(`Cleanup failed: ${error.message}`);
  }
}, 60 * 60 * 1000);

// Initialize DB and Start Server
initDB()
  .then(() => {
    app.listen(PORT, () => {
      logger.info(`SlayHealth Pathology Backend running on port ${PORT}`);
    });
  })
  .catch((err) => {
    logger.error('Fatal: Failed to initialize database:', err);
    process.exit(1);
  });

