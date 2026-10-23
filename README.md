# BitBot Escape

**Versi 0.4.0 (Build 2026.10.23)** — game edukasi: papan petak digambar dengan Canvas
(vektor dari token warna CSS, tanpa file gambar), suara memakai berkas WAV lokal di
`sounds/`.

## Struktur Folder

```
├── index.html          # UI + Blockly + generator blok->Python + Canvas board
├── engine.js           # Engine: parser, interpreter, scoring, level data
├── lib/                # Third-party libraries
│   └── blockly.min.js
├── sounds/             # Efek suara (WAV mono hasil sintesis, lokal)
│   ├── click.wav  snap.wav  create.wav  delete.wav  detach.wav
│   ├── step.wav   run.wav   win.wav    error.wav   levelup.wav
├── tools/
│   └── generate-sounds.js  # Membuat ulang berkas WAV di sounds/ (tanpa dependensi)
├── api/                # Endpoint telemetry (harus di web root / folder game)
│   ├── submit.php      # Submit batch attempts
│   └── health.php      # Health check
├── .htaccess           # Security & redirects (Apache / cPanel / Laragon)
├── frontend/           # Dokumen riset
│   ├── FIELD_CHECKLIST.md
│   └── STRESS_REPORT.md
├── backend/            # Server-side code (untuk hosting PHP / Laragon)
│   ├── config.sample.php  # TEMPLAT konfigurasi (salin → config.php)
│   ├── config.php         # Konfigurasi asli (TIDAK ikut di-commit)
│   ├── schema.sql         # Skema tabel attempts (untuk cPanel)
│   ├── sql/
│   │   └── impor-laragon.sql  # SQL siap impor untuk Laragon/XAMPP
│   └── PANDUAN-LARAGON.md    # Panduan setup untuk pemula
├── tests/              # Test files
└── README.md
```

## Demo (GitHub Pages)

Buka https://muhammadzaky090.github.io/BitBot-Escape/

Game berjalan offline tanpa server (telemetry otomatis nonaktif di hosting statis —
PHP tidak bisa jalan di GitHub Pages).

## Menjalankan Lokal

Buka `index.html` langsung di browser — tanpa server, tanpa internet, tanpa `npm install`.

## Menjalankan Dengan Server + Telemetry (Laragon / XAMPP / hosting)

**Pemula? Ikuti [`backend/PANDUAN-LARAGON.md`](backend/PANDUAN-LARAGON.md)** — panduan
langkah demi langkah (pasang Laragon → Start All → salin file → import SQL → cek
`api/health.php` → main), lengkap dengan tabel padanan XAMPP dan daftar masalah umum.

Ringkasnya:

1. Salin **seluruh isi repo** ke folder web server, misal
   `C:\laragon\www\bitbot-escape\` (folder game + `api/` + `backend/`).
2. Salin `backend/config.sample.php` → `backend/config.php`, isi `db_host`, `db_name`,
   `db_user`, `db_pass`.
3. Import `backend/sql/impor-laragon.sql` lewat phpMyAdmin (file ini sekaligus membuat
   database `bitbot_escape` + tabel `attempts`). Untuk cPanel, buat database dulu di
   panel lalu import `backend/schema.sql`.
4. Jalankan Apache + MySQL, buka `http://localhost/bitbot-escape/`.

Alternatif tanpa Apache (hanya untuk mencoba, PHP built-in server):

```bash
php -S localhost:8000
# Buka http://localhost:8000
```

Halaman yang disajikan lewat HTTP(S) akan meminta **kode siswa** dan mengirim setiap
attempt ke `api/submit.php`. Bila game dibuka langsung dari berkas (`file://`) tidak ada
server, sehingga modal identitas dan pengiriman data otomatis dilewati.

## Efek Suara

Bunyi memakai **berkas WAV lokal** di `sounds/` — tidak ada permintaan ke luar jaringan.
Blockly sendiri tetap bisu (`sounds: false`); semua bunyi berasal dari aplikasi.

| Efek | Kapan berbunyi |
|------|----------------|
| `snap` | Blok tersambung ke koneksi lain |
| `create` | Blok baru dibuat |
| `delete` | Blok dihapus |
| `detach` | Blok dilepas dari koneksi |
| `click` | Tombol ditekan |
| `step` | Maju satu perintah |
| `run` | Program dijalankan |
| `win` | Level selesai |
| `error` | Program salah / menabrak |
| `levelup` | Pindah ke level berikutnya |

Tombol 🔊 di baris kontrol mematikan/menyalakan efek suara; pilihan disimpan di
`localStorage` (`bitbot_sfx`). Suara baru berbunyi setelah interaksi pertama (kebijakan
autoplay peramban).

Berkas WAV dibuat oleh skrip Node tanpa dependensi — ubah nadanya lalu jalankan ulang:

```bash
node tools/generate-sounds.js
```

## API Telemetry

Setelah dikonfigurasi, setiap attempt siswa akan otomatis terkirim ke server:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `api/submit.php` | POST | Submit batch attempts |
| `api/health.php` | GET | Health check (`{"status":"ok","total_attempts":N}`) |

Kredensial database dibaca dari `backend/config.php` (diabaikan Git) — salin dari
`backend/config.sample.php`.

## Tests

```bash
npm install
npm test
```

## Lisensi

MIT
