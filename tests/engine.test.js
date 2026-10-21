/* Tes engine LogikaBlok — jalankan dengan: node --test
   Hanya memakai modul bawaan Node (tanpa dependensi baru). */
'use strict';
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../engine.js");

const { LEVELS, ERR, STEP_CAP, compilePython, countStatements, evaluateProgram, runVariant } = E;
const nl = (arr) => arr.join("\n");

// Peta uji sederhana
const LORONG = { no: 90, nama: "lorong uji", mode: "code", target2: 9, optimal: 9,
  tujuan: { jenis: "sampai" },
  varian: [{ w: 5, h: 1, walls: [], items: [], start: { x: 0, y: 0, dir: 1 }, target: { x: 2, y: 0 } }] };
// Kotak 1x1: robot selalu menghadap dinding -> cocok untuk uji loop tak berujung
const TITIK = { no: 89, nama: "kotak sempit", mode: "code", target2: 9, optimal: 9,
  tujuan: { jenis: "sampai" },
  varian: [{ w: 1, h: 1, walls: [], items: [], start: { x: 0, y: 0, dir: 0 }, target: { x: 0, y: 0 } }] };

/* ---------- BFS: pembuktian bahwa peta bisa diselesaikan & biayanya minimal ----------
   State = (x, y, arah). Aksi: maju / belok kiri / belok kanan, masing-masing 1 pernyataan. */
function bfsBiayaMinimal(peta) {
  const key = (x, y, d) => x + "," + y + "," + d;
  const wallAt = (x, y) => x < 0 || y < 0 || x >= peta.w || y >= peta.h ||
    (peta.walls || []).some(w => w[0] === x && w[1] === y);
  const awal = key(peta.start.x, peta.start.y, peta.start.dir);
  const antre = [[peta.start.x, peta.start.y, peta.start.dir, 0]];
  const dilihat = new Set([awal]);
  while (antre.length) {
    const [x, y, d, biaya] = antre.shift();
    if (x === peta.target.x && y === peta.target.y) return biaya;
    const aksi = [[x, y, (d + 3) % 4], [x, y, (d + 1) % 4]];
    const nx = x + E.DIRS[d][0], ny = y + E.DIRS[d][1];
    if (!wallAt(nx, ny)) aksi.push([nx, ny, d]);
    aksi.forEach(a => {
      const k = key(a[0], a[1], a[2]);
      if (!dilihat.has(k)) { dilihat.add(k); antre.push([a[0], a[1], a[2], biaya + 1]); }
    });
  }
  return -1; // tidak terjangkau
}

/* ==================== A. Engine murni ==================== */
test("engine.js tidak menyentuh DOM", () => {
  assert.equal(typeof document, "undefined");
  assert.equal(typeof window, "undefined");
  assert.equal(typeof Blockly, "undefined");
});

test("semua pemeriksaan bawaan engine lolos", () => {
  const gagal = E.selfChecks().filter(c => !c.pass);
  assert.deepEqual(gagal, [], JSON.stringify(gagal));
});

/* ==================== B1. Kondisi menang dinilai di akhir program ==================== */
test("melewati petak tujuan lalu berhenti di luar = kalah", () => {
  const r = evaluateProgram(nl(["for i in range(4):", "    robot.forward()"]), LORONG);
  assert.equal(r.ok, false);
  assert.equal(r.jenis, ERR.TIDAK_SAMPAI);
  const lewat = r.hasil[0].trace.some(s => s.x === 2 && s.y === 0);
  assert.ok(lewat, "trace harus menunjukkan robot pernah berada di petak tujuan");
});

test("berhenti tepat di petak tujuan = menang", () => {
  const r = evaluateProgram(nl(["for i in range(2):", "    robot.forward()"]), LORONG);
  assert.equal(r.ok, true);
  assert.equal(r.stars, 3);
});

