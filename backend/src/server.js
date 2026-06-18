require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pathologyRoutes = require('./routes/pathology.routes');
const dbRoutes = require('./routes/db.routes');
const compatibilityRoutes = require('./routes/compatibility.routes');
const chronicRoutes = require('./routes/chronic.routes');
const mfrRoutes = require('./routes/mfr.routes');
const usgRoutes = require('./routes/usg.routes');
const { healthCheck } = require('./controllers/pathology.controller');
const { cleanupOldReports } = require('./services/storage/sqlite.service');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/health', healthCheck);
app.use('/api/pathology', pathologyRoutes);
app.use('/api/db', dbRoutes);
app.use('/api/compatibility', compatibilityRoutes);
app.use('/api/chronic', chronicRoutes);
app.use('/api/mfr', mfrRoutes);
app.use('/api/usg', usgRoutes);

// Global Error Handler (must be after routes)
app.use(errorHandler);

// Scheduled job for cleanup (Every hour)
setInterval(() => {
  logger.info('Running scheduled cleanup of old reports...');
  try {
    const deletedCount = cleanupOldReports();
    logger.info(`Cleanup finished. Deleted ${deletedCount} old reports.`);
  } catch (error) {
    logger.error(`Cleanup failed: ${error.message}`);
  }
}, 60 * 60 * 1000);

// Start Server
app.listen(PORT, () => {
  logger.info(`SlayHealth Pathology Backend running on port ${PORT}`);
});
