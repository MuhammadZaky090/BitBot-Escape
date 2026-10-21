/* =====================================================================
   Generator efek suara BitBot Escape — tools/generate-sounds.js
   ---------------------------------------------------------------
   Membuat berkas WAV mono 16-bit di folder sounds/ tanpa dependensi
   eksternal: semua bunyi disintesis dari oscillator + amplop
   (envelope) di Node, lalu ditulis sebagai berkas PCM.

   Jalankan ulang bila ingin mengubah nada/-volume:
       node tools/generate-sounds.js

   Hasil: sounds/*.wav  (dipakai index.html lewat <audio>)
   ===================================================================== */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const SR = 44100;            // frekuensi sampel
const KELUAR = path.join(__dirname, '..', 'sounds');

/* ---------- utilitas ---------- */

// Tulis Float32Array (-1..1) menjadi berkas WAV PCM 16-bit mono.
function tulisWav(nama, sampel) {
  const n = sampel.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);          // ukuran blok fmt
  buf.writeUInt16LE(1, 20);           // PCM
  buf.writeUInt16LE(1, 22);           // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);      // byte per detik
  buf.writeUInt16LE(2, 32);           // perataan blok
  buf.writeUInt16LE(16, 34);          // bit per sampel
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, sampel[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  fs.writeFileSync(path.join(KELUAR, nama), buf);
  return buf.length;
}

// Puncak dinormalisasi ke `target` supaya semua efek punya kekuatan yang mirip.
function normalisasi(sampel, target = 0.88) {
  let puncak = 0;
  for (const v of sampel) puncak = Math.max(puncak, Math.abs(v));
  if (puncak > 0) {
    const k = target / puncak;
    for (let i = 0; i < sampel.length; i++) sampel[i] *= k;
  }
  return sampel;
}

// Gabungkan beberapa lapisan ke dalam satu buffer (panjang = yang terpanjang).
function gabung(...lapisan) {
  const n = Math.max(...lapisan.map(l => l.length));
  const out = new Float32Array(n);
  for (const lap of lapisan) for (let i = 0; i < lap.length; i++) out[i] += lap[i];
  return out;
}

// Geser buffer ke kanan (delay) — berguna untuk memberi jarak antar nada.
function geser(sampel, ms) {
  const d = Math.round(SR * ms / 1000);
  const out = new Float32Array(sampel.length + d);
  out.set(sampel, d);
  return out;
}

/* ---------- sintesis dasar ---------- */

// Satu nada dengan slide frekuensi (f0 -> f1) dan amplop attack/decay.
function nada({ f0, f1 = f0, dur, jenis = 'sine', vol = 0.5, attack = 0.004, tau = null }) {
  const n = Math.max(1, Math.round(SR * dur));
  const out = new Float32Array(n);
  const konstanta = tau === null ? dur * 0.45 : tau;
  let fase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = f0 + (f1 - f0) * (i / n);
    fase += 2 * Math.PI * f / SR;
    const x = (fase / (2 * Math.PI)) % 1;
    let s;
    if (jenis === 'sine') s = Math.sin(fase);
    else if (jenis === 'tri') s = 4 * Math.abs(x - 0.5) - 1;
    else if (jenis === 'square') s = x < 0.5 ? 1 : -1;
    else if (jenis === 'saw') s = 2 * x - 1;
    else s = Math.sin(fase);
    const a = Math.min(1, t / attack);
    const d = Math.exp(-t / konstanta);
    out[i] = s * a * d * vol;
  }
  return out;
}

// Derau putih pendek (untuk "klik"/"snap" Mechanical).
function derau({ dur = 0.04, vol = 0.2, seed = 1 }) {
  const n = Math.max(1, Math.round(SR * dur));
  const out = new Float32Array(n);
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;      // LCG agar hasil deterministik
    const white = (s / 0x3fffffff) - 1;
    const t = i / SR;
    out[i] = white * Math.exp(-t / (dur * 0.3)) * vol;
  }
  return out;
}

/* ---------- daftar efek ---------- */

