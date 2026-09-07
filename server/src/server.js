require('dotenv').config();
const path = require('path');
const { execSync } = require('child_process');
const app = require('./app');

const PORT = process.env.PORT || 5000;

// Auto-sync database schema on production startup (e.g., Render)
if (process.env.DATABASE_URL && process.env.NODE_ENV === 'production') {
  try {
    console.log('🔄 Checking & pushing database schema with Prisma...');
    execSync('npx prisma db push --accept-data-loss', {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
    });
    console.log('✅ Database schema verified and in sync.');
  } catch (err) {
    console.warn('⚠️ Warning: Prisma db push on startup encountered an issue:', err.message);
  }
}

const server = app.listen(PORT, () => {
  console.log(`🚀 TilexPharmacy server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 API Base: http://localhost:${PORT}/api/v1`);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

module.exports = server;
