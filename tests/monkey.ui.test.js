'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium, firefox, webkit } = require('playwright');

function createRng(seed) {
  let s = seed >>> 0;
  return function() {
    let t = (s += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const INDEX_URL = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/') + '?debug=1';

async function setupPage(browser, options = {}) {
  const ctx = await browser.newContext(options);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push('[PAGEERROR] ' + (err.stack || err.message)));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push('[CONSOLE.ERROR] ' + msg.text());
  });
  await page.goto(INDEX_URL);
  await page.waitForFunction('typeof LB !== "undefined" && typeof Blockly !== "undefined"');
  return { ctx, page, errors };
}

async function runMonkeySequence(page, errors, rng, actionCount, seed) {
  // Set speed to 0 (Langsung) or 95 (4x) so actions run deterministically and fast
  await page.selectOption('#speed', rng() < 0.7 ? '0' : '95');

  for (let step = 0; step < actionCount; step++) {
    const act = Math.floor(rng() * 12);
    try {
      switch (act) {
        case 0: // Jalankan (#btnRun)
          await page.evaluate(() => document.getElementById('btnRun').click());
          break;
        case 1: // Langkah (#btnStep)
          await page.evaluate(() => document.getElementById('btnStep').click());
          break;
        case 2: // Ke akhir (#btnEnd)
          await page.evaluate(() => document.getElementById('btnEnd').click());
          break;
        case 3: // Reset (#btnReset)
          await page.evaluate(() => document.getElementById('btnReset').click());
          break;
        case 4: // Switch Level
          const lvl = Math.floor(rng() * 3);
          await page.evaluate(i => LB.loadLevel(i), lvl);
          break;
        case 5: // Ubah Kecepatan
          const spds = ['380', '190', '95', '0'];
          const spd = spds[Math.floor(rng() * spds.length)];
          await page.selectOption('#speed', spd);
          break;
        case 6: // Hint (#btnHint)
          await page.evaluate(() => {
            const b = document.getElementById('btnHint');
            if (b && !b.disabled) b.click();
          });
          break;
        case 7: // Manipulasi Blok Blockly
          await page.evaluate(r => {
            if (LB.lvl !== 2 && LB.ws) {
              const types = ['lb_fwd', 'lb_left', 'lb_right', 'lb_take'];
              const t = types[Math.floor(r * types.length)];
              const b = LB.ws.newBlock(t);
              b.initSvg();
              b.render();
              if (r < 0.3) {
                // Hapus blok acak
                const all = LB.ws.getAllBlocks(false);
                if (all.length > 2) all[all.length - 1].dispose();
              }
            }
          }, rng());
          break;
        case 8: // Edit Kode di Level 3 (#code)
          await page.evaluate(r => {
            LB.loadLevel(2);
            const el = document.getElementById('code');
            const snippets = [
              'robot.forward()\nrobot.turn_left()',
              'for i in range(3):\n    robot.forward()',
              'while not robot.at_goal():\n    robot.forward()',
              '# komentar baru\nrobot.forward()',
              ''
            ];
            el.value = snippets[Math.floor(r * snippets.length)];
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }, rng());
          break;
        case 9: // Rapid Double Clicks
          await page.evaluate(() => {
            const b = document.getElementById('btnRun');
            b.click();
            b.click();
          });
          break;
        case 10: // Esc pada overlay / keyboard
          await page.keyboard.press('Escape');
          break;
        case 11: // Coba Lagi / Lanjut pada overlay jika muncul
          await page.evaluate(() => {
            const ov = document.getElementById('overlay');
            if (ov && ov.style.display === 'flex') {
              document.getElementById('ovRetry').click();
            }
          });
          break;
      }
    } catch (e) {
      assert.fail(`Aksi ${act} gagal dieksekusi pada step ${step}, SEED=${seed}: ${e.message}`);
    }

    // Tunggu sejenak jika animasi mikro berjalan
    await page.waitForTimeout(5);

    // Assert: Tidak ada pageerror atau console error
    assert.strictEqual(errors.length, 0,
      `Error terdeteksi pada step ${step}, aksi ${act}, SEED=${seed}:\n${errors.join('\n')}`);

    // Assert: State UI konsisten saat simulator tidak aktif
    const uiState = await page.evaluate(() => {
      const isRunning = LB.running;
      const inert = document.getElementById('blocklyDiv').inert;
      const codeReadOnly = document.getElementById('code').readOnly;
      const runDisabled = document.getElementById('btnRun').disabled;
      return { isRunning, inert, codeReadOnly, runDisabled };
    });

    if (!uiState.isRunning) {
      assert.strictEqual(uiState.inert, false, `BlocklyDiv terkunci (inert) padahal simulator tidak berjalan di step ${step}, SEED=${seed}`);
      assert.strictEqual(uiState.codeReadOnly, false, `Editor kode readOnly padahal simulator tidak berjalan di step ${step}, SEED=${seed}`);
      assert.strictEqual(uiState.runDisabled, false, `Tombol btnRun terkunci disabled di step ${step}, SEED=${seed}`);
    }
  }
}

