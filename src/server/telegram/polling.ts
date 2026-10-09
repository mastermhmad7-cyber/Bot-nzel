import { db } from '../database/database.js';
import { telegramBot } from './client.js';
import { handleTelegramUpdate } from './handlers.js';

export class TelegramPollingService {
  private isRunning = false;
  private offset = 0;
  private pollAbortController: AbortController | null = null;
  private checkInterval: NodeJS.Timeout | null = null;

  public async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[Polling] Starting Telegram Long Polling service...');

    this.runLoop().catch((err) => {
      console.error('[Polling] Fatal error in polling loop:', err);
    });
  }

  public stop() {
    this.isRunning = false;
    if (this.pollAbortController) {
      this.pollAbortController.abort();
      this.pollAbortController = null;
    }
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log('[Polling] Stopped Telegram polling.');
  }

  public getStatus() {
    return {
      isRunning: this.isRunning,
      offset: this.offset,
    };
  }

  public async restart() {
    this.stop();
    await new Promise((r) => setTimeout(r, 500));
    await this.start();
  }

  private async runLoop() {
    // Keep trying until token is available
    while (this.isRunning) {
      let token = telegramBot.getToken();

      if (!token) {
        try {
          const settings = await db.getSettings();
          if (settings.bot_token) {
            token = settings.bot_token;
            telegramBot.updateToken(token);
          }
        } catch {
          // ignore
        }
      }

      if (!token || token.length < 10) {
        // Wait for token to be configured
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }

      // Check if a webhook is currently active in settings
      try {
        const settings = await db.getSettings();
        if (settings.webhook_url && settings.webhook_url.startsWith('https://')) {
          console.log('[Polling] Webhook URL is configured; polling will not run.');
          this.isRunning = false;
          return;
        }
      } catch {
        // ignore
      }

      // If no webhook is configured, clear webhook once to ensure getUpdates functions (preserve pending messages)
      try {
        await telegramBot.deleteWebhook(false);
        console.log('[Polling] Ready for getUpdates (Polling mode).');
      } catch {
        // ignore
      }

      let consecutiveErrors = 0;

      // Main polling loop with active token
      while (this.isRunning) {
        try {
          // Double check settings periodically
          const currentSettings = await db.getSettings().catch(() => null);
          if (currentSettings?.webhook_url && currentSettings.webhook_url.startsWith('https://')) {
            console.log('[Polling] Webhook URL enabled in settings; stopping polling.');
            this.isRunning = false;
            break;
          }

          const activeToken = telegramBot.getToken() || token;
          this.pollAbortController = new AbortController();

          // Use timeout=15s on Telegram side and 25s client timeout to prevent socket drop
          const timeoutSignal = AbortSignal.timeout ? AbortSignal.timeout(25000) : undefined;
          const combinedSignal = (AbortSignal as any).any && timeoutSignal
            ? (AbortSignal as any).any([this.pollAbortController.signal, timeoutSignal])
            : this.pollAbortController.signal;

          const url = `https://api.telegram.org/bot${activeToken}/getUpdates?offset=${this.offset}&timeout=15&allowed_updates=["message","callback_query"]`;
          const response = await fetch(url, {
            signal: combinedSignal,
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            // If 409 Conflict, Telegram has an active webhook, so polling should yield completely
            if (response.status === 409) {
              console.log('[Polling] Webhook is active on Telegram (409 Conflict). Yielding to Webhook mode.');
              this.isRunning = false;
              break;
            }
            consecutiveErrors++;
            if (consecutiveErrors >= 5) {
              console.log(`[Polling] Temporary Telegram API status ${response.status}, retrying...`);
            }
            await new Promise((r) => setTimeout(r, Math.min(consecutiveErrors * 1000, 5000)));
            continue;
          }

          const data = await response.json();
          consecutiveErrors = 0; // Reset on successful response

          if (data && data.ok && Array.isArray(data.result)) {
            for (const update of data.result) {
              this.offset = Math.max(this.offset, update.update_id + 1);
              console.log(`[Polling] Processing update #${update.update_id} from chat ${update.message?.chat?.id || update.callback_query?.message?.chat?.id}`);
              // Process update asynchronously without blocking the loop
              handleTelegramUpdate(update).catch((err) => {
                console.error('[Polling] Error handling update:', err);
              });
            }
          }
        } catch (err: any) {
          if (err.name === 'AbortError' || err.name === 'TimeoutError') {
            // Normal long polling timeout / abort, immediately continue next poll
            continue;
          }

          consecutiveErrors++;
          // Standard transient network hiccup in long polling (e.g. idle socket reset)
          if (consecutiveErrors >= 5) {
            console.log(`[Polling] Connection retry (${consecutiveErrors})...`);
          }

          const delay = Math.min(consecutiveErrors * 1000, 5000);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
  }
}

export const telegramPolling = new TelegramPollingService();