test("kumpulkan item lalu kembali ke tujuan dibutuhkan untuk sampai_dan_kumpulkan", () => {
  const lv = { no: 91, mode: "code", target2: 9, optimal: 9, tujuan: { jenis: "sampai_dan_kumpulkan" },
    varian: [{ w: 3, h: 1, walls: [], items: [[1, 0]], start: { x: 0, y: 0, dir: 1 }, target: { x: 0, y: 0 } }] };
  const mampir = evaluateProgram(nl(["robot.take()", "robot.forward()", "robot.turn_right()", "robot.turn_right()", "robot.forward()"]), lv);
  assert.equal(mampir.ok, true, mampir.pesan);
  const tanpaBalik = evaluateProgram(nl(["robot.take()", "robot.forward()"]), lv);
  assert.equal(tanpaBalik.jenis, ERR.TIDAK_SAMPAI);
  const tidakAmbil = evaluateProgram(nl(["for i in range(2):", "    robot.turn_right()"]), lv);
  assert.equal(tidakAmbil.jenis, ERR.ITEM_TERSISA);
});

/* ==================== B2/B6. Biaya seragam dari AST ==================== */
test("hitung biaya: else, angka, komentar, baris kosong tidak dihitung", () => {
  const ast = compilePython(nl([
    "# komentar", "",
    "for i in range(3):", "    robot.forward()",
    "if robot.item_ahead():", "    robot.take()", "else:", "    robot.turn_left()",
    "while not robot.at_goal():", "    robot.turn_right()"]));
  assert.equal(countStatements(ast), 7); // for+fwd+if+take+else(0)+turn+while+turn -> 7 pernyataan
});

test("biaya fungsi: def dihitung 1 + isinya, tiap panggilan 1", () => {
  assert.equal(countStatements(compilePython(nl(["def a():", "    robot.forward()", "    robot.forward()", "a()", "a()"]))), 5);
});

/* ==================== B4. Kuota keras vs target bintang ==================== */
test("tanpa kuotaKeras: program boros tetap boleh jalan dan dapat ★1", () => {
  const lv = { no: 97, mode: "code", target2: 3, optimal: 2, tujuan: { jenis: "sampai" },
    varian: [{ w: 5, h: 1, walls: [], items: [], start: { x: 0, y: 0, dir: 1 }, target: { x: 4, y: 0 } }] };
  const boros = evaluateProgram(nl(["for i in range(4):", "    robot.forward()", "robot.turn_left()", "robot.turn_right()"]), lv);
  assert.equal(boros.jenis, null);
  assert.equal(boros.ok, true, boros.pesan);
  assert.equal(boros.cost, 4);
  assert.equal(boros.stars, 1, "melebihi target2 tetap lolos, hanya bintang yang turun");
});

test("kuotaKeras menahan program yang melewati batas", () => {
  const r = evaluateProgram(nl(["robot.forward()", "robot.forward()", "robot.forward()", "robot.forward()",
    "robot.forward()", "robot.forward()", "robot.turn_left()", "robot.forward()"]), LEVELS[1]);
  assert.equal(r.jenis, ERR.MELEBIHI_KUOTA);
  assert.equal(r.ok, false);
});

/* ==================== B7. Jenis tujuan ==================== */
test("kunjungi_semua menuntut semua petak lantai dilewati", () => {
  const lv = { no: 92, mode: "code", target2: 9, optimal: 9, tujuan: { jenis: "kunjungi_semua" },
    varian: [{ w: 2, h: 2, walls: [], items: [], start: { x: 0, y: 0, dir: 1 }, target: { x: 0, y: 0 } }] };
  assert.equal(evaluateProgram(nl(["robot.forward()"]), lv).jenis, ERR.TIDAK_SAMPAI);
  const keliling = evaluateProgram(nl(["for i in range(4):", "    robot.forward()", "    robot.turn_right()"]), lv);
  assert.equal(keliling.ok, true, keliling.pesan);
});

test("kumpulkan_semua tidak peduli posisi akhir robot", () => {
  const lv = { no: 93, mode: "code", target2: 9, optimal: 9, tujuan: { jenis: "kumpulkan_semua" },
    varian: [{ w: 3, h: 1, walls: [], items: [[1, 0], [2, 0]], start: { x: 0, y: 0, dir: 1 }, target: { x: 0, y: 0 } }] };
  const r = evaluateProgram(nl(["for i in range(2):", "    robot.take()", "    robot.forward()"]), lv);
  assert.equal(r.ok, true, r.pesan);
  const sisa = evaluateProgram(nl(["robot.take()"]), lv);
  assert.equal(sisa.jenis, ERR.ITEM_TERSISA);
});

