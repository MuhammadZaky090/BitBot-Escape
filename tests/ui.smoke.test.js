/* =====================================================================
   Tes UI smoke — Edisi Tanpa Aset — tests/ui.smoke.test.js
   Memerlukan Playwright (dependensi DEV opsional; game tetap tanpa
   dependensi runtime). Kalau Playwright tidak terpasang, SELURUH tes di
   file ini di-skip supaya `node --test` tetap hijau di mesin mana pun.

   Pasang sekali:  npm i -D playwright  &&  npx playwright install chromium
   Jalankan:       node --test            (atau: node --test tests/ui.smoke.test.js)

   Halaman dibuka dengan "?debug" — hanya di mode itu window.LB tersedia.
   ===================================================================== */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

let chromium = null;
try { chromium = require('playwright').chromium; } catch (e) { /* opsional */ }
const SKIP = chromium ? false
  : "Playwright tidak terpasang — jalankan: npm i -D playwright && npx playwright install chromium";

const HALAMAN = "file:///" + path.resolve(__dirname, "..", "index.html").replace(/\\/g, "/") + "?debug";
// Satu-satunya file yang boleh dimuat halaman ini.
const FILE_BAKU = ["index.html", "engine.js", "lib/blockly.min.js"];

/* Buka halaman, kumpulkan galat konsol + SEMUA permintaan (luar file:// dan file lokal). */
async function buka(browser, viewport) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const galat = [], eksternal = [], lokal = [];
  page.on("console", m => { if (m.type() === "error") galat.push(m.text()); });
  page.on("pageerror", e => galat.push("pageerror: " + e.message));
  ctx.on("request", r => {
    const u = r.url();
    if (!u.startsWith("file://")) { eksternal.push(u); return; }
    const baseDir = path.resolve(__dirname, "..").replace(/\\/g, "/");
    let relatif = decodeURIComponent(u.replace(/^file:\/\/\/?/i, "")).replace(/\\/g, "/");
    const baseClean = baseDir.replace(/^[a-zA-Z]:\/?/, "");
    if (relatif.toLowerCase().includes(baseClean.toLowerCase())) {
      relatif = relatif.slice(relatif.toLowerCase().indexOf(baseClean.toLowerCase()) + baseClean.length).replace(/^\/+/, "");
    }
    lokal.push(relatif.replace(/\?.*$/, ""));
  });
  page.on("requestfailed", r => { if (!r.url().startsWith("file://")) eksternal.push(r.url()); });
  await page.goto(HALAMAN);
  await page.waitForFunction("window.LB && window.LB.ws");
  return { ctx, page, galat, eksternal, lokal };
}
const Tutup = async ctx => { await ctx.close(); };

test("halaman & satu kali jalan: nol galat konsol, nol permintaan eksternal", { skip: SKIP }, async () => {
  const browser = await chromium.launch();
  const { ctx, page, galat, eksternal } = await buka(browser);
  try {
    await page.evaluate(() => LB.loadLevel(2));                    // mode kode
    await page.locator("#speed").selectOption("0");                // langsung
    await page.evaluate(() => { document.getElementById("code").value = LB.LEVELS[2].solusiReferensi; });
    await page.locator("#btnRun").click();
    await page.waitForFunction("document.getElementById('overlay').style.display === 'flex'");
    assert.deepStrictEqual(galat, [], "galat konsol: " + galat.join(" | "));
    assert.deepStrictEqual(eksternal, [], "permintaan keluar: " + eksternal.join(" | "));
  } finally { await Tutup(ctx); await browser.close(); }
});

test("hanya 3 file yang dimuat: tidak ada permintaan sprite, kursor, atau audio", { skip: SKIP }, async () => {
  const browser = await chromium.launch();
  const { ctx, page, lokal } = await buka(browser);
  try {
    // Interaksi yang biasanya memicu permintaan aset: kategori toolbox, drag blok, jalan, menang.
    await page.evaluate(() => {
      LB.loadLevel(1);
      LB.ws.clear();
      Blockly.serialization.blocks.append({
        type: "lb_repeat",
        inputs: { TIMES: { shadow: { type: "math_number", fields: { NUM: 6 } } }, DO: { block: { type: "lb_fwd" } } }
      }, LB.ws);
    });
    await page.locator(".blocklyTreeRow").filter({ hasText: "Perulangan" }).click();
    await page.locator("#btnRun").click();
    await page.waitForFunction("document.getElementById('overlay').style.display === 'flex'");
    const takDikenal = [...new Set(lokal)].filter(f => !FILE_BAKU.includes(f)).sort();
    assert.deepStrictEqual(takDikenal, [], "permintaan file di luar 3 file: " + takDikenal.join(" | "));
  } finally { await Tutup(ctx); await browser.close(); }
});

