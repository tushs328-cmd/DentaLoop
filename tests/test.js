const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createApp, WORK_TYPES, VITA_SHADES, SOCIAL_CATEGORIES, calculateRisk, calculateImpact, publicOrder, seedOrders, sortOrders } = require('../server');

function request(server, path, options = {}) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.request({ hostname:'127.0.0.1', port:address.port, path, method:options.method || 'GET', headers:{ 'Content-Type':'application/json', ...(options.headers || {}) } }, (res) => { let data=''; res.on('data', (chunk) => data += chunk); res.on('end', () => resolve({ status:res.statusCode, body:data ? JSON.parse(data) : null, headers:res.headers })); });
    req.on('error', reject); if (options.body) req.write(JSON.stringify(options.body)); req.end();
  });
}

let server;
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dentaloop-tests-'));
const testFile = path.join(testDir, 'orders.json');
const workingDataFile = path.join(__dirname, '..', 'data', 'orders.json');
const workingDataBefore = fs.existsSync(workingDataFile) ? fs.readFileSync(workingDataFile, 'utf8') : null;
test.before(async () => { server = createApp({ dataFile:testFile }).listen(0); await new Promise((resolve) => server.once('listening', resolve)); });
test.after(() => { server.close(); fs.rmSync(testDir, { recursive:true, force:true }); });

test('risk calculation covers on-time, risk and overdue', () => {
  const base = { type:'temporary', stage:'intake', dueDate:'2099-01-01' };
  assert.equal(calculateRisk(base, new Date('2026-01-01T00:00:00Z')).status, 'on-time');
  assert.equal(calculateRisk({ ...base, dueDate:'2026-01-03' }, new Date('2026-01-01T00:00:00Z')).status, 'risk');
  assert.equal(calculateRisk({ ...base, dueDate:'2025-12-31' }, new Date('2026-01-01T00:00:00Z')).status, 'overdue');
});

test('all six work types have stage templates', () => { assert.ok(Object.keys(WORK_TYPES).length >= 6); for (const type of Object.values(WORK_TYPES)) assert.ok(type.stages.length >= 4); });

test('create order returns checklist-compatible order and export-shaped data', async () => { const payload = { patientCode:'TEST-1', clinic:'Clinic', dentist:'Dr Test', type:'veneer', teeth:'1.1', shade:'A1', material:'Lithium disilicate', dueDate:'2099-05-01', notes:'Note' }; const created = await request(server, '/api/orders', { method:'POST', body:payload }); assert.equal(created.status, 201); assert.equal(created.body.stage, 'intake'); assert.equal(created.body.risk.status, 'on-time'); assert.equal(typeof created.body.publicToken, 'string'); });

test('invalid VITA shade is rejected', async () => { const response = await request(server, '/api/orders', { method:'POST', body:{ patientCode:'BAD', clinic:'C', dentist:'D', type:'veneer', teeth:'1.1', shade:'Z9', material:'M', dueDate:'2099-05-01' } }); assert.equal(response.status, 400); });

test('public page payload excludes clinic, dentist, notes and material', async () => { const order = seedOrders()[0]; const safe = publicOrder(order); assert.deepEqual(Object.keys(safe).sort(), ['dueDate','expectedDate','patientCode','risk','stage','stageLabel','type','typeLabel']); assert.equal(safe.patientCode, order.patientCode); });

test('public API returns only safe status fields', async () => { const list = await request(server, '/api/orders'); const response = await request(server, `/api/public/${list.body[0].publicToken}`); assert.equal(response.status, 200); assert.equal(response.body.clinic, undefined); assert.equal(response.body.dentist, undefined); });

test('config includes matching stage labels and VITA shades', async () => { const config = await request(server, '/api/config'); assert.ok(config.body.vitaShades.includes('A1')); assert.deepEqual(Object.keys(config.body.stages).length, 7); assert.ok(VITA_SHADES.includes('D4')); });

test('social orders are prioritized when due dates are equal', () => { const normal = { id:'normal', dueDate:'2026-04-10', isSocial:false, createdAt:'2026-01-01' }; const social = { id:'social', dueDate:'2026-04-10', isSocial:true, createdAt:'2026-01-02' }; assert.equal(sortOrders([normal, social])[0].id, 'social'); });

test('social orders use a stricter risk threshold', () => { const base = { type:'temporary', stage:'qc', dueDate:'2026-01-03' }; assert.equal(calculateRisk({ ...base, isSocial:false }, new Date('2026-01-01T00:00:00Z')).status, 'on-time'); assert.equal(calculateRisk({ ...base, isSocial:true }, new Date('2026-01-01T00:00:00Z')).status, 'risk'); });

test('impact panel is calculated from stored social orders only', () => { const orders = [{ isSocial:false, stage:'ship', completedAt:'2026-01-01T00:00:00Z', dueDate:'2026-01-01' }, { isSocial:true, stage:'ship', completedAt:'2026-01-01T00:00:00Z', dueDate:'2999-01-02', type:'temporary' }, { isSocial:true, stage:'intake', dueDate:'2025-12-01', type:'temporary' }]; const impact = calculateImpact(orders); assert.deepEqual(impact, { total:2, deliveredOnTime:1, risk:0, overdue:1, onTimeRate:50 }); });

test('social category is validated and never exposed publicly', async () => { assert.ok(SOCIAL_CATEGORIES.elderly); const payload = { patientCode:'SOCIAL-1', clinic:'Clinic', dentist:'Dr Test', type:'temporary', teeth:'1.1', shade:'A1', material:'PMMA', dueDate:'2099-05-01', isSocial:true, socialCategory:'elderly' }; const created = await request(server, '/api/orders', { method:'POST', body:payload }); const publicResponse = await request(server, `/api/public/${created.body.publicToken}`); assert.equal(publicResponse.body.socialCategory, undefined); assert.equal(publicResponse.body.clinic, undefined); });

test('tests use a temporary store and leave the project data file untouched', () => { const workingDataAfter = fs.existsSync(workingDataFile) ? fs.readFileSync(workingDataFile, 'utf8') : null; assert.equal(workingDataAfter, workingDataBefore); });
