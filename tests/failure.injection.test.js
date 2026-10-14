'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

const INDEX_URL = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/') + '?debug=1';

test('Failure Injection 1: engine.js diblokir -> tampil pesan ramah & berhenti', async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext();
    await ctx.route('**/engine.js', route => route.abort());
    const page = await ctx.newPage();
    await page.goto(INDEX_URL);
    const bodyText = await page.textContent('body');
    assert.match(bodyText, /Berkas Tidak Ditemukan/);
    assert.match(bodyText, /engine\.js atau lib\/blockly\.min\.js tidak termuat/);
  } finally {
    await browser.close();
  }
});

test('Failure Injection 2: blockly.min.js diblokir -> tampil pesan ramah & berhenti', async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext();
    await ctx.route('**/blockly.min.js', route => route.abort());
    const page = await ctx.newPage();
    await page.goto(INDEX_URL);
    const bodyText = await page.textContent('body');
    assert.match(bodyText, /Berkas Tidak Ditemukan/);
    assert.match(bodyText, /engine\.js atau lib\/blockly\.min\.js tidak termuat/);
  } finally {
    await browser.close();
  }
});

test('Failure Injection 3: localStorage dinonaktifkan -> game tetap berfungsi normal', async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get: () => { throw new Error('SecurityError: localStorage is disabled'); }
      });
    });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(INDEX_URL);

    await page.locator('#btnRun').click();
    await page.waitForTimeout(100);
    assert.strictEqual(errs.length, 0, `Terjadi error saat localStorage dinonaktifkan: ${errs.join(', ')}`);

    await page.evaluate(() => LB.loadLevel(1));
    await page.evaluate(() => LB.loadLevel(2));
    assert.strictEqual(errs.length, 0);
  } finally {
    await browser.close();
  }
});

test('Failure Injection 4: Koneksi jaringan terputus (offline) di tengah sesi -> game 100% lokal', async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(INDEX_URL);

    await ctx.setOffline(true);

    for (let i = 0; i < 3; i++) {
      await page.evaluate(lvl => {
        LB.loadLevel(lvl);
        if (lvl === 2) document.getElementById('code').value = 'robot.forward()';
      }, i);
      await page.locator('#btnRun').click();
      await page.waitForTimeout(50);
    }

    assert.strictEqual(errs.length, 0, 'Ada request gagal saat offline');
  } finally {
    await browser.close();
  }
});

test('Failure Injection 5: Zoom 150% pada browser -> tata letak responsif tanpa overflow horizontal', async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
    const page = await ctx.newPage();
    await page.goto(INDEX_URL);

    await page.evaluate(() => {
      document.body.style.zoom = '1.5';
    });
    await page.waitForTimeout(100);

    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    assert.strictEqual(overflow, false, 'Ditemukan scroll horizontal yang merusak tampilan pada zoom 150%');
  } finally {
    await browser.close();
  }
});

test('Failure Injection 6: Input sentuh saja (touch-only) -> kontrol game merespons sentuhan', async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(INDEX_URL);

    const boxRun = await page.locator('#btnRun').boundingBox();
    assert.ok(boxRun, 'Tombol btnRun tidak ditemukan');
    await page.touchscreen.tap(boxRun.x + boxRun.width / 2, boxRun.y + boxRun.height / 2);

    await page.waitForTimeout(100);
    const statusAktif = await page.evaluate(() => LB.running || LB.hasil !== null);
    assert.strictEqual(statusAktif, true, 'btnRun tidak merespons sentuhan');
  } finally {
    await browser.close();
  }
});

test('Failure Injection 7: Navigasi papan ketik murni (keyboard-only) -> dialog & fokus bekerja', async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(INDEX_URL);

    await page.selectOption('#speed', '0');
    await page.locator('#btnRun').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(50);

    await page.keyboard.press('Escape');
    const inert = await page.evaluate(() => document.getElementById('blocklyDiv').inert);
    assert.strictEqual(inert, false, 'Workspace terkunci setelah interaksi keyboard');
  } finally {
    await browser.close();
  }
});

test('Failure Injection 8: Muat ulang halaman (refresh) di tengah eksekusi simulasi -> pulih bersih', async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(INDEX_URL);

    await page.selectOption('#speed', '380');
    await page.locator('#btnRun').click();
    await page.waitForTimeout(100);

    await page.reload();
    await page.waitForFunction('typeof LB !== "undefined"');

    const readyState = await page.evaluate(() => ({
      running: LB.running,
      codeReadOnly: document.getElementById('code').readOnly,
      blocklyInert: document.getElementById('blocklyDiv').inert
    }));

    assert.strictEqual(readyState.running, false, 'Simulator tidak boleh berjalan otomatis setelah refresh');
    assert.strictEqual(readyState.codeReadOnly, false, 'Editor terkunci setelah refresh');
    assert.strictEqual(readyState.blocklyInert, false, 'Blockly terkunci setelah refresh');
    assert.strictEqual(errs.length, 0, 'Ada error setelah refresh');
  } finally {
    await browser.close();
  }
});
