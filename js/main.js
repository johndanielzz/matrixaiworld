(() => {
  'use strict';

  const STORAGE = {
    users: 'matrix_users',
    session: 'matrix_session',
    settings: 'matrix_settings',
    stats: 'matrix_stats',
    chat: 'matrix_chat_history',
    memories: 'matrix_memories',
    payments: 'matrix_payments',
    announcement: 'matrix_announcement',
    logs: 'matrix_logs',
    videos: 'matrix_videos',
    promptLibrary: 'matrix_prompt_library',
    devSnippets: 'matrix_dev_snippets',
    teacherCourses: 'matrix_teacher_courses',
    teacherHistory: 'matrix_teacher_history',
    teacherNotes: 'matrix_teacher_notes',
    cyberWatch: 'matrix_cyber_watchlist',
    cyberIncidents: 'matrix_cyber_incidents',
    automationFlows: 'matrix_automation_flows',
    automationQueue: 'matrix_automation_queue',
    roadmapVotes: 'matrix_roadmap_votes',
    roadmapIdeas: 'matrix_roadmap_ideas',
    offerEndsAt: 'matrix_offer_ends_at',
    rememberEmail: 'matrix_remember_email',
    modelsCache: 'matrix_models_cache'
  };

  const DEFAULT_SETTINGS = {
    theme: 'dark',
    apiKey: '',
    baseUrl: 'https://api.ai.cc/v1',
    apiMode: 'chat_completions',
    model: 'gpt-4o',
    videoModel: 'gpt-4o',
    storeResponses: true,
    systemPrompt: 'You are MatrixAI. Be concise, practical, and honest.',
    temperature: 0.7
  };

  const PLANS = [
    {
      id: 'starter',
      name: 'Starter',
      monthly: 9,
      yearly: 79,
      features: ['400 AI messages per month', '3 image generations daily', 'Email support']
    },
    {
      id: 'pro',
      name: 'Pro',
      monthly: 24,
      yearly: 239,
      recommended: true,
      features: ['Unlimited chat', '25 image generations daily', 'Priority queue', 'Advanced tool suite']
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      monthly: 79,
      yearly: 799,
      features: ['All Pro features', 'Team workspace mode', 'Admin analytics exports', 'Dedicated support']
    }
  ];

  const PROMO_CODES = {
    MATRIX10: 0.1,
    BOOST20: 0.2,
    WORLD30: 0.3
  };

  const REQUEST_DEFAULTS = {
    timeoutMs: 45000,
    retries: 2,
    retryBaseMs: 700
  };

  const TOOL_PROMPTS = {
    summarize: (text) => `Summarize this in 3 concise bullet points:\n${text}`,
    translate: (text) => `Translate this into Spanish and keep tone natural:\n${text}`,
    code: (text) => `Write production-grade code for this request with brief comments:\n${text}`,
    strategy: (text) => `Create a 7-day growth strategy for this topic:\n${text}`,
    tweet: (text) => `Write 5 short social post options for:\n${text}`,
    meme: (text) => `Write 8 punchy meme captions for:\n${text}`,
    actionplan: (text) => `Convert this into a practical action plan with priorities and owners:\n${text}`,
    qa: (text) => `Generate 10 high-quality Q&A flashcards from this content:\n${text}`
  };

  const AUTH_PAGES = new Set(['dashboard', 'payment', 'leaderboard', 'settings', 'roadmap', 'video', 'lab', 'dev', 'teacher', 'cyber', 'automation', 'admin']);
  const ADMIN_PAGES = new Set(['admin']);

  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

  function getJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function setJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function uid(prefix = 'id') {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function downloadJSON(filename, value) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename || `matrix-export-${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function getSession() {
    return getJSON(STORAGE.session, null);
  }

  function setSession(session) {
    setJSON(STORAGE.session, session);
  }

  function clearSession() {
    localStorage.removeItem(STORAGE.session);
  }

  function getUsers() {
    return getJSON(STORAGE.users, []);
  }

  function setUsers(users) {
    setJSON(STORAGE.users, users);
  }

  function findUserById(userId) {
    return getUsers().find((u) => u.id === userId) || null;
  }

  function getSettings() {
    return { ...DEFAULT_SETTINGS, ...getJSON(STORAGE.settings, {}) };
  }

  function setSettings(next) {
    setJSON(STORAGE.settings, { ...getSettings(), ...next });
  }

  function getStats() {
    return getJSON(STORAGE.stats, {
      messages: 0,
      responseTimes: [],
      toolRuns: 0,
      imageRuns: 0,
      lastActive: nowISO()
    });
  }

  function setStats(stats) {
    setJSON(STORAGE.stats, stats);
  }

  function addLog(type, detail, level = 'info') {
    const logs = getJSON(STORAGE.logs, []);
    logs.unshift({ id: uid('log'), type, detail, level, at: nowISO() });
    setJSON(STORAGE.logs, logs.slice(0, 300));
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function showToast(message, kind = 'info', timeout = 3000) {
    if (!message) return;
    let wrap = qs('.toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${kind}`;
    toast.textContent = message;
    wrap.appendChild(toast);
    setTimeout(() => toast.remove(), timeout);
  }

  function initCommandPalette() {
    if (qs('#cmdPaletteModal')) return;

    const modal = document.createElement('div');
    modal.id = 'cmdPaletteModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-panel cmd-panel">
        <div class="modal-head">
          <h3>Command Palette</h3>
          <span class="badge">Ctrl+K</span>
        </div>
        <input id="cmdPaletteInput" class="input" type="text" placeholder="Search pages and actions...">
        <ul id="cmdPaletteList" class="cmd-list"></ul>
      </div>
    `;
    document.body.appendChild(modal);

    const actions = [
      { label: 'Go: Dashboard', keyword: 'dashboard chat analytics', run: () => (window.location.href = 'dashboard.html') },
      { label: 'Go: AI Lab', keyword: 'lab compare prompts ai', run: () => (window.location.href = 'ai-lab.html') },
      { label: 'Go: Developer Hub', keyword: 'developer coding regex snippets', run: () => (window.location.href = 'dev-hub.html') },
      { label: 'Go: Teacher Academy', keyword: 'teacher courses voice tutor lesson', run: () => (window.location.href = 'teacher.html') },
      { label: 'Go: Cybersecurity', keyword: 'security cyber incident risk', run: () => (window.location.href = 'cybersecurity.html') },
      { label: 'Go: Automation Lab', keyword: 'automation workflow api queue', run: () => (window.location.href = 'automation-lab.html') },
      { label: 'Go: Video Studio', keyword: 'video studio generate', run: () => (window.location.href = 'video-studio.html') },
      { label: 'Go: Settings', keyword: 'settings model api key', run: () => (window.location.href = 'settings.html') },
      { label: 'Go: Payments', keyword: 'payment subscription plan', run: () => (window.location.href = 'payment.html') },
      { label: 'Toggle Theme', keyword: 'theme dark light', run: () => cycleTheme() },
      {
        label: 'Logout',
        keyword: 'logout signout',
        run: () => {
          clearSession();
          window.location.href = 'login.html';
        }
      }
    ];

    const input = qs('#cmdPaletteInput', modal);
    const list = qs('#cmdPaletteList', modal);

    function close() {
      modal.classList.remove('open');
      if (input) input.value = '';
    }

    function open() {
      modal.classList.add('open');
      renderList('');
      setTimeout(() => input?.focus(), 0);
    }

    function renderList(term) {
      if (!list) return;
      const q = term.trim().toLowerCase();
      const filtered = actions.filter((a) => {
        if (!q) return true;
        return a.label.toLowerCase().includes(q) || a.keyword.includes(q);
      });
      if (!filtered.length) {
        list.innerHTML = '<li class="muted">No commands found.</li>';
        return;
      }
      list.innerHTML = filtered
        .map((a, index) => `<li><button type="button" class="cmd-item" data-cmd-index="${index}">${escapeHtml(a.label)}</button></li>`)
        .join('');
      qsa('.cmd-item', list).forEach((btn, idx) => {
        btn.addEventListener('click', () => {
          filtered[idx].run();
          close();
        });
      });
    }

    input?.addEventListener('input', () => renderList(input.value));
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Enter') {
        const first = qsa('.cmd-item', list)[0];
        if (first) first.click();
      }
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (modal.classList.contains('open')) close();
        else open();
      }
      if (e.key === 'Escape' && modal.classList.contains('open')) close();
    });
  }

  function applyTheme(mode) {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;
  }

  function cycleTheme() {
    const current = getSettings().theme;
    const next = current === 'dark' ? 'light' : current === 'light' ? 'system' : 'dark';
    setSettings({ theme: next });
    applyTheme(next);
    showToast(`Theme set to ${next}.`, 'success', 1800);
  }

  function ensureSeedData() {
    const users = getUsers();
    if (!users.length) {
      setUsers([
        {
          id: 'user-admin',
          username: 'MatrixAdmin',
          email: 'admin@matrixai.world',
          password: 'Admin#2026',
          role: 'admin',
          trials: 999,
          points: 6200,
          streak: 45,
          plan: 'Enterprise',
          createdAt: nowISO(),
          lastLogin: null
        },
        {
          id: 'user-sora',
          username: 'SoraPilot',
          email: 'sora@matrixai.world',
          password: 'Pass#1234',
          role: 'user',
          trials: 5,
          points: 3420,
          streak: 16,
          plan: 'Pro',
          createdAt: nowISO(),
          lastLogin: null
        }
      ]);
    }

    if (!localStorage.getItem(STORAGE.settings)) setJSON(STORAGE.settings, DEFAULT_SETTINGS);
    if (!localStorage.getItem(STORAGE.stats)) setStats(getStats());
    if (!localStorage.getItem(STORAGE.chat)) setJSON(STORAGE.chat, []);
    if (!localStorage.getItem(STORAGE.memories)) setJSON(STORAGE.memories, []);
    if (!localStorage.getItem(STORAGE.payments)) setJSON(STORAGE.payments, []);
    if (!localStorage.getItem(STORAGE.logs)) setJSON(STORAGE.logs, []);
    if (!localStorage.getItem(STORAGE.videos)) setJSON(STORAGE.videos, []);
    if (!localStorage.getItem(STORAGE.devSnippets)) setJSON(STORAGE.devSnippets, []);
    if (!localStorage.getItem(STORAGE.teacherCourses)) setJSON(STORAGE.teacherCourses, []);
    if (!localStorage.getItem(STORAGE.teacherHistory)) setJSON(STORAGE.teacherHistory, []);
    if (!localStorage.getItem(STORAGE.teacherNotes)) setJSON(STORAGE.teacherNotes, []);
    if (!localStorage.getItem(STORAGE.cyberWatch)) setJSON(STORAGE.cyberWatch, []);
    if (!localStorage.getItem(STORAGE.cyberIncidents)) setJSON(STORAGE.cyberIncidents, []);
    if (!localStorage.getItem(STORAGE.automationFlows)) setJSON(STORAGE.automationFlows, []);
    if (!localStorage.getItem(STORAGE.automationQueue)) setJSON(STORAGE.automationQueue, []);
    if (!localStorage.getItem(STORAGE.promptLibrary)) {
      setJSON(STORAGE.promptLibrary, [
        {
          id: uid('prompt'),
          title: 'Bug Triage',
          prompt: 'Analyze this bug report and provide probable root cause, repro steps, and fix plan.',
          createdAt: nowISO()
        },
        {
          id: uid('prompt'),
          title: 'Marketing Launch',
          prompt: 'Create a 14-day launch plan with channels, content ideas, and KPIs.',
          createdAt: nowISO()
        }
      ]);
    }
    if (!localStorage.getItem(STORAGE.roadmapVotes)) setJSON(STORAGE.roadmapVotes, {});
    if (!localStorage.getItem(STORAGE.roadmapIdeas)) setJSON(STORAGE.roadmapIdeas, []);
  }

  function updateUser(userId, updater) {
    const users = getUsers();
    const i = users.findIndex((u) => u.id === userId);
    if (i < 0) return null;
    users[i] = updater({ ...users[i] });
    setUsers(users);
    return users[i];
  }

  function awardPoints(userId, points) {
    if (!points || points <= 0) return;
    updateUser(userId, (u) => ({ ...u, points: (u.points || 0) + points }));
  }

  function updateNavForSession(session) {
    qsa('.auth-only').forEach((el) => el.classList.toggle('hidden', !session));
    qsa('.guest-only').forEach((el) => el.classList.toggle('hidden', Boolean(session)));
    const account = qs('#headerAccount');
    if (account) account.textContent = session ? `${session.username} - ${session.plan}` : 'Guest session';
  }

  function markActiveNav(page) {
    qsa('[data-nav]').forEach((link) => {
      if (link.dataset.nav === page) link.classList.add('active');
    });
  }

  function renderAnnouncement() {
    const banner = qs('#announcementBanner');
    if (!banner) return;
    const notice = getJSON(STORAGE.announcement, null);
    if (!notice || !notice.text) {
      banner.style.display = 'none';
      return;
    }
    if (notice.expiresAt && Date.now() > new Date(notice.expiresAt).getTime()) {
      localStorage.removeItem(STORAGE.announcement);
      banner.style.display = 'none';
      return;
    }
    banner.style.display = 'block';
    banner.textContent = notice.text;
  }

  function initGlobal() {
    applyTheme(getSettings().theme);
    renderAnnouncement();
    qsa('.js-year').forEach((node) => (node.textContent = String(new Date().getFullYear())));

    const navToggle = qs('#navToggle');
    const nav = qs('#siteNav');
    if (navToggle && nav) navToggle.addEventListener('click', () => nav.classList.toggle('open'));

    qsa('.js-theme-cycle').forEach((button) => button.addEventListener('click', cycleTheme));
    qsa('.js-logout').forEach((button) => {
      button.addEventListener('click', () => {
        clearSession();
        showToast('Logged out.', 'success');
        window.location.href = 'login.html';
      });
    });

    const page = document.body?.dataset?.page || 'index';
    markActiveNav(page);
    updateNavForSession(getSession());
    initCommandPalette();
  }

  function sanitizeBaseUrl(url) {
    if (!url) return DEFAULT_SETTINGS.baseUrl;
    return url.replace(/\/+$/, '');
  }

  function buildAiccUrl(baseUrl, path) {
    const base = sanitizeBaseUrl(baseUrl || DEFAULT_SETTINGS.baseUrl);
    const cleanedPath = String(path || '').replace(/^\/+/, '');
    if (!cleanedPath) return base;
    if (/\/v\d+$/i.test(base)) return `${base}/${cleanedPath}`;
    return `${base}/v1/${cleanedPath}`;
  }

  function extractOutputText(payload) {
    if (!payload) return '';
    if (typeof payload.output_text === 'string' && payload.output_text.trim()) return payload.output_text.trim();
    const out = [];
    (Array.isArray(payload.output) ? payload.output : []).forEach((item) => {
      (Array.isArray(item.content) ? item.content : []).forEach((piece) => {
        if (typeof piece?.text === 'string') out.push(piece.text);
      });
    });
    return out.join('\n').trim();
  }

  function extractChatCompletionText(payload) {
    if (!payload) return '';
    const choices = Array.isArray(payload.choices) ? payload.choices : [];
    const message = choices[0]?.message;
    if (!message) return '';
    if (typeof message.content === 'string') return message.content.trim();
    if (Array.isArray(message.content)) {
      return message.content
        .map((item) => (typeof item?.text === 'string' ? item.text : ''))
        .join('\n')
        .trim();
    }
    return '';
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function parseApiPayload(response) {
    const type = String(response.headers.get('content-type') || '').toLowerCase();
    if (type.includes('application/json')) {
      try {
        return await response.json();
      } catch {
        return {};
      }
    }
    const text = await response.text().catch(() => '');
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  }

  function extractApiErrorMessage(payload) {
    if (!payload) return '';
    if (typeof payload === 'string') return payload.trim();
    if (typeof payload?.error?.message === 'string') return payload.error.message.trim();
    if (typeof payload?.message === 'string') return payload.message.trim();
    if (typeof payload?.detail === 'string') return payload.detail.trim();
    return '';
  }

  function shouldRetryRequest(statusCode) {
    return [408, 409, 429, 500, 502, 503, 504].includes(Number(statusCode));
  }

  function retryDelayMs(attempt, retryBaseMs) {
    const jitter = Math.floor(Math.random() * 160);
    return retryBaseMs * Math.pow(2, attempt) + jitter;
  }

  async function requestJSON(path, options = {}) {
    const settings = getSettings();
    const method = String(options.method || 'GET').toUpperCase();
    const timeoutMs = Math.max(2000, Number(options.timeoutMs) || REQUEST_DEFAULTS.timeoutMs);
    const retries = Math.max(0, Number(options.retries ?? REQUEST_DEFAULTS.retries));
    const retryBaseMs = Math.max(150, Number(options.retryBaseMs) || REQUEST_DEFAULTS.retryBaseMs);
    const withAuth = options.withAuth !== false;
    const apiKey = typeof options.apiKey === 'string'
      ? options.apiKey.trim()
      : String(settings.apiKey || '').trim();
    if (withAuth && !apiKey) throw new Error('Set API key in Settings first.');

    const headers = { ...(options.headers || {}) };
    if (withAuth && !headers.Authorization) headers.Authorization = `Bearer ${apiKey}`;
    const hasBody = typeof options.body !== 'undefined';
    if (hasBody && typeof options.body !== 'string' && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

    let networkError = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(buildAiccUrl(options.baseUrl || settings.baseUrl, path), {
          method,
          headers,
          body: hasBody ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
          signal: controller.signal
        });
        clearTimeout(timer);

        const data = await parseApiPayload(response);
        if (response.ok) return { data, response };

        const reason = extractApiErrorMessage(data) || options.errorMessage || 'Request failed.';
        if (attempt < retries && shouldRetryRequest(response.status)) {
          await sleep(retryDelayMs(attempt, retryBaseMs));
          continue;
        }
        const httpError = new Error(`${reason} (HTTP ${response.status})`);
        httpError.name = 'HttpError';
        throw httpError;
      } catch (error) {
        clearTimeout(timer);
        if (error?.name === 'HttpError') throw error;
        const msg = error?.name === 'AbortError'
          ? `Request timed out after ${timeoutMs}ms.`
          : (error?.message || 'Network request failed.');
        networkError = new Error(msg);
        if (attempt < retries) {
          await sleep(retryDelayMs(attempt, retryBaseMs));
          continue;
        }
        throw networkError;
      }
    }
    throw networkError || new Error('Request failed.');
  }

  async function callAI(prompt, options = {}) {
    const settings = getSettings();
    const apiKey = (settings.apiKey || '').trim();
    if (!apiKey) throw new Error('Set API key in Settings first.');

    const apiMode = options.apiMode || settings.apiMode || 'chat_completions';
    const model = options.model || settings.model || DEFAULT_SETTINGS.model;
    const temperature = Number.isFinite(Number(options.temperature))
      ? Number(options.temperature)
      : Number(settings.temperature) || DEFAULT_SETTINGS.temperature;
    const store = typeof options.store === 'boolean'
      ? options.store
      : Boolean(settings.storeResponses);
    const includeSystemPrompt = options.includeSystemPrompt !== false;
    const input = includeSystemPrompt
      ? [
          { role: 'system', content: [{ type: 'input_text', text: settings.systemPrompt || DEFAULT_SETTINGS.systemPrompt }] },
          { role: 'user', content: [{ type: 'input_text', text: prompt }] }
        ]
      : prompt;

    const start = performance.now();
    let data;
    if (apiMode === 'responses') {
      const result = await requestJSON('responses', {
        method: 'POST',
        apiKey,
        body: {
          model,
          input,
          temperature,
          store,
          ...(Number.isFinite(Number(options.maxOutputTokens)) ? { max_output_tokens: Number(options.maxOutputTokens) } : {})
        },
        errorMessage: 'AI responses request failed.'
      });
      data = result.data;
    } else {
      const messages = includeSystemPrompt
        ? [
            { role: 'system', content: settings.systemPrompt || DEFAULT_SETTINGS.systemPrompt },
            { role: 'user', content: String(prompt) }
          ]
        : [{ role: 'user', content: String(prompt) }];

      const result = await requestJSON('chat/completions', {
        method: 'POST',
        apiKey,
        body: {
          model,
          messages,
          temperature,
          ...(Number.isFinite(Number(options.maxOutputTokens)) ? { max_tokens: Number(options.maxOutputTokens) } : {})
        },
        errorMessage: 'AI chat request failed.'
      });
      data = result.data;
    }

    const stats = getStats();
    stats.messages += 1;
    stats.responseTimes.push((performance.now() - start) / 1000);
    stats.responseTimes = stats.responseTimes.slice(-80);
    stats.lastActive = nowISO();
    setStats(stats);

    return (apiMode === 'responses' ? extractOutputText(data) : extractChatCompletionText(data)) || 'No response text returned.';
  }

  async function listAvailableModels(options = {}) {
    const settings = getSettings();
    const apiKey = (settings.apiKey || '').trim();
    if (!apiKey) throw new Error('Set API key in Settings first.');

    const includeOwned = Boolean(options.includeOwned);
    const useCache = options.useCache !== false;
    try {
      const { data } = await requestJSON('models', {
        method: 'GET',
        apiKey,
        retries: 1,
        errorMessage: 'Failed to fetch model list.'
      });
      const rows = Array.isArray(data?.data) ? data.data : [];
      setJSON(STORAGE.modelsCache, { at: nowISO(), data: rows });
      const ids = rows.map((row) => String(row.id || '').trim()).filter(Boolean);
      if (includeOwned) {
        return rows.map((row) => ({
          id: String(row.id || ''),
          owned_by: String(row.owned_by || ''),
          created: Number(row.created || 0)
        }));
      }
      return ids;
    } catch (error) {
      if (!useCache) throw error;
      const cache = getJSON(STORAGE.modelsCache, null);
      const rows = Array.isArray(cache?.data) ? cache.data : [];
      if (!rows.length) throw error;
      const ids = rows.map((row) => String(row.id || '').trim()).filter(Boolean);
      if (includeOwned) {
        return rows.map((row) => ({
          id: String(row.id || ''),
          owned_by: String(row.owned_by || ''),
          created: Number(row.created || 0)
        }));
      }
      return ids;
    }
  }

  async function createAiccVideoTask(payload) {
    const settings = getSettings();
    const apiKey = (settings.apiKey || '').trim();
    if (!apiKey) throw new Error('Set API key in Settings first.');
    const { data } = await requestJSON('video/generations', {
      method: 'POST',
      apiKey,
      body: payload,
      retries: 1,
      errorMessage: 'Failed to create video task.'
    });
    return data;
  }

  async function getAiccVideoTask(taskId) {
    const settings = getSettings();
    const apiKey = (settings.apiKey || '').trim();
    if (!apiKey) throw new Error('Set API key in Settings first.');
    if (!taskId) throw new Error('Task ID is required.');
    const { data } = await requestJSON(`video/generations/${encodeURIComponent(taskId)}`, {
      method: 'GET',
      apiKey,
      retries: 1,
      errorMessage: 'Failed to fetch task status.'
    });
    return data;
  }

  function extractJsonBlock(raw) {
    if (!raw) return null;
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end < 0 || end <= start) return null;
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  function normalizeScenes(rawText) {
    const parsed = extractJsonBlock(rawText);
    if (parsed && Array.isArray(parsed.scenes) && parsed.scenes.length) {
      return parsed.scenes
        .map((scene, index) => ({
          index: index + 1,
          title: String(scene.title || `Scene ${index + 1}`),
          description: String(scene.description || ''),
          color: String(scene.color || '#2cd4a5')
        }))
        .slice(0, 12);
    }

    const fallbackLines = String(rawText || '')
      .split('\n')
      .map((line) => line.replace(/^\s*[-*\d.)]+\s*/, '').trim())
      .filter(Boolean);
    const lines = fallbackLines.length ? fallbackLines : ['Opening shot', 'Middle sequence', 'Final reveal'];
    return lines.slice(0, 8).map((line, index) => ({
      index: index + 1,
      title: `Scene ${index + 1}`,
      description: line,
      color: index % 2 === 0 ? '#2cd4a5' : '#f0b85c'
    }));
  }

  function hexToRgb(hex) {
    const normalized = hex.replace('#', '').trim();
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return { r: 44, g: 212, b: 165 };
    return {
      r: parseInt(normalized.slice(0, 2), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      b: parseInt(normalized.slice(4, 6), 16)
    };
  }

  function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(/\s+/);
    let line = '';
    let offsetY = 0;
    words.forEach((word, idx) => {
      const testLine = line ? `${line} ${word}` : word;
      const width = ctx.measureText(testLine).width;
      if (width > maxWidth && line) {
        ctx.fillText(line, x, y + offsetY);
        line = word;
        offsetY += lineHeight;
      } else {
        line = testLine;
      }
      if (idx === words.length - 1 && line) {
        ctx.fillText(line, x, y + offsetY);
      }
    });
  }

  async function renderStoryboardVideo(scenes, options = {}) {
    if (!('MediaRecorder' in window)) {
      throw new Error('MediaRecorder is not supported in this browser.');
    }

    const fps = Math.max(6, Math.min(30, Number(options.fps) || 12));
    const width = Number(options.width) || 1280;
    const height = Number(options.height) || 720;
    const durationSec = Math.max(4, Math.min(45, Number(options.durationSec) || 12));
    const showOverlay = options.showOverlay !== false;
    const sceneCount = Math.max(1, scenes.length);
    const totalFrames = Math.max(1, Math.round(durationSec * fps));
    const frameDelay = Math.round(1000 / fps);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available.');

    const stream = canvas.captureStream(fps);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
    const chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data);
    };

    const stopPromise = new Promise((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
    });

    recorder.start();
    for (let frame = 0; frame < totalFrames; frame += 1) {
      const progress = frame / totalFrames;
      const sceneFloat = progress * sceneCount;
      const sceneIndex = Math.min(sceneCount - 1, Math.floor(sceneFloat));
      const sceneProgress = sceneFloat - sceneIndex;
      const scene = scenes[sceneIndex];
      const rgb = hexToRgb(scene.color || '#2cd4a5');

      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.90)`);
      gradient.addColorStop(1, `rgba(${Math.max(0, rgb.r - 65)}, ${Math.max(0, rgb.g - 65)}, ${Math.max(0, rgb.b - 65)}, 0.92)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      const pulse = 0.9 + Math.sin((frame / fps) * 2) * 0.08;
      ctx.save();
      ctx.translate(width * 0.5, height * 0.5);
      ctx.rotate((sceneProgress - 0.5) * 0.12);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = 'rgba(5, 12, 26, 0.18)';
      ctx.fillRect(-width * 0.4, -height * 0.2, width * 0.8, height * 0.4);
      ctx.restore();

      if (showOverlay) {
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.font = '700 58px "Space Grotesk", sans-serif';
        ctx.fillText(`Scene ${scene.index}`, 76, 118);

        ctx.fillStyle = 'rgba(255,255,255,0.96)';
        ctx.font = '600 46px "Space Grotesk", sans-serif';
        drawWrappedText(ctx, scene.title, 76, 212, width - 152, 54);

        ctx.fillStyle = 'rgba(236,245,255,0.92)';
        ctx.font = '500 30px "Space Grotesk", sans-serif';
        drawWrappedText(ctx, scene.description, 76, 332, width - 152, 42);
      }

      ctx.fillStyle = 'rgba(255,255,255,0.62)';
      ctx.font = '500 22px "IBM Plex Mono", monospace';
      ctx.fillText(`MatrixAI Video Studio | ${(progress * 100).toFixed(1)}%`, 76, height - 56);

      if (typeof options.onProgress === 'function' && (frame % 2 === 0 || frame === totalFrames - 1)) {
        options.onProgress(Math.round(progress * 100));
      }

      await new Promise((resolve) => setTimeout(resolve, frameDelay));
    }

    recorder.stop();
    return stopPromise;
  }

  function normalizeImageFeed(rawText) {
    if (!rawText) return [];
    const parsed = extractJsonBlock(rawText);
    const images = Array.isArray(parsed?.images) ? parsed.images : [];
    if (!images.length) return [];
    return images
      .map((img, index) => {
        const imageUrl = String(img.imageUrl || img.url || '').trim();
        if (!imageUrl) return null;
        return {
          index: index + 1,
          title: String(img.title || `Image ${index + 1}`),
          imageUrl,
          source: String(img.source || img.domain || 'Unknown source'),
          domain: String(img.domain || ''),
          link: String(img.link || ''),
          position: Number(img.position || index + 1)
        };
      })
      .filter(Boolean)
      .slice(0, 30);
  }

  function loadImageForVideo(url, timeoutMs = 6000) {
    return new Promise((resolve) => {
      const img = new Image();
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        resolve(null);
      }, timeoutMs);

      if (/^https?:\/\//i.test(String(url || ''))) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(img);
      };
      img.onerror = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(null);
      };
      img.src = url;
    });
  }

  function drawCoverImage(ctx, img, width, height, options = {}) {
    const srcRatio = img.width / img.height;
    const dstRatio = width / height;
    let sx = 0;
    let sy = 0;
    let sWidth = img.width;
    let sHeight = img.height;

    if (srcRatio > dstRatio) {
      sWidth = img.height * dstRatio;
      sx = (img.width - sWidth) / 2;
    } else {
      sHeight = img.width / dstRatio;
      sy = (img.height - sHeight) / 2;
    }

    const motionStyle = String(options.motionStyle || 'static');
    if (motionStyle === 'kenburns') {
      const progress = Math.max(0, Math.min(1, Number(options.progress || 0)));
      const zoom = 1.06 + progress * 0.12;
      const dw = width * zoom;
      const dh = height * zoom;
      const dx = -((dw - width) * progress);
      const dy = -((dh - height) * (1 - progress));
      ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dw, dh);
      return;
    }
    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, width, height);
  }

  async function renderImageMontageVideo(items, options = {}) {
    if (!('MediaRecorder' in window)) {
      throw new Error('MediaRecorder is not supported in this browser.');
    }
    const shots = (Array.isArray(items) ? items : []).slice(0, 24);
    if (!shots.length) throw new Error('No image feed items available.');

    const fps = Math.max(6, Math.min(30, Number(options.fps) || 12));
    const width = Number(options.width) || 1280;
    const height = Number(options.height) || 720;
    const durationSec = Math.max(4, Math.min(45, Number(options.durationSec) || 12));
    const showOverlay = options.showOverlay !== false;
    const motionStyle = String(options.motionStyle || 'kenburns');
    const totalFrames = Math.max(1, Math.round(durationSec * fps));
    const frameDelay = Math.round(1000 / fps);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available.');

    const loaded = await Promise.all(shots.map((item) => loadImageForVideo(item.imageUrl)));

    const stream = canvas.captureStream(fps);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
    const chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data);
    };

    const stopPromise = new Promise((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
    });

    recorder.start();
    for (let frame = 0; frame < totalFrames; frame += 1) {
      const progress = frame / totalFrames;
      const shotFloat = progress * shots.length;
      const shotIndex = Math.min(shots.length - 1, Math.floor(shotFloat));
      const shotProgress = shotFloat - Math.floor(shotFloat);
      const item = shots[shotIndex];
      const image = loaded[shotIndex];

      if (image) {
        drawCoverImage(ctx, image, width, height, { progress: shotProgress, motionStyle });
      } else {
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#1b3556');
        gradient.addColorStop(1, '#081426');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }

      const overlay = ctx.createLinearGradient(0, height * 0.45, 0, height);
      overlay.addColorStop(0, 'rgba(5,12,26,0)');
      overlay.addColorStop(1, 'rgba(5,12,26,0.86)');
      ctx.fillStyle = overlay;
      ctx.fillRect(0, 0, width, height);

      if (showOverlay) {
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.font = '700 46px "Space Grotesk", sans-serif';
        drawWrappedText(ctx, item.title || `Image ${shotIndex + 1}`, 54, height - 156, width - 108, 52);

        ctx.fillStyle = 'rgba(216,232,255,0.92)';
        ctx.font = '500 24px "Space Grotesk", sans-serif';
        const source = item.source || item.domain || 'Image feed';
        ctx.fillText(source, 54, height - 74);
      }

      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '500 20px "IBM Plex Mono", monospace';
      ctx.fillText(`Feed Shot ${shotIndex + 1}/${shots.length} | ${(progress * 100).toFixed(1)}%`, 54, 48);

      if (typeof options.onProgress === 'function' && (frame % 2 === 0 || frame === totalFrames - 1)) {
        options.onProgress(Math.round(progress * 100));
      }

      await new Promise((resolve) => setTimeout(resolve, frameDelay));
    }

    recorder.stop();
    return stopPromise;
  }

  function pageGuard(page, session) {
    if (AUTH_PAGES.has(page) && !session) {
      const current = window.location.pathname.split('/').pop();
      window.location.href = `login.html?return=${encodeURIComponent(current)}`;
      return false;
    }
    if (ADMIN_PAGES.has(page) && session && session.role !== 'admin') {
      window.location.href = 'dashboard.html';
      return false;
    }
    return true;
  }

  function parseReturnUrl() {
    return new URLSearchParams(window.location.search).get('return');
  }

  function scorePassword(value) {
    let score = 0;
    if (value.length >= 8) score += 25;
    if (/[A-Z]/.test(value)) score += 25;
    if (/[0-9]/.test(value)) score += 25;
    if (/[^A-Za-z0-9]/.test(value)) score += 25;
    return Math.min(score, 100);
  }

  function initPasswordMeters() {
    qsa('[data-meter-for]').forEach((meter) => {
      const target = qs(`#${meter.dataset.meterFor}`);
      if (!target) return;
      const fill = meter.querySelector('span');
      target.addEventListener('input', () => {
        const score = scorePassword(target.value);
        fill.style.width = `${score}%`;
        fill.style.background = score < 40 ? '#ef6b6b' : score < 70 ? '#f0b85c' : '#58d68d';
      });
    });
  }

  function wirePasswordToggles() {
    qsa('.toggle-pass').forEach((button) => {
      button.addEventListener('click', () => {
        const target = qs(`#${button.dataset.target}`);
        if (!target) return;
        target.type = target.type === 'password' ? 'text' : 'password';
      });
    });
  }

  function initHomePage() {
    const usersEl = qs('#statUsers');
    const msgsEl = qs('#statMessages');
    const subsEl = qs('#statPlans');
    if (usersEl) usersEl.textContent = String(getUsers().length);
    if (msgsEl) msgsEl.textContent = String(getStats().messages || 0);
    if (subsEl) subsEl.textContent = String(getJSON(STORAGE.payments, []).length);
  }

  function initLoginPage() {
    if (getSession()) {
      window.location.href = 'dashboard.html';
      return;
    }

    wirePasswordToggles();
    initPasswordMeters();

    const remembered = localStorage.getItem(STORAGE.rememberEmail);
    if (remembered && qs('#loginEmail')) qs('#loginEmail').value = remembered;

    const demo = qs('#demoAdminBtn');
    if (demo) {
      demo.addEventListener('click', () => {
        qs('#loginEmail').value = 'admin@matrixai.world';
        qs('#loginPassword').value = 'Admin#2026';
      });
    }

    qs('#loginForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = (qs('#loginEmail')?.value || '').trim().toLowerCase();
      const password = (qs('#loginPassword')?.value || '').trim();
      const remember = Boolean(qs('#rememberMe')?.checked);

      if (!email || !password) return showToast('Enter email and password.', 'error');
      const user = getUsers().find((u) => u.email.toLowerCase() === email && u.password === password);
      if (!user) {
        addLog('auth', `Failed login for ${email}`, 'warn');
        return showToast('Invalid credentials.', 'error');
      }

      if (remember) localStorage.setItem(STORAGE.rememberEmail, email);
      else localStorage.removeItem(STORAGE.rememberEmail);

      user.lastLogin = nowISO();
      setUsers(getUsers().map((u) => (u.id === user.id ? user : u)));
      setSession({ userId: user.id, username: user.username, email: user.email, role: user.role, plan: user.plan || 'Free' });
      addLog('auth', `User logged in: ${email}`);

      window.location.href = parseReturnUrl() || 'dashboard.html';
    });
  }

  function initRegisterPage() {
    wirePasswordToggles();
    initPasswordMeters();

    qs('#registerForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = (qs('#registerUsername')?.value || '').trim();
      const email = (qs('#registerEmail')?.value || '').trim().toLowerCase();
      const password = (qs('#registerPassword')?.value || '').trim();
      const confirm = (qs('#registerConfirmPassword')?.value || '').trim();
      const accepted = Boolean(qs('#registerTerms')?.checked);

      if (!username || !email || !password || !confirm) return showToast('Complete all fields.', 'error');
      if (!email.includes('@')) return showToast('Enter a valid email.', 'error');
      if (scorePassword(password) < 50) return showToast('Use a stronger password.', 'error');
      if (password !== confirm) return showToast('Passwords do not match.', 'error');
      if (!accepted) return showToast('Accept terms to continue.', 'error');
      if (getUsers().some((u) => u.email.toLowerCase() === email)) return showToast('Email already registered.', 'error');

      const user = {
        id: uid('user'),
        username,
        email,
        password,
        role: 'user',
        trials: 5,
        points: 0,
        streak: 1,
        plan: 'Free',
        createdAt: nowISO(),
        lastLogin: nowISO()
      };
      const users = getUsers();
      users.push(user);
      setUsers(users);

      setSession({ userId: user.id, username: user.username, email: user.email, role: user.role, plan: user.plan });
      addLog('auth', `User registered: ${email}`);
      window.location.href = 'dashboard.html';
    });
  }

  function initTabs() {
    const tabs = qsa('.tab-btn');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.target;
        tabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        qsa('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === target));
      });
    });
  }

  function renderChatBubble(container, role, text, at) {
    const bubble = document.createElement('article');
    bubble.className = `bubble ${role}`;
    bubble.innerHTML = `<div class="meta">${role.toUpperCase()} - ${new Date(at).toLocaleTimeString()}</div><div>${escapeHtml(text)}</div>`;
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
    return bubble;
  }

  function userChatRows(userId) {
    return getJSON(STORAGE.chat, []).filter((r) => r.userId === userId);
  }

  function saveChatRow(row) {
    const rows = getJSON(STORAGE.chat, []);
    rows.push(row);
    setJSON(STORAGE.chat, rows.slice(-500));
  }

  function userMemoryRows(userId) {
    return getJSON(STORAGE.memories, []).filter((r) => r.userId === userId);
  }

  function saveMemoryRow(row) {
    const rows = getJSON(STORAGE.memories, []);
    rows.unshift(row);
    setJSON(STORAGE.memories, rows.slice(0, 500));
  }

  function renderMemoryList(userId) {
    const list = qs('#memoryList');
    if (!list) return;
    const rows = userMemoryRows(userId).slice(0, 60);
    if (!rows.length) {
      list.innerHTML = '<li class="muted">No saved memory yet.</li>';
      return;
    }
    list.innerHTML = rows
      .map(
        (row) => `<li class="card" style="padding:0.9rem;margin-bottom:0.7rem;"><strong>${escapeHtml(row.type)}</strong><p class="muted" style="margin:0.35rem 0;">${escapeHtml(row.input)}</p><p style="margin:0.35rem 0;">${escapeHtml(row.output).slice(0, 260)}</p><small class="muted">${new Date(row.at).toLocaleString()}</small></li>`
      )
      .join('');
  }

  function updateDashboardAnalytics(user) {
    const stats = getStats();
    const avg = stats.responseTimes.length ? stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length : 0;
    const moodWordsPositive = ['great', 'good', 'solid', 'nice', 'improved'];
    const moodWordsNegative = ['bad', 'error', 'failed', 'risk', 'issue'];
    const assistantRows = userChatRows(user.id).filter((r) => r.role === 'assistant').slice(-20);
    let score = 0;
    assistantRows.forEach((r) => {
      const t = r.text.toLowerCase();
      moodWordsPositive.forEach((w) => { if (t.includes(w)) score += 1; });
      moodWordsNegative.forEach((w) => { if (t.includes(w)) score -= 1; });
    });

    if (qs('#kpiTrials')) qs('#kpiTrials').textContent = String(user.trials || 0);
    if (qs('#kpiPlan')) qs('#kpiPlan').textContent = user.plan || 'Free';
    if (qs('#kpiMessages')) qs('#kpiMessages').textContent = String(stats.messages || 0);
    if (qs('#kpiAvgLatency')) qs('#kpiAvgLatency').textContent = `${avg.toFixed(2)}s`;
    if (qs('#kpiTools')) qs('#kpiTools').textContent = String(stats.toolRuns || 0);
    if (qs('#kpiImages')) qs('#kpiImages').textContent = String(stats.imageRuns || 0);
    if (qs('#kpiMood')) qs('#kpiMood').textContent = score > 2 ? 'Positive' : score < -2 ? 'Negative' : 'Neutral';
    if (qs('#engagementBar')) qs('#engagementBar').style.width = `${Math.min(100, Math.round(((stats.messages || 0) / 200) * 100))}%`;
  }

  function initDashboardPage() {
    const session = getSession();
    if (!session) return;

    const user = findUserById(session.userId);
    if (!user) {
      clearSession();
      window.location.href = 'login.html';
      return;
    }

    if (qs('#dashboardGreeting')) qs('#dashboardGreeting').textContent = `Welcome back, ${user.username}`;

    initTabs();
    const stream = qs('#chatStream');
    const input = qs('#chatInput');
    let lastAssistantReply = '';

    if (stream) {
      stream.innerHTML = '';
      const history = userChatRows(user.id).slice(-80);
      if (!history.length) {
        const welcome = 'Session is ready. Add your API key in Settings for live responses.';
        renderChatBubble(stream, 'assistant', welcome, nowISO());
        lastAssistantReply = welcome;
      } else {
        history.forEach((row) => {
          renderChatBubble(stream, row.role, row.text, row.at);
          if (row.role === 'assistant') lastAssistantReply = row.text;
        });
      }
    }

    async function sendChat() {
      const text = (input?.value || '').trim();
      if (!text || !stream) return;

      const fresh = findUserById(user.id);
      if (!fresh) return;
      if ((fresh.plan || 'Free') === 'Free' && (fresh.trials || 0) <= 0) {
        showToast('Free trials are exhausted. Upgrade in Payments.', 'error');
        return;
      }
      if ((fresh.plan || 'Free') === 'Free') {
        updateUser(user.id, (u) => ({ ...u, trials: Math.max(0, (u.trials || 0) - 1) }));
      }

      const userRow = { id: uid('chat'), userId: user.id, role: 'user', text, at: nowISO() };
      saveChatRow(userRow);
      renderChatBubble(stream, 'user', text, userRow.at);
      input.value = '';

      const loading = renderChatBubble(stream, 'assistant', 'Typing...', nowISO());
      try {
        const reply = await callAI(text);
        loading.remove();
        const aiRow = { id: uid('chat'), userId: user.id, role: 'assistant', text: reply, at: nowISO() };
        saveChatRow(aiRow);
        renderChatBubble(stream, 'assistant', reply, aiRow.at);
        lastAssistantReply = reply;

        saveMemoryRow({ id: uid('mem'), userId: user.id, type: 'Chat', input: text, output: reply, at: nowISO() });
        awardPoints(user.id, 10);
        renderMemoryList(user.id);
        const updated = findUserById(user.id);
        if (updated) updateDashboardAnalytics(updated);
      } catch (error) {
        loading.remove();
        renderChatBubble(stream, 'assistant', `Error: ${error.message}`, nowISO());
        showToast(error.message, 'error');
      }
    }

    qs('#chatSendBtn')?.addEventListener('click', sendChat);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChat();
      }
    });

    qs('#chatClearBtn')?.addEventListener('click', () => {
      setJSON(STORAGE.chat, getJSON(STORAGE.chat, []).filter((r) => r.userId !== user.id));
      if (stream) stream.innerHTML = '';
      showToast('Chat history cleared.', 'success');
    });

    qs('#chatExportBtn')?.addEventListener('click', () => {
      downloadJSON(`matrix-chat-${user.username}.json`, userChatRows(user.id));
    });

    qs('#voiceBtn')?.addEventListener('click', () => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) return showToast('Voice recognition is not supported in this browser.', 'error');
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.onresult = (e) => { if (input) input.value = e.results?.[0]?.[0]?.transcript || ''; };
      recognition.start();
    });

    qs('#chatSpeakBtn')?.addEventListener('click', () => {
      if (!('speechSynthesis' in window)) return showToast('Speech synthesis is not supported in this browser.', 'error');
      if (!lastAssistantReply) return showToast('No assistant response available yet.', 'error');
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(lastAssistantReply);
      utterance.rate = 1;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    });

    qs('#imageForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const prompt = (qs('#imagePrompt')?.value || '').trim();
      const style = (qs('#imageStyle')?.value || 'photorealistic').trim();
      const size = (qs('#imageSize')?.value || '1024x1024').trim();
      const preview = qs('#imagePreview');
      if (!prompt || !preview) return;

      preview.innerHTML = '<p class="muted">Generating image...</p>';
      const settings = getSettings();
      if (!(settings.apiKey || '').trim()) {
        preview.innerHTML = '<p class="muted">Set API key in Settings to generate images.</p>';
        return showToast('Add API key in Settings first.', 'error');
      }

      try {
        const res = await fetch(buildAiccUrl(settings.baseUrl, 'images/generations'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${settings.apiKey.trim()}`
          },
          body: JSON.stringify({ model: 'gpt-image-1', prompt: `${prompt}. style: ${style}`, size })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message || 'Image generation failed');

        const image = data?.data?.[0];
        const src = image?.url || (image?.b64_json ? `data:image/png;base64,${image.b64_json}` : '');
        if (!src) throw new Error('No image output returned');
        preview.innerHTML = `<img src="${src}" alt="Generated visual"/>`;

        saveMemoryRow({ id: uid('mem'), userId: user.id, type: 'Image', input: prompt, output: `style=${style}, size=${size}`, at: nowISO() });
        const stats = getStats();
        stats.imageRuns += 1;
        setStats(stats);
        awardPoints(user.id, 14);
        renderMemoryList(user.id);
        const updated = findUserById(user.id);
        if (updated) updateDashboardAnalytics(updated);
      } catch (error) {
        preview.innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
        showToast(error.message, 'error');
      }
    });

    qsa('.tool-card').forEach((card) => {
      const tool = card.dataset.tool;
      const toolInput = qs('[data-tool-input]', card);
      const toolOutput = qs('[data-tool-output]', card);
      const runBtn = qs('[data-tool-run]', card);
      if (!tool || !toolInput || !toolOutput || !runBtn) return;

      runBtn.addEventListener('click', async () => {
        const text = toolInput.value.trim();
        if (!text) return showToast('Enter input for this tool.', 'error');

        toolOutput.textContent = 'Working...';
        try {
          const reply = await callAI((TOOL_PROMPTS[tool] || ((x) => x))(text));
          toolOutput.textContent = reply;
          saveMemoryRow({ id: uid('mem'), userId: user.id, type: `Tool:${tool}`, input: text, output: reply, at: nowISO() });
          const stats = getStats();
          stats.toolRuns += 1;
          setStats(stats);
          awardPoints(user.id, 8);
          renderMemoryList(user.id);
          const updated = findUserById(user.id);
          if (updated) updateDashboardAnalytics(updated);
        } catch (error) {
          toolOutput.textContent = `Error: ${error.message}`;
          showToast(error.message, 'error');
        }
      });
    });

    qs('#clearMemoryBtn')?.addEventListener('click', () => {
      setJSON(STORAGE.memories, getJSON(STORAGE.memories, []).filter((r) => r.userId !== user.id));
      renderMemoryList(user.id);
      showToast('Memory cleared for this account.', 'success');
    });

    qs('#exportMemoryBtn')?.addEventListener('click', () => {
      downloadJSON(`matrix-memory-${user.username}.json`, userMemoryRows(user.id));
    });

    const importInput = qs('#memoryImportInput');
    qs('#importMemoryBtn')?.addEventListener('click', () => importInput?.click());
    importInput?.addEventListener('change', () => {
      const file = importInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const payload = JSON.parse(String(reader.result || '[]'));
          if (!Array.isArray(payload)) throw new Error('File is not an array');
          const merged = getJSON(STORAGE.memories, []);
          payload.forEach((row) => {
            merged.unshift({
              id: uid('mem'),
              userId: user.id,
              type: row.type || 'Imported',
              input: row.input || '',
              output: row.output || '',
              at: row.at || nowISO()
            });
          });
          setJSON(STORAGE.memories, merged.slice(0, 500));
          renderMemoryList(user.id);
          showToast('Memory imported.', 'success');
        } catch (error) {
          showToast(`Import failed: ${error.message}`, 'error');
        } finally {
          importInput.value = '';
        }
      };
      reader.readAsText(file);
    });

    renderMemoryList(user.id);
    updateDashboardAnalytics(user);
  }

  function initPaymentPage() {
    const session = getSession();
    if (!session) return;

    let billing = 'monthly';
    let selected = null;

    const promoInput = qs('#promoInput');
    const promoMsg = qs('#promoMessage');
    const grid = qs('#plansGrid');
    const modal = qs('#checkoutModal');

    function discount() {
      const code = (promoInput?.value || '').trim().toUpperCase();
      return PROMO_CODES[code] || 0;
    }

    function planPrice(plan) {
      const base = billing === 'monthly' ? plan.monthly : plan.yearly;
      return Number((base * (1 - discount())).toFixed(2));
    }

    function renderPromo() {
      if (!promoMsg) return;
      const code = (promoInput?.value || '').trim().toUpperCase();
      const d = discount();
      promoMsg.textContent = d ? `Promo ${code} applied: ${Math.round(d * 100)}% off` : (code ? 'Promo code not recognized' : 'Available codes: MATRIX10, BOOST20, WORLD30');
    }

    function renderPlans() {
      if (!grid) return;
      grid.innerHTML = PLANS.map((plan) => {
        const price = planPrice(plan);
        const cadence = billing === 'monthly' ? '/month' : '/year';
        const features = plan.features.map((f) => `<li>${escapeHtml(f)}</li>`).join('');
        return `<article class="plan-card ${plan.recommended ? 'recommended' : ''}">${plan.recommended ? '<div class="plan-tag">Best value</div>' : ''}<h3>${plan.name}</h3><div class="plan-price">$${price.toFixed(2)} <span class="muted" style="font-size:0.9rem">${cadence}</span></div><ul class="check-list">${features}</ul><button class="btn primary" data-plan-id="${plan.id}">Choose ${plan.name}</button></article>`;
      }).join('');

      qsa('[data-plan-id]', grid).forEach((button) => {
        button.addEventListener('click', () => {
          selected = PLANS.find((p) => p.id === button.dataset.planId) || null;
          if (!selected || !modal) return;
          if (qs('#checkoutPlanName')) qs('#checkoutPlanName').textContent = `${selected.name} (${billing})`;
          if (qs('#checkoutPlanPrice')) qs('#checkoutPlanPrice').textContent = `$${planPrice(selected).toFixed(2)}`;
          modal.classList.add('open');
        });
      });
    }

    function renderHistory() {
      const body = qs('#paymentHistoryBody');
      if (!body) return;
      const rows = getJSON(STORAGE.payments, []).filter((r) => r.userId === session.userId).slice(0, 12);
      if (!rows.length) {
        body.innerHTML = '<tr><td colspan="6" class="muted">No payments yet.</td></tr>';
        return;
      }
      body.innerHTML = rows.map((r) => `<tr><td>${new Date(r.at).toLocaleDateString()}</td><td>${escapeHtml(r.planName)}</td><td>${escapeHtml(r.billing)}</td><td>${escapeHtml(r.gateway)}</td><td>$${Number(r.finalPrice).toFixed(2)}</td><td>${escapeHtml(r.status)}</td></tr>`).join('');
    }

    function tickCountdown() {
      const countdown = qs('#offerCountdown');
      if (!countdown) return;
      let end = Number(localStorage.getItem(STORAGE.offerEndsAt) || 0);
      if (!end || end <= Date.now()) {
        end = Date.now() + 72 * 60 * 60 * 1000;
        localStorage.setItem(STORAGE.offerEndsAt, String(end));
      }
      const tick = () => {
        const left = end - Date.now();
        if (left <= 0) return (countdown.textContent = 'Special discount window ended');
        const h = Math.floor(left / (1000 * 60 * 60));
        const m = Math.floor((left % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((left % (1000 * 60)) / 1000);
        countdown.textContent = `Offer timer: ${h}h ${m}m ${s}s`;
      };
      tick();
      setInterval(tick, 1000);
    }

    qsa('[data-billing]').forEach((button) => {
      button.addEventListener('click', () => {
        billing = button.dataset.billing || 'monthly';
        qsa('[data-billing]').forEach((b) => b.classList.toggle('active', b === button));
        renderPlans();
      });
    });

    promoInput?.addEventListener('input', () => {
      renderPromo();
      renderPlans();
    });

    qs('#closeCheckoutBtn')?.addEventListener('click', () => modal?.classList.remove('open'));

    qs('#checkoutForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!selected) return;
      const gateway = qs('#checkoutGateway')?.value || 'paypal';
      const base = billing === 'monthly' ? selected.monthly : selected.yearly;
      const d = discount();
      const finalPrice = Number((base * (1 - d)).toFixed(2));

      const row = {
        id: uid('pay'),
        userId: session.userId,
        planId: selected.id,
        planName: selected.name,
        billing,
        gateway,
        basePrice: base,
        discount: d,
        finalPrice,
        status: 'confirmed',
        at: nowISO()
      };
      const payments = getJSON(STORAGE.payments, []);
      payments.unshift(row);
      setJSON(STORAGE.payments, payments.slice(0, 300));

      const upgraded = updateUser(session.userId, (u) => ({ ...u, plan: `${selected.name} ${billing}`, trials: selected.id === 'starter' ? 250 : 999, points: (u.points || 0) + 120 }));
      if (upgraded) setSession({ ...session, plan: upgraded.plan });

      addLog('payment', `Payment success: ${selected.name} via ${gateway} at $${finalPrice}`);
      modal?.classList.remove('open');
      renderHistory();
      updateNavForSession(getSession());
      showToast('Payment recorded and plan upgraded.', 'success');
    });

    renderPromo();
    renderPlans();
    renderHistory();
    tickCountdown();
  }

  function initLeaderboardPage() {
    const search = qs('#leaderboardSearch');
    const sort = qs('#leaderboardSort');
    const body = qs('#leaderboardBody');
    const yourRank = qs('#yourRank');
    const session = getSession();

    function render() {
      if (!body) return;
      const term = (search?.value || '').trim().toLowerCase();
      const mode = sort?.value || 'points';
      let rows = getUsers().filter((u) => u.username.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));

      if (mode === 'points') rows.sort((a, b) => (b.points || 0) - (a.points || 0));
      if (mode === 'streak') rows.sort((a, b) => (b.streak || 0) - (a.streak || 0));
      if (mode === 'name') rows.sort((a, b) => a.username.localeCompare(b.username));

      body.innerHTML = rows.map((u, i) => `<tr ${session && u.id === session.userId ? 'style="font-weight:700"' : ''}><td><span class="rank-pill">${i + 1}</span></td><td>${escapeHtml(u.username)}</td><td>${escapeHtml(u.plan || 'Free')}</td><td>${u.points || 0}</td><td>${u.streak || 0}</td></tr>`).join('');
      if (session && yourRank) {
        const idx = rows.findIndex((u) => u.id === session.userId);
        yourRank.textContent = idx >= 0 ? `Your rank: #${idx + 1}` : 'Your rank: unranked';
      }
    }

    search?.addEventListener('input', render);
    sort?.addEventListener('change', render);
    render();
  }

  function initAdminPage() {
    const session = getSession();
    if (!session || session.role !== 'admin') return;

    const body = qs('#adminUsersBody');
    const search = qs('#adminUserSearch');

    function renderUsers() {
      if (!body) return;
      const term = (search?.value || '').trim().toLowerCase();
      const users = getUsers().filter((u) => u.username.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
      body.innerHTML = users.map((u) => `<tr><td>${escapeHtml(u.username)}</td><td>${escapeHtml(u.email)}</td><td>${escapeHtml(u.role || 'user')}</td><td><input class="input" style="padding:0.35rem;min-width:80px" type="number" data-field="trials" data-id="${u.id}" value="${u.trials || 0}"></td><td><input class="input" style="padding:0.35rem;min-width:90px" type="number" data-field="points" data-id="${u.id}" value="${u.points || 0}"></td><td><input class="input" style="padding:0.35rem;min-width:130px" type="text" data-field="plan" data-id="${u.id}" value="${escapeHtml(u.plan || 'Free')}"></td><td class="inline-row"><button class="btn ghost" data-action="save-user" data-id="${u.id}">Save</button><button class="btn ghost" data-action="toggle-role" data-id="${u.id}">Toggle Role</button><button class="btn danger" data-action="delete-user" data-id="${u.id}">Delete</button></td></tr>`).join('');
    }

    search?.addEventListener('input', renderUsers);

    body?.addEventListener('click', (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const action = target.dataset.action;
      const id = target.dataset.id;
      if (!action || !id) return;

      if (action === 'save-user') {
        const trials = Number(qs(`[data-field="trials"][data-id="${id}"]`)?.value || 0);
        const points = Number(qs(`[data-field="points"][data-id="${id}"]`)?.value || 0);
        const plan = String(qs(`[data-field="plan"][data-id="${id}"]`)?.value || 'Free').trim() || 'Free';
        updateUser(id, (u) => ({ ...u, trials, points, plan }));
        showToast('User saved.', 'success');
      }

      if (action === 'toggle-role') {
        updateUser(id, (u) => ({ ...u, role: u.role === 'admin' ? 'user' : 'admin' }));
        renderUsers();
        showToast('Role updated.', 'success');
      }

      if (action === 'delete-user') {
        if (id === session.userId) return showToast('You cannot delete your own account.', 'error');
        setUsers(getUsers().filter((u) => u.id !== id));
        renderUsers();
        showToast('User removed.', 'success');
      }
    });

    qs('#adminAnnouncementForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = (qs('#announcementText')?.value || '').trim();
      const expires = (qs('#announcementExpiry')?.value || '').trim();
      if (!text) return showToast('Announcement text is required.', 'error');
      setJSON(STORAGE.announcement, {
        text,
        expiresAt: expires ? new Date(expires).toISOString() : null,
        updatedAt: nowISO()
      });
      if (qs('#adminAnnouncementPreview')) {
        qs('#adminAnnouncementPreview').textContent = `${text}${expires ? ` (expires ${expires})` : ''}`;
      }
      showToast('Announcement saved.', 'success');
    });

    qs('#adminExportBtn')?.addEventListener('click', () => {
      const snapshot = {};
      Object.keys(localStorage).filter((k) => k.startsWith('matrix_')).forEach((k) => (snapshot[k] = localStorage.getItem(k)));
      downloadJSON(`matrix-backup-${new Date().toISOString().slice(0, 10)}.json`, snapshot);
      showToast('Backup exported.', 'success');
    });

    const importInput = qs('#backupImportInput');
    qs('#adminImportBtn')?.addEventListener('click', () => importInput?.click());
    importInput?.addEventListener('change', () => {
      const file = importInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const payload = JSON.parse(String(reader.result || '{}'));
          if (typeof payload !== 'object' || Array.isArray(payload) || payload === null) throw new Error('Backup must be a JSON object');
          Object.entries(payload).forEach(([k, v]) => { if (k.startsWith('matrix_')) localStorage.setItem(k, String(v)); });
          renderUsers();
          showToast('Backup imported.', 'success');
        } catch (error) {
          showToast(`Import failed: ${error.message}`, 'error');
        } finally {
          importInput.value = '';
        }
      };
      reader.readAsText(file);
    });

    qs('#adminClearLogsBtn')?.addEventListener('click', () => {
      setJSON(STORAGE.logs, []);
      showToast('Logs cleared.', 'success');
      if (qs('#adminLog')) qs('#adminLog').innerHTML = '<li class="muted">No logs yet.</li>';
    });

    const logs = getJSON(STORAGE.logs, []).slice(0, 25);
    if (qs('#adminLog')) qs('#adminLog').innerHTML = logs.length ? logs.map((l) => `<li>${new Date(l.at).toLocaleString()} - [${l.type}] ${escapeHtml(l.detail)}</li>`).join('') : '<li class="muted">No logs yet.</li>';

    renderUsers();
  }

  function initSettingsPage() {
    const form = qs('#settingsForm');
    if (!form) return;

    const s = getSettings();
    if (qs('#settingsTheme')) qs('#settingsTheme').value = s.theme;
    if (qs('#settingsApiKey')) qs('#settingsApiKey').value = s.apiKey;
    if (qs('#settingsBaseUrl')) qs('#settingsBaseUrl').value = s.baseUrl;
    if (qs('#settingsApiMode')) qs('#settingsApiMode').value = s.apiMode || DEFAULT_SETTINGS.apiMode;
    if (qs('#settingsModel')) qs('#settingsModel').value = s.model;
    if (qs('#settingsVideoModel')) qs('#settingsVideoModel').value = s.videoModel || s.model;
    if (qs('#settingsStoreResponses')) qs('#settingsStoreResponses').checked = Boolean(s.storeResponses);
    if (qs('#settingsSystemPrompt')) qs('#settingsSystemPrompt').value = s.systemPrompt;
    if (qs('#settingsTemperature')) qs('#settingsTemperature').value = String(s.temperature);
    if (qs('#settingsTemperatureLabel')) qs('#settingsTemperatureLabel').textContent = String(s.temperature);

    qs('#settingsTemperature')?.addEventListener('input', () => {
      if (qs('#settingsTemperatureLabel')) qs('#settingsTemperatureLabel').textContent = qs('#settingsTemperature').value;
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      setSettings({
        theme: qs('#settingsTheme')?.value || 'dark',
        apiKey: qs('#settingsApiKey')?.value || '',
        baseUrl: sanitizeBaseUrl(qs('#settingsBaseUrl')?.value || DEFAULT_SETTINGS.baseUrl),
        apiMode: qs('#settingsApiMode')?.value || DEFAULT_SETTINGS.apiMode,
        model: qs('#settingsModel')?.value || DEFAULT_SETTINGS.model,
        videoModel: qs('#settingsVideoModel')?.value || qs('#settingsModel')?.value || DEFAULT_SETTINGS.videoModel,
        storeResponses: Boolean(qs('#settingsStoreResponses')?.checked),
        systemPrompt: qs('#settingsSystemPrompt')?.value || DEFAULT_SETTINGS.systemPrompt,
        temperature: Number(qs('#settingsTemperature')?.value || DEFAULT_SETTINGS.temperature)
      });
      applyTheme(getSettings().theme);
      showToast('Settings saved.', 'success');
    });

    qs('#testApiBtn')?.addEventListener('click', async () => {
      if (qs('#testApiResult')) qs('#testApiResult').textContent = 'Testing...';
      try {
        const reply = await callAI('Tell me about San Francisco', {
          apiMode: qs('#settingsApiMode')?.value || DEFAULT_SETTINGS.apiMode,
          maxOutputTokens: 256
        });
        if (qs('#testApiResult')) qs('#testApiResult').textContent = reply;
        showToast('API test successful.', 'success');
      } catch (error) {
        if (qs('#testApiResult')) qs('#testApiResult').textContent = `Error: ${error.message}`;
        showToast(error.message, 'error');
      }
    });

    qs('#settingsUseAiccDefaultsBtn')?.addEventListener('click', () => {
      if (qs('#settingsBaseUrl')) qs('#settingsBaseUrl').value = 'https://api.ai.cc/v1';
      if (qs('#settingsApiMode')) qs('#settingsApiMode').value = 'chat_completions';
      if (qs('#settingsModel')) qs('#settingsModel').value = 'gpt-4o';
      if (qs('#settingsVideoModel')) qs('#settingsVideoModel').value = 'gpt-4o';
      if (qs('#settingsSystemPrompt')) qs('#settingsSystemPrompt').value = 'You are a travel agent. Be descriptive and helpful.';
      if (qs('#settingsTemperature')) qs('#settingsTemperature').value = '0.7';
      if (qs('#settingsTemperatureLabel')) qs('#settingsTemperatureLabel').textContent = '0.7';
      showToast('AICC defaults applied. Save settings to persist.', 'success');
    });

    qs('#settingsLoadModelsBtn')?.addEventListener('click', async () => {
      const output = qs('#settingsModelsOutput');
      if (output) output.textContent = 'Loading models...';
      try {
        const models = await listAvailableModels({ useCache: true });
        if (output) {
          output.textContent = models.length
            ? models.slice(0, 120).join('\n')
            : 'No models returned.';
        }
        const modelOptions = qs('#settingsModelOptions');
        if (modelOptions) {
          modelOptions.innerHTML = models
            .slice(0, 200)
            .map((m) => `<option value="${escapeHtml(m)}"></option>`)
            .join('');
        }
        showToast(`Loaded ${models.length} models.`, 'success');
      } catch (error) {
        if (output) output.textContent = `Error: ${error.message}`;
        showToast(error.message, 'error');
      }
    });

    qs('#settingsRunDiagnosticsBtn')?.addEventListener('click', async () => {
      const out = qs('#settingsDiagnosticsOutput');
      const lines = [];
      const started = new Date();
      if (out) out.textContent = 'Running diagnostics...';
      const settings = getSettings();

      lines.push(`Started: ${started.toLocaleString()}`);
      lines.push(`Base URL: ${sanitizeBaseUrl(settings.baseUrl || DEFAULT_SETTINGS.baseUrl)}`);
      lines.push(`API Mode: ${settings.apiMode || DEFAULT_SETTINGS.apiMode}`);
      lines.push(`Model: ${settings.model || DEFAULT_SETTINGS.model}`);
      lines.push(`Video Model: ${settings.videoModel || settings.model || DEFAULT_SETTINGS.videoModel}`);
      lines.push(`API Key: ${(settings.apiKey || '').trim() ? 'Present' : 'Missing'}`);
      lines.push('');

      if (!(settings.apiKey || '').trim()) {
        lines.push('Connectivity checks skipped: API key is missing.');
        if (out) out.textContent = lines.join('\n');
        return;
      }

      try {
        const models = await listAvailableModels({ useCache: false });
        lines.push(`Model List: OK (${models.length} models)`);
      } catch (error) {
        lines.push(`Model List: FAIL (${error.message})`);
      }

      try {
        const probe = await callAI('Reply with exactly: MATRIX_OK', {
          apiMode: settings.apiMode,
          includeSystemPrompt: false,
          maxOutputTokens: 24
        });
        lines.push(`Chat Test: OK (${probe.slice(0, 90).replace(/\s+/g, ' ')})`);
      } catch (error) {
        lines.push(`Chat Test: FAIL (${error.message})`);
      }

      if (out) out.textContent = lines.join('\n');
    });

    const session = getSession();
    qs('#settingsClearChatBtn')?.addEventListener('click', () => {
      if (!session) return;
      setJSON(STORAGE.chat, getJSON(STORAGE.chat, []).filter((r) => r.userId !== session.userId));
      showToast('Your chat history was cleared.', 'success');
    });

    qs('#settingsClearMemoryBtn')?.addEventListener('click', () => {
      if (!session) return;
      setJSON(STORAGE.memories, getJSON(STORAGE.memories, []).filter((r) => r.userId !== session.userId));
      showToast('Your memories were cleared.', 'success');
    });

    qs('#settingsExportProfileBtn')?.addEventListener('click', () => {
      if (!session) return;
      downloadJSON(`matrix-profile-${session.username}.json`, {
        user: findUserById(session.userId),
        settings: getSettings(),
        chat: userChatRows(session.userId),
        memories: userMemoryRows(session.userId)
      });
    });

    qs('#settingsExportBackupBtn')?.addEventListener('click', () => {
      const snapshot = {};
      Object.keys(localStorage)
        .filter((k) => k.startsWith('matrix_'))
        .forEach((k) => (snapshot[k] = localStorage.getItem(k)));
      downloadJSON(`matrix-backup-${new Date().toISOString().slice(0, 10)}.json`, snapshot);
      showToast('Full backup exported.', 'success');
    });

    qs('#settingsResetAllBtn')?.addEventListener('click', () => {
      const ok = window.confirm('This will clear all MatrixAI local data for this browser. Continue?');
      if (!ok) return;
      Object.keys(localStorage)
        .filter((k) => k.startsWith('matrix_'))
        .forEach((k) => localStorage.removeItem(k));
      showToast('All local MatrixAI data cleared. Reloading...', 'success');
      setTimeout(() => window.location.reload(), 900);
    });
  }

  function initRoadmapPage() {
    const session = getSession();
    if (!session) return;

    const votes = getJSON(STORAGE.roadmapVotes, {});
    const ideas = getJSON(STORAGE.roadmapIdeas, []);

    function renderVotes() {
      qsa('.roadmap-item').forEach((card) => {
        const feature = card.dataset.feature;
        const count = qs('.votes', card);
        const button = qs('[data-vote]', card);
        if (!feature || !count || !button) return;

        const bucket = votes[feature] || { count: 0, voters: [] };
        count.textContent = `${bucket.count} votes`;
        const voted = bucket.voters.includes(session.userId);
        button.disabled = voted;
        button.textContent = voted ? 'Voted' : 'Vote';
      });
    }

    function renderIdeas() {
      const list = qs('#ideaList');
      if (!list) return;
      if (!ideas.length) {
        list.innerHTML = '<li class="muted">No ideas submitted yet.</li>';
        return;
      }
      list.innerHTML = ideas.slice(0, 30).map((i) => `<li>${escapeHtml(i.text)} <span class="muted">- ${escapeHtml(i.user)} (${new Date(i.at).toLocaleDateString()})</span></li>`).join('');
    }

    qsa('[data-vote]').forEach((button) => {
      button.addEventListener('click', () => {
        const card = button.closest('.roadmap-item');
        const feature = card?.dataset.feature;
        if (!feature) return;

        const bucket = votes[feature] || { count: 0, voters: [] };
        if (!bucket.voters.includes(session.userId)) {
          bucket.count += 1;
          bucket.voters.push(session.userId);
          votes[feature] = bucket;
          setJSON(STORAGE.roadmapVotes, votes);
          awardPoints(session.userId, 3);
          renderVotes();
        }
      });
    });

    qs('#ideaForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = qs('#ideaInput');
      const text = (input?.value || '').trim();
      if (!text) return;
      ideas.unshift({ id: uid('idea'), user: session.username, userId: session.userId, text, at: nowISO() });
      setJSON(STORAGE.roadmapIdeas, ideas.slice(0, 120));
      if (input) input.value = '';
      awardPoints(session.userId, 4);
      renderIdeas();
    });

    renderVotes();
    renderIdeas();
  }

  function normalizeTaskStatus(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (!normalized) return 'unknown';
    if (normalized === 'succeeded') return 'completed';
    if (normalized === 'in_progress') return 'processing';
    return normalized;
  }

  function isTerminalTaskStatus(status) {
    const normalized = normalizeTaskStatus(status);
    return ['completed', 'failed', 'cancelled', 'canceled', 'expired'].includes(normalized);
  }

  function getVideoTaskOutputUrl(task) {
    if (!task || typeof task !== 'object') return '';
    const candidates = [
      task.output_url,
      task.url,
      task.content_url,
      task.result_url,
      task.download_url,
      task.video_url,
      task?.metadata?.url,
      task?.metadata?.video_url,
      task?.metadata?.output_url,
      task?.metadata?.download_url,
      task?.data?.url,
      task?.data?.video_url,
      Array.isArray(task?.output) ? task.output[0]?.url : '',
      Array.isArray(task?.output) ? task.output[0]?.video_url : ''
    ];
    for (const candidate of candidates) {
      const value = String(candidate || '').trim();
      if (value && /^https?:\/\//i.test(value)) return value;
    }
    return '';
  }

  function initVideoPage() {
    const session = getSession();
    if (!session) return;

    let settings = getSettings();
    const promptInput = qs('#videoPrompt');
    const styleInput = qs('#videoStyle');
    const durationInput = qs('#videoDuration');
    const formatInput = qs('#videoFormat');
    const motionStyleInput = qs('#videoMotionStyle');
    const modeInput = qs('#videoRenderMode');
    const captionOverlayInput = qs('#videoCaptionOverlay');
    const autoPollInput = qs('#videoAutoPoll');
    const autoNarrationInput = qs('#videoAutoNarration');
    const modelInput = qs('#videoTaskModel');
    const shotTypeInput = qs('#videoTaskShotType');
    const promptExtendInput = qs('#videoTaskPromptExtend');
    const audioUrlInput = qs('#videoTaskAudioUrl');
    const taskIdInput = qs('#videoTaskIdInput');
    const extraJsonInput = qs('#videoTaskExtraJson');
    const taskPanel = qs('#videoTaskPanel');
    const taskLink = qs('#videoTaskContentLink');
    const loadModelsBtn = qs('#videoLoadModelsBtn');
    const storyboardOutput = qs('#videoStoryboard');
    const imageFeedInput = qs('#videoImageFeedInput');
    const photoUploadInput = qs('#videoPhotoUploadInput');
    const imageFeedMeta = qs('#videoFeedMeta');
    const imageFeedPreview = qs('#videoImageFeedPreview');
    const renderProgress = qs('#videoRenderProgress');
    const status = qs('#videoStatus');
    const preview = qs('#videoPreview');
    const download = qs('#videoDownloadLink');
    const history = qs('#videoHistory');
    const narrationInput = qs('#videoNarrationScript');
    const voiceSelect = qs('#videoVoiceSelect');
    const voiceRateInput = qs('#videoVoiceRate');
    const voicePitchInput = qs('#videoVoicePitch');
    const voiceRateLabel = qs('#videoVoiceRateLabel');
    const voicePitchLabel = qs('#videoVoicePitchLabel');

    let storyboardScenes = [];
    let imageFeedItems = [];
    let uploadedPhotoItems = [];
    let currentObjectUrl = '';
    let lastTask = null;
    let lastNarratedTaskId = '';
    let taskPollTimer = null;
    let taskPollAttempts = 0;
    let taskPollFailures = 0;
    let taskPollInFlight = false;
    let taskPollNonce = 0;

    const sampleFeed = {
      images: [
        {
          title: 'Lion - Wikipedia',
          imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Lion_waiting_in_Namibia.jpg/1200px-Lion_waiting_in_Namibia.jpg',
          source: 'Wikipedia',
          domain: 'en.wikipedia.org',
          link: 'https://en.wikipedia.org/wiki/Lion',
          position: 1
        },
        {
          title: 'Lion',
          imageUrl: 'https://i.natgeofe.com/k/1d33938b-3d02-4773-91e3-70b113c3b8c7/lion-male-roar_3x2.jpg?wp=1&w=1084.125&h=721.875',
          source: 'National Geographic Kids',
          domain: 'kids.nationalgeographic.com',
          link: 'https://kids.nationalgeographic.com/animals/mammals/facts/lion',
          position: 2
        },
        {
          title: 'Lion | WWF',
          imageUrl: 'https://files.worldwildlife.org/wwfcmsprod/images/Lion_Kenya/hero_small/7seqacudmc_Medium_WW2116702.jpg',
          source: 'WWF',
          domain: 'worldwildlife.org',
          link: 'https://www.worldwildlife.org/species/lion--19',
          position: 3
        }
      ]
    };

    function refreshSettings() {
      settings = getSettings();
    }

    function setRenderProgress(value, visible) {
      if (!renderProgress) return;
      if (typeof value === 'number') renderProgress.value = Math.max(0, Math.min(100, Number(value) || 0));
      if (typeof visible === 'boolean') renderProgress.classList.toggle('hidden', !visible);
    }

    function getCombinedFeedItems() {
      return [...uploadedPhotoItems, ...imageFeedItems];
    }

    function revokeUploadedPhotoUrls() {
      uploadedPhotoItems.forEach((item) => {
        if (item?.isUpload && item?.imageUrl && String(item.imageUrl).startsWith('blob:')) {
          URL.revokeObjectURL(item.imageUrl);
        }
      });
    }

    function updateVoiceLabels() {
      if (voiceRateLabel && voiceRateInput) voiceRateLabel.textContent = Number(voiceRateInput.value || 1).toFixed(1);
      if (voicePitchLabel && voicePitchInput) voicePitchLabel.textContent = Number(voicePitchInput.value || 1).toFixed(1);
    }

    function populateVoiceOptions() {
      if (!voiceSelect) return;
      if (!('speechSynthesis' in window)) {
        voiceSelect.innerHTML = '<option value="">Speech not supported in this browser</option>';
        voiceSelect.disabled = true;
        return;
      }

      const voices = window.speechSynthesis.getVoices() || [];
      if (!voices.length) {
        voiceSelect.innerHTML = '<option value="">Loading voices...</option>';
        return;
      }

      const preferred = voices.find((voice) => /en(-|_)?us/i.test(voice.lang)) || voices[0];
      voiceSelect.innerHTML = voices
        .map((voice, idx) => {
          const label = `${voice.name} (${voice.lang})${voice.default ? ' - default' : ''}`;
          return `<option value="${escapeHtml(String(idx))}">${escapeHtml(label)}</option>`;
        })
        .join('');
      voiceSelect.disabled = false;
      if (preferred) {
        const preferredIndex = voices.indexOf(preferred);
        if (preferredIndex >= 0) voiceSelect.value = String(preferredIndex);
      }
    }

    function stopNarration() {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    }

    function buildFallbackNarration() {
      if (storyboardScenes.length) {
        return storyboardScenes
          .slice(0, 8)
          .map((scene, idx) => `Scene ${idx + 1}: ${scene.title}. ${scene.description}`)
          .join(' ');
      }
      const prompt = (promptInput?.value || '').trim();
      return prompt
        ? `Welcome to this AI video. ${prompt}. Stay tuned for the highlights.`
        : 'Welcome to your MatrixAI generated video.';
    }

    function speakNarration() {
      const text = (narrationInput?.value || '').trim() || buildFallbackNarration();
      if (!text) {
        showToast('Generate or enter narration text first.', 'error');
        return;
      }
      if (!('speechSynthesis' in window)) {
        showToast('Voice playback is not supported in this browser.', 'error');
        return;
      }

      const voices = window.speechSynthesis.getVoices() || [];
      const selectedIndex = Number(voiceSelect?.value ?? 0);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = Math.max(0.6, Math.min(1.4, Number(voiceRateInput?.value || 1)));
      utterance.pitch = Math.max(0.7, Math.min(1.4, Number(voicePitchInput?.value || 1)));
      if (voices[selectedIndex]) utterance.voice = voices[selectedIndex];

      utterance.onstart = () => {
        if (status) status.textContent = 'Playing AI narration voice...';
      };
      utterance.onend = () => {
        if (status) status.textContent = 'Narration complete.';
      };
      utterance.onerror = () => {
        if (status) status.textContent = 'Narration stopped.';
      };

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }

    async function generateNarrationScript() {
      refreshSettings();
      const prompt = (promptInput?.value || '').trim();
      if (!prompt && !storyboardScenes.length) {
        showToast('Add a prompt or generate storyboard first.', 'error');
        return;
      }
      if (status) status.textContent = 'Generating narration script...';

      const sceneSummary = storyboardScenes
        .slice(0, 8)
        .map((scene) => `${scene.title}: ${scene.description}`)
        .join('\n');

      const instruction = [
        'Write a natural voiceover narration script for a short video.',
        'Use 80 to 130 words.',
        'Tone: engaging and cinematic.',
        'Return plain text only, no markdown.',
        `Style: ${styleInput?.value || 'cinematic'}`,
        `Duration target: ${durationInput?.value || 12} seconds`,
        prompt ? `Video prompt: ${prompt}` : 'Video prompt not provided.',
        sceneSummary ? `Storyboard scenes:\n${sceneSummary}` : 'No storyboard scenes yet.',
        getCombinedFeedItems().length ? `Image references: ${getCombinedFeedItems().length}` : 'No image references.'
      ].join('\n');

      try {
        const script = await callAI(instruction, {
          model: settings.videoModel || settings.model,
          maxOutputTokens: 260,
          includeSystemPrompt: true
        });
        if (narrationInput) narrationInput.value = script.trim();
        if (status) status.textContent = 'Narration script generated.';
        showToast('Narration script ready.', 'success');
      } catch (error) {
        if (narrationInput && !narrationInput.value.trim()) narrationInput.value = buildFallbackNarration();
        if (status) status.textContent = `Narration fallback ready. ${error.message}`;
        showToast('Used fallback narration because live script generation failed.', 'warn');
      }
    }

    function updateTaskPanel(task) {
      if (!taskPanel) return;
      if (!task || !task.id) {
        taskPanel.textContent = 'No API task yet.';
        if (taskLink) {
          taskLink.classList.add('hidden');
          taskLink.removeAttribute('href');
        }
        return;
      }
      const lines = [
        `id: ${task.id}`,
        `model: ${task.model || '-'}`,
        `status: ${normalizeTaskStatus(task.status)}`,
        `progress: ${Number(task.progress || 0)}%`,
        `seconds: ${task.seconds || '-'}`,
        `created_at: ${task.created_at || '-'}`,
        task.completed_at ? `completed_at: ${task.completed_at}` : ''
      ].filter(Boolean);
      taskPanel.textContent = lines.join('\n');

      const maybeUrl = getVideoTaskOutputUrl(task);

      if (taskLink) {
        if (maybeUrl) {
          taskLink.href = maybeUrl;
          taskLink.classList.remove('hidden');
        } else {
          taskLink.classList.add('hidden');
          taskLink.removeAttribute('href');
        }
      }

      const canPreview = /\.(mp4|webm|mov)(\?|#|$)/i.test(maybeUrl);
      if (preview && maybeUrl && canPreview) {
        preview.src = maybeUrl;
        preview.load();
      }
    }

    function resolveDimensions() {
      const format = formatInput?.value || '16:9';
      if (format === '9:16') return { width: 720, height: 1280, format };
      if (format === '1:1') return { width: 960, height: 960, format };
      return { width: 1280, height: 720, format: '16:9' };
    }

    function renderVideoHistory() {
      if (!history) return;
      const rows = getJSON(STORAGE.videos, []).filter((row) => row.userId === session.userId).slice(0, 12);
      if (!rows.length) {
        history.innerHTML = '<li class="muted">No generated videos yet.</li>';
        return;
      }
      history.innerHTML = rows
        .map((row) => {
          const statusText = row.mode === 'aicc-task'
            ? `${normalizeTaskStatus(row.status || 'queued')} (${Number(row.progress || 0)}%)`
            : 'local render complete';
          const outputLink = row.outputUrl
            ? `<a class="btn ghost" href="${escapeHtml(row.outputUrl)}" target="_blank" rel="noopener">Open Output</a>`
            : '';
          return `
            <li class="card" style="padding:0.75rem;margin-bottom:0.55rem;">
              <strong>${new Date(row.at).toLocaleString()}</strong> - ${escapeHtml(row.prompt || 'Untitled video')}
              <div class="muted">${row.durationSec || '-'}s, ${escapeHtml(row.format || '-')}, ${escapeHtml(row.mode || 'storyboard')}</div>
              <div class="muted">Status: ${escapeHtml(statusText)}</div>
              ${outputLink}
            </li>
          `;
        })
        .join('');
    }

    function renderFeedPreview() {
      const combined = getCombinedFeedItems();
      if (imageFeedMeta) {
        imageFeedMeta.textContent = combined.length
          ? `${uploadedPhotoItems.length} uploaded + ${imageFeedItems.length} JSON = ${combined.length} total images`
          : 'No image feed loaded.';
      }
      if (!imageFeedPreview) return;
      if (!combined.length) {
        imageFeedPreview.innerHTML = '<p class="muted">Upload photos or paste feed JSON, then load.</p>';
        return;
      }
      imageFeedPreview.innerHTML = combined
        .slice(0, 9)
        .map(
          (item) => `
            <article class="feed-card">
              <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}" loading="lazy">
              <div>
                <strong>${escapeHtml(item.title)}</strong>
                <small class="muted">${escapeHtml(item.source || item.domain || '')}</small>
              </div>
            </article>
          `
        )
        .join('');
    }

    function loadFeedFromInput() {
      const raw = (imageFeedInput?.value || '').trim();
      imageFeedItems = normalizeImageFeed(raw);
      if (!imageFeedItems.length) {
        showToast('No valid images found in feed JSON.', 'error');
      } else {
        showToast(`Loaded ${imageFeedItems.length} images from feed.`, 'success');
      }
      renderFeedPreview();
      return imageFeedItems;
    }

    function importUploadedPhotos(fileList) {
      const files = Array.from(fileList || []).filter((file) => String(file.type || '').startsWith('image/'));
      if (!files.length) {
        showToast('Select one or more image files.', 'error');
        return;
      }

      revokeUploadedPhotoUrls();
      uploadedPhotoItems = files.slice(0, 30).map((file, idx) => ({
        index: idx + 1,
        title: file.name || `Upload ${idx + 1}`,
        imageUrl: URL.createObjectURL(file),
        source: 'Local Upload',
        domain: 'local-device',
        link: '',
        position: idx + 1,
        isUpload: true
      }));
      renderFeedPreview();
      showToast(`Loaded ${uploadedPhotoItems.length} uploaded photos.`, 'success');
    }

    async function generateStoryboard() {
      refreshSettings();
      const prompt = (promptInput?.value || '').trim();
      const style = (styleInput?.value || 'cinematic').trim();
      const duration = Number(durationInput?.value || 12);
      if (!prompt) {
        showToast('Enter a video prompt first.', 'error');
        return;
      }

      if (status) status.textContent = 'Generating storyboard with AI...';
      const instruction = [
        'Create a concise JSON storyboard for a short AI video.',
        'Output strictly in JSON with key "scenes".',
        'Each scene should have title, description, color (hex).',
        'Use 5 to 8 scenes.',
        `Style: ${style}`,
        `Target duration seconds: ${duration}`,
        getCombinedFeedItems().length ? `Use this visual context count: ${getCombinedFeedItems().length} image references.` : 'No image feed context provided.',
        `Prompt: ${prompt}`
      ].join('\n');

      try {
        const raw = await callAI(instruction, {
          model: settings.videoModel || settings.model,
          maxOutputTokens: 900
        });
        storyboardScenes = normalizeScenes(raw);
        if (storyboardOutput) {
          storyboardOutput.textContent = JSON.stringify({ scenes: storyboardScenes }, null, 2);
        }
        if (status) status.textContent = `Storyboard ready with ${storyboardScenes.length} scenes.`;
      } catch (error) {
        if (status) status.textContent = `Failed: ${error.message}`;
        showToast(error.message, 'error');
      }
    }

    function resolveHybridFeed() {
      const combined = getCombinedFeedItems();
      if (!combined.length || !storyboardScenes.length) return combined;
      return combined.map((item, index) => {
        const scene = storyboardScenes[index % storyboardScenes.length];
        return {
          ...item,
          title: scene?.title || item.title,
          source: item.source || scene?.description || item.domain
        };
      });
    }

    function safeJsonObject(raw) {
      if (!raw || !raw.trim()) return {};
      const parsed = extractJsonBlock(raw.trim()) || (() => {
        try {
          return JSON.parse(raw.trim());
        } catch {
          return null;
        }
      })();
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    }

    function buildVideoTaskPayload() {
      const prompt = (promptInput?.value || '').trim();
      const model = (modelInput?.value || settings.videoModel || settings.model || 'wan2.6-t2v').trim();
      const duration = Math.max(1, Math.min(60, Number(durationInput?.value || 10)));
      const shotType = (shotTypeInput?.value || 'multi').trim();
      const promptExtend = Boolean(promptExtendInput?.checked);
      const audioUrl = (audioUrlInput?.value || '').trim();
      const extra = safeJsonObject(extraJsonInput?.value || '');

      const format = formatInput?.value || '16:9';
      const size = format === '9:16' ? '720*1280' : format === '1:1' ? '960*960' : '1280*720';

      const payload = {
        model,
        input: {
          prompt
        },
        parameters: {
          size,
          duration,
          shot_type: shotType,
          prompt_extend: promptExtend
        }
      };
      if (audioUrl) payload.input.audio_url = audioUrl;

      const merged = { ...payload, ...extra };
      if (extra.input && typeof extra.input === 'object' && !Array.isArray(extra.input)) {
        merged.input = { ...payload.input, ...extra.input };
      }
      if (extra.parameters && typeof extra.parameters === 'object' && !Array.isArray(extra.parameters)) {
        merged.parameters = { ...payload.parameters, ...extra.parameters };
      }
      return merged;
    }

    function upsertVideoTaskHistory(task, payload, prompt) {
      const taskId = String(task?.id || '').trim();
      if (!taskId) return;

      const videos = getJSON(STORAGE.videos, []);
      const idx = videos.findIndex((v) => v.taskId === taskId && v.userId === session.userId);
      const outputUrl = getVideoTaskOutputUrl(task);
      const base = {
        id: idx >= 0 ? videos[idx].id : uid('video'),
        taskId,
        userId: session.userId,
        prompt: prompt || videos[idx]?.prompt || '',
        style: styleInput?.value || videos[idx]?.style || 'cinematic',
        durationSec: Number(durationInput?.value || videos[idx]?.durationSec || 10),
        format: formatInput?.value || videos[idx]?.format || '16:9',
        mode: 'aicc-task',
        model: task.model || payload?.model || videos[idx]?.model || '',
        status: normalizeTaskStatus(task.status || videos[idx]?.status),
        progress: Number(task.progress ?? videos[idx]?.progress ?? 0),
        outputUrl: outputUrl || videos[idx]?.outputUrl || '',
        at: idx >= 0 ? videos[idx].at : nowISO(),
        updatedAt: nowISO()
      };

      if (idx >= 0) videos[idx] = base;
      else videos.unshift(base);
      setJSON(STORAGE.videos, videos.slice(0, 300));
    }

    function stopTaskPolling() {
      taskPollNonce += 1;
      if (taskPollTimer) clearTimeout(taskPollTimer);
      taskPollTimer = null;
      taskPollInFlight = false;
      taskPollAttempts = 0;
      taskPollFailures = 0;
    }

    async function refreshApiTask(options = {}) {
      refreshSettings();
      const silent = Boolean(options.silent);
      const taskId = String(options.taskId || taskIdInput?.value || lastTask?.id || '').trim();
      if (!taskId) {
        if (!silent) showToast('Task ID is required.', 'error');
        return null;
      }
      if (taskPollInFlight) return lastTask;
      if (status && !silent) status.textContent = `Checking task ${taskId}...`;

      taskPollInFlight = true;
      try {
        const task = await getAiccVideoTask(taskId);
        lastTask = task;
        if (taskIdInput) taskIdInput.value = task.id || taskId;
        updateTaskPanel(task);
        upsertVideoTaskHistory(task, null, (promptInput?.value || '').trim());
        renderVideoHistory();

        const normalizedStatus = normalizeTaskStatus(task.status);
        const progress = Number(task.progress || 0);
        if (status) status.textContent = `Task ${task.id || taskId}: ${normalizedStatus} (${progress}%)`;
        if (!silent) showToast('Task status updated.', 'success');
        if (normalizedStatus === 'completed' && autoNarrationInput?.checked) {
          const completedTaskId = String(task.id || taskId);
          if (lastNarratedTaskId !== completedTaskId) {
            lastNarratedTaskId = completedTaskId;
            if (!(narrationInput?.value || '').trim()) {
              await generateNarrationScript();
            }
            speakNarration();
          }
        }
        if (taskPollTimer && isTerminalTaskStatus(normalizedStatus)) {
          stopTaskPolling();
          if (normalizedStatus === 'completed') showToast('Video task completed.', 'success');
        }
        return task;
      } catch (error) {
        if (status && !silent) status.textContent = `Failed: ${error.message}`;
        if (!silent) showToast(error.message, 'error');
        return null;
      } finally {
        taskPollInFlight = false;
      }
    }

    function startTaskPolling(taskId) {
      const id = String(taskId || taskIdInput?.value || lastTask?.id || '').trim();
      if (!id) return;
      stopTaskPolling();
      const pollNonce = ++taskPollNonce;
      if (status) status.textContent = `Auto-polling task ${id} every 5 seconds...`;

      const tick = async () => {
        if (pollNonce !== taskPollNonce) return;
        taskPollAttempts += 1;
        const task = await refreshApiTask({ taskId: id, silent: true });
        if (pollNonce !== taskPollNonce) return;
        if (!task) {
          taskPollFailures += 1;
          if (taskPollFailures >= 3 || taskPollAttempts >= 120) {
            stopTaskPolling();
            if (status) status.textContent = `Stopped polling task ${id}. Refresh manually.`;
            return;
          }
        } else {
          taskPollFailures = 0;
          if (isTerminalTaskStatus(task.status)) {
            stopTaskPolling();
            if (status) {
              status.textContent = `Task ${id}: ${normalizeTaskStatus(task.status)} (${Number(task.progress || 0)}%)`;
            }
            return;
          }
          if (status) status.textContent = `Auto-polling task ${id}... (${Number(task.progress || 0)}%)`;
        }
        if (pollNonce !== taskPollNonce) return;
        taskPollTimer = setTimeout(tick, 5000);
      };

      tick();
    }

    async function createApiVideoTask() {
      refreshSettings();
      const prompt = (promptInput?.value || '').trim();
      if (!prompt) {
        showToast('Enter a video prompt first.', 'error');
        return;
      }
      if (status) status.textContent = 'Creating video task via AICC API...';
      try {
        const payload = buildVideoTaskPayload();
        const task = await createAiccVideoTask(payload);
        lastTask = task;
        if (taskIdInput) taskIdInput.value = task.id || '';
        updateTaskPanel(task);
        upsertVideoTaskHistory(task, payload, prompt);
        addLog('video', `AICC video task created by ${session.username}`);
        if (status) status.textContent = `Task created: ${task.id || '-'} (${normalizeTaskStatus(task.status || 'queued')})`;
        showToast('Video task created.', 'success');
        renderVideoHistory();

        if (autoPollInput?.checked && task.id) {
          startTaskPolling(task.id);
        } else {
          stopTaskPolling();
        }
      } catch (error) {
        if (status) status.textContent = `Failed: ${error.message}`;
        showToast(error.message, 'error');
      }
    }

    async function generateVideo() {
      refreshSettings();
      const prompt = (promptInput?.value || '').trim();
      const durationSec = Math.max(4, Math.min(45, Number(durationInput?.value || 12)));
      const mode = modeInput?.value || 'aicc-task';
      const { width, height, format } = resolveDimensions();
      const showOverlay = captionOverlayInput?.checked !== false;
      const motionStyle = motionStyleInput?.value || 'kenburns';
      if (mode === 'aicc-task') {
        await createApiVideoTask();
        return;
      }
      stopTaskPolling();
      if (!prompt && mode !== 'image-feed') {
        showToast('Enter a video prompt first.', 'error');
        return;
      }

      if (!imageFeedItems.length && (imageFeedInput?.value || '').trim()) {
        loadFeedFromInput();
      }
      const activeFeed = getCombinedFeedItems();

      if ((mode === 'storyboard' || mode === 'hybrid') && !storyboardScenes.length) {
        await generateStoryboard();
      }
      if (mode === 'storyboard' && !storyboardScenes.length) return;
      if (mode === 'image-feed' && !activeFeed.length) {
        showToast('Load a valid image feed first.', 'error');
        return;
      }
      if (mode === 'hybrid' && !storyboardScenes.length && !activeFeed.length) {
        showToast('Need storyboard or image feed for hybrid mode.', 'error');
        return;
      }

      if (status) status.textContent = 'Rendering AI video locally...';
      setRenderProgress(0, true);
      if (download) {
        download.classList.add('hidden');
        download.removeAttribute('href');
      }

      try {
        const blob = mode === 'storyboard'
          ? await renderStoryboardVideo(storyboardScenes, {
              durationSec,
              fps: 12,
              width,
              height,
              showOverlay,
              onProgress: (pct) => setRenderProgress(pct, true)
            })
          : mode === 'image-feed'
            ? await renderImageMontageVideo(activeFeed, {
                durationSec,
                fps: 12,
                width,
                height,
                showOverlay,
                motionStyle,
                onProgress: (pct) => setRenderProgress(pct, true)
              })
            : await (activeFeed.length
              ? renderImageMontageVideo(resolveHybridFeed(), {
                  durationSec,
                  fps: 12,
                  width,
                  height,
                  showOverlay,
                  motionStyle,
                  onProgress: (pct) => setRenderProgress(pct, true)
                })
              : renderStoryboardVideo(storyboardScenes, {
                  durationSec,
                  fps: 12,
                  width,
                  height,
                  showOverlay,
                  onProgress: (pct) => setRenderProgress(pct, true)
                }));

        if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
        const objectUrl = URL.createObjectURL(blob);
        currentObjectUrl = objectUrl;
        if (preview) {
          preview.src = objectUrl;
          preview.load();
        }
        if (download) {
          download.href = objectUrl;
          download.download = `matrix-video-${Date.now()}.webm`;
          download.classList.remove('hidden');
        }

        const videos = getJSON(STORAGE.videos, []);
        videos.unshift({
          id: uid('video'),
          userId: session.userId,
          prompt: prompt || 'Image feed montage',
          style: styleInput?.value || 'cinematic',
          durationSec,
          format,
          mode,
          feedCount: activeFeed.length,
          scenes: storyboardScenes,
          at: nowISO()
        });
        setJSON(STORAGE.videos, videos.slice(0, 200));
        awardPoints(session.userId, 30);
        addLog('video', `Video generated by ${session.username}`);
        setRenderProgress(100, true);
        if (status) status.textContent = 'Video generated successfully. Preview and download are ready.';
        showToast('AI video generated.', 'success');
        if (autoNarrationInput?.checked) {
          if (!(narrationInput?.value || '').trim()) {
            await generateNarrationScript();
          }
          speakNarration();
        }
        renderVideoHistory();
      } catch (error) {
        setRenderProgress(0, false);
        if (status) status.textContent = `Failed: ${error.message}`;
        showToast(error.message, 'error');
        return;
      }
      setTimeout(() => setRenderProgress(renderProgress?.value || 100, false), 1400);
    }

    qs('#videoLoadFeedBtn')?.addEventListener('click', () => {
      loadFeedFromInput();
    });
    photoUploadInput?.addEventListener('change', () => {
      importUploadedPhotos(photoUploadInput.files);
    });
    qs('#videoUseSampleFeedBtn')?.addEventListener('click', () => {
      if (imageFeedInput) imageFeedInput.value = JSON.stringify(sampleFeed, null, 2);
      loadFeedFromInput();
    });
    qs('#videoClearFeedBtn')?.addEventListener('click', () => {
      imageFeedItems = [];
      if (imageFeedInput) imageFeedInput.value = '';
      renderFeedPreview();
      showToast('JSON image feed cleared.', 'success');
    });
    qs('#videoClearUploadsBtn')?.addEventListener('click', () => {
      revokeUploadedPhotoUrls();
      uploadedPhotoItems = [];
      if (photoUploadInput) photoUploadInput.value = '';
      renderFeedPreview();
      showToast('Uploaded photos cleared.', 'success');
    });

    qs('#videoStoryboardBtn')?.addEventListener('click', generateStoryboard);
    qs('#videoGenerateBtn')?.addEventListener('click', generateVideo);
    qs('#videoGenerateNarrationBtn')?.addEventListener('click', generateNarrationScript);
    qs('#videoSpeakNarrationBtn')?.addEventListener('click', speakNarration);
    qs('#videoStopNarrationBtn')?.addEventListener('click', stopNarration);
    qs('#videoExportStoryboardBtn')?.addEventListener('click', () => {
      if (!storyboardScenes.length) return showToast('Generate storyboard first.', 'error');
      downloadJSON(`matrix-storyboard-${Date.now()}.json`, { scenes: storyboardScenes });
    });
    qs('#videoExportFeedBtn')?.addEventListener('click', () => {
      const combined = getCombinedFeedItems();
      if (!combined.length) return showToast('Load JSON feed or upload photos first.', 'error');
      downloadJSON(`matrix-image-feed-${Date.now()}.json`, { images: combined });
    });

    qs('#videoCreateTaskBtn')?.addEventListener('click', createApiVideoTask);
    qs('#videoRefreshTaskBtn')?.addEventListener('click', () => {
      refreshApiTask({});
    });

    loadModelsBtn?.addEventListener('click', async () => {
      try {
        const ids = await listAvailableModels();
        const dataList = qs('#videoModelOptions');
        if (dataList) {
          dataList.innerHTML = ids
            .slice(0, 300)
            .map((id) => `<option value="${escapeHtml(id)}"></option>`)
            .join('');
        }
        if (status) status.textContent = `Loaded ${ids.length} models.`;
        showToast(`Loaded ${ids.length} models.`, 'success');
      } catch (error) {
        if (status) status.textContent = `Failed loading models: ${error.message}`;
        showToast(error.message, 'error');
      }
    });

    autoPollInput?.addEventListener('change', () => {
      const taskId = String(taskIdInput?.value || lastTask?.id || '').trim();
      if (autoPollInput.checked && taskId) {
        startTaskPolling(taskId);
      } else {
        stopTaskPolling();
      }
    });

    modeInput?.addEventListener('change', () => {
      if (modeInput.value !== 'aicc-task') stopTaskPolling();
    });
    voiceRateInput?.addEventListener('input', updateVoiceLabels);
    voicePitchInput?.addEventListener('input', updateVoiceLabels);
    preview?.addEventListener('play', () => {
      if (autoNarrationInput?.checked && (narrationInput?.value || '').trim()) {
        speakNarration();
      }
    });
    preview?.addEventListener('pause', stopNarration);
    preview?.addEventListener('ended', stopNarration);

    renderFeedPreview();
    setRenderProgress(0, false);
    updateVoiceLabels();
    populateVoiceOptions();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = populateVoiceOptions;
    }
    updateTaskPanel(null);
    renderVideoHistory();

    const recentTask = getJSON(STORAGE.videos, [])
      .find((row) => row.userId === session.userId && row.mode === 'aicc-task' && row.taskId);
    if (recentTask?.taskId && taskIdInput && !taskIdInput.value) {
      taskIdInput.value = recentTask.taskId;
      if (status) status.textContent = `Loaded recent task ${recentTask.taskId}.`;
      if (autoPollInput?.checked && !isTerminalTaskStatus(recentTask.status)) {
        startTaskPolling(recentTask.taskId);
      }
    }

    window.addEventListener('beforeunload', () => {
      stopNarration();
      stopTaskPolling();
      if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
      revokeUploadedPhotoUrls();
    });
  }

  function initLabPage() {
    const session = getSession();
    if (!session) return;

    const promptInput = qs('#labPrompt');
    const modelA = qs('#labModelA');
    const modelB = qs('#labModelB');
    const modelC = qs('#labModelC');
    const runBtn = qs('#labRunCompareBtn');
    const loadModelsBtn = qs('#labLoadModelsBtn');
    const modelOptions = qs('#labModelOptions');
    const resultA = qs('#labResultA');
    const resultB = qs('#labResultB');
    const resultC = qs('#labResultC');
    const resultALabel = qs('#labResultALabel');
    const resultBLabel = qs('#labResultBLabel');
    const resultCLabel = qs('#labResultCLabel');
    const saveTitle = qs('#labSaveTitle');
    const saveBtn = qs('#labSavePromptBtn');
    const promptList = qs('#labPromptLibrary');
    const status = qs('#labStatus');

    function getLibrary() {
      return getJSON(STORAGE.promptLibrary, []);
    }

    function setLibrary(rows) {
      setJSON(STORAGE.promptLibrary, rows.slice(0, 120));
    }

    function renderLibrary() {
      if (!promptList) return;
      const rows = getLibrary();
      if (!rows.length) {
        promptList.innerHTML = '<li class="muted">No saved prompts yet.</li>';
        return;
      }
      promptList.innerHTML = rows
        .map(
          (row) => `
            <li class="card" style="padding:0.8rem;margin-bottom:0.55rem;">
              <strong>${escapeHtml(row.title)}</strong>
              <p class="muted" style="margin:0.3rem 0;">${escapeHtml(row.prompt).slice(0, 180)}</p>
              <div class="inline-row">
                <button type="button" class="btn ghost" data-lab-run="${row.id}">Use</button>
                <button type="button" class="btn danger" data-lab-delete="${row.id}">Delete</button>
              </div>
            </li>
          `
        )
        .join('');

      qsa('[data-lab-run]', promptList).forEach((button) => {
        button.addEventListener('click', () => {
          const row = rows.find((r) => r.id === button.dataset.labRun);
          if (!row) return;
          if (promptInput) promptInput.value = row.prompt;
          showToast('Prompt loaded.', 'success');
        });
      });

      qsa('[data-lab-delete]', promptList).forEach((button) => {
        button.addEventListener('click', () => {
          setLibrary(rows.filter((r) => r.id !== button.dataset.labDelete));
          renderLibrary();
          showToast('Prompt removed.', 'success');
        });
      });
    }

    async function runModelCompare() {
      const prompt = (promptInput?.value || '').trim();
      if (!prompt) return showToast('Enter a prompt first.', 'error');

      const models = [
        (modelA?.value || '').trim() || DEFAULT_SETTINGS.model,
        (modelB?.value || '').trim() || DEFAULT_SETTINGS.model,
        (modelC?.value || '').trim() || DEFAULT_SETTINGS.model
      ];

      if (resultALabel) resultALabel.textContent = models[0];
      if (resultBLabel) resultBLabel.textContent = models[1];
      if (resultCLabel) resultCLabel.textContent = models[2];
      if (resultA) resultA.textContent = 'Running...';
      if (resultB) resultB.textContent = 'Running...';
      if (resultC) resultC.textContent = 'Running...';
      if (status) status.textContent = 'Executing model comparison...';

      const outputs = await Promise.allSettled(
        models.map((model) => callAI(prompt, { model, maxOutputTokens: 900 }))
      );

      const blocks = [resultA, resultB, resultC];
      outputs.forEach((entry, index) => {
        const block = blocks[index];
        if (!block) return;
        if (entry.status === 'fulfilled') block.textContent = entry.value;
        else block.textContent = `Error: ${entry.reason?.message || 'Request failed'}`;
      });

      const succeeded = outputs.filter((entry) => entry.status === 'fulfilled').length;
      if (status) status.textContent = `Completed. ${succeeded}/3 model responses returned.`;
      awardPoints(session.userId, 18);
      addLog('lab', `Model comparison run by ${session.username}`);
    }

    runBtn?.addEventListener('click', runModelCompare);

    loadModelsBtn?.addEventListener('click', async () => {
      if (status) status.textContent = 'Loading model list...';
      try {
        const models = await listAvailableModels({ useCache: true });
        if (modelOptions) {
          modelOptions.innerHTML = models
            .slice(0, 350)
            .map((id) => `<option value="${escapeHtml(id)}"></option>`)
            .join('');
        }
        if (status) status.textContent = `Loaded ${models.length} models.`;
        showToast(`Loaded ${models.length} models.`, 'success');
      } catch (error) {
        if (status) status.textContent = `Failed to load models: ${error.message}`;
        showToast(error.message, 'error');
      }
    });

    saveBtn?.addEventListener('click', () => {
      const title = (saveTitle?.value || '').trim();
      const prompt = (promptInput?.value || '').trim();
      if (!title || !prompt) return showToast('Enter title and prompt before saving.', 'error');
      const rows = getLibrary();
      rows.unshift({ id: uid('prompt'), title, prompt, createdAt: nowISO() });
      setLibrary(rows);
      if (saveTitle) saveTitle.value = '';
      renderLibrary();
      showToast('Prompt saved to library.', 'success');
    });

    renderLibrary();
  }

  function initDevPage() {
    const session = getSession();
    if (!session) return;

    const promptInput = qs('#devPrompt');
    const languageInput = qs('#devLanguage');
    const frameworkInput = qs('#devFramework');
    const codeOutput = qs('#devCodeOutput');
    const snippetTitle = qs('#devSnippetTitle');
    const snippetList = qs('#devSnippetList');
    const regexPattern = qs('#devRegexPattern');
    const regexFlags = qs('#devRegexFlags');
    const regexInput = qs('#devRegexInput');
    const regexOutput = qs('#devRegexOutput');
    const diffInput = qs('#devDiffInput');
    const commitOutput = qs('#devCommitOutput');
    const prOutput = qs('#devPrOutput');
    const reviewInput = qs('#devReviewInput');
    const reviewOutput = qs('#devReviewOutput');
    const testInput = qs('#devTestInput');
    const testOutput = qs('#devTestOutput');
    const previewHtmlInput = qs('#devPreviewHtml');
    const previewCssInput = qs('#devPreviewCss');
    const previewJsInput = qs('#devPreviewJs');
    const previewFrame = qs('#devPreviewFrame');
    const previewConsole = qs('#devConsoleOutput');
    const terminalOutput = qs('#devTerminalOutput');
    const terminalInput = qs('#devTerminalInput');
    const status = qs('#devStatus');
    const importInput = qs('#devSnippetImportInput');

    function getRows() {
      return getJSON(STORAGE.devSnippets, []).filter((row) => row.userId === session.userId);
    }

    function setRows(rows) {
      const others = getJSON(STORAGE.devSnippets, []).filter((row) => row.userId !== session.userId);
      setJSON(STORAGE.devSnippets, [...rows.slice(0, 200), ...others]);
    }

    function renderSnippets() {
      if (!snippetList) return;
      const rows = getRows().slice(0, 60);
      if (!rows.length) {
        snippetList.innerHTML = '<li class="muted">No snippets saved yet.</li>';
        return;
      }
      snippetList.innerHTML = rows
        .map((row) => `
          <li class="card" style="padding:0.8rem;margin-bottom:0.55rem;">
            <strong>${escapeHtml(row.title || 'Untitled snippet')}</strong>
            <p class="muted" style="margin:0.3rem 0;">${escapeHtml(row.language || 'general')} ${row.framework ? `- ${escapeHtml(row.framework)}` : ''}</p>
            <pre class="tool-output">${escapeHtml(String(row.code || '').slice(0, 400))}</pre>
            <div class="inline-row">
              <button type="button" class="btn ghost" data-snippet-use="${row.id}">Use</button>
              <button type="button" class="btn danger" data-snippet-delete="${row.id}">Delete</button>
            </div>
          </li>
        `)
        .join('');

      qsa('[data-snippet-use]', snippetList).forEach((button) => {
        button.addEventListener('click', () => {
          const row = rows.find((item) => item.id === button.dataset.snippetUse);
          if (!row) return;
          if (promptInput) promptInput.value = row.prompt || '';
          if (codeOutput) codeOutput.textContent = row.code || '';
          if (languageInput && row.language) languageInput.value = row.language;
          if (frameworkInput) frameworkInput.value = row.framework || '';
          showToast('Snippet loaded.', 'success');
        });
      });

      qsa('[data-snippet-delete]', snippetList).forEach((button) => {
        button.addEventListener('click', () => {
          setRows(rows.filter((item) => item.id !== button.dataset.snippetDelete));
          renderSnippets();
          showToast('Snippet deleted.', 'success');
        });
      });
    }

    async function generateCode() {
      const prompt = (promptInput?.value || '').trim();
      if (!prompt) return showToast('Enter your coding request first.', 'error');
      const language = (languageInput?.value || 'javascript').trim();
      const framework = (frameworkInput?.value || '').trim();
      if (status) status.textContent = 'Generating code...';
      if (codeOutput) codeOutput.textContent = 'Generating...';
      try {
        const reply = await callAI(
          `Write production-grade ${language} code.
Framework: ${framework || 'none'}
Task: ${prompt}
Return code first, then short notes.`,
          { maxOutputTokens: 1400 }
        );
        if (codeOutput) codeOutput.textContent = reply;
        if (status) status.textContent = 'Code generated.';
        awardPoints(session.userId, 12);
        addLog('dev', `Developer code generation by ${session.username}`);
      } catch (error) {
        if (codeOutput) codeOutput.textContent = `Error: ${error.message}`;
        if (status) status.textContent = `Failed: ${error.message}`;
        showToast(error.message, 'error');
      }
    }

    async function generateCommit() {
      const diff = (diffInput?.value || '').trim();
      if (!diff) return showToast('Paste change notes or diff first.', 'error');
      if (commitOutput) commitOutput.textContent = 'Generating...';
      try {
        const reply = await callAI(`Create one conventional commit and 3 alternatives for:\n${diff}`, { maxOutputTokens: 260 });
        if (commitOutput) commitOutput.textContent = reply;
      } catch (error) {
        if (commitOutput) commitOutput.textContent = `Error: ${error.message}`;
      }
    }

    async function generatePr() {
      const diff = (diffInput?.value || '').trim();
      if (!diff) return showToast('Paste change notes or diff first.', 'error');
      if (prOutput) prOutput.textContent = 'Generating...';
      try {
        const reply = await callAI(`Write PR summary with sections: Changes, Why, Risks, Tests.\n${diff}`, { maxOutputTokens: 560 });
        if (prOutput) prOutput.textContent = reply;
      } catch (error) {
        if (prOutput) prOutput.textContent = `Error: ${error.message}`;
      }
    }

    function runRegex() {
      if (!regexOutput) return;
      const pattern = (regexPattern?.value || '').trim();
      const flags = (regexFlags?.value || '').trim();
      const input = regexInput?.value || '';
      if (!pattern) return showToast('Enter regex pattern first.', 'error');
      try {
        const exp = new RegExp(pattern, flags.includes('g') ? flags : `${flags}g`);
        const matches = [...input.matchAll(exp)].slice(0, 80);
        regexOutput.textContent = matches.length
          ? matches.map((m, i) => `#${i + 1} @${m.index}: ${m[0]}`).join('\n')
          : 'No matches found.';
      } catch (error) {
        regexOutput.textContent = `Regex error: ${error.message}`;
      }
    }

    function appendDevLine(target, text) {
      if (!target) return;
      const stamp = new Date().toLocaleTimeString();
      target.textContent += `[${stamp}] ${text}\n`;
      target.scrollTop = target.scrollHeight;
    }

    function clearDevConsole() {
      if (previewConsole) previewConsole.textContent = '';
    }

    function clearTerminal() {
      if (terminalOutput) terminalOutput.textContent = '';
    }

    function buildPreviewDocument(html, css, js) {
      const safeJs = String(js || '').replace(/<\/script/gi, '<\\/script');
      const safeCss = String(css || '').replace(/<\/style/gi, '<\\/style');
      return `<!doctype html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${safeCss}</style>
</head>
<body>
${String(html || '')}
<script>
(function(){
  const serialize = (value) => {
    try {
      if (typeof value === 'string') return value;
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };
  const push = (kind, values) => {
    parent.postMessage({ source: 'matrix-dev-preview', kind, values: values.map(serialize) }, '*');
  };
  ['log','info','warn','error'].forEach((kind) => {
    const original = console[kind];
    console[kind] = (...args) => {
      push(kind, args);
      if (typeof original === 'function') original.apply(console, args);
    };
  });
  window.addEventListener('error', (event) => {
    push('error', [event.message || 'Runtime error', 'line ' + event.lineno + ', col ' + event.colno]);
  });
  window.addEventListener('unhandledrejection', (event) => {
    push('error', ['Unhandled promise rejection', String(event.reason || '')]);
  });
  push('info', ['Preview loaded']);
})();
</script>
<script>${safeJs}</script>
</body>
</html>`;
    }

    function runPreview() {
      if (!previewFrame) return;
      clearDevConsole();
      const html = previewHtmlInput?.value || '';
      const css = previewCssInput?.value || '';
      const js = previewJsInput?.value || '';
      previewFrame.srcdoc = buildPreviewDocument(html, css, js);
      if (status) status.textContent = 'Preview rendered.';
    }

    function loadPreviewStarter() {
      if (previewHtmlInput) {
        previewHtmlInput.value = `<main class="demo">\n  <h1>Dev Sandbox</h1>\n  <button id="demoBtn">Click me</button>\n  <p id="out">Ready</p>\n</main>`;
      }
      if (previewCssInput) {
        previewCssInput.value = `.demo{font-family:Arial,sans-serif;padding:24px;border:1px solid #ddd;border-radius:12px;max-width:420px}\nbutton{padding:8px 12px;border-radius:8px;border:1px solid #444;cursor:pointer}`;
      }
      if (previewJsInput) {
        previewJsInput.value = `const btn = document.getElementById('demoBtn');\nconst out = document.getElementById('out');\nbtn?.addEventListener('click', () => {\n  out.textContent = 'Button clicked at ' + new Date().toLocaleTimeString();\n  console.log('Button clicked');\n});`;
      }
      runPreview();
    }

    function resetPreview() {
      if (previewHtmlInput) previewHtmlInput.value = '';
      if (previewCssInput) previewCssInput.value = '';
      if (previewJsInput) previewJsInput.value = '';
      if (previewFrame) previewFrame.srcdoc = '<!doctype html><html><body></body></html>';
      clearDevConsole();
      if (status) status.textContent = 'Preview reset.';
    }

    function executeTerminal(rawCommand) {
      const command = String(rawCommand || '').trim();
      if (!command) return;
      appendDevLine(terminalOutput, `$ ${command}`);
      const [root, ...rest] = command.split(' ');
      const args = rest.join(' ').trim();

      if (root === 'help') {
        appendDevLine(terminalOutput, 'Commands: help, clear, date, echo, ls, open <page>, theme <mode>, run-preview, reset-preview, starter-preview, stats, models');
        return;
      }
      if (root === 'clear') {
        clearTerminal();
        return;
      }
      if (root === 'date') {
        appendDevLine(terminalOutput, new Date().toString());
        return;
      }
      if (root === 'echo') {
        appendDevLine(terminalOutput, args);
        return;
      }
      if (root === 'ls') {
        appendDevLine(terminalOutput, 'pages: index dashboard video-studio ai-lab dev-hub teacher cybersecurity automation-lab settings');
        return;
      }
      if (root === 'open') {
        const page = args || 'index';
        const map = {
          index: 'index.html',
          dashboard: 'dashboard.html',
          video: 'video-studio.html',
          lab: 'ai-lab.html',
          dev: 'dev-hub.html',
          teacher: 'teacher.html',
          cyber: 'cybersecurity.html',
          automation: 'automation-lab.html',
          settings: 'settings.html'
        };
        const href = map[page] || map[page.replace('.html', '')];
        if (!href) {
          appendDevLine(terminalOutput, 'Unknown page alias.');
          return;
        }
        window.location.href = href;
        return;
      }
      if (root === 'theme') {
        const mode = args.toLowerCase();
        if (!['dark', 'light', 'system'].includes(mode)) {
          appendDevLine(terminalOutput, 'Use: theme dark|light|system');
          return;
        }
        setSettings({ theme: mode });
        applyTheme(mode);
        appendDevLine(terminalOutput, `Theme set to ${mode}`);
        return;
      }
      if (root === 'run-preview') {
        runPreview();
        appendDevLine(terminalOutput, 'Preview rendered.');
        return;
      }
      if (root === 'reset-preview') {
        resetPreview();
        appendDevLine(terminalOutput, 'Preview reset.');
        return;
      }
      if (root === 'starter-preview') {
        loadPreviewStarter();
        appendDevLine(terminalOutput, 'Starter preview loaded.');
        return;
      }
      if (root === 'stats') {
        const stats = getStats();
        appendDevLine(terminalOutput, `messages=${stats.messages || 0}, toolRuns=${stats.toolRuns || 0}, imageRuns=${stats.imageRuns || 0}`);
        return;
      }
      if (root === 'models') {
        const cache = getJSON(STORAGE.modelsCache, null);
        const rows = Array.isArray(cache?.data) ? cache.data : [];
        appendDevLine(terminalOutput, rows.length ? rows.slice(0, 20).map((r) => r.id).join(', ') : 'No cached models.');
        return;
      }

      appendDevLine(terminalOutput, `Unknown command: ${root}. Type "help".`);
    }

    async function runReview() {
      const source = (reviewInput?.value || '').trim();
      if (!source) return showToast('Paste code or architecture notes first.', 'error');
      if (reviewOutput) reviewOutput.textContent = 'Reviewing...';
      try {
        const reply = await callAI(
          `Perform a senior engineering review.
Find bugs, security risks, performance issues, and missing tests.
Then provide prioritized fixes.
Input:\n${source}`,
          { maxOutputTokens: 900 }
        );
        if (reviewOutput) reviewOutput.textContent = reply;
        awardPoints(session.userId, 8);
      } catch (error) {
        if (reviewOutput) reviewOutput.textContent = `Error: ${error.message}`;
        showToast(error.message, 'error');
      }
    }

    async function generateTests() {
      const source = (testInput?.value || '').trim();
      if (!source) return showToast('Paste code or behavior spec first.', 'error');
      if (testOutput) testOutput.textContent = 'Generating test plan...';
      try {
        const reply = await callAI(
          `Generate a robust test suite plan and sample tests for this input.
Include: unit tests, edge cases, integration checks.
Input:\n${source}`,
          { maxOutputTokens: 900 }
        );
        if (testOutput) testOutput.textContent = reply;
        awardPoints(session.userId, 7);
      } catch (error) {
        if (testOutput) testOutput.textContent = `Error: ${error.message}`;
        showToast(error.message, 'error');
      }
    }

    function saveSnippet() {
      const code = (codeOutput?.textContent || '').trim();
      if (!code || code.toLowerCase() === 'generating...') return showToast('Generate code before saving.', 'error');
      const rows = getRows();
      rows.unshift({
        id: uid('snippet'),
        userId: session.userId,
        title: (snippetTitle?.value || '').trim() || `Snippet ${new Date().toLocaleString()}`,
        prompt: (promptInput?.value || '').trim(),
        language: (languageInput?.value || '').trim(),
        framework: (frameworkInput?.value || '').trim(),
        code,
        createdAt: nowISO()
      });
      setRows(rows);
      if (snippetTitle) snippetTitle.value = '';
      renderSnippets();
      showToast('Snippet saved.', 'success');
    }

    qs('#devGenerateCodeBtn')?.addEventListener('click', generateCode);
    qs('#devCommitMsgBtn')?.addEventListener('click', generateCommit);
    qs('#devPrSummaryBtn')?.addEventListener('click', generatePr);
    qs('#devRegexRunBtn')?.addEventListener('click', runRegex);
    qs('#devReviewBtn')?.addEventListener('click', runReview);
    qs('#devTestPlanBtn')?.addEventListener('click', generateTests);
    qs('#devPreviewRunBtn')?.addEventListener('click', runPreview);
    qs('#devPreviewResetBtn')?.addEventListener('click', resetPreview);
    qs('#devPreviewStarterBtn')?.addEventListener('click', loadPreviewStarter);
    qs('#devConsoleClearBtn')?.addEventListener('click', clearDevConsole);
    qs('#devTerminalClearBtn')?.addEventListener('click', clearTerminal);
    qs('#devSaveSnippetBtn')?.addEventListener('click', saveSnippet);
    qs('#devSnippetExportBtn')?.addEventListener('click', () => downloadJSON(`matrix-dev-snippets-${session.username}.json`, getRows()));
    qs('#devSnippetImportBtn')?.addEventListener('click', () => importInput?.click());
    importInput?.addEventListener('change', () => {
      const file = importInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const payload = JSON.parse(String(reader.result || '[]'));
          if (!Array.isArray(payload)) throw new Error('Expected array payload.');
          const imported = payload
            .filter((row) => row && typeof row === 'object')
            .map((row) => ({
              id: uid('snippet'),
              userId: session.userId,
              title: String(row.title || 'Imported snippet'),
              prompt: String(row.prompt || ''),
              language: String(row.language || ''),
              framework: String(row.framework || ''),
              code: String(row.code || ''),
              createdAt: nowISO()
            }))
            .filter((row) => row.code.trim());
          if (!imported.length) throw new Error('No valid snippets.');
          setRows([...imported, ...getRows()]);
          renderSnippets();
          showToast(`Imported ${imported.length} snippets.`, 'success');
        } catch (error) {
          showToast(`Import failed: ${error.message}`, 'error');
        } finally {
          importInput.value = '';
        }
      };
      reader.readAsText(file);
    });

    const previewMessageHandler = (event) => {
      const payload = event?.data;
      if (!payload || payload.source !== 'matrix-dev-preview') return;
      const kind = payload.kind || 'log';
      const values = Array.isArray(payload.values) ? payload.values : [];
      appendDevLine(previewConsole, `[${kind}] ${values.join(' ')}`);
    };
    window.addEventListener('message', previewMessageHandler);

    terminalInput?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      executeTerminal(terminalInput.value);
      terminalInput.value = '';
    });
    qs('#devTerminalRunBtn')?.addEventListener('click', () => {
      executeTerminal(terminalInput?.value || '');
      if (terminalInput) terminalInput.value = '';
    });

    renderSnippets();
    if (previewFrame && !previewFrame.srcdoc) resetPreview();
    appendDevLine(terminalOutput, 'Terminal ready. Type "help".');
    window.addEventListener('beforeunload', () => {
      window.removeEventListener('message', previewMessageHandler);
    });
  }

  function initTeacherPage() {
    const session = getSession();
    if (!session) return;

    const topicInput = qs('#teacherTopic');
    const subjectInput = qs('#teacherSubject');
    const levelInput = qs('#teacherLevel');
    const durationInput = qs('#teacherDuration');
    const styleInput = qs('#teacherStyle');
    const goalsInput = qs('#teacherGoals');
    const outlineOutput = qs('#teacherOutlineOutput');
    const moduleSelect = qs('#teacherModuleSelect');
    const lessonFocusInput = qs('#teacherLessonFocus');
    const lessonOutput = qs('#teacherLessonOutput');
    const quizOutput = qs('#teacherQuizOutput');
    const studyPlanOutput = qs('#teacherStudyPlanOutput');
    const flashcardsOutput = qs('#teacherFlashcardsOutput');
    const assignmentOutput = qs('#teacherAssignmentOutput');
    const tutorQuestionInput = qs('#teacherTutorQuestion');
    const tutorAnswerOutput = qs('#teacherTutorAnswerOutput');
    const notesInput = qs('#teacherNotes');
    const progressList = qs('#teacherProgressList');
    const progressSummary = qs('#teacherProgressSummary');
    const courseTitleInput = qs('#teacherCourseTitle');
    const courseList = qs('#teacherCourseList');
    const historyList = qs('#teacherHistoryList');
    const status = qs('#teacherStatus');
    const importInput = qs('#teacherImportCoursesInput');
    const voiceToggleInput = qs('#teacherVoiceAuto');
    const voiceSelect = qs('#teacherVoiceSelect');
    const voiceRateInput = qs('#teacherVoiceRate');
    const voicePitchInput = qs('#teacherVoicePitch');
    const voiceRateLabel = qs('#teacherVoiceRateLabel');
    const voicePitchLabel = qs('#teacherVoicePitchLabel');
    const voiceSourceInput = qs('#teacherVoiceSource');

    let currentCourse = null;
    let voiceActivated = false;

    function getCourses() {
      return getJSON(STORAGE.teacherCourses, []).filter((row) => row.userId === session.userId);
    }

    function setCourses(rows) {
      const others = getJSON(STORAGE.teacherCourses, []).filter((row) => row.userId !== session.userId);
      setJSON(STORAGE.teacherCourses, [...rows.slice(0, 120), ...others]);
    }

    function getHistory() {
      return getJSON(STORAGE.teacherHistory, []).filter((row) => row.userId === session.userId);
    }

    function setHistory(rows) {
      const others = getJSON(STORAGE.teacherHistory, []).filter((row) => row.userId !== session.userId);
      setJSON(STORAGE.teacherHistory, [...rows.slice(0, 300), ...others]);
    }

    function getSavedNotes() {
      const row = getJSON(STORAGE.teacherNotes, []).find((item) => item.userId === session.userId);
      return row?.notes || '';
    }

    function setSavedNotes(text) {
      const rows = getJSON(STORAGE.teacherNotes, []);
      const filtered = rows.filter((row) => row.userId !== session.userId);
      filtered.unshift({ userId: session.userId, notes: text, updatedAt: nowISO() });
      setJSON(STORAGE.teacherNotes, filtered.slice(0, 40));
    }

    function persistCurrentCourseProgress() {
      if (!currentCourse?.id) return;
      const rows = getCourses();
      const idx = rows.findIndex((row) => row.id === currentCourse.id);
      if (idx < 0) return;
      rows[idx] = { ...rows[idx], completedModules: currentCourse.completedModules || [], updatedAt: nowISO() };
      setCourses(rows);
    }

    function updateVoiceLabels() {
      if (voiceRateLabel && voiceRateInput) voiceRateLabel.textContent = Number(voiceRateInput.value || 1).toFixed(1);
      if (voicePitchLabel && voicePitchInput) voicePitchLabel.textContent = Number(voicePitchInput.value || 1).toFixed(1);
    }

    function populateVoices() {
      if (!voiceSelect) return;
      if (!('speechSynthesis' in window)) {
        voiceSelect.innerHTML = '<option value="">Speech not supported</option>';
        voiceSelect.disabled = true;
        return;
      }
      const voices = window.speechSynthesis.getVoices() || [];
      if (!voices.length) {
        voiceSelect.innerHTML = '<option value="">Loading voices...</option>';
        return;
      }
      voiceSelect.innerHTML = voices
        .map((voice, idx) => `<option value="${idx}">${escapeHtml(`${voice.name} (${voice.lang})`)}</option>`)
        .join('');
      const preferred = voices.findIndex((voice) => /en(-|_)?us/i.test(voice.lang));
      voiceSelect.value = String(preferred >= 0 ? preferred : 0);
      voiceSelect.disabled = false;
    }

    function stopTeachingVoice() {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    }

    function speakTeachingText(text) {
      if (!voiceActivated || !voiceToggleInput?.checked) return;
      const body = String(text || '').trim();
      if (!body || !('speechSynthesis' in window)) return;

      const voices = window.speechSynthesis.getVoices() || [];
      const selectedIdx = Number(voiceSelect?.value || 0);
      const utter = new SpeechSynthesisUtterance(body);
      utter.rate = Math.max(0.6, Math.min(1.4, Number(voiceRateInput?.value || 1)));
      utter.pitch = Math.max(0.7, Math.min(1.5, Number(voicePitchInput?.value || 1)));
      if (voices[selectedIdx]) utter.voice = voices[selectedIdx];
      utter.onstart = () => { if (status) status.textContent = 'Teacher voice is speaking...'; };
      utter.onend = () => { if (status) status.textContent = 'Teacher voice finished.'; };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    }

    function normalizeModules(rawText) {
      const parsed = extractJsonBlock(rawText);
      if (parsed && Array.isArray(parsed.modules) && parsed.modules.length) {
        return parsed.modules.slice(0, 20).map((m, idx) => ({
          index: idx + 1,
          title: String(m.title || `Module ${idx + 1}`),
          summary: String(m.summary || ''),
          objectives: Array.isArray(m.objectives) ? m.objectives.map((x) => String(x)) : []
        }));
      }
      const lines = String(rawText || '')
        .split('\n')
        .map((line) => line.replace(/^\s*[-*\d.)]+\s*/, '').trim())
        .filter(Boolean);
      return lines.slice(0, 12).map((line, idx) => ({
        index: idx + 1,
        title: `Module ${idx + 1}`,
        summary: line,
        objectives: []
      }));
    }

    function resolveVoiceContent() {
      const source = String(voiceSourceInput?.value || 'lesson');
      if (source === 'outline') return String(outlineOutput?.textContent || '');
      if (source === 'quiz') return String(quizOutput?.textContent || '');
      if (source === 'studyplan') return String(studyPlanOutput?.textContent || '');
      if (source === 'assignment') return String(assignmentOutput?.textContent || '');
      if (source === 'qa') return String(tutorAnswerOutput?.textContent || '');
      return String(lessonOutput?.textContent || '');
    }

    function renderModuleProgress(course) {
      if (!progressList) return;
      if (!course?.modules?.length) {
        progressList.innerHTML = '<li class="muted">No module progress yet.</li>';
        if (progressSummary) progressSummary.textContent = '0% complete';
        return;
      }
      const completed = Array.isArray(course.completedModules) ? course.completedModules : [];
      progressList.innerHTML = course.modules
        .map((module) => `
          <li class="inline-row" style="justify-content:space-between;border:1px solid var(--line);padding:0.5rem 0.7rem;border-radius:10px;margin-bottom:0.45rem;">
            <label class="inline-row">
              <input type="checkbox" data-progress-module="${module.index}" ${completed.includes(module.index) ? 'checked' : ''}>
              <span>${escapeHtml(`${module.index}. ${module.title}`)}</span>
            </label>
          </li>
        `)
        .join('');

      qsa('[data-progress-module]', progressList).forEach((checkbox) => {
        checkbox.addEventListener('change', () => {
          const idx = Number(checkbox.dataset.progressModule || 0);
          if (!idx || !currentCourse) return;
          const set = new Set(Array.isArray(currentCourse.completedModules) ? currentCourse.completedModules : []);
          if (checkbox.checked) set.add(idx);
          else set.delete(idx);
          currentCourse.completedModules = [...set].sort((a, b) => a - b);
          const pct = Math.round((currentCourse.completedModules.length / currentCourse.modules.length) * 100);
          if (progressSummary) progressSummary.textContent = `${pct}% complete (${currentCourse.completedModules.length}/${currentCourse.modules.length})`;
          persistCurrentCourseProgress();
        });
      });

      const pct = Math.round((completed.length / course.modules.length) * 100);
      if (progressSummary) progressSummary.textContent = `${pct}% complete (${completed.length}/${course.modules.length})`;
    }

    function renderCourseOutline(course) {
      if (!outlineOutput) return;
      if (!course) {
        outlineOutput.textContent = 'No course generated yet.';
        renderModuleProgress(null);
        return;
      }
      const modules = Array.isArray(course.modules) ? course.modules : [];
      course.completedModules = Array.isArray(course.completedModules) ? course.completedModules : [];
      const lines = [
        `Title: ${course.title || 'Untitled Course'}`,
        `Subject: ${course.subject || '-'}`,
        `Level: ${course.level || '-'}`,
        `Duration: ${course.duration || '-'}`,
        '',
        course.overview ? `Overview:\n${course.overview}` : '',
        '',
        'Modules:'
      ];
      modules.forEach((module) => {
        lines.push(`${module.index}. ${module.title}`);
        if (module.summary) lines.push(`   ${module.summary}`);
        if (module.objectives?.length) lines.push(`   Objectives: ${module.objectives.join(' | ')}`);
      });
      outlineOutput.textContent = lines.filter(Boolean).join('\n');

      if (moduleSelect) {
        moduleSelect.innerHTML = modules.length
          ? modules.map((module) => `<option value="${module.index}">${escapeHtml(`${module.index}. ${module.title}`)}</option>`).join('')
          : '<option value="">No modules</option>';
      }
      renderModuleProgress(course);
    }

    function renderCourseList() {
      if (!courseList) return;
      const rows = getCourses().slice(0, 40);
      if (!rows.length) {
        courseList.innerHTML = '<li class="muted">No saved courses yet.</li>';
        return;
      }
      courseList.innerHTML = rows
        .map((row) => `
          <li class="card" style="padding:0.8rem;margin-bottom:0.55rem;">
            <strong>${escapeHtml(row.title || 'Untitled Course')}</strong>
            <p class="muted" style="margin:0.25rem 0;">${escapeHtml(row.subject || '-')} | ${escapeHtml(row.level || '-')} | ${escapeHtml(row.duration || '-')}</p>
            <div class="inline-row">
              <button type="button" class="btn ghost" data-course-load="${row.id}">Load</button>
              <button type="button" class="btn danger" data-course-delete="${row.id}">Delete</button>
            </div>
          </li>
        `)
        .join('');

      qsa('[data-course-load]', courseList).forEach((button) => {
        button.addEventListener('click', () => {
          const row = rows.find((item) => item.id === button.dataset.courseLoad);
          if (!row) return;
          currentCourse = row;
          if (courseTitleInput) courseTitleInput.value = row.title || '';
          if (topicInput) topicInput.value = row.topic || '';
          if (subjectInput) subjectInput.value = row.subject || 'general';
          if (levelInput) levelInput.value = row.level || 'intermediate';
          if (durationInput) durationInput.value = row.duration || '6 weeks';
          if (styleInput) styleInput.value = row.style || 'interactive';
          if (goalsInput) goalsInput.value = row.goals || '';
          renderCourseOutline(row);
          showToast('Course loaded.', 'success');
        });
      });

      qsa('[data-course-delete]', courseList).forEach((button) => {
        button.addEventListener('click', () => {
          setCourses(rows.filter((item) => item.id !== button.dataset.courseDelete));
          renderCourseList();
          showToast('Course deleted.', 'success');
        });
      });
    }

    function renderHistory() {
      if (!historyList) return;
      const rows = getHistory().slice(0, 80);
      if (!rows.length) {
        historyList.innerHTML = '<li class="muted">No teaching history yet.</li>';
        return;
      }
      historyList.innerHTML = rows
        .map((row) => `
          <li class="card" style="padding:0.75rem;margin-bottom:0.5rem;">
            <strong>${escapeHtml(row.type || 'Lesson')}</strong>
            <p class="muted" style="margin:0.2rem 0;">${new Date(row.at).toLocaleString()}</p>
            <p class="muted">${escapeHtml(String(row.input || '').slice(0, 220))}</p>
          </li>
        `)
        .join('');
    }

    async function generateCourse() {
      const topic = (topicInput?.value || '').trim();
      const subject = (subjectInput?.value || 'general').trim();
      const level = (levelInput?.value || 'intermediate').trim();
      const duration = (durationInput?.value || '6 weeks').trim();
      const style = (styleInput?.value || 'interactive').trim();
      const goals = (goalsInput?.value || '').trim();
      if (!topic) return showToast('Enter a topic first.', 'error');
      if (status) status.textContent = 'Generating full course outline...';
      if (outlineOutput) outlineOutput.textContent = 'Generating...';

      const instruction = [
        'Create a complete course outline in JSON.',
        'Return strict JSON only with keys: title, overview, modules.',
        'modules must be an array of 8 to 14 objects: {title, summary, objectives}.',
        `Topic: ${topic}`,
        `Subject: ${subject}`,
        `Learner level: ${level}`,
        `Duration: ${duration}`,
        `Teaching style: ${style}`,
        goals ? `Learning goals: ${goals}` : 'Learning goals: default progression'
      ].join('\n');

      try {
        const raw = await callAI(instruction, { maxOutputTokens: 1500 });
        const modules = normalizeModules(raw);
        const parsed = extractJsonBlock(raw) || {};
        currentCourse = {
          id: uid('course'),
          userId: session.userId,
          title: String(parsed.title || (courseTitleInput?.value || `${topic} Masterclass`)),
          topic,
          subject,
          level,
          duration,
          style,
          goals,
          overview: String(parsed.overview || ''),
          modules,
          createdAt: nowISO()
        };
        renderCourseOutline(currentCourse);
        setHistory([{ id: uid('teach'), userId: session.userId, type: 'Course Generated', input: topic, at: nowISO() }, ...getHistory()]);
        renderHistory();
        if (status) status.textContent = `Course ready with ${modules.length} modules.`;
        awardPoints(session.userId, 18);
        addLog('teacher', `Course generated by ${session.username}`);
      } catch (error) {
        if (outlineOutput) outlineOutput.textContent = `Error: ${error.message}`;
        if (status) status.textContent = `Failed: ${error.message}`;
        showToast(error.message, 'error');
      }
    }

    async function generateLesson() {
      if (!currentCourse?.modules?.length) return showToast('Generate or load a course first.', 'error');
      const moduleIndex = Number(moduleSelect?.value || 1) - 1;
      const module = currentCourse.modules[Math.max(0, Math.min(moduleIndex, currentCourse.modules.length - 1))];
      const focus = (lessonFocusInput?.value || '').trim();
      if (status) status.textContent = 'Generating lesson...';
      if (lessonOutput) lessonOutput.textContent = 'Generating...';
      try {
        const lesson = await callAI(
          `You are a world-class teacher. Teach this module clearly.
Course: ${currentCourse.title}
Module: ${module.title}
Module summary: ${module.summary}
Objectives: ${(module.objectives || []).join('; ')}
Learner level: ${currentCourse.level}
Teaching style: ${currentCourse.style}
Focus request: ${focus || 'core explanation'}
Provide sections: Concept, Example, Practice, Common mistakes, Recap.`,
          { maxOutputTokens: 1300 }
        );
        if (lessonOutput) lessonOutput.textContent = lesson;
        setHistory([{ id: uid('teach'), userId: session.userId, type: `Lesson - ${module.title}`, input: focus || module.title, at: nowISO() }, ...getHistory()]);
        renderHistory();
        if (status) status.textContent = 'Lesson generated.';
        awardPoints(session.userId, 12);
        speakTeachingText(lesson);
      } catch (error) {
        if (lessonOutput) lessonOutput.textContent = `Error: ${error.message}`;
        if (status) status.textContent = `Failed: ${error.message}`;
        showToast(error.message, 'error');
      }
    }

    async function generateQuiz() {
      const lesson = (lessonOutput?.textContent || '').trim();
      if (!lesson || lesson.toLowerCase() === 'generating...') return showToast('Generate a lesson first.', 'error');
      if (quizOutput) quizOutput.textContent = 'Generating quiz...';
      try {
        const quiz = await callAI(
          `Create a quiz based on this lesson. Include 8 questions with answers and brief explanations.\n${lesson}`,
          { maxOutputTokens: 900 }
        );
        if (quizOutput) quizOutput.textContent = quiz;
        if (status) status.textContent = 'Quiz generated.';
      } catch (error) {
        if (quizOutput) quizOutput.textContent = `Error: ${error.message}`;
        showToast(error.message, 'error');
      }
    }

    async function generateStudyPlan() {
      if (!currentCourse?.modules?.length) return showToast('Generate or load a course first.', 'error');
      if (studyPlanOutput) studyPlanOutput.textContent = 'Generating study plan...';
      try {
        const reply = await callAI(
          `Create a week-by-week study plan for this course.
Course: ${currentCourse.title}
Level: ${currentCourse.level}
Duration: ${currentCourse.duration}
Modules: ${currentCourse.modules.map((m) => m.title).join(' | ')}
Return: weekly schedule, checkpoints, and revision plan.`,
          { maxOutputTokens: 980 }
        );
        if (studyPlanOutput) studyPlanOutput.textContent = reply;
        if (status) status.textContent = 'Study plan generated.';
      } catch (error) {
        if (studyPlanOutput) studyPlanOutput.textContent = `Error: ${error.message}`;
        showToast(error.message, 'error');
      }
    }

    async function generateFlashcards() {
      const lesson = String(lessonOutput?.textContent || '').trim();
      const source = lesson && lesson.toLowerCase() !== 'no lesson yet.' ? lesson : String(outlineOutput?.textContent || '');
      if (!source) return showToast('Generate course or lesson first.', 'error');
      if (flashcardsOutput) flashcardsOutput.textContent = 'Generating flashcards...';
      try {
        const reply = await callAI(
          `Generate 15 high-quality study flashcards from this content. Format each as "Q: ... A: ...".\n${source}`,
          { maxOutputTokens: 1000 }
        );
        if (flashcardsOutput) flashcardsOutput.textContent = reply;
        if (status) status.textContent = 'Flashcards generated.';
      } catch (error) {
        if (flashcardsOutput) flashcardsOutput.textContent = `Error: ${error.message}`;
        showToast(error.message, 'error');
      }
    }

    async function generateAssignment() {
      if (!currentCourse?.modules?.length) return showToast('Generate or load a course first.', 'error');
      const lesson = String(lessonOutput?.textContent || '').trim();
      const focus = (lessonFocusInput?.value || '').trim();
      if (assignmentOutput) assignmentOutput.textContent = 'Generating assignment...';
      try {
        const reply = await callAI(
          `Create a practical assignment with rubric and solution outline.
Course: ${currentCourse.title}
Module focus: ${focus || 'current module objectives'}
Context:\n${lesson || currentCourse.overview || ''}`,
          { maxOutputTokens: 1100 }
        );
        if (assignmentOutput) assignmentOutput.textContent = reply;
        if (status) status.textContent = 'Assignment generated.';
      } catch (error) {
        if (assignmentOutput) assignmentOutput.textContent = `Error: ${error.message}`;
        showToast(error.message, 'error');
      }
    }

    async function askTutor() {
      const question = (tutorQuestionInput?.value || '').trim();
      if (!question) return showToast('Ask a tutor question first.', 'error');
      if (tutorAnswerOutput) tutorAnswerOutput.textContent = 'Thinking...';
      try {
        const context = [
          currentCourse?.title ? `Course: ${currentCourse.title}` : '',
          currentCourse?.subject ? `Subject: ${currentCourse.subject}` : '',
          currentCourse?.level ? `Level: ${currentCourse.level}` : '',
          `Outline: ${String(outlineOutput?.textContent || '').slice(0, 2200)}`,
          `Lesson: ${String(lessonOutput?.textContent || '').slice(0, 2200)}`
        ].filter(Boolean).join('\n');
        const reply = await callAI(
          `You are an expert teacher. Answer the learner's question clearly with examples and a quick recap.
Question: ${question}
Context:
${context}`,
          { maxOutputTokens: 900 }
        );
        if (tutorAnswerOutput) tutorAnswerOutput.textContent = reply;
        setHistory([{ id: uid('teach'), userId: session.userId, type: 'Tutor Q&A', input: question, at: nowISO() }, ...getHistory()]);
        renderHistory();
        if (voiceActivated && voiceToggleInput?.checked) speakTeachingText(reply);
      } catch (error) {
        if (tutorAnswerOutput) tutorAnswerOutput.textContent = `Error: ${error.message}`;
        showToast(error.message, 'error');
      }
    }

    function saveCourse() {
      if (!currentCourse) return showToast('Generate a course first.', 'error');
      const title = (courseTitleInput?.value || '').trim();
      if (title) currentCourse.title = title;
      const rows = getCourses();
      const idx = rows.findIndex((row) => row.id === currentCourse.id);
      if (idx >= 0) {
        rows[idx] = { ...rows[idx], ...currentCourse, updatedAt: nowISO() };
      } else {
        currentCourse.id = currentCourse.id || uid('course');
        rows.unshift({ ...currentCourse, createdAt: currentCourse.createdAt || nowISO() });
      }
      setCourses(rows);
      renderCourseList();
      showToast('Course saved.', 'success');
      awardPoints(session.userId, 4);
    }

    qs('#teacherGenerateCourseBtn')?.addEventListener('click', generateCourse);
    qs('#teacherGenerateLessonBtn')?.addEventListener('click', generateLesson);
    qs('#teacherGenerateQuizBtn')?.addEventListener('click', generateQuiz);
    qs('#teacherGenerateStudyPlanBtn')?.addEventListener('click', generateStudyPlan);
    qs('#teacherGenerateFlashcardsBtn')?.addEventListener('click', generateFlashcards);
    qs('#teacherGenerateAssignmentBtn')?.addEventListener('click', generateAssignment);
    qs('#teacherAskTutorBtn')?.addEventListener('click', askTutor);
    qs('#teacherStartLiveClassBtn')?.addEventListener('click', async () => {
      voiceActivated = true;
      await generateLesson();
    });
    qs('#teacherSaveCourseBtn')?.addEventListener('click', saveCourse);
    qs('#teacherSaveNotesBtn')?.addEventListener('click', () => {
      const text = String(notesInput?.value || '');
      setSavedNotes(text);
      showToast('Teaching notes saved.', 'success');
    });
    qs('#teacherVoiceActivateBtn')?.addEventListener('click', () => {
      voiceActivated = true;
      showToast('Teacher voice activated.', 'success');
      const text = resolveVoiceContent();
      if (text && !/no lesson yet|no course generated yet|no quiz yet/i.test(text)) speakTeachingText(text);
    });
    qs('#teacherVoiceReadBtn')?.addEventListener('click', () => {
      const text = resolveVoiceContent();
      if (!text || /no lesson yet|no course generated yet|no quiz yet/i.test(text)) {
        showToast('Generate content before using read aloud.', 'error');
        return;
      }
      voiceActivated = true;
      speakTeachingText(text);
    });
    qs('#teacherVoiceStopBtn')?.addEventListener('click', () => {
      voiceActivated = false;
      stopTeachingVoice();
      showToast('Teacher voice stopped.', 'success');
    });
    qs('#teacherExportCoursesBtn')?.addEventListener('click', () => downloadJSON(`matrix-teacher-courses-${session.username}.json`, getCourses()));
    qs('#teacherExportHistoryBtn')?.addEventListener('click', () => downloadJSON(`matrix-teacher-history-${session.username}.json`, getHistory()));
    qs('#teacherImportCoursesBtn')?.addEventListener('click', () => importInput?.click());
    importInput?.addEventListener('change', () => {
      const file = importInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const payload = JSON.parse(String(reader.result || '[]'));
          if (!Array.isArray(payload)) throw new Error('Expected an array of courses.');
          const imported = payload
            .filter((row) => row && typeof row === 'object')
            .map((row) => ({
              id: uid('course'),
              userId: session.userId,
              title: String(row.title || 'Imported Course'),
              topic: String(row.topic || ''),
              subject: String(row.subject || 'general'),
              level: String(row.level || 'intermediate'),
              duration: String(row.duration || '6 weeks'),
              style: String(row.style || 'interactive'),
              goals: String(row.goals || ''),
              overview: String(row.overview || ''),
              modules: Array.isArray(row.modules) ? row.modules.slice(0, 20).map((m, idx) => ({
                index: idx + 1,
                title: String(m.title || `Module ${idx + 1}`),
                summary: String(m.summary || ''),
                objectives: Array.isArray(m.objectives) ? m.objectives.map((x) => String(x)) : []
              })) : [],
              createdAt: nowISO()
            }))
            .filter((course) => course.title && course.modules.length);
          if (!imported.length) throw new Error('No valid course objects found.');
          setCourses([...imported, ...getCourses()]);
          renderCourseList();
          showToast(`Imported ${imported.length} courses.`, 'success');
        } catch (error) {
          showToast(`Import failed: ${error.message}`, 'error');
        } finally {
          importInput.value = '';
        }
      };
      reader.readAsText(file);
    });
    voiceRateInput?.addEventListener('input', updateVoiceLabels);
    voicePitchInput?.addEventListener('input', updateVoiceLabels);
    tutorQuestionInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        askTutor();
      }
    });

    if (notesInput) notesInput.value = getSavedNotes();
    if ('speechSynthesis' in window) {
      populateVoices();
      window.speechSynthesis.onvoiceschanged = populateVoices;
    }
    updateVoiceLabels();
    renderCourseOutline(null);
    renderCourseList();
    renderHistory();

    window.addEventListener('beforeunload', stopTeachingVoice);
  }

  function initCyberPage() {
    const session = getSession();
    if (!session) return;

    const auditInput = qs('#cyberAuditInput');
    const auditType = qs('#cyberAuditType');
    const auditOutput = qs('#cyberAuditOutput');
    const incidentTitle = qs('#cyberIncidentTitle');
    const incidentService = qs('#cyberIncidentService');
    const incidentSeverity = qs('#cyberIncidentSeverity');
    const incidentDetails = qs('#cyberIncidentDetails');
    const runbookOutput = qs('#cyberRunbookOutput');
    const watchInput = qs('#cyberWatchInput');
    const watchStatus = qs('#cyberWatchStatus');
    const watchList = qs('#cyberWatchList');
    const incidentList = qs('#cyberIncidentList');
    const passwordInput = qs('#cyberPasswordInput');
    const passwordScore = qs('#cyberPasswordScore');
    const passwordTips = qs('#cyberPasswordTips');
    const status = qs('#cyberStatus');

    function getWatchRows() {
      return getJSON(STORAGE.cyberWatch, []).filter((row) => row.userId === session.userId);
    }

    function setWatchRows(rows) {
      const others = getJSON(STORAGE.cyberWatch, []).filter((row) => row.userId !== session.userId);
      setJSON(STORAGE.cyberWatch, [...rows.slice(0, 150), ...others]);
    }

    function getIncidents() {
      return getJSON(STORAGE.cyberIncidents, []).filter((row) => row.userId === session.userId);
    }

    function setIncidents(rows) {
      const others = getJSON(STORAGE.cyberIncidents, []).filter((row) => row.userId !== session.userId);
      setJSON(STORAGE.cyberIncidents, [...rows.slice(0, 160), ...others]);
    }

    function renderWatchlist() {
      if (!watchList) return;
      const rows = getWatchRows().slice(0, 40);
      if (!rows.length) {
        watchList.innerHTML = '<li class="muted">No threat watchlist items yet.</li>';
        return;
      }
      watchList.innerHTML = rows
        .map((row) => `
          <li class="card" style="padding:0.8rem;margin-bottom:0.55rem;">
            <strong>${escapeHtml(row.name)}</strong>
            <p class="muted" style="margin:0.25rem 0;">Status: ${escapeHtml(row.status)} | ${new Date(row.createdAt).toLocaleDateString()}</p>
            <pre class="tool-output">${escapeHtml(row.summary || 'No AI assessment yet.')}</pre>
            <div class="inline-row">
              <button type="button" class="btn ghost" data-watch-assess="${row.id}">AI Assess</button>
              <button type="button" class="btn danger" data-watch-delete="${row.id}">Delete</button>
            </div>
          </li>
        `)
        .join('');

      qsa('[data-watch-delete]', watchList).forEach((button) => {
        button.addEventListener('click', () => {
          setWatchRows(rows.filter((row) => row.id !== button.dataset.watchDelete));
          renderWatchlist();
          showToast('Watchlist item deleted.', 'success');
        });
      });

      qsa('[data-watch-assess]', watchList).forEach((button) => {
        button.addEventListener('click', async () => {
          const row = rows.find((item) => item.id === button.dataset.watchAssess);
          if (!row) return;
          try {
            const reply = await callAI(
              `Assess the cybersecurity risk for "${row.name}". Return risk level, likely impact, and mitigation checklist.`,
              { maxOutputTokens: 380 }
            );
            const next = getWatchRows().map((item) => item.id === row.id ? { ...item, summary: reply, updatedAt: nowISO() } : item);
            setWatchRows(next);
            renderWatchlist();
            showToast('Assessment updated.', 'success');
          } catch (error) {
            showToast(error.message, 'error');
          }
        });
      });
    }

    function renderIncidents() {
      if (!incidentList) return;
      const rows = getIncidents().slice(0, 30);
      if (!rows.length) {
        incidentList.innerHTML = '<li class="muted">No incidents logged.</li>';
        return;
      }
      incidentList.innerHTML = rows
        .map((row) => `
          <li class="card" style="padding:0.8rem;margin-bottom:0.55rem;">
            <strong>${escapeHtml(row.title)}</strong>
            <p class="muted" style="margin:0.25rem 0;">${escapeHtml(row.service)} | ${escapeHtml(row.severity)} | ${new Date(row.createdAt).toLocaleString()}</p>
            <pre class="tool-output">${escapeHtml(row.runbook || row.details || '')}</pre>
            <button type="button" class="btn danger" data-incident-delete="${row.id}">Delete</button>
          </li>
        `)
        .join('');

      qsa('[data-incident-delete]', incidentList).forEach((button) => {
        button.addEventListener('click', () => {
          setIncidents(rows.filter((row) => row.id !== button.dataset.incidentDelete));
          renderIncidents();
        });
      });
    }

    function updatePasswordHints() {
      const value = String(passwordInput?.value || '');
      const score = scorePassword(value);
      if (passwordScore) passwordScore.textContent = `${score}/100`;
      if (!passwordTips) return;
      const tips = [];
      if (value.length < 12) tips.push('Use at least 12 characters.');
      if (!/[A-Z]/.test(value)) tips.push('Add uppercase.');
      if (!/[a-z]/.test(value)) tips.push('Add lowercase.');
      if (!/[0-9]/.test(value)) tips.push('Add numbers.');
      if (!/[^A-Za-z0-9]/.test(value)) tips.push('Add symbols.');
      if (/(password|admin|qwerty|1234)/i.test(value)) tips.push('Avoid common keywords.');
      passwordTips.textContent = tips.length ? tips.join(' ') : 'Strong pattern detected.';
    }

    async function runAudit() {
      const text = (auditInput?.value || '').trim();
      if (!text) return showToast('Provide security input first.', 'error');
      const type = (auditType?.value || 'webapp').trim();
      if (auditOutput) auditOutput.textContent = 'Analyzing...';
      if (status) status.textContent = 'Running security audit...';
      try {
        const reply = await callAI(
          `Act as cybersecurity auditor. Analyze this ${type} input. Return top risks with severity and remediation steps.\n${text}`,
          { maxOutputTokens: 900 }
        );
        if (auditOutput) auditOutput.textContent = reply;
        if (status) status.textContent = 'Audit complete.';
        awardPoints(session.userId, 10);
        addLog('cyber', `Security audit by ${session.username}`);
      } catch (error) {
        if (auditOutput) auditOutput.textContent = `Error: ${error.message}`;
        if (status) status.textContent = `Failed: ${error.message}`;
        showToast(error.message, 'error');
      }
    }

    async function generateRunbook() {
      const title = (incidentTitle?.value || '').trim();
      const details = (incidentDetails?.value || '').trim();
      if (!title || !details) return showToast('Enter incident title and details.', 'error');
      const service = (incidentService?.value || 'Unknown service').trim();
      const severity = (incidentSeverity?.value || 'medium').trim();
      if (runbookOutput) runbookOutput.textContent = 'Generating runbook...';
      try {
        const reply = await callAI(
          `Create incident response runbook.
Incident: ${title}
Service: ${service}
Severity: ${severity}
Details: ${details}
Return sections: Triage, Containment, Eradication, Recovery, Communication, Postmortem.`,
          { maxOutputTokens: 1000 }
        );
        if (runbookOutput) runbookOutput.textContent = reply;
        if (status) status.textContent = 'Runbook generated.';
      } catch (error) {
        if (runbookOutput) runbookOutput.textContent = `Error: ${error.message}`;
        showToast(error.message, 'error');
      }
    }

    function saveIncident() {
      const title = (incidentTitle?.value || '').trim();
      const details = (incidentDetails?.value || '').trim();
      if (!title || !details) return showToast('Enter incident title and details.', 'error');
      const rows = getIncidents();
      rows.unshift({
        id: uid('incident'),
        userId: session.userId,
        title,
        service: (incidentService?.value || 'Unknown service').trim(),
        severity: (incidentSeverity?.value || 'medium').trim(),
        details,
        runbook: (runbookOutput?.textContent || '').trim(),
        createdAt: nowISO()
      });
      setIncidents(rows);
      renderIncidents();
      showToast('Incident saved.', 'success');
      awardPoints(session.userId, 5);
    }

    qs('#cyberRunAuditBtn')?.addEventListener('click', runAudit);
    qs('#cyberGenerateRunbookBtn')?.addEventListener('click', generateRunbook);
    qs('#cyberSaveIncidentBtn')?.addEventListener('click', saveIncident);
    qs('#cyberWatchAddBtn')?.addEventListener('click', () => {
      const name = (watchInput?.value || '').trim();
      if (!name) return showToast('Enter threat ID or CVE first.', 'error');
      const rows = getWatchRows();
      rows.unshift({
        id: uid('watch'),
        userId: session.userId,
        name,
        status: (watchStatus?.value || 'monitoring').trim(),
        summary: '',
        createdAt: nowISO()
      });
      setWatchRows(rows);
      if (watchInput) watchInput.value = '';
      renderWatchlist();
      showToast('Watchlist item added.', 'success');
    });
    qs('#cyberWatchExportBtn')?.addEventListener('click', () => downloadJSON(`matrix-cyber-watch-${session.username}.json`, getWatchRows()));
    qs('#cyberIncidentExportBtn')?.addEventListener('click', () => downloadJSON(`matrix-cyber-incidents-${session.username}.json`, getIncidents()));
    passwordInput?.addEventListener('input', updatePasswordHints);

    updatePasswordHints();
    renderWatchlist();
    renderIncidents();
  }

  function initAutomationPage() {
    const session = getSession();
    if (!session) return;

    const goalInput = qs('#autoGoalInput');
    const triggerInput = qs('#autoTriggerType');
    const frequencyInput = qs('#autoFrequencyInput');
    const toolsInput = qs('#autoToolsInput');
    const flowNameInput = qs('#autoFlowName');
    const planOutput = qs('#autoPlanOutput');
    const workflowList = qs('#autoWorkflowList');
    const workflowImportInput = qs('#autoWorkflowImportInput');
    const queueNameInput = qs('#autoTaskName');
    const queueRunAtInput = qs('#autoTaskRunAt');
    const queueList = qs('#autoQueueList');
    const apiMethodInput = qs('#autoApiMethod');
    const apiUrlInput = qs('#autoApiUrl');
    const apiHeadersInput = qs('#autoApiHeaders');
    const apiBodyInput = qs('#autoApiBody');
    const apiOutput = qs('#autoApiOutput');
    const status = qs('#autoStatus');

    function getFlows() {
      return getJSON(STORAGE.automationFlows, []).filter((row) => row.userId === session.userId);
    }

    function setFlows(rows) {
      const others = getJSON(STORAGE.automationFlows, []).filter((row) => row.userId !== session.userId);
      setJSON(STORAGE.automationFlows, [...rows.slice(0, 200), ...others]);
    }

    function getQueue() {
      return getJSON(STORAGE.automationQueue, []).filter((row) => row.userId === session.userId);
    }

    function setQueue(rows) {
      const others = getJSON(STORAGE.automationQueue, []).filter((row) => row.userId !== session.userId);
      setJSON(STORAGE.automationQueue, [...rows.slice(0, 220), ...others]);
    }

    function renderFlows() {
      if (!workflowList) return;
      const rows = getFlows().slice(0, 60);
      if (!rows.length) {
        workflowList.innerHTML = '<li class="muted">No workflows saved yet.</li>';
        return;
      }
      workflowList.innerHTML = rows
        .map((row) => `
          <li class="card" style="padding:0.8rem;margin-bottom:0.55rem;">
            <strong>${escapeHtml(row.name)}</strong>
            <p class="muted" style="margin:0.3rem 0;">${escapeHtml(row.trigger)} | ${escapeHtml(row.frequency || 'custom')}</p>
            <pre class="tool-output">${escapeHtml(String(row.plan || '').slice(0, 450))}</pre>
            <div class="inline-row">
              <button type="button" class="btn ghost" data-flow-load="${row.id}">Load</button>
              <button type="button" class="btn danger" data-flow-delete="${row.id}">Delete</button>
            </div>
          </li>
        `)
        .join('');

      qsa('[data-flow-load]', workflowList).forEach((button) => {
        button.addEventListener('click', () => {
          const row = rows.find((item) => item.id === button.dataset.flowLoad);
          if (!row) return;
          if (goalInput) goalInput.value = row.goal || '';
          if (triggerInput) triggerInput.value = row.trigger || 'webhook';
          if (frequencyInput) frequencyInput.value = row.frequency || '';
          if (toolsInput) toolsInput.value = row.tools || '';
          if (flowNameInput) flowNameInput.value = row.name || '';
          if (planOutput) planOutput.textContent = row.plan || '';
          showToast('Workflow loaded.', 'success');
        });
      });

      qsa('[data-flow-delete]', workflowList).forEach((button) => {
        button.addEventListener('click', () => {
          setFlows(rows.filter((item) => item.id !== button.dataset.flowDelete));
          renderFlows();
          showToast('Workflow deleted.', 'success');
        });
      });
    }

    function renderQueue() {
      if (!queueList) return;
      const rows = getQueue().slice(0, 80);
      if (!rows.length) {
        queueList.innerHTML = '<li class="muted">No queue jobs yet.</li>';
        return;
      }
      queueList.innerHTML = rows
        .map((row) => `
          <li class="card" style="padding:0.8rem;margin-bottom:0.55rem;">
            <strong>${escapeHtml(row.name)}</strong>
            <p class="muted" style="margin:0.3rem 0;">${row.runAt ? new Date(row.runAt).toLocaleString() : 'Immediate'} | ${escapeHtml(row.status || 'queued')}</p>
            <p class="muted">${escapeHtml(row.result || '')}</p>
            <div class="inline-row">
              <button type="button" class="btn ghost" data-queue-run="${row.id}">Run Now</button>
              <button type="button" class="btn danger" data-queue-delete="${row.id}">Delete</button>
            </div>
          </li>
        `)
        .join('');

      qsa('[data-queue-run]', queueList).forEach((button) => {
        button.addEventListener('click', () => {
          const next = getQueue().map((row) => row.id === button.dataset.queueRun
            ? { ...row, status: 'completed', result: `Simulated execution at ${new Date().toLocaleTimeString()}`, updatedAt: nowISO() }
            : row);
          setQueue(next);
          renderQueue();
          showToast('Queue job executed.', 'success');
          awardPoints(session.userId, 2);
        });
      });

      qsa('[data-queue-delete]', queueList).forEach((button) => {
        button.addEventListener('click', () => {
          setQueue(rows.filter((row) => row.id !== button.dataset.queueDelete));
          renderQueue();
        });
      });
    }

    async function generatePlan() {
      const goal = (goalInput?.value || '').trim();
      if (!goal) return showToast('Enter an automation goal first.', 'error');
      const trigger = (triggerInput?.value || 'webhook').trim();
      const frequency = (frequencyInput?.value || '').trim();
      const tools = (toolsInput?.value || '').trim();
      if (planOutput) planOutput.textContent = 'Generating workflow...';
      if (status) status.textContent = 'Generating AI plan...';
      try {
        const reply = await callAI(
          `Create automation workflow.
Goal: ${goal}
Trigger: ${trigger}
Frequency: ${frequency || 'custom'}
Tools: ${tools || 'not specified'}
Return sections: Steps, Dependencies, Failure handling, Monitoring.`,
          { maxOutputTokens: 920 }
        );
        if (planOutput) planOutput.textContent = reply;
        if (status) status.textContent = 'Workflow ready.';
        awardPoints(session.userId, 10);
        addLog('automation', `Automation workflow generated by ${session.username}`);
      } catch (error) {
        if (planOutput) planOutput.textContent = `Error: ${error.message}`;
        if (status) status.textContent = `Failed: ${error.message}`;
        showToast(error.message, 'error');
      }
    }

    function saveFlow() {
      const goal = (goalInput?.value || '').trim();
      const plan = (planOutput?.textContent || '').trim();
      if (!goal || !plan || plan.toLowerCase() === 'generating workflow...') return showToast('Generate a workflow before saving.', 'error');
      const rows = getFlows();
      rows.unshift({
        id: uid('flow'),
        userId: session.userId,
        name: (flowNameInput?.value || '').trim() || `Workflow ${new Date().toLocaleString()}`,
        goal,
        trigger: (triggerInput?.value || 'webhook').trim(),
        frequency: (frequencyInput?.value || '').trim(),
        tools: (toolsInput?.value || '').trim(),
        plan,
        createdAt: nowISO()
      });
      setFlows(rows);
      renderFlows();
      showToast('Workflow saved.', 'success');
    }

    function addQueueJob() {
      const name = (queueNameInput?.value || '').trim();
      if (!name) return showToast('Enter task name first.', 'error');
      const rows = getQueue();
      rows.unshift({
        id: uid('queue'),
        userId: session.userId,
        name,
        runAt: (queueRunAtInput?.value || '').trim(),
        status: 'queued',
        result: '',
        createdAt: nowISO()
      });
      setQueue(rows);
      if (queueNameInput) queueNameInput.value = '';
      renderQueue();
      showToast('Queue task added.', 'success');
    }

    function buildApiSnippet(mode) {
      const method = (apiMethodInput?.value || 'GET').toUpperCase();
      const url = (apiUrlInput?.value || '').trim();
      if (!url) return showToast('Enter API URL first.', 'error');
      const headerRows = (apiHeadersInput?.value || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const idx = line.indexOf(':');
          if (idx < 0) return null;
          return { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
        })
        .filter(Boolean);
      const body = (apiBodyInput?.value || '').trim();

      if (!apiOutput) return;
      if (mode === 'curl') {
        const headers = headerRows.map((h) => `  -H "${h.key}: ${h.value}"`).join(' \\\n');
        const bodyPart = body ? ` \\\n  -d '${body.replace(/'/g, "\\'")}'` : '';
        apiOutput.textContent = `curl -X ${method} "${url}"${headers ? ` \\\n${headers}` : ''}${bodyPart}`;
      } else {
        const headersObject = headerRows.length
          ? `{\n${headerRows.map((h) => `    "${h.key}": "${h.value.replace(/"/g, '\\"')}"`).join(',\n')}\n  }`
          : '{}';
        apiOutput.textContent = `fetch("${url}", {\n  method: "${method}",\n  headers: ${headersObject},\n  ${body ? `body: JSON.stringify(${body}),\n  ` : ''}credentials: "include"\n});`;
      }
    }

    qs('#autoGeneratePlanBtn')?.addEventListener('click', generatePlan);
    qs('#autoSaveWorkflowBtn')?.addEventListener('click', saveFlow);
    qs('#autoQueueAddBtn')?.addEventListener('click', addQueueJob);
    qs('#autoQueueRunAllBtn')?.addEventListener('click', () => {
      const next = getQueue().map((row) => ({
        ...row,
        status: 'completed',
        result: `Bulk-run completed at ${new Date().toLocaleTimeString()}`,
        updatedAt: nowISO()
      }));
      setQueue(next);
      renderQueue();
      showToast('All queue jobs executed.', 'success');
      awardPoints(session.userId, 4);
    });
    qs('#autoBuildCurlBtn')?.addEventListener('click', () => buildApiSnippet('curl'));
    qs('#autoBuildFetchBtn')?.addEventListener('click', () => buildApiSnippet('fetch'));
    qs('#autoWorkflowExportBtn')?.addEventListener('click', () => downloadJSON(`matrix-workflows-${session.username}.json`, getFlows()));
    qs('#autoWorkflowImportBtn')?.addEventListener('click', () => workflowImportInput?.click());
    workflowImportInput?.addEventListener('change', () => {
      const file = workflowImportInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const payload = JSON.parse(String(reader.result || '[]'));
          if (!Array.isArray(payload)) throw new Error('Expected array payload.');
          const imported = payload
            .filter((row) => row && typeof row === 'object')
            .map((row) => ({
              id: uid('flow'),
              userId: session.userId,
              name: String(row.name || 'Imported workflow'),
              goal: String(row.goal || ''),
              trigger: String(row.trigger || 'webhook'),
              frequency: String(row.frequency || ''),
              tools: String(row.tools || ''),
              plan: String(row.plan || ''),
              createdAt: nowISO()
            }))
            .filter((row) => row.goal && row.plan);
          if (!imported.length) throw new Error('No valid workflows found.');
          setFlows([...imported, ...getFlows()]);
          renderFlows();
          showToast(`Imported ${imported.length} workflows.`, 'success');
        } catch (error) {
          showToast(`Import failed: ${error.message}`, 'error');
        } finally {
          workflowImportInput.value = '';
        }
      };
      reader.readAsText(file);
    });

    renderFlows();
    renderQueue();
  }

  function initTermsPage() {
    if (qs('#termsGeneratedDate')) qs('#termsGeneratedDate').textContent = new Date().toLocaleDateString();
  }

  function boot() {
    ensureSeedData();
    initGlobal();

    const page = document.body?.dataset?.page || 'index';
    const session = getSession();
    if (!pageGuard(page, session)) return;

    if (page === 'index') initHomePage();
    if (page === 'login') initLoginPage();
    if (page === 'register') initRegisterPage();
    if (page === 'dashboard') initDashboardPage();
    if (page === 'payment') initPaymentPage();
    if (page === 'leaderboard') initLeaderboardPage();
    if (page === 'admin') initAdminPage();
    if (page === 'settings') initSettingsPage();
    if (page === 'roadmap') initRoadmapPage();
    if (page === 'video') initVideoPage();
    if (page === 'lab') initLabPage();
    if (page === 'dev') initDevPage();
    if (page === 'teacher') initTeacherPage();
    if (page === 'cyber') initCyberPage();
    if (page === 'automation') initAutomationPage();
    if (page === 'terms') initTermsPage();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
