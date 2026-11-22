const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'orders.json');

const STAGES = {
  intake: { ru: 'Слепок / скан', en: 'Impression / scan' },
  model: { ru: 'Моделирование', en: 'Modelling' },
  process: { ru: 'Обработка', en: 'Processing' },
  tryin: { ru: 'Примерка', en: 'Try-in' },
  finish: { ru: 'Глазурь / финиш', en: 'Glaze / finish' },
  qc: { ru: 'Контроль качества', en: 'Quality control' },
  ship: { ru: 'Отправка', en: 'Dispatch' }
};

const WORK_TYPES = {
  zirconia: {
    ru: 'Циркониевая коронка', en: 'Zirconia crown', material: 'Zirconia',
    stages: [['intake', 1], ['model', 2], ['process', 2], ['tryin', 1], ['finish', 1], ['qc', 1], ['ship', 1]]
  },
  pfm: {
    ru: 'Металлокерамика', en: 'Porcelain-fused-to-metal crown', material: 'PFM',
    stages: [['intake', 1], ['model', 2], ['process', 3], ['tryin', 1], ['finish', 2], ['qc', 1], ['ship', 1]]
  },
  bridge: {
    ru: 'Мост', en: 'Bridge', material: 'Zirconia / PFM',
    stages: [['intake', 1], ['model', 3], ['process', 4], ['tryin', 1], ['finish', 2], ['qc', 1], ['ship', 1]]
  },
  denture: {
    ru: 'Съёмный протез', en: 'Removable denture', material: 'Acrylic',
    stages: [['intake', 1], ['model', 3], ['process', 5], ['tryin', 2], ['finish', 1], ['qc', 1], ['ship', 1]]
  },
  veneer: {
    ru: 'Винир', en: 'Veneer', material: 'Lithium disilicate',
    stages: [['intake', 1], ['model', 2], ['process', 3], ['tryin', 1], ['finish', 2], ['qc', 1], ['ship', 1]]
  },
  temporary: {
    ru: 'Временная коронка', en: 'Temporary crown', material: 'PMMA',
    stages: [['intake', 1], ['model', 1], ['process', 1], ['qc', 1], ['ship', 1]]
  }
};