const EFEK = {
  // Klik tombol antarmuka: pendek dan kering.
  'click': () => gabung(
    nada({ f0: 1200, f1: 820, dur: 0.045, jenis: 'square', vol: 0.30, tau: 0.018 }),
    derau({ dur: 0.02, vol: 0.10, seed: 7 })
  ),

  // Blok tersambung ke koneksi lain: bunyi "klik" mekanis yang brighten.
  'snap': () => gabung(
    nada({ f0: 760, f1: 1560, dur: 0.11, jenis: 'tri', vol: 0.55, tau: 0.045 }),
    nada({ f0: 1520, f1: 3120, dur: 0.05, jenis: 'sine', vol: 0.16, tau: 0.02 }),
    derau({ dur: 0.03, vol: 0.12, seed: 19 })
  ),

  // Blok baru dibuat: nada naik lembut.
  'create': () => gabung(
    nada({ f0: 540, f1: 900, dur: 0.09, jenis: 'tri', vol: 0.40, tau: 0.04 })
  ),

  // Blok dihapus: nada turun.
  'delete': () => gabung(
    nada({ f0: 430, f1: 150, dur: 0.18, jenis: 'saw', vol: 0.30, tau: 0.07 })
  ),

  // Blok dilepas dari koneksi: sangat pendek.
  'detach': () => gabung(
    nada({ f0: 320, f1: 240, dur: 0.06, jenis: 'sine', vol: 0.26, tau: 0.025 })
  ),

  // Maju satu langkah program: tik kecil.
  'step': () => gabung(
    nada({ f0: 1750, f1: 1350, dur: 0.04, jenis: 'sine', vol: 0.24, tau: 0.016 })
  ),

  // Program mulai dijalankan: arpeggio naik tiga nada.
  'run': () => gabung(
    nada({ f0: 523.25, dur: 0.16, jenis: 'tri', vol: 0.34, tau: 0.09 }),
    geser(nada({ f0: 659.25, dur: 0.16, jenis: 'tri', vol: 0.34, tau: 0.09 }), 70),
    geser(nada({ f0: 783.99, dur: 0.22, jenis: 'tri', vol: 0.34, tau: 0.11 }), 140)
  ),

  // Level selesai: arpeggio maior empat nada + shimmer.
  'win': () => gabung(
    nada({ f0: 523.25, dur: 0.24, jenis: 'tri', vol: 0.30, tau: 0.13 }),
    geser(nada({ f0: 659.25, dur: 0.24, jenis: 'tri', vol: 0.30, tau: 0.13 }), 110),
    geser(nada({ f0: 783.99, dur: 0.26, jenis: 'tri', vol: 0.30, tau: 0.14 }), 220),
    geser(nada({ f0: 1046.5, dur: 0.55, jenis: 'tri', vol: 0.32, tau: 0.26 }), 330),
    geser(nada({ f0: 2093, dur: 0.45, jenis: 'sine', vol: 0.08, tau: 0.18 }), 330)
  ),

  // Program salah / menabrak: nada turun bergerigi.
  'error': () => gabung(
    nada({ f0: 280, f1: 150, dur: 0.34, jenis: 'square', vol: 0.22, tau: 0.16 }),
    nada({ f0: 140, f1: 96, dur: 0.34, jenis: 'tri', vol: 0.20, tau: 0.16 })
  ),

  // Level berikutnya: nada naik singkat.
  'levelup': () => gabung(
    nada({ f0: 659.25, dur: 0.14, jenis: 'tri', vol: 0.30, tau: 0.08 }),
    geser(nada({ f0: 987.77, dur: 0.26, jenis: 'tri', vol: 0.30, tau: 0.12 }), 90)
  )
};

/* ---------- jalankan ---------- */

fs.mkdirSync(KELUAR, { recursive: true });
let total = 0;
for (const [nama, buat] of Object.entries(EFEK)) {
  const sampel = normalisasi(buat());
  const ukuran = tulisWav(nama + '.wav', sampel);
  total += ukuran;
  console.log('  ' + nama.padEnd(8) + ' ' + (sampel.length / SR).toFixed(2) + ' dtk  ' +
              (ukuran / 1024).toFixed(1) + ' KB');
}
console.log('Total ' + (total / 1024).toFixed(1) + ' KB di ' + KELUAR);