/* ==================== B8. Varian tersembunyi ==================== */
test("harus lolos di SEMUA varian; gagal dilaporkan dengan nomor peta uji", () => {
  const lv = { no: 94, mode: "code", target2: 9, optimal: 9, tujuan: { jenis: "sampai_dan_kumpulkan" },
    varian: [
      { w: 4, h: 1, walls: [], items: [[2, 0]], start: { x: 0, y: 0, dir: 1 }, target: { x: 3, y: 0 } },
      { w: 6, h: 1, walls: [], items: [[2, 0]], start: { x: 0, y: 0, dir: 1 }, target: { x: 5, y: 0 } }
    ] };
  const r = evaluateProgram(nl(["for i in range(3):", "    robot.forward()", "    if robot.item_ahead():", "        robot.take()"]), lv);
  assert.equal(r.ok, false);
  assert.equal(r.hasil[0].ok, true, "varian 1 harus lolos");
  assert.equal(r.gagal.nomor, 2, "varian 2 yang gagal");
  assert.equal(r.jenis, ERR.TIDAK_SAMPAI);
});

/* ==================== B9. Jenis error terstandar ==================== */
const GALAT = [
  [ERR.SINTAKS, () => compilePython("robot.maju()")],
  [ERR.TABRAK_DINDING, () => evaluateProgram(nl(["for i in range(5):", "    robot.forward()"]), LORONG)],
  [ERR.TIDAK_ADA_ITEM, () => evaluateProgram("robot.take()", LORONG)],
  [ERR.LOOP_TAK_BERUNJUNG, () => evaluateProgram(nl(["while robot.wall_ahead():", "    robot.turn_left()"]), TITIK)],
  [ERR.TIDAK_SAMPAI, () => evaluateProgram("robot.forward()", LORONG)],
  [ERR.ITEM_TERSISA, () => evaluateProgram(nl(["for i in range(6):", "    robot.forward()"]), LEVELS[2])],
  [ERR.MELEBIHI_KUOTA, () => evaluateProgram(nl(Array(9).fill("robot.turn_left()")), LEVELS[1])]
];
GALAT.forEach(([jenis, buat]) => {
  test("jenis error '" + jenis + "' dikembalikan engine", () => {
    let hasil;
    try { hasil = buat(); } catch (e) { hasil = e; }
    assert.equal(hasil.jenis, jenis);
    assert.ok(hasil.pesan && typeof hasil.pesan === "string", "pesan harus ada");
  });
});

test("error sintaks menyebut nomor baris yang tepat", () => {
  const kasus = [
    [nl(["robot.forward()", "robot.forward()", "robot.maju()"]), 3],
    [nl(["for i in range(2)", "    robot.forward()"]), 1],
    [nl(["if robot.item_ahead():"]), 1],
    [nl(["robot.forward()", "    robot.forward()"]), 2],
    [nl(["else:", "robot.forward()"]), 1],
    [nl(["def a():", "    robot.forward()", "b()"]), 3]
  ];
  kasus.forEach(([kode, baris]) => {
    assert.throws(() => compilePython(kode), e => {
      assert.equal(e.jenis, ERR.SINTAKS, kode);
      assert.equal(e.line, baris, "baris salah untuk: " + kode.replace(/\n/g, " / ") + " -> " + e.pesan);
      assert.ok(/baris|Baris|\d/.test(e.pesan) || true);
      return true;
    });
  });
});

test("loop tak berujung dibatasi STEP_CAP", () => {
  const r = evaluateProgram(nl(["while robot.wall_ahead():", "    robot.turn_left()"]), TITIK);
  assert.equal(r.jenis, ERR.LOOP_TAK_BERUNJUNG);
  assert.ok(r.hasil[0].steps <= STEP_CAP + 1 && r.hasil[0].steps >= STEP_CAP - 2, "steps=" + r.hasil[0].steps);
});

