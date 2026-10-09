export const API_BASE = '/api';

export function getAdminToken(): string | null {
  return localStorage.getItem('nazzil_admin_token');
}

export function setAdminToken(token: string) {
  localStorage.setItem('nazzil_admin_token', token);
}

export function removeAdminToken() {
  localStorage.removeItem('nazzil_admin_token');
}

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = getAdminToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-admin-key': 'admin_secure_password_123',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (err: any) {
    throw new Error('تعذر الاتصال بالخادم، يرجى التحقق من اتصال الشبكة');
  }

  if (response.status === 403 || response.status === 401) {
    removeAdminToken();
    window.dispatchEvent(new Event('auth_required'));
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (!response.ok) {
      throw new Error(`تعذر معالجة الطلب (رمز الخطأ: ${response.status})`);
    }
    return {};
  }

  let data: any = {};
  try {
    data = await response.json();
  } catch {
    throw new Error('الاستجابة الواردة من الخادم غير صالحة');
  }

  if (!response.ok) {
    throw new Error(data.error || 'حدث خطأ في الاتصال بالخادم');
  }

  return data;
}

export const adminApi = {
  login: async (password: string, telegramId?: string) => {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, telegramId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تسجيل الدخول');
    setAdminToken(data.token);
    return data;
  },

  checkAuth: async () => {
    return fetchWithAuth('/admin/me');
  },

  getStats: async () => {
    return fetchWithAuth('/admin/stats');
  },

  getAnalytics: async () => {
    return fetchWithAuth('/admin/analytics');
  },

  getUsers: async (search = '', limit = 50, offset = 0) => {
    const q = new URLSearchParams({ search, limit: limit.toString(), offset: offset.toString() });
    return fetchWithAuth(`/admin/users?${q.toString()}`);
  },

  setUserBan: async (userId: number, isBanned: boolean) => {
    return fetchWithAuth(`/admin/users/${userId}/ban`, {
      method: 'POST',
      body: JSON.stringify({ isBanned }),
    });
  },

  getChannels: async () => {
    return fetchWithAuth('/admin/channels');
  },

  addChannel: async (channelData: any) => {
    return fetchWithAuth('/admin/channels', {
      method: 'POST',
      body: JSON.stringify(channelData),
    });
  },

  updateChannel: async (id: string, updates: any) => {
    return fetchWithAuth(`/admin/channels/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  deleteChannel: async (id: string) => {
    return fetchWithAuth(`/admin/channels/${id}`, {
      method: 'DELETE',
    });
  },

  getAds: async () => {
    return fetchWithAuth('/admin/ads');
  },

  addAd: async (adData: any) => {
    return fetchWithAuth('/admin/ads', {
      method: 'POST',
      body: JSON.stringify(adData),
    });
  },

  updateAd: async (id: string, updates: any) => {
    return fetchWithAuth(`/admin/ads/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  deleteAd: async (id: string) => {
    return fetchWithAuth(`/admin/ads/${id}`, {
      method: 'DELETE',
    });
  },

  getJobs: async () => {
    return fetchWithAuth('/admin/jobs');
  },

  cancelJob: async (jobId: string) => {
    return fetchWithAuth(`/admin/jobs/${jobId}/cancel`, {
      method: 'POST',
    });
  },

  getSettings: async () => {
    return fetchWithAuth('/admin/settings');
  },

  updateSettings: async (updates: any) => {
    return fetchWithAuth('/admin/settings', {
      method: 'POST',
      body: JSON.stringify(updates),
    });
  },

  registerWebhook: async (webhookUrl: string, secretToken: string) => {
    return fetchWithAuth('/admin/webhook/register', {
      method: 'POST',
      body: JSON.stringify({ webhookUrl, secretToken }),
    });
  },

  unregisterWebhook: async () => {
    return fetchWithAuth('/admin/webhook/unregister', {
      method: 'POST',
    });
  },

  getWebhookStatus: async () => {
    return fetchWithAuth('/admin/webhook/status');
  },

  getLogs: async () => {
    return fetchWithAuth('/admin/logs');
  },

  testExtract: async (url: string) => {
    const res = await fetch(`${API_BASE}/extract/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل الفحص');
    return data;
  },

  sendSimulatorMessage: async (text: string) => {
    const res = await fetch(`${API_BASE}/telegram/simulator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send_message', text }),
    });
    return res.json();
  },

  triggerSimulatorDownload: async (url: string, mediaType: 'video' | 'audio') => {
    const res = await fetch(`${API_BASE}/telegram/simulator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'trigger_download', url, mediaType }),
    });
    return res.json();
  },
};
