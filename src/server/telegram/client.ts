import fs from 'fs';
import path from 'path';

export interface TelegramSendMessageOptions {
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  reply_markup?: any;
  disable_web_page_preview?: boolean;
}

export interface ChatMemberResponse {
  ok: boolean;
  result?: {
    status: 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked';
    user?: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
    };
  };
  description?: string;
}

export class TelegramBotClient {
  private token: string;
  private baseUrl: string;
  private lastEditTime: Map<string, number> = new Map();

  constructor(token?: string) {
    this.token = token || process.env.TELEGRAM_BOT_TOKEN || '';
    this.baseUrl = `https://api.telegram.org/bot${this.token}`;
  }

  public updateToken(token: string) {
    this.token = token;
    this.baseUrl = `https://api.telegram.org/bot${this.token}`;
  }

  public getToken(): string {
    return this.token;
  }

  public hasToken(): boolean {
    return !!this.token && this.token.length > 10;
  }

  private async request(method: string, body?: any): Promise<any> {
    if (!this.hasToken()) {
      throw new Error('TELEGRAM_BOT_TOKEN is not configured');
    }

    const url = `${this.baseUrl}/${method}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    return data;
  }

  public async getMe(): Promise<{ ok: boolean; result?: any; error?: string }> {
    try {
      const data = await this.request('getMe');
      return data;
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  public async sendMessage(chatId: number | string, text: string, options: TelegramSendMessageOptions = {}): Promise<any> {
    return this.request('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: options.parse_mode || 'HTML',
      reply_markup: options.reply_markup,
      disable_web_page_preview: options.disable_web_page_preview ?? false,
    });
  }

  public async editMessageText(
    chatId: number | string,
    messageId: number,
    text: string,
    options: TelegramSendMessageOptions = {}
  ): Promise<any> {
    const editKey = `${chatId}_${messageId}`;
    const now = Date.now();
    const lastTime = this.lastEditTime.get(editKey) || 0;

    // Rate-limit edits to Telegram: at least 750ms apart
    if (now - lastTime < 750) {
      return { ok: true, rateLimited: true };
    }

    this.lastEditTime.set(editKey, now);

    try {
      return await this.request('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: options.parse_mode || 'HTML',
        reply_markup: options.reply_markup,
        disable_web_page_preview: options.disable_web_page_preview ?? true,
      });
    } catch (err: any) {
      // Ignore "message is not modified" error from Telegram
      if (err?.message?.includes('message is not modified')) {
        return { ok: true };
      }
      throw err;
    }
  }

  public async answerCallbackQuery(callbackQueryId: string, text?: string, showAlert = false): Promise<any> {
    return this.request('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert,
    });
  }

  public async getChatMember(chatId: string | number, userId: number): Promise<ChatMemberResponse> {
    try {
      const res = await this.request('getChatMember', {
        chat_id: chatId,
        user_id: userId,
      });
      return res;
    } catch (err: any) {
      return { ok: false, description: err.message };
    }
  }

  public async setWebhook(url: string, secretToken?: string): Promise<any> {
    return this.request('setWebhook', {
      url,
      secret_token: secretToken,
      drop_pending_updates: true,
      allowed_updates: ['message', 'callback_query'],
    });
  }

  public async deleteWebhook(dropPendingUpdates: boolean = false): Promise<any> {
    return this.request('deleteWebhook', { drop_pending_updates: dropPendingUpdates });
  }

  public async getWebhookInfo(): Promise<any> {
    return this.request('getWebhookInfo');
  }

  public async sendPhoto(chatId: number | string, photoUrl: string, caption?: string, options: TelegramSendMessageOptions = {}): Promise<any> {
    return this.request('sendPhoto', {
      chat_id: chatId,
      photo: photoUrl,
      caption,
      parse_mode: options.parse_mode || 'HTML',
      reply_markup: options.reply_markup,
    });
  }

  /**
   * Send video file using multipart/form-data.
   */
  public async sendVideo(
    chatId: number | string,
    filePath: string,
    options: { caption?: string; duration?: number; reply_markup?: any } = {}
  ): Promise<any> {
    if (!this.hasToken()) throw new Error('Telegram Bot Token not configured');

    const fileBuffer = await fs.promises.readFile(filePath);
    const fileName = path.basename(filePath);
    const blob = new Blob([fileBuffer], { type: 'video/mp4' });

    const formData = new FormData();
    formData.append('chat_id', chatId.toString());
    formData.append('video', blob, fileName);
    if (options.caption) formData.append('caption', options.caption);
    formData.append('parse_mode', 'HTML');
    formData.append('supports_streaming', 'true');
    if (options.duration) formData.append('duration', options.duration.toString());
    if (options.reply_markup) formData.append('reply_markup', JSON.stringify(options.reply_markup));

    const response = await fetch(`${this.baseUrl}/sendVideo`, {
      method: 'POST',
      body: formData,
    });

    return await response.json();
  }

  /**
   * Send audio file (MP3) using multipart/form-data.
   */
  public async sendAudio(
    chatId: number | string,
    filePath: string,
    options: { caption?: string; title?: string; performer?: string; reply_markup?: any } = {}
  ): Promise<any> {
    if (!this.hasToken()) throw new Error('Telegram Bot Token not configured');

    const fileBuffer = await fs.promises.readFile(filePath);
    const fileName = path.basename(filePath);
    const blob = new Blob([fileBuffer], { type: 'audio/mpeg' });

    const formData = new FormData();
    formData.append('chat_id', chatId.toString());
    formData.append('audio', blob, fileName);
    if (options.caption) formData.append('caption', options.caption);
    if (options.title) formData.append('title', options.title);
    if (options.performer) formData.append('performer', options.performer);
    formData.append('parse_mode', 'HTML');
    if (options.reply_markup) formData.append('reply_markup', JSON.stringify(options.reply_markup));

    const response = await fetch(`${this.baseUrl}/sendAudio`, {
      method: 'POST',
      body: formData,
    });

    return await response.json();
  }

  /**
   * Fallback sendDocument for arbitrary media files or formats.
   */
  public async sendDocument(
    chatId: number | string,
    filePath: string,
    options: { caption?: string; reply_markup?: any } = {}
  ): Promise<any> {
    if (!this.hasToken()) throw new Error('Telegram Bot Token not configured');

    const fileBuffer = await fs.promises.readFile(filePath);
    const fileName = path.basename(filePath);
    const blob = new Blob([fileBuffer]);

    const formData = new FormData();
    formData.append('chat_id', chatId.toString());
    formData.append('document', blob, fileName);
    if (options.caption) formData.append('caption', options.caption);
    formData.append('parse_mode', 'HTML');
    if (options.reply_markup) formData.append('reply_markup', JSON.stringify(options.reply_markup));

    const response = await fetch(`${this.baseUrl}/sendDocument`, {
      method: 'POST',
      body: formData,
    });

    return await response.json();
  }
}

export const telegramBot = new TelegramBotClient();