const VITA_SHADES = ['A1', 'A2', 'A3', 'A3.5', 'A4', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4', 'D2', 'D3', 'D4'];
const SOCIAL_CATEGORIES = {
  elderly: { ru: 'Пожилой пациент', en: 'Older patient' },
  low_income: { ru: 'Малообеспеченная семья', en: 'Low-income family' },
  benefit: { ru: 'Льготная категория', en: 'Benefits category' },
  other: { ru: 'Другое', en: 'Other' }
};

function isoDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function token() { return crypto.randomBytes(12).toString('hex'); }

function seedOrders() {
  const orders = [
    makeOrder({ patientCode: 'DL-204', clinic: 'Стоматология «Маяк»', dentist: 'д-р Алина К.', type: 'zirconia', teeth: '1.1', shade: 'A1', material: 'Zirconia', dueDate: isoDate(4), notes: 'Демо: сохранить прозрачность режущего края.', stage: 'process' }),
    makeOrder({ patientCode: 'DL-205', clinic: 'White Line', dentist: 'д-р Тимур С.', type: 'pfm', teeth: '2.6', shade: 'A2', material: 'PFM', dueDate: isoDate(2), notes: 'Демо: проверить окклюзию по скану.', stage: 'model' }),
    makeOrder({ patientCode: 'DL-206', clinic: 'Dental Point', dentist: 'д-р Мария Р.', type: 'bridge', teeth: '3.4–3.6', shade: 'B2', material: 'Zirconia / PFM', dueDate: isoDate(-1), notes: 'Демо: срочный заказ для теста риска.', stage: 'intake' }),
    makeOrder({ patientCode: 'DL-207', clinic: 'Стоматология «Клевер»', dentist: 'д-р Илья Н.', type: 'veneer', teeth: '1.2', shade: 'A1', material: 'Lithium disilicate', dueDate: isoDate(7), notes: 'Демо: без личных данных пациента.', stage: 'tryin' }),
    makeOrder({ patientCode: 'DL-208', clinic: 'Nova Dental', dentist: 'д-р Елена П.', type: 'temporary', teeth: '4.6', shade: 'A3', material: 'PMMA', dueDate: isoDate(1), notes: 'Демо: временная коронка.', stage: 'qc' }),
    makeOrder({ patientCode: 'DL-209', clinic: 'Стоматология «Маяк»', dentist: 'д-р Алина К.', type: 'denture', teeth: '1.1–1.6', shade: 'A2', material: 'Acrylic', dueDate: isoDate(3), notes: 'Демо: социальный заказ. Без ФИО и медицинских деталей.', stage: 'model', isSocial: true, socialCategory: 'elderly' }),
    makeOrder({ patientCode: 'DL-210', clinic: 'White Line', dentist: 'д-р Тимур С.', type: 'temporary', teeth: '2.6', shade: 'A2', material: 'PMMA', dueDate: isoDate(5), notes: 'Демо: социальный заказ.', stage: 'ship', isSocial: true, socialCategory: 'low_income', completedAt: new Date().toISOString() }),
    makeOrder({ patientCode: 'DL-211', clinic: 'Dental Point', dentist: 'д-р Мария Р.', type: 'bridge', teeth: '3.4–3.6', shade: 'B2', material: 'Zirconia / PFM', dueDate: isoDate(-2), notes: 'Демо: социальный заказ для проверки просрочки.', stage: 'process', isSocial: true, socialCategory: 'benefit' }),
    makeOrder({ patientCode: 'DL-212', clinic: 'Nova Dental', dentist: 'д-р Елена П.', type: 'veneer', teeth: '1.2', shade: 'A1', material: 'Lithium disilicate', dueDate: isoDate(4), notes: 'Демо: социальный заказ.', stage: 'tryin', isSocial: true, socialCategory: 'other' })
  ];
  return orders;
}

function makeOrder(input) {
  const now = new Date().toISOString();
  const type = input.type || 'zirconia';
  return {
    id: input.id || crypto.randomUUID(),
    publicToken: input.publicToken || token(),
    patientCode: String(input.patientCode || '').trim(),
    clinic: String(input.clinic || '').trim(),
    dentist: String(input.dentist || '').trim(),
    type,
    teeth: String(input.teeth || '').trim(),
    shade: String(input.shade || '').trim().toUpperCase(),
    material: String(input.material || WORK_TYPES[type]?.material || '').trim(),
    dueDate: input.dueDate,
    notes: String(input.notes || '').trim(),
    stage: input.stage || WORK_TYPES[type]?.stages[0][0] || 'intake',
    isSocial: Boolean(input.isSocial),
    socialCategory: input.isSocial ? String(input.socialCategory || 'other') : null,
    completedAt: input.completedAt || null,
    isDemo: Boolean(input.isDemo),
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now
  };
}

function ensureStore(file = DATA_FILE) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) writeOrders(seedOrders().map((order) => ({ ...order, isDemo: true })), file);
}

function readOrders(file = DATA_FILE) {
  ensureStore(file);
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOrders(orders, file = DATA_FILE) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(orders, null, 2), 'utf8');
  fs.renameSync(temp, file);
}

function typeStages(order) { return WORK_TYPES[order.type]?.stages || []; }

function calculateRisk(order, now = new Date()) {
  const stages = typeStages(order);
  const currentIndex = Math.max(0, stages.findIndex(([id]) => id === order.stage));
  const remainingDays = stages.slice(currentIndex).reduce((sum, [, days]) => sum + days, 0);
  const expected = new Date(now);
  expected.setDate(expected.getDate() + remainingDays);
  const due = new Date(`${order.dueDate}T23:59:59`);
  const riskDue = new Date(due);
  if (order.isSocial) riskDue.setDate(riskDue.getDate() - 1);
  const status = now > due ? 'overdue' : expected > riskDue ? 'risk' : 'on-time';
  return { status, remainingDays, expectedDate: expected.toISOString().slice(0, 10), dueDate: order.dueDate, strict: Boolean(order.isSocial) };
}