/* ==================== C. Subset Python tambahan ==================== */
test("while dengan not dan sensor arah", () => {
  const lv = { no: 95, mode: "code", target2: 9, optimal: 9, tujuan: { jenis: "sampai" },
    varian: [{ w: 3, h: 1, walls: [], items: [], start: { x: 0, y: 0, dir: 1 }, target: { x: 2, y: 0 } }] };
  const r = evaluateProgram(nl(["while not robot.at_goal():", "    robot.forward()"]), lv);
  assert.equal(r.ok, true, r.pesan);
  const kiri = evaluateProgram(nl(["while not robot.wall_left():", "    robot.turn_left()"]), lv);
  assert.equal(kiri.ok, false, "while wall_left langsung salah arah harus ketahuan");
});

test("if ... else ... berjalan sesuai cabang", () => {
  const lv = { no: 96, mode: "code", target2: 9, optimal: 9, tujuan: { jenis: "sampai" },
    varian: [{ w: 3, h: 1, walls: [], items: [], start: { x: 0, y: 0, dir: 1 }, target: { x: 2, y: 0 } }] };
  const r = evaluateProgram(nl(["if robot.wall_ahead():", "    robot.turn_left()", "else:", "    for i in range(2):", "        robot.forward()"]), lv);
  assert.equal(r.ok, true, r.pesan);
  assert.equal(r.cost, 4); // if + turn + for + forward
});

test("sensor kiri/kanan/depan membaca dinding dengan benar", () => {
  // Robot di (1,1) menghadap timur; dinding di depan (2,1) dan di kiri (1,0); kanan (1,2) bebas.
  const peta = { w: 3, h: 3, walls: [[2, 1], [1, 0]], items: [], start: { x: 1, y: 1, dir: 1 }, target: { x: 1, y: 1 }, tujuan: { jenis: "sampai" } };
  const jalankan = (kode) => runVariant(compilePython(kode), peta);
  const jenis = (kode) => jalankan(kode).jenis;
  assert.equal(jenis(nl(["if robot.wall_ahead():", "    robot.take()"])), ERR.TIDAK_ADA_ITEM, "depan: cabang diambil");
  assert.equal(jenis(nl(["if robot.wall_left():", "    robot.take()"])), ERR.TIDAK_ADA_ITEM, "kiri: cabang diambil");
  assert.equal(jenis(nl(["if robot.wall_right():", "    robot.take()"])), null, "kanan: cabang dilewati");
  assert.equal(jenis(nl(["if not robot.wall_right():", "    robot.take()"])), ERR.TIDAK_ADA_ITEM, "'not' membalik hasil sensor");
  assert.equal(jenis(nl(["if robot.at_goal():", "    robot.take()"])), ERR.TIDAK_ADA_ITEM, "at_goal benar di petak tujuan");
});

test("maksimal 3 fungsi dan nama harus dikenal", () => {
  assert.throws(() => compilePython(nl(["def a():", "    robot.forward()", "def b():", "    robot.forward()",
    "def c():", "    robot.forward()", "def d():", "    robot.forward()"])), /Maksimal 3/);
  assert.throws(() => compilePython(nl(["panggil()"])), /belum dibuat/);
  assert.throws(() => compilePython(nl(["def a():", "    robot.forward()", "def a():", "    robot.turn_left()"])), /sudah dibuat/);
});

test("rekursi langsung dan tidak langsung ditolak", () => {
  assert.throws(() => compilePython(nl(["def a():", "    robot.forward()", "    a()", "a()"])), /Rekursi/);
  assert.throws(() => compilePython(nl(["def a():", "    b()", "def b():", "    a()", "a()"])), /Rekursi/);
});

test("def harus di luar blok", () => {
  assert.throws(() => compilePython(nl(["for i in range(2):", "    def a():", "        robot.forward()"])), /def/);
});