test("blok 'ulangi' selalu membawa angka, termasuk saat lahir dari flyout", { skip: SKIP }, async () => {
  const browser = await chromium.launch();
  const { ctx, page } = await buka(browser);
  try {
    await page.evaluate(() => LB.loadLevel(1));
    // 1) Spesifikasi toolbox: entri flyout sudah memakai shadow math_number.
    const shadow = await page.evaluate(() =>
      LB.toolboxDari(LB.LEVELS[1]).find(c => c.name === "Perulangan")
        .contents[0].inputs.TIMES.shadow.fields.NUM);
    assert.ok(shadow >= 1, "shadow toolbox kosong");
    // 2) Klik kategori lalu bloknya di flyout -> blok di workspace harus punya angka.
    await page.locator(".blocklyTreeRow").filter({ hasText: "Perulangan" }).click();
    await page.waitForSelector("#blocklyDiv .blocklyFlyout .blocklyDraggable");
    await page.locator("#blocklyDiv .blocklyFlyout .blocklyDraggable").first().click();
    const flyout = await page.evaluate(() => {
      const b = LB.ws.getTopBlocks(false).find(x => x.type === "lb_repeat");
      const n = b && b.getInputTargetBlock("TIMES");
      return { ada: !!n, nilai: n && +n.getFieldValue("NUM"), kode: b ? LB.blocksToPython(LB.ws).code : "" };
    });
    assert.ok(flyout.ada, "blok hasil flyout tidak punya blok angka");
    assert.ok(flyout.nilai >= 1, "angka flyout tidak sah: " + flyout.nilai);
    assert.match(flyout.kode, /for i in range\(\d+\):/);
    // 3) Jaring pengaman: blok tanpa shadow (jalur pembuatan lain) ikut diisi.
    await page.evaluate(() => {
      LB.ws.clear();
      Blockly.serialization.blocks.append({ type: "lb_repeat" }, LB.ws);
    });
    await page.waitForTimeout(100);
    const cadangan = await page.evaluate(() => {
      const b = LB.ws.getTopBlocks(false)[0];
      return +b.getInputTargetBlock("TIMES").getFieldValue("NUM");
    });
    assert.ok(cadangan >= 1, "jaring pengaman fixRepeatSlot tidak jalan");
  } finally { await Tutup(ctx); await browser.close(); }
});

test("Level 2 dengan blok: lolos, biaya 2, ★3 menyala di HUD", { skip: SKIP }, async () => {
  const browser = await chromium.launch();
  const { ctx, page } = await buka(browser);
  try {
    await page.evaluate(() => {
      LB.loadLevel(1); LB.ws.clear();
      Blockly.serialization.blocks.append({
        type: "lb_repeat",
        inputs: { TIMES: { shadow: { type: "math_number", fields: { NUM: 6 } } },
                  DO: { block: { type: "lb_fwd" } } }
      }, LB.ws);
    });
    await page.locator("#speed").selectOption("0");
    await page.locator("#btnRun").click();
    const r = await page.evaluate(() => ({
      ok: LB.hasil.ok, cost: LB.hasil.cost, stars: LB.hasil.stars,
      judul: document.getElementById("ovTitle").textContent,
      menyala: ["s1", "s2", "s3"].filter(id => document.getElementById(id).classList.contains("on")).length
    }));
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.cost, 2);
    assert.strictEqual(r.stars, 3);
    assert.match(r.judul, /★3/);
    assert.strictEqual(r.menyala, 3, "bintang HUD tidak menyala sesuai hasil");
  } finally { await Tutup(ctx); await browser.close(); }
});

test("Level 3 dengan kode: dua peta uji (satu tersembunyi) keduanya lolos", { skip: SKIP }, async () => {
  const browser = await chromium.launch();
  const { ctx, page } = await buka(browser);
  try {
    await page.evaluate(() => {
      LB.loadLevel(2);
      document.getElementById("code").value = LB.LEVELS[2].solusiReferensi;
    });
    await page.locator("#speed").selectOption("0");
    await page.locator("#btnRun").click();
    const r = await page.evaluate(() => ({
      jumlah: LB.hasil.hasil.length, semuaOk: LB.hasil.hasil.every(x => x.ok), stars: LB.hasil.stars
    }));
    assert.strictEqual(r.jumlah, 2, "L3 harus diuji pada 2 peta");
    assert.strictEqual(r.semuaOk, true);
    assert.strictEqual(r.stars, 3);
  } finally { await Tutup(ctx); await browser.close(); }
});