function publicOrder(order) {
  const risk = calculateRisk(order);
  return {
    patientCode: order.patientCode,
    type: order.type,
    typeLabel: WORK_TYPES[order.type]?.ru || order.type,
    stage: order.stage,
    stageLabel: STAGES[order.stage]?.ru || order.stage,
    expectedDate: risk.expectedDate,
    dueDate: order.dueDate,
    risk: risk.status
  };
}

function safeOrder(order) {
  return { ...order, typeLabel: WORK_TYPES[order.type]?.ru || order.type, socialCategoryLabel: SOCIAL_CATEGORIES[order.socialCategory]?.ru || null, risk: calculateRisk(order) };
}

function sortOrders(orders) {
  return [...orders].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || Number(b.isSocial) - Number(a.isSocial) || String(a.createdAt).localeCompare(String(b.createdAt)));
}

function calculateImpact(orders) {
  const social = orders.filter((order) => order.isSocial);
  const deliveredOnTime = social.filter((order) => order.stage === 'ship' && order.completedAt && new Date(order.completedAt) <= new Date(`${order.dueDate}T23:59:59`)).length;
  const risk = social.filter((order) => calculateRisk(order).status === 'risk').length;
  const overdue = social.filter((order) => calculateRisk(order).status === 'overdue').length;
  return { total: social.length, deliveredOnTime, risk, overdue, onTimeRate: social.length ? Math.round((deliveredOnTime / social.length) * 100) : 0 };
}

function validOrderInput(body) {
  const required = ['patientCode', 'clinic', 'dentist', 'type', 'teeth', 'shade', 'material', 'dueDate'];
  if (!body || typeof body !== 'object') return 'Некорректное тело запроса.';
  for (const field of required) if (typeof body[field] !== 'string' || !body[field].trim()) return `Поле «${field}» обязательно.`;
  if (!WORK_TYPES[body.type]) return 'Неизвестный тип работы.';
  if (body.isSocial && !SOCIAL_CATEGORIES[body.socialCategory]) return 'Выберите категорию социального заказа.';
  if (!VITA_SHADES.includes(body.shade.toUpperCase())) return 'Недопустимый оттенок VITA.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate) || Number.isNaN(new Date(`${body.dueDate}T00:00:00`).getTime())) return 'Срок сдачи должен быть датой YYYY-MM-DD.';
  if (body.patientCode.length > 40 || body.clinic.length > 100 || body.dentist.length > 100 || body.notes?.length > 1000) return 'Слишком длинное значение поля.';
  return null;
}

function templateHint(order) {
  const type = WORK_TYPES[order.type];
  const focus = order.type === 'zirconia' ? 'проверьте толщину коннектора и прозрачность режущего края' : order.type === 'veneer' ? 'сверьте линию улыбки, контактные пункты и посадку на модели' : 'сверьте посадку на модели и окклюзионные контакты';
  return `Для «${type.ru}» оттенка ${order.shade}: ${focus}. Перед контролем качества сопоставьте скан, заметки врача и оттенок. Это шаблонная памятка, не медицинская рекомендация.`;
}

async function aiHint(order) {
  const apiKey = process.env.LLM_API_KEY;
  const ollama = process.env.OLLAMA_URL;
  if (!apiKey && !ollama) return { mode: 'template', text: templateHint(order) };
  const url = ollama ? `${ollama.replace(/\/$/, '')}/api/generate` : (process.env.LLM_API_URL || 'https://api.openai.com/v1/chat/completions');
  const prompt = `You are a dental lab workflow assistant. Give a concise Russian production checklist, not medical advice. Work: ${WORK_TYPES[order.type]?.ru}; shade: ${order.shade}; material: ${order.material}; stage: ${STAGES[order.stage]?.ru}.`;
  const payload = ollama ? { model: process.env.OLLAMA_MODEL || 'llama3.2', prompt, stream: false } : { model: process.env.LLM_MODEL || 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: 180 };
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  try {
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`LLM status ${response.status}`);
    const data = await response.json();
    const text = ollama ? data.response : data.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty LLM response');
    return { mode: 'ai', text: String(text).trim() };
  } catch {
    return { mode: 'template', text: templateHint(order), fallback: true };
  }
}