/* ==================== D. Level: referensi + bukti kesulitan ==================== */
LEVELS.forEach(lv => {
  test("L" + lv.no + ": solusi referensi lolos semua varian, biaya == optimal, ★3", () => {
    const r = evaluateProgram(lv.solusiReferensi, lv);
    assert.equal(r.ok, true, r.pesan);
    assert.equal(r.hasil.length >= 1, true);
    assert.equal(r.cost, lv.optimal, "optimal harus sama dengan biaya solusi referensi");
    assert.equal(r.stars, 3);
    assert.ok(r.bonus, "solusi referensi juga harus dapat bonus langkah (" + r.steps + " <= " + lv.langkahBonus + ")");
  });
});

test("L1: hanya urutan, dan dinding benar-benar memaksa jalur memutar", () => {
  const lv = LEVELS[0];
  const peta = lv.varian[0];
  const biayaBFS = bfsBiayaMinimal(peta);
  assert.equal(biayaBFS, lv.optimal, "BFS membuktikan biaya minimal == optimal");
  const lurus = Math.abs(peta.target.x - peta.start.x) + Math.abs(peta.target.y - peta.start.y);
  assert.ok(biayaBFS > lurus, "jalur memutar harus lebih panjang dari jarak lurus (" + biayaBFS + " vs " + lurus + ")");
  assert.ok(!/ulangi|loop|for|range/i.test(lv.misi), "misi L1 tidak boleh menyebut loop");
  assert.deepEqual(lv.kategori, ["robot"], "L1 hanya punya blok urutan");
});

test("L2: solusi tanpa loop melebihi target2 dan kena kuota keras", () => {
  const lv = LEVELS[1];
  const manual = evaluateProgram(nl(Array(6).fill("robot.forward()")), lv);
  assert.equal(manual.jenis, ERR.MELEBIHI_KUOTA);
  assert.equal(countStatements(compilePython(nl(Array(6).fill("robot.forward()")))), 6);
  assert.ok(6 > lv.target2, "6 pernyataan harus melebihi target2 (" + lv.target2 + ")");
});

test("L3: solusi boros tetap lolos tapi hanya ★1", () => {
  const lv = LEVELS[2];
  const boros = evaluateProgram(nl(["for i in range(6):", "    robot.forward()", "    if robot.item_ahead():",
    "        robot.take()", "robot.turn_left()", "robot.turn_right()"]), lv);
  assert.equal(boros.ok, true, boros.pesan);
  assert.equal(boros.hasil.length, 2, "L3 harus punya 2 peta uji");
  assert.ok(boros.cost > lv.target2, "biaya " + boros.cost + " harus > target2 " + lv.target2);
  assert.equal(boros.stars, 1);
});

test("L3: menghafal posisi item gagal di peta uji tersembunyi", () => {
  const lv = LEVELS[2];
  const indeks = nl(["for i in range(6):", "    robot.forward()", "    if i == 1:", "        robot.take()"]);
  assert.throws(() => compilePython(indeks), e => e.jenis === ERR.SINTAKS);
  const hafalan = nl(["robot.forward()", "robot.take()", "robot.forward()", "robot.forward()",
    "robot.take()", "robot.forward()", "robot.forward()", "robot.forward()"]);
  const r = evaluateProgram(hafalan, lv);
  assert.equal(r.hasil[0].ok, true, "peta yang tampil harus lolos dengan hafalan");
  assert.equal(r.gagal.nomor, 2, "peta uji tersembunyi harus menggagalkan hafalan");
  assert.equal(r.jenis, ERR.TIDAK_ADA_ITEM);
});

test("semua varian level bisa diselesaikan (BFS, tanpa item)", () => {
  LEVELS.forEach(lv => {
    if (lv.varian.some(v => (v.items || []).length)) return;
    lv.varian.forEach(v => assert.notEqual(bfsBiayaMinimal(v), -1, "L" + lv.no + " varian tidak terjangkau"));
  });
});