test("dua tumpukan blok ditolak dan blok yatim disorot", { skip: SKIP }, async () => {
  const browser = await chromium.launch();
  const { ctx, page } = await buka(browser);
  try {
    await page.evaluate(() => {
      LB.loadLevel(0); LB.ws.clear();
      Blockly.serialization.blocks.append({ type: "lb_fwd", x: 40, y: 40 }, LB.ws);
      Blockly.serialization.blocks.append({ type: "lb_left", x: 40, y: 260 }, LB.ws);
    });
    const r = await page.evaluate(() => ({
      lanjut: LB.prepare(), pesan: document.getElementById("msg").textContent,
      yatim: document.querySelectorAll(".lb-orphan").length
    }));
    assert.strictEqual(r.lanjut, false, "program dengan 2 tumpukan tidak boleh jalan");
    assert.match(r.pesan, /2 tumpukan blok terpisah/);
    assert.strictEqual(r.yatim, 1, "harus ada tepat satu blok yatim yang disorot");
  } finally { await Tutup(ctx); await browser.close(); }
});

test("nama fungsi ternormalisasi dan kode hasil generator selalu lolos parser", { skip: SKIP }, async () => {
  const browser = await chromium.launch();
  const { ctx, page } = await buka(browser);
  try {
    const r = await page.evaluate(() => {
      LB.loadLevel(0); LB.ws.clear();
      const def = Blockly.serialization.blocks.append({ type: "lb_def", fields: { NAME: "Maju Dua" },
        inputs: { STACK: { block: { type: "lb_fwd" } } } }, LB.ws);
      Blockly.serialization.blocks.append({ type: "lb_call", fields: { NAME: "Maju Dua" } }, LB.ws);
      const kode = LB.blocksToPython(LB.ws).code;
      let galat = null;
      try { LB.engine.compilePython(kode); } catch (e) { galat = e.pesan; }
      return { field: def.getFieldValue("NAME"), kode, galat,
               sah: ["Maju Dua", "  maju-dua  ", "2lari", "!!", "A B"].map(s => LB.namaFungsi(s)) };
    });
    assert.deepStrictEqual(r.sah, ["maju_dua", "maju_dua", null, null, "a_b"]);
    assert.match(r.kode, /def maju_dua\(\):/);
    assert.match(r.kode, /^maju_dua\(\)$/m);
    assert.strictEqual(r.galat, null, "kode blok tidak lolos parser: " + r.galat);
    assert.strictEqual(r.field, "maju_dua", "validator field NAME tidak berjalan");
  } finally { await Tutup(ctx); await browser.close(); }
});

test("komentar inline diterima lewat editor kode", { skip: SKIP }, async () => {
  const browser = await chromium.launch();
  const { ctx, page } = await buka(browser);
  try {
    await page.evaluate(() => {
      LB.loadLevel(2);
      document.getElementById("code").value = [
        "for i in range(6):   # ulangi 6 langkah",
        "    robot.forward()  # maju satu petak",
        "    if robot.item_ahead():  # ada barang?",
        "        robot.take()"
      ].join("\n");
    });
    const r = await page.evaluate(() => ({ lanjut: LB.prepare(), biaya: LB.biayaSaatIni(),
      pesan: document.getElementById("msg").textContent, stars: LB.hasil && LB.hasil.stars }));
    assert.strictEqual(r.lanjut, true, "komentar inline ditolak: " + r.pesan);
    assert.strictEqual(r.biaya, 4, "komentar tidak boleh dihitung sebagai pernyataan");
    assert.strictEqual(r.stars, 3);
  } finally { await Tutup(ctx); await browser.close(); }
});

test("viewport 390x844: tanpa scroll horizontal dan Blockly tetap terpakai", { skip: SKIP }, async () => {
  const browser = await chromium.launch();
  const { ctx, page } = await buka(browser, { width: 390, height: 844 });
  try {
    for (const i of [0, 1, 2]) {
      await page.evaluate(idx => LB.loadLevel(idx), i);
      const u = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth, bw: document.body.scrollWidth, iw: window.innerWidth,
        board: document.getElementById("board").getBoundingClientRect().width,
        div: document.getElementById("blocklyDiv").getBoundingClientRect().width
      }));
      assert.ok(u.sw <= u.iw, "L" + (i + 1) + " scrollWidth " + u.sw + " > innerWidth " + u.iw);
      assert.ok(u.bw <= u.iw, "L" + (i + 1) + " body scrollWidth " + u.bw + " > innerWidth " + u.iw);
      assert.ok(u.board <= u.iw, "L" + (i + 1) + " board melebar: " + u.board);
      if (i !== 2) assert.ok(u.div > 0 && u.div <= u.iw, "L" + (i + 1) + " workspace Blockly melebar: " + u.div);
    }
    const jalan = await page.evaluate(() => {
      LB.loadLevel(1); LB.ws.clear();
      Blockly.serialization.blocks.append({
        type: "lb_repeat",
        inputs: { TIMES: { shadow: { type: "math_number", fields: { NUM: 6 } } }, DO: { block: { type: "lb_fwd" } } }
      }, LB.ws);
      return LB.prepare();
    });
    assert.strictEqual(jalan, true, "blok tidak bisa dipakai di layar sempit");
  } finally { await Tutup(ctx); await browser.close(); }
});