function createApp({ dataFile = DATA_FILE } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    next();
  });
  app.use(express.static(path.join(ROOT, 'public'), { maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));

  app.get('/api/config', (req, res) => res.json({ stages: STAGES, workTypes: WORK_TYPES, vitaShades: VITA_SHADES, socialCategories: SOCIAL_CATEGORIES, aiAvailable: Boolean(process.env.LLM_API_KEY || process.env.OLLAMA_URL) }));
  app.get('/api/orders', (req, res) => res.json(sortOrders(readOrders(dataFile)).map(safeOrder)));
  app.post('/api/orders', (req, res) => {
    const error = validOrderInput(req.body);
    if (error) return res.status(400).json({ error });
    const orders = readOrders(dataFile);
    const order = makeOrder(req.body);
    orders.unshift(order);
    writeOrders(orders, dataFile);
    return res.status(201).json(safeOrder(order));
  });
  app.patch('/api/orders/:id', (req, res) => {
    const orders = readOrders(dataFile);
    const index = orders.findIndex((order) => order.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: 'Заказ не найден.' });
    const order = orders[index];
    if (typeof req.body.stage !== 'string' || !typeStages(order).some(([stage]) => stage === req.body.stage)) return res.status(400).json({ error: 'Недопустимый этап для этого типа работы.' });
    order.stage = req.body.stage;
    order.completedAt = req.body.stage === 'ship' ? (order.completedAt || new Date().toISOString()) : null;
    order.updatedAt = new Date().toISOString();
    writeOrders(orders, dataFile);
    return res.json(safeOrder(order));
  });
  app.get('/api/orders/:id/assistant', async (req, res) => {
    const order = readOrders(dataFile).find((candidate) => candidate.id === req.params.id);
    if (!order) return res.status(404).json({ error: 'Заказ не найден.' });
    return res.json(await aiHint(order));
  });
  app.get('/api/public/:token', (req, res) => {
    const order = readOrders(dataFile).find((candidate) => candidate.publicToken === req.params.token);
    if (!order) return res.status(404).json({ error: 'Ссылка статуса не найдена.' });
    return res.json(publicOrder(order));
  });
  app.get('/api/impact', (req, res) => res.json(calculateImpact(readOrders(dataFile))));
  app.post('/api/demo/reset', (req, res) => {
    const orders = seedOrders().map((order) => ({ ...order, isDemo: true }));
    writeOrders(orders, dataFile);
    return res.json(sortOrders(orders).map(safeOrder));
  });
  app.post('/api/import', (req, res) => {
    if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Импорт должен быть JSON-массивом заказов.' });
    const cleaned = [];
    for (const item of req.body) {
      const error = validOrderInput(item);
      if (error) return res.status(400).json({ error: `Импорт остановлен: ${error}` });
      const order = makeOrder(item);
      if (!typeStages(order).some(([stage]) => stage === order.stage)) order.stage = typeStages(order)[0][0];
      cleaned.push(order);
    }
    writeOrders(cleaned, dataFile);
    return res.json(cleaned.map(safeOrder));
  });
  app.get('/status/:token', (req, res) => res.sendFile(path.join(ROOT, 'public', 'index.html')));
  app.use((req, res) => res.status(404).json({ error: 'Маршрут не найден.' }));
  app.use((error, req, res, next) => { console.error(error.message); res.status(500).json({ error: 'Внутренняя ошибка сервера.' }); });
  return app;
}

if (require.main === module) {
  ensureStore();
  createApp().listen(PORT, () => console.log(`DentaLoop запущен: http://localhost:${PORT}`));
}

module.exports = { createApp, WORK_TYPES, STAGES, VITA_SHADES, SOCIAL_CATEGORIES, calculateRisk, calculateImpact, publicOrder, DATA_FILE, seedOrders, sortOrders };