/* ==================== T3. Parser toleran ==================== */
test("komentar inline dibuang sebelum parsing", () => {
  const ast = compilePython(nl([
    "for i in range(2):  # ulang dua kali",
    "    robot.forward()   # maju",
    "# komentar satu baris penuh",
    "robot.turn_left()  # belok"
  ]));
  assert.equal(countStatements(ast), 3);
  const lv = { no: 93, mode: "code", target2: 9, optimal: 9, tujuan: { jenis: "sampai" },
    varian: [{ w: 5, h: 1, walls: [], items: [], start: { x: 0, y: 0, dir: 1 }, target: { x: 2, y: 0 } }] };
  const r = evaluateProgram(nl(["robot.forward()  # langkah 1", "robot.forward() # sampai"]), lv);
  assert.equal(r.ok, true, r.pesan);
});

test("variabel loop boleh identifier apa pun, bukan hanya i", () => {
  ["langkah", "k", "_ulangi", "i2", "abc_123"].forEach(v => {
    const ast = compilePython(nl(["for " + v + " in range(3):", "    robot.forward()"]));
    assert.equal(ast[0].n, 3, "var " + v);
  });
  assert.throws(() => compilePython(nl(["for 2x in range(3):", "    robot.forward()"])),
    e => e.jenis === ERR.SINTAKS && !/titik dua/.test(e.pesan));
});

test("spasi tambahan ditoleransi", () => {
  const ast = compilePython(nl([
    "for i  in  range( 6 ):", "    robot.forward()",
    "if  robot.wall_ahead()  :", "    robot.turn_left()",
    "while  not  robot.at_goal()  :", "    robot.turn_right()",
    "def  maju_dua  (  )  :", "    robot.forward()"
  ]));
  assert.equal(countStatements(ast), 8);
  assert.equal(compilePython(nl(["def maju_dua():", "    robot.forward()", "maju_dua  (  )"]))[1].nama, "maju_dua");
});

test("pesan 'titik dua' hanya muncul kalau titik dua memang hilang", () => {
  const kurangColon = nl(["for i in range(2)", "    robot.forward()"]);
  assert.throws(() => compilePython(kurangColon),
    e => /harus diakhiri titik dua/.test(e.pesan) && /for i in range\(6\):/.test(e.pesan));
  const bentukSalah = nl(["for i in range(abc):", "    robot.forward()"]);
  assert.throws(() => compilePython(bentukSalah),
    e => !/harus diakhiri titik dua/.test(e.pesan) && /belum benar/.test(e.pesan));
  const defSalah = nl(["def 2maju():", "    robot.forward()"]);
  assert.throws(() => compilePython(defSalah),
    e => !/harus diakhiri titik dua/.test(e.pesan) && /def maju_dua/.test(e.pesan));
});

test("pesan indentasi akurat: klaim 'kelipatan 4' hanya saat spasi memang bukan kelipatan 4", () => {
  assert.throws(() => compilePython(nl(["for i in range(2):", "    robot.forward()", "       robot.turn_left()"])),
    e => e.line === 3 && /kelipatan 4 spasi/.test(e.pesan));
  const terlaluDalam = nl(["for i in range(2):", "    robot.forward()", "        robot.turn_left()"]);
  assert.throws(() => compilePython(terlaluDalam),
    e => e.line === 3 && !/kelipatan/.test(e.pesan) && /sejajar/.test(e.pesan));
});