test("kontrol kecepatan: 'Ke akhir' menuntaskan trace dan editing terkunci saat berjalan", { skip: SKIP }, async () => {
  const browser = await chromium.launch();
  const { ctx, page } = await buka(browser);
  try {
    await page.evaluate(() => { LB.loadLevel(1); LB.ws.clear();
      Blockly.serialization.blocks.append({
        type: "lb_repeat",
        inputs: { TIMES: { shadow: { type: "math_number", fields: { NUM: 6 } } }, DO: { block: { type: "lb_fwd" } } }
      }, LB.ws); });
    await page.locator("#speed").selectOption("380");               // 1x: animasi panjang
    await page.locator("#btnRun").click();
    const tengah = await page.evaluate(() => ({ inert: document.getElementById("blocklyDiv").inert,
      readonly: document.getElementById("code").readOnly, kecepatan: LB.kecepatan }));
    assert.strictEqual(tengah.inert, true, "Blockly tidak dikunci saat berjalan");
    assert.strictEqual(tengah.readonly, true, "editor kode tidak dikunci saat berjalan");
    assert.strictEqual(tengah.kecepatan, 380);
    await page.locator("#btnEnd").click();
    const akhir = await page.evaluate(() => ({ overlay: document.getElementById("overlay").style.display,
      inert: document.getElementById("blocklyDiv").inert }));
    assert.strictEqual(akhir.overlay, "flex", "tombol Ke akhir tidak menuntaskan program");
    assert.strictEqual(akhir.inert, false, "editing tidak dibuka lagi setelah berhenti");
  } finally { await Tutup(ctx); await browser.close(); }
});

test("aksesibilitas: aria-label peta, dialog hasil, dan fokus kembali", { skip: SKIP }, async () => {
  const browser = await chromium.launch();
  const { ctx, page } = await buka(browser);
  try {
    await page.evaluate(() => { LB.loadLevel(2); document.getElementById("code").value = LB.LEVELS[2].solusiReferensi; });
    await page.locator("#speed").selectOption("0");
    const awal = await page.getAttribute("#board", "aria-label");
    assert.match(awal, /Robot di kolom/);
    await page.locator("#btnRun").click();
    const r = await page.evaluate(() => ({ label: document.getElementById("board").getAttribute("aria-label"),
      role: document.getElementById("overlay").getAttribute("role"),
      modal: document.getElementById("overlay").getAttribute("aria-modal"),
      fokus: document.activeElement.id }));
    assert.match(r.label, /Item tersisa 0/, "aria-label peta tidak diperbarui tiap langkah");
    assert.strictEqual(r.role, "dialog");
    assert.strictEqual(r.modal, "true");
    assert.strictEqual(r.fokus, "ovRetry", "fokus tidak pindah ke dialog hasil");
    await page.keyboard.press("Escape");
    const sesudah = await page.evaluate(() => ({ tampil: document.getElementById("overlay").style.display,
      fokus: document.activeElement.id }));
    assert.strictEqual(sesudah.tampil, "none", "Escape tidak menutup dialog");
    assert.strictEqual(sesudah.fokus, "btnRun", "fokus tidak kembali ke tombol Jalankan");
  } finally { await Tutup(ctx); await browser.close(); }
});

test("board vektor: setiap petak terisi warna (bukti: tidak ada piksel transparan)", { skip: SKIP }, async () => {
  const browser = await chromium.launch();
  const { ctx, page } = await buka(browser);
  try {
    for (const i of [0, 1, 2]) {
      const r = await page.evaluate(idx => {
        LB.loadLevel(idx);
        const cv = document.getElementById("board"), g = cv.getContext("2d");
        const d = g.getImageData(0, 0, cv.width, cv.height).data;
        let transparan = 0, warnaBerbeda = new Set();
        for (let p = 3; p < d.length; p += 4) { if (d[p] === 0) transparan++; }
        for (let p = 0; p < d.length; p += 4 * 97) warnaBerbeda.add(d[p] + "," + d[p + 1] + "," + d[p + 2]);
        return { w: cv.width, h: cv.height, transparan, ragam: warnaBerbeda.size };
      }, i);
      assert.strictEqual(r.transparan, 0, "L" + (i + 1) + ": ada piksel transparan di board");
      assert.ok(r.ragam >= 4, "L" + (i + 1) + ": board hanya " + r.ragam + " warna — petak tidak tergambar");
    }
  } finally { await Tutup(ctx); await browser.close(); }
});
