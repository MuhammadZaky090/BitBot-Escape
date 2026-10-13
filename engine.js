/* =====================================================================
   LogikaBlok — ENGINE MURNI (demo/engine.js)
   Kompilasi subset Python -> AST, interpretasi -> trace, biaya, bintang,
   evaluasi level (termasuk varian peta tersembunyi).
   Aturan keras: TIDAK menyentuh DOM/Blockly/window. Kode pemain tidak pernah
   di-eval — yang dijalankan adalah AST hasil parser sendiri.
   Dimuat browser lewat <script src="engine.js"></script>, Node lewat require().
   ===================================================================== */
'use strict';

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // 0=utara 1=timur 2=selatan 3=barat
const STEP_CAP = 3000; // batas langkah per varian -> penanda loop tak berujung

// Jenis error terstandar (dikembalikan engine, dipakai analitik guru nanti)
const ERR = {
  SINTAKS: "sintaks",
  TABRAK_DINDING: "tabrak_dinding",
  TIDAK_ADA_ITEM: "tidak_ada_item",
  LOOP_TAK_BERUNJUNG: "loop_tak_berujung",
  TIDAK_SAMPAI: "tidak_sampai",
  ITEM_TERSISA: "item_tersisa",
  MELEBIHI_KUOTA: "melebihi_kuota"
};

const PERINTAH = {
  "robot.forward()": "fwd",
  "robot.turn_left()": "left",
  "robot.turn_right()": "right",
  "robot.take()": "take"
};
const SENSOR = /^(at_goal|wall_ahead|wall_left|wall_right|item_ahead)$/;
const MAKS_FUNGSI = 3;

/* Tema Blockly: hex literal yang SAMA dengan token CSS di index.html (dijaga tes kontras).
   Ditaruh di engine supaya Node bisa menghitung rasio kontrasnya tanpa browser. */
const TEMA = {
  workspaceBg: "#10141f", toolboxBg: "#151a26", toolboxFg: "#e8ecf4",
  flyoutBg: "#222a3d", scrollbar: "#4a5268", marker: "#ffd166", cursor: "#ffd166",
  catRobot: "#3aa79d", catLoop: "#e0a23c", catLogic: "#93c447", catMath: "#7a7ff2"
};

// Buat error sintaks berisi jenis, nomor baris, dan pesan.
function errSintaks(line, pesan) {
  const e = new Error(pesan);
  e.jenis = ERR.SINTAKS; e.line = line; e.pesan = pesan;
  return e;
}

// "robot.wall_ahead()" / "not robot.at_goal()" -> {cond, not}; null kalau bukan kondisi sah
function parseCond(text) {
  const m = /^(not\s+)?robot\.([a-z_]+)\(\)$/.exec(text.trim());
  if (!m || !SENSOR.test(m[2])) return null;
  return { cond: m[2], not: !!m[1] };
}

// Pesan error untuk kondisi yang tidak dikenal.
function pesanKondisi(teks) {
  return "Kondisi '" + teks + "' tidak dikenal — pakai robot.wall_ahead(), robot.wall_left(), " +
         "robot.wall_right(), robot.item_ahead(), robot.at_goal() (boleh diawali 'not ')";
}