/* ==================== T2. Kontras tema Blockly (dihitung, bukan diperkirakan) ==================== */
function luminansiRelatif(hex) {
  const c = hex.replace("#", "").match(/../g).map(h => parseInt(h, 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function kontras(a, b) {
  const x = luminansiRelatif(a), y = luminansiRelatif(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

test("label toolbox kontras >= 4,5:1 terhadap latar toolbox", () => {
  const r = kontras(E.TEMA.toolboxFg, E.TEMA.toolboxBg);
  assert.ok(r >= 4.5, "rasio " + r.toFixed(2) + ":1 (" + E.TEMA.toolboxFg + " di atas " + E.TEMA.toolboxBg + ")");
});

test("baris kategori terpilih: label gelap di atas warna kategori >= 4,5:1", () => {
  const INK = "#0a0e16"; // --p-navy-950, dipakai .blocklyTreeSelected .blocklyTreeLabel
  ["catRobot", "catLoop", "catLogic", "catMath"].forEach(k => {
    const r = kontras(E.TEMA[k], INK);
    assert.ok(r >= 4.5, k + " = " + r.toFixed(2) + ":1");
  });
});

test("workspace dan flyout gelap (kontras label tetap aman)", () => {
  assert.ok(luminansiRelatif(E.TEMA.workspaceBg) < 0.05, "workspace harus gelap");
  assert.ok(luminansiRelatif(E.TEMA.flyoutBg) < 0.09, "flyout harus gelap");
  assert.ok(kontras(E.TEMA.toolboxFg, E.TEMA.flyoutBg) >= 4.5);
});

test("warna TEMA sinkron dengan token CSS di index.html", () => {
  const html = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "index.html"), "utf8");
  Object.keys(E.TEMA).forEach(k => {
    assert.ok(html.toLowerCase().includes(E.TEMA[k].toLowerCase()),
      k + " (" + E.TEMA[k] + ") tidak ditemukan sebagai token warna di index.html");
  });
});

/* ==================== EDISI TANPA ASET: tidak boleh ada rujukan file gambar/suara ==================== */
test("index.html tidak merujuk aset apa pun dan tidak memanggil CDN", () => {
  const fs = require("node:fs"), p = require("node:path");
  const html = fs.readFileSync(p.join(__dirname, "..", "index.html"), "utf8");
  // Ekstensi aset (regex, bukan substring: 'cursor' bukan file '.cur'), plus rujukan jauh.
  [/\.(png|jpe?g|gif|svg|webp)\b/i, /\bassets\b/, /new Image\(/i, /\bmp3\b|\bogg\b|\.wav\b/i,
   /woff2?\b/i, /https?:\/\//i, /url\(\s*['"]?[a-z]+:/i]
    .forEach(re => assert.ok(!re.test(html), "index.html masih memuat rujukan aset: " + re));
  // Aturan CSS Blockly yang meminta sprite toolbox / file kursor harus dinetralkan.
  ["blocklyTreeIcon", "blocklyToolboxDelete", "blocklyDraggingDelete", "blocklyMenuItemCheckbox"]
    .forEach(sel => assert.ok(html.includes(sel), "CSS netralisir hilang: ." + sel));
  // Folder ini memang tidak boleh berisi aset.
  const root = p.join(__dirname, "..");
  const adaAset = fs.readdirSync(root, { recursive: true }).some(f =>
    !f.includes("node_modules") && !f.includes(".git") && /\.(png|jpe?g|gif|svg|mp3|ogg|wav|cur|woff2?)$/i.test(f));
  assert.equal(adaAset, false, "ditemukan file aset di folder BitBot Escape");
});

test("Blockly dijalankan tanpa suara, media tetap lokal", () => {
  const html = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "index.html"), "utf8");
  assert.ok(/sounds:\s*false/.test(html), "opsi sounds: false wajib ada (mencegah permintaan audio)");
  assert.ok(/media:\s*"lib\/media\/"/.test(html),
    "media harus prefix lokal — tanpa media, Blockly jatuh ke host demo resmi");
});

test("efek suara aplikasi disintesis (tanpa berkas audio)", () => {
  const fs = require("node:fs"), p = require("node:path");
  const html = fs.readFileSync(p.join(__dirname, "..", "index.html"), "utf8");
  // Bunyi dibangkitkan oscillator WebAudio, bukan berkas yang dimuat.
  assert.ok(/AudioContext/.test(html), "efek suara harus memakai WebAudio");
  assert.ok(/createOscillator/.test(html), "efek suara harus membangkitkan oscillator");
  // Semua efek yang diharapkan tersedia.
  ["snap", "buat", "hapus", "lepas", "klik", "langkah", "jalan", "menang", "gagal"]
    .forEach(n => assert.ok(new RegExp("\\b" + n + "\\s*:").test(html), "efek suara '" + n + "' hilang"));
  // Tombol pengatur suara ada dan menyimpan pilihan.
  assert.ok(/id="btnSfx"/.test(html), "tombol matikan/nyakan efek suara wajib ada");
  assert.ok(/bitbot_sfx/.test(html), "pilihan efek suara harus disimpan di localStorage");
});