// 20 Runs x 300 actions
test('Monkey UI: 20 sesi random (300 aksi per sesi) di Chromium', async () => {
  const browser = await chromium.launch();
  try {
    for (let run = 0; run < 20; run++) {
      const seed = 20261014 + (run * 313);
      const rng = createRng(seed);
      const { ctx, page, errors } = await setupPage(browser);
      try {
        await runMonkeySequence(page, errors, rng, 300, seed);
      } finally {
        await page.close();
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
});

test('Monkey UI: Firefox (300 aksi)', async () => {
  const browser = await firefox.launch();
  try {
    const seed = 771122;
    const rng = createRng(seed);
    const { ctx, page, errors } = await setupPage(browser);
    try {
      await runMonkeySequence(page, errors, rng, 300, seed);
    } finally {
      await page.close();
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
});

test('Monkey UI: WebKit (300 aksi)', async () => {
  const browser = await webkit.launch();
  try {
    const seed = 883344;
    const rng = createRng(seed);
    const { ctx, page, errors } = await setupPage(browser);
    try {
      await runMonkeySequence(page, errors, rng, 300, seed);
    } finally {
      await page.close();
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
});

test('Monkey UI: Chromium dengan 4x dan 6x CPU Throttling pada viewport 1024x768', async () => {
  const browser = await chromium.launch();
  try {
    for (const rate of [4, 6]) {
      const seed = 995511 + rate;
      const rng = createRng(seed);
      const { ctx, page, errors } = await setupPage(browser, {
        viewport: { width: 1024, height: 768 }
      });
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      try {
        await runMonkeySequence(page, errors, rng, 150, seed);
      } finally {
        await cdp.detach();
        await page.close();
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
});

test('Soak Test: 500 attempt eksekusi berkelanjutan dalam 1 tab & pelaporan memori', async () => {
  const browser = await chromium.launch();
  try {
    const { ctx, page, errors } = await setupPage(browser);
    try {
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Performance.enable');

      const getHeap = async () => {
        const metrics = await cdp.send('Performance.getMetrics');
        const m = metrics.metrics.find(x => x.name === 'JSHeapUsedSize');
        return m ? Math.round(m.value / 1024 / 1024 * 100) / 100 : 0;
      };

      const heapAwal = await getHeap();
      await page.selectOption('#speed', '0');

      for (let i = 0; i < 500; i++) {
        const lvl = i % 3;
        await page.evaluate(l => {
          LB.loadLevel(l);
          if (l === 2) {
            document.getElementById('code').value = 'robot.forward()\nrobot.turn_left()';
          }
          document.getElementById('btnRun').click();
        }, lvl);

        assert.strictEqual(errors.length, 0, `Error pada iterasi soak ke-${i}: ${errors.join('; ')}`);
      }

      const heapAkhir = await getHeap();
      const pertumbuhan = Math.round((heapAkhir - heapAwal) * 100) / 100;

      console.log(`[SOAK REPORT] 500 Attempts Selesai — Heap Awal: ${heapAwal} MB, Heap Akhir: ${heapAkhir} MB (Pertumbuhan: ${pertumbuhan} MB)`);
      // Memori tidak boleh bocor secara ekstrem (kurang dari 35 MB setelah 500 run)
      assert.ok(pertumbuhan < 35, `Kebocoran memori berlebih: ${pertumbuhan} MB`);
      await cdp.detach();
    } finally {
      await page.close();
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
});