/* ==================== PARSER: teks Python -> AST ==================== */
// Subset tidak punya string, jadi '#' selalu memulai komentar: buang sebelum parsing.
function compilePython(code) {
  const baris = code.split("\n").map((ln, i) => {
    const bersih = ln.replace(/\t/g, "    ").replace(/#.*$/, "");
    return { n: i + 1, indent: bersih.match(/^ */)[0].length, text: bersih.trim() };
  }).filter(o => o.text.length);

  const defs = {};   // nama -> node def
  const panggilan = [];
  let pos = 0;

  // Ubah baris-baris satu level indentasi menjadi daftar node AST.
  function parseBlock(indent) {
    const out = [];
    while (pos < baris.length && baris[pos].indent >= indent) {
      const line = baris[pos];
      if (line.indent > indent) {
        if (line.indent % 4 !== 0)
          throw errSintaks(line.n, "Indentasi harus kelipatan 4 spasi — baris ini memakai " + line.indent + " spasi di depan");
        throw errSintaks(line.n, "Indentasi terlalu dalam — baris ini seharusnya sejajar (" + indent + " spasi di depan)");
      }
      pos++;
      const t = line.text;
      let m;
      if (PERINTAH[t]) out.push({ k: PERINTAH[t], line: line.n });
      else if ((m = /^for\s+([a-z_][a-z0-9_]*)\s+in\s+range\(\s*(\d+)\s*\)\s*:$/.exec(t)))
        out.push({ k: "loop", n: +m[2], body: parseChild(line), line: line.n });
      else if ((m = /^if\s+(.*?)\s*:$/.exec(t))) {
        const c = parseCond(m[1]);
        if (!c) throw errSintaks(line.n, pesanKondisi(m[1]));
        const node = { k: "if", cond: c.cond, not: c.not, body: parseChild(line), line: line.n };
        if (pos < baris.length && baris[pos].text === "else:" && baris[pos].indent === line.indent) {
          const el = baris[pos]; pos++;
          node.elseBody = parseChild(el);
        }
        out.push(node);
      }
      else if ((m = /^while\s+(.*?)\s*:$/.exec(t))) {
        const c = parseCond(m[1]);
        if (!c) throw errSintaks(line.n, pesanKondisi(m[1]));
        out.push({ k: "while", cond: c.cond, not: c.not, body: parseChild(line), line: line.n });
      }
      else if ((m = /^def\s+([a-z_][a-z0-9_]*)\s*\(\s*\)\s*:$/.exec(t))) {
        if (indent !== 0) throw errSintaks(line.n, "'def' harus ditulis di luar blok (tidak menjorok)");
        const nama = m[1];
        if (defs[nama]) throw errSintaks(line.n, "Fungsi '" + nama + "' sudah dibuat di baris " + defs[nama].line);
        if (Object.keys(defs).length >= MAKS_FUNGSI) throw errSintaks(line.n, "Maksimal " + MAKS_FUNGSI + " fungsi dalam satu program");
        const node = { k: "def", nama: nama, body: parseChild(line), line: line.n };
        defs[nama] = node;
        out.push(node);
      }
      else if ((m = /^([a-z_][a-z0-9_]*)\s*\(\s*\)$/.exec(t))) {
        const node = { k: "call", nama: m[1], line: line.n };
        panggilan.push(node); out.push(node);
      }
      else if (t === "else:") throw errSintaks(line.n, "'else:' hanya boleh dipakai setelah 'if'");
      else throw errSintaks(line.n, pesanBarisTakDikenal(t));
    }
    return out;
  }

  // Parse isi blok anak dari baris induk (tidak boleh kosong).
  function parseChild(parent) {
    if (pos >= baris.length || baris[pos].indent <= parent.indent)
      throw errSintaks(parent.n, "Blok '" + parent.text.split(":")[0] + ":' kosong, isi perintahnya dulu!");
    return parseBlock(baris[pos].indent);
  }

  const ast = parseBlock(0);
  if (pos < baris.length)
    throw errSintaks(baris[pos].n, "Indentasi baris ini tidak sejajar dengan blok di atasnya — periksa jumlah spasi di depannya");

  panggilan.forEach(c => {
    if (!defs[c.nama]) throw errSintaks(c.line, "Fungsi '" + c.nama + "()' belum dibuat — tulis 'def " + c.nama + "():' lebih dulu");
  });
  cekRekursi(defs);
  return ast;
}

// Pesan untuk baris yang tidak cocok pola mana pun. Pesan "kurang titik dua" hanya
// dipakai kalau titik dua memang tidak ada; kalau ada, sebut bentuk yang benar.
function pesanBarisTakDikenal(t) {
  const m = /^(for|if|while|def)\b/.exec(t);
  if (m) {
    if (!t.endsWith(":"))
      return "Baris '" + m[1] + "' harus diakhiri titik dua ':' — contoh: " + CONTOH_MELINTAS[m[1]];
    return "Bentuk baris '" + m[1] + "' belum benar — contoh yang diterima: " + CONTOH_MELINTAS[m[1]];
  }
  if (t.endsWith(":")) return "Blok '" + t + "' tidak dikenal — cek kartu Referensi Perintah";
  return "Perintah tidak dikenal: " + t + " — cek kartu Referensi Perintah";
}

const CONTOH_MELINTAS = {
  for: "for i in range(6):", if: "if robot.wall_ahead():",
  while: "while robot.wall_ahead():", def: "def maju_dua():"
};

// Kumpulkan semua node panggilan fungsi di dalam pohon AST.
function panggilanDalam(stmts, acc) {
  (stmts || []).forEach(s => {
    if (s.k === "call") acc.push(s);
    panggilanDalam(s.body, acc);
    panggilanDalam(s.elseBody, acc);
  });
  return acc;
}

// Rekursi (langsung maupun lewat fungsi lain) ditolak dengan pesan edukatif.
function cekRekursi(defs) {
  Object.keys(defs).forEach(root => {
    const seen = {};

    // Telusuri panggilan; error bila kembali ke fungsi asal.
    const langkah = (c) => {
      if (c.nama === root)
        throw errSintaks(c.line, "Rekursi tidak didukung: fungsi '" + root + "' memanggil dirinya sendiri — panggil satu kali saja");
      if (seen[c.nama]) return;
      seen[c.nama] = true;
      panggilanDalam(defs[c.nama].body, []).forEach(langkah);
    };

    panggilanDalam(defs[root].body, []).forEach(langkah);
  });
}

/* ==================== BIAYA (metrik seragam dari AST) ====================
   1 pernyataan = 1: perintah robot, for, while, if (ada/tanpa else), def,
   dan pemanggilan fungsi. 'else:', angka, komentar, baris kosong: 0. */
function countStatements(ast) {
  return ast.reduce((t, s) => t + 1 + countStatements(s.body || []) + countStatements(s.elseBody || []), 0);
}

/* ==================== INTERPRETER: AST + peta -> trace ====================
   Peta = {w,h,walls,items,start,target,tujuan}. Fungsi murni: hasil berupa
   trace (daftar keadaan) + penilaian tujuan, tanpa efek samping ke UI. */
function runVariant(ast, peta) {
  const walls = peta.walls || [], itemData = peta.items || [];
  const st = { x: peta.start.x, y: peta.start.y, dir: peta.start.dir };
  const items = itemData.map(i => ({ x: i[0], y: i[1], taken: false }));
  const funcs = {};
  ast.forEach(s => { if (s.k === "def") funcs[s.nama] = s; });
  const trace = [];
  const dikunjungi = {};
  let langkah = 0, gagal = null;

  // True bila petak (x, y) dinding atau di luar peta.
  const wallAt = (x, y) => x < 0 || y < 0 || x >= peta.w || y >= peta.h ||
    walls.some(w => w[0] === x && w[1] === y);

  // Nilai sensor robot untuk kondisi c.
  function sensor(c) {
    const d = DIRS[st.dir];
    if (c === "at_goal") return st.x === peta.target.x && st.y === peta.target.y;
    if (c === "item_ahead") return items.some(i => !i.taken && i.x === st.x + d[0] && i.y === st.y + d[1]);
    const side = c === "wall_left" ? 3 : c === "wall_right" ? 1 : 0;
    const s = DIRS[(st.dir + side) % 4];
    return wallAt(st.x + s[0], st.y + s[1]);
  }

  // True bila kondisi if/while terpenuhi (memperhitungkan 'not').
  const kondisiTerpenuhi = s => !!s.not !== sensor(s.cond);

  // Catat keadaan robot ke trace; tandai gagal bila ada jenis error.
  function snap(line, desc, jenis) {
    trace.push({ line: line, desc: desc, bad: !!jenis, x: st.x, y: st.y, dir: st.dir,
                 items: items.map(i => ({ x: i.x, y: i.y, taken: i.taken })) });
    dikunjungi[st.x + "," + st.y] = true;
    if (jenis) gagal = { jenis: jenis, pesan: desc, line: line };
  }

  // Jalankan daftar pernyataan secara berurutan.
  function jalankan(stmts, stack) {
    if (gagal) return;
    for (const s of stmts) {
      if (gagal) return;
      if (++langkah > STEP_CAP) {
        snap(s.line, "Loop tak berujung — program dihentikan setelah " + STEP_CAP + " langkah. Periksa kondisi 'while' atau angka range().", ERR.LOOP_TAK_BERUNJUNG);
        return;
      }
      if (s.k === "fwd") {
        const d = DIRS[st.dir], nx = st.x + d[0], ny = st.y + d[1];
        if (wallAt(nx, ny)) { snap(s.line, "Robot menabrak dinding", ERR.TABRAK_DINDING); return; }
        st.x = nx; st.y = ny; snap(s.line, "maju");
      }
      else if (s.k === "left") { st.dir = (st.dir + 3) % 4; snap(s.line, "belok kiri"); }
      else if (s.k === "right") { st.dir = (st.dir + 1) % 4; snap(s.line, "belok kanan"); }
      else if (s.k === "take") {
        const d = DIRS[st.dir];
        const it = items.find(i => !i.taken && i.x === st.x + d[0] && i.y === st.y + d[1]);
        if (!it) { snap(s.line, "Tidak ada item di depan robot", ERR.TIDAK_ADA_ITEM); return; }
        it.taken = true; snap(s.line, "mengambil item");
      }
      else if (s.k === "loop") { for (let i = 0; i < s.n && !gagal; i++) jalankan(s.body, stack); }
      else if (s.k === "while") { while (!gagal && kondisiTerpenuhi(s)) jalankan(s.body, stack); }
      else if (s.k === "if") { if (kondisiTerpenuhi(s)) jalankan(s.body, stack); else if (s.elseBody) jalankan(s.elseBody, stack); }
      else if (s.k === "def") { /* definisi: dihitung biaya, tidak dijalankan di tempat ia ditulis */ }
      else if (s.k === "call") {
        if (stack.indexOf(s.nama) >= 0) { snap(s.line, "Rekursi tidak didukung", ERR.LOOP_TAK_BERUNJUNG); return; }
        stack.push(s.nama); jalankan(funcs[s.nama].body, stack); stack.pop();
      }
    }
  }

  dikunjungi[st.x + "," + st.y] = true;
  jalankan(ast, []);

  const akhir = trace.length ? trace[trace.length - 1] : { x: st.x, y: st.y, dir: st.dir, items: items };
  let hasil = gagal;
  if (!hasil) hasil = nilaiTujuan(peta, st, items, dikunjungi);
  return {
    ok: !hasil, jenis: hasil && hasil.jenis, pesan: hasil && hasil.pesan, line: hasil && hasil.line,
    trace: trace, steps: trace.length, akhir: akhir, items: items
  };
}

// Cek tujuan level tercapai; null bila lolos, objek error bila tidak.
function nilaiTujuan(peta, st, items, dikunjungi) {
  const jenis = (peta.tujuan && peta.tujuan.jenis) || "sampai";
  const diTujuan = st.x === peta.target.x && st.y === peta.target.y;
  const sisa = items.filter(i => !i.taken).length;
  if (jenis === "sampai")
    return diTujuan ? null : { jenis: ERR.TIDAK_SAMPAI, pesan: "Program selesai tapi robot tidak BERHENTI di petak tujuan. Lewat di atas tujuan lalu pergi lagi tidak dihitung menang." };
  if (jenis === "kumpulkan_semua")
    return sisa ? { jenis: ERR.ITEM_TERSISA, pesan: "Masih ada " + sisa + " item yang belum dipungut." } : null;
  if (jenis === "sampai_dan_kumpulkan") {
    if (sisa) return { jenis: ERR.ITEM_TERSISA, pesan: "Semua rute sudah dilalui, tapi masih ada " + sisa + " item yang belum dipungut." };
    return diTujuan ? null : { jenis: ERR.TIDAK_SAMPAI, pesan: "Item sudah lengkap, tapi robot tidak berhenti di petak tujuan." };
  }
  if (jenis === "kunjungi_semua") {
    const lantai = peta.w * peta.h - (peta.walls || []).length;
    const kurang = lantai - Object.keys(dikunjungi).length;
    return kurang ? { jenis: ERR.TIDAK_SAMPAI, pesan: "Masih ada " + kurang + " petak lantai yang belum dilewati robot." } : null;
  }
  return { jenis: ERR.SINTAKS, pesan: "Konfigurasi level salah: tujuan.jenis '" + jenis + "' tidak dikenal." };
}

/* ==================== LEVEL: varian + bintang ==================== */
// Daftar peta uji sebuah level (minimal satu).
function varian(level) { return level.varian && level.varian.length ? level.varian : [level]; }

// Gabungkan jenis tujuan level ke dalam satu varian peta.
function petaDari(level, v) { return Object.assign({ tujuan: level.tujuan }, v); }

// Hitung skor edukasi (0-100) dan predikat KKTP untuk instrumen pretest/posttest.
function hitungSkorEdukasi(ok, cost, level, opts) {
  if (!ok) return { total: 0, predikat: "Perlu Bimbingan", kebenaran: 0, efisiensi: 0, kemandirian: 0 };
  const petunjuk = (opts && opts.hintsUsed) || 0;
  const tabrakan = (opts && opts.crashes) || 0;
  const sKebenaran = 50;
  const rasio = Math.min(1, (level.optimal || 1) / Math.max(1, cost));
  const sEfisiensi = Math.round(30 * rasio);
  const penaltiHint = petunjuk * 5;
  const penaltiCrash = Math.max(0, tabrakan - 1) * 2;
  const sKemandirian = Math.max(0, 20 - penaltiHint - penaltiCrash);
  const total = sKebenaran + sEfisiensi + sKemandirian;
  const predikat = total >= 85 ? "Mahir" : total >= 70 ? "Cakap" : total >= 50 ? "Dasar" : "Perlu Bimbingan";
  return { total, predikat, kebenaran: sKebenaran, efisiensi: sEfisiensi, kemandirian: sKemandirian };
}

// Hitung bintang (1-3) dari biaya pernyataan.
function starsFor(cost, level) { return cost <= level.optimal ? 3 : cost <= level.target2 ? 2 : 1; }

// Jalankan program pada SEMUA varian. Lolos = setiap varian lolos.
function evaluateProgram(code, level, opts) {
  let ast;
  try { ast = compilePython(code); }
  catch (e) {
    if (e.jenis) return { ok: false, jenis: e.jenis, pesan: e.pesan, line: e.line, cost: 0, hasil: [], gagal: null, score: 0, predikat: "Error" };
    throw e;
  }
  const cost = countStatements(ast);
  if (level.kuotaKeras != null && cost > level.kuotaKeras)
    return { ok: false, jenis: ERR.MELEBIHI_KUOTA, cost: cost, hasil: [], gagal: null, score: 0, predikat: "Melebihi Kuota",
             pesan: "Program memakai " + cost + " pernyataan, melewati batas " + level.kuotaKeras + " untuk level ini. Buat lebih ringkas (loop/kondisi/fungsi)." };

  const hasil = varian(level).map((v, i) => Object.assign({ nomor: i + 1 }, runVariant(ast, petaDari(level, v))));
  const gagal = hasil.find(r => !r.ok) || null;
  const steps = hasil.reduce((m, r) => Math.max(m, r.steps), 0);
  const edu = hitungSkorEdukasi(!gagal, cost, level, opts);
  return {
    ok: !gagal, cost: cost, hasil: hasil, gagal: gagal, steps: steps,
    jenis: gagal && gagal.jenis, pesan: gagal && gagal.pesan, line: gagal && gagal.line,
    stars: gagal ? 0 : starsFor(cost, level),
    score: edu.total, predikat: edu.predikat, rubrik: edu,
    bonus: !gagal && level.langkahBonus != null && steps <= level.langkahBonus
  };
}

/* ==================== DATA LEVEL ====================
   Field: no (nomor tampil), mode ("blok"|"code"), kategori Blockly,
   kuotaKeras (opsional), target2, optimal, langkahBonus (opsional),
   tujuan.jenis, varian[] (varian[0] tampil, sisanya tersembunyi),
   misi, hints[], solusiReferensi. */
const LEVELS = [
  {
    no: 1, nama: "Urutan Perintah", mode: "blok", kategori: ["robot"],
    target2: 11, optimal: 9, langkahBonus: 9,
    tujuan: { jenis: "sampai" },
    varian: [{ w: 5, h: 3, walls: [[2, 0], [2, 1]], items: [], start: { x: 0, y: 1, dir: 1 }, target: { x: 4, y: 1 } }],
    misi: "Robot mulai di kiri bawah lorong, menghadap ke kanan. Bawa paket ke petak hijau. " +
          "Dinding abu-abu di tengah tidak bisa ditembus, jadi robot harus memutar. " +
          "Susun perintah maju / belok kiri / belok kanan sampai robot berhenti di petak hijau.",
    solusiReferensi: ["robot.forward()", "robot.turn_right()", "robot.forward()", "robot.turn_left()",
      "robot.forward()", "robot.forward()", "robot.forward()", "robot.turn_left()", "robot.forward()"].join("\n")
  },
  {
    no: 2, nama: "Koridor Panjang (Kuota Ketat)", mode: "blok", kategori: ["robot", "loop", "matematika"],
    kuotaKeras: 4, target2: 3, optimal: 2, langkahBonus: 6,
    tujuan: { jenis: "sampai" },
    varian: [{
      w: 7, h: 7, items: [], start: { x: 0, y: 3, dir: 1 }, target: { x: 6, y: 3 },
      walls: [[1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4]]
    }],
    misi: "Koridor lurus 6 langkah, tapi level ini hanya boleh memakai 4 pernyataan. " +
          "Menulis 'maju' satu per satu tidak akan muat — cari blok yang bisa mengulang perintah.",
    solusiReferensi: ["for i in range(6):", "    robot.forward()"].join("\n")
  },
  {
    no: 3, nama: "Koding Sendiri", mode: "code", kategori: [],
    placeholder: "# Tulis kodemu di sini. Petunjuk: koridor ini berpola — pakai for + if, bukan robot.forward() berulang.",
    target2: 5, optimal: 4, langkahBonus: 8,
    tujuan: { jenis: "sampai_dan_kumpulkan" },
    varian: [
      {
        w: 7, h: 7, items: [[2, 3], [4, 3]], start: { x: 0, y: 3, dir: 1 }, target: { x: 6, y: 3 },
        walls: [[1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4]]
      },
      {
        w: 7, h: 7, items: [[3, 3], [5, 3]], start: { x: 0, y: 3, dir: 1 }, target: { x: 6, y: 3 },
        walls: [[1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4]]
      }
    ],
    misi: "MODE KODE: tidak ada blok — tulis Python langsung. Ada 2 peta uji: yang tampil di layar " +
          "dan satu peta uji tersembunyi dengan posisi item berbeda. Programmu harus lolos di KEDUA peta. " +
          "Buntu? Pakai tombol Petunjuk (bertingkat).",
    hints: [
      "Petunjuk 1 (konsep):\nJangan menulis robot.forward() enam kali — koridor ini berpola. Ingat struktur perulangan Python: for i in range(...): lalu isinya menjorok 4 spasi.",
      "Petunjuk 2 (struktur):\nIsi loop: maju dulu, lalu cek apakah ada item di depan; kalau ya, ambil.\nJadi: robot.forward() dan if robot.item_ahead(): yang berisi robot.take().",
      "Petunjuk 3 (kerangka, isi angkanya sendiri):\nfor i in range( ... ):\n    robot.forward()\n    if robot.item_ahead():\n        robot.take()"
    ],
    solusiReferensi: ["for i in range(6):", "    robot.forward()", "    if robot.item_ahead():", "        robot.take()"].join("\n")
  }
];

/* ==================== PEMERIKSAAN MANDIRI ====================
   Dipakai tests/engine.test.js (node --test) dan tombol diagnostik di browser,
   supaya satu daftar periksa berlaku untuk kedua lingkungan. */
function selfChecks() {
  const hasil = [];

  // Catat satu hasil pemeriksaan (lulus/gagal + detail).
  const cek = (nama, kondisi, detail) => hasil.push({ name: nama, pass: !!kondisi, detail: kondisi ? "" : String(detail === undefined ? "" : detail) });

  const lorong = { no: 99, nama: " uji ", mode: "code", target2: 9, optimal: 2, tujuan: { jenis: "sampai" },
    varian: [{ w: 5, h: 1, walls: [], items: [], start: { x: 0, y: 0, dir: 1 }, target: { x: 2, y: 0 } }] };

  LEVELS.forEach((lv, i) => {
    const r = evaluateProgram(lv.solusiReferensi, lv);
    cek("L" + lv.no + " solusi referensi lolos semua varian", r.ok, r.pesan);
    cek("L" + lv.no + " biaya referensi == optimal (" + lv.optimal + ")", r.cost === lv.optimal, "dapat " + r.cost);
    cek("L" + lv.no + " referensi dapat ★3", r.stars === 3, "dapat ★" + r.stars);
  });

  const lewat = evaluateProgram(["for i in range(4):", "    robot.forward()"].join("\n"), lorong);
  cek("melewati tujuan lalu terus jalan != menang", !lewat.ok && lewat.jenis === ERR.TIDAK_SAMPAI, lewat.jenis);
  const berhenti = evaluateProgram(["for i in range(2):", "    robot.forward()"].join("\n"), lorong);
  cek("berhenti tepat di tujuan == menang", berhenti.ok, berhenti.pesan);
  const kosong = evaluateProgram(["for i in range(0):", "    robot.forward()"].join("\n"), lorong);
  cek("range(0) tidak menang", !kosong.ok && kosong.jenis === ERR.TIDAK_SAMPAI, kosong.jenis);

  const putar = { no: 99, nama: " uji ", mode: "code", target2: 9, optimal: 9, tujuan: { jenis: "sampai" },
    varian: [{ w: 1, h: 1, walls: [], items: [], start: { x: 0, y: 0, dir: 0 }, target: { x: 0, y: 0 } }] };
  const takBerujung = evaluateProgram(["while robot.wall_ahead():", "    robot.turn_left()"].join("\n"), putar);
  cek("loop tak berujung -> loop_tak_berujung", !takBerujung.ok && takBerujung.jenis === ERR.LOOP_TAK_BERUNJUNG, takBerujung.jenis);
  cek("loop tak berujung dibatasi STEP_CAP", takBerujung.hasil[0].steps <= STEP_CAP + 1, takBerujung.hasil[0].steps);

  const sapu = { no: 99, nama: " uji ", mode: "code", target2: 9, optimal: 9, tujuan: { jenis: "kunjungi_semua" },
    varian: [{ w: 2, h: 2, walls: [], items: [], start: { x: 0, y: 0, dir: 1 }, target: { x: 0, y: 0 } }] };
  const sapuan = evaluateProgram(["for i in range(2):", "    robot.forward()", "    robot.turn_right()",
    "    robot.forward()", "    robot.turn_right()"].join("\n"), sapu);
  cek("kunjungi_semua lolos kalau semua petak dilewati", sapuan.ok, sapuan.pesan);
  const kurangSapu = evaluateProgram(["robot.forward()"].join("\n"), sapu);
  cek("kunjungi_semua gagal kalau ada petak tersisa", !kurangSapu.ok && kurangSapu.jenis === ERR.TIDAK_SAMPAI, kurangSapu.jenis);

  const duaVarian = evaluateProgram(["for i in range(6):", "    robot.forward()"].join("\n"), LEVELS[2]);
  cek("L3 tanpa pungut item -> item_tersisa di varian 1", duaVarian.jenis === ERR.ITEM_TERSISA && duaVarian.gagal.nomor === 1, duaVarian.jenis);
  const varianDua = evaluateProgram(["for i in range(6):", "    robot.forward()", "    if robot.item_ahead():", "        robot.take()"].join("\n"), LEVELS[2]);
  cek("referensi L3 lolos 2 varian", varianDua.hasil.length === 2 && varianDua.hasil.every(r => r.ok), JSON.stringify(varianDua.hasil.map(r => r.jenis)));

  cek("kuota keras menahan program yang terlalu panjang",
    evaluateProgram(["robot.forward()", "robot.forward()", "robot.forward()", "robot.forward()", "robot.forward()",
      "robot.forward()", "robot.turn_left()", "robot.forward()"].join("\n"), LEVELS[1]).jenis === ERR.MELEBIHI_KUOTA);
  cek("tanpa kuota keras, program panjang tetap boleh jalan (★1)",
    evaluateProgram(["for i in range(6):", "    robot.forward()", "    if robot.item_ahead():", "        robot.take()",
      "robot.turn_left()", "robot.turn_right()"].join("\n"), LEVELS[2]).stars === 1);

  const fungsi = evaluateProgram(["def langkah():", "    robot.forward()", "langkah()", "langkah()"].join("\n"), lorong);
  cek("def + 2 panggilan = 4 pernyataan", countStatements(compilePython(["def a():", "    robot.forward()", "a()", "a()"].join("\n"))) === 4, "");
  cek("program dengan fungsi bisa menang", fungsi.ok && fungsi.cost === 4, fungsi.pesan + " | biaya " + fungsi.cost);
  cek("rekursi ditolak", (function () {
    try { compilePython(["def a():", "    robot.forward()", "    a()", "a()"].join("\n")); return false; }
    catch (e) { return e.jenis === ERR.SINTAKS && /Rekursi/.test(e.pesan); }
  })());
  cek("panggilan ke fungsi tak dikenal -> sintaks per baris", (function () {
    try { compilePython(["maju2()"].join("\n")); return false; }
    catch (e) { return e.jenis === ERR.SINTAKS && e.line === 1; }
  })());
  cek("lebih dari 3 fungsi ditolak", (function () {
    try { compilePython(["def a():", "    robot.forward()", "def b():", "    robot.forward()", "def c():", "    robot.forward()",
      "def d():", "    robot.forward()"].join("\n")); return false; }
    catch (e) { return /Maksimal 3/.test(e.pesan); }
  })());
  cek("while + not + else", (function () {
    const ast = compilePython(["while not robot.at_goal():", "    robot.forward()", "if robot.wall_ahead():", "    robot.turn_left()", "else:", "    robot.turn_right()"].join("\n"));
    return countStatements(ast) === 5;
  })());
  return hasil;
}

const LBEngine = {
  DIRS, STEP_CAP, ERR, MAKS_FUNGSI, TEMA, LEVELS,
  compilePython, countStatements, runVariant, evaluateProgram, starsFor, hitungSkorEdukasi, varian, selfChecks
};

if (typeof module !== "undefined" && module.exports) module.exports = LBEngine;
if (typeof window !== "undefined") window.LBEngine = LBEngine;
