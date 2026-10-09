import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { apiRouter } from './src/server/api/routes.js';
import { startPeriodicCleanup } from './src/server/media/cleanup.js';
import { mediaProcessor } from './src/server/media/processor.js';
import { telegramBot } from './src/server/telegram/client.js';
import { telegramPolling } from './src/server/telegram/polling.js';
import { db } from './src/server/database/database.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Parse JSON request bodies (up to 10MB)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Trust proxy for Cloud Run and reverse proxies
app.set('trust proxy', 1);

// Mount API routes
app.use('/api', apiRouter);

// Start Periodic Media Cleanup job
startPeriodicCleanup(15);

// Environment check and diagnostics in Server Logs
async function checkInitialConfiguration() {
  console.log('========================================================');
  console.log('           منصة نَزِّل - NAZZIL MEDIA ENGINE           ');
  console.log('========================================================');
  console.log(`[Status] Server environment: ${isProduction ? 'Production' : 'Development'}`);
  console.log(`[Status] FFmpeg available: ${mediaProcessor.isFfmpegAvailable() ? 'YES (/usr/bin/ffmpeg)' : 'NO'}`);

  const settings = await db.getSettings();
  const token = settings.bot_token || process.env.TELEGRAM_BOT_TOKEN;

  if (token) {
    telegramBot.updateToken(token);
    console.log('[Status] TELEGRAM_BOT_TOKEN: Configured and loaded');
    try {
      const me = await telegramBot.getMe();
      if (me.ok && me.result) {
        console.log(`[Telegram] Bot connected as: @${me.result.username} (${me.result.first_name})`);
      } else {
        console.warn(`[Telegram] Bot token validation warning:`, me.error || 'Token may be invalid or awaiting activation');
      }
    } catch (e: any) {
      console.warn(`[Telegram] Bot connection notice:`, e?.message || e);
    }
  } else {
    console.warn('[Warning] TELEGRAM_BOT_TOKEN is not configured yet.');
  }

  // Start Telegram Long Polling
  telegramPolling.start().catch(() => {});

  if (settings.admin_telegram_id || process.env.ADMIN_TELEGRAM_ID) {
    console.log(`[Status] ADMIN_TELEGRAM_ID: ${settings.admin_telegram_id || process.env.ADMIN_TELEGRAM_ID}`);
  }

  console.log(`[Status] Temporary media directory: ${path.resolve(process.cwd(), 'temp_media')}`);
  console.log('========================================================');
}

async function startServer() {
  await checkInitialConfiguration();

  if (!isProduction) {
    // Development mode: mount Vite dev server middlewares
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log('[Vite] Dev middleware mounted.');
    } catch (err) {
      console.error('[Vite] Failed to start Vite dev middleware:', err);
    }
  } else {
    // Production mode: serve built client assets
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      console.warn('[Server] dist directory not found. Please run `npm run build`');
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [نَزِّل] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
