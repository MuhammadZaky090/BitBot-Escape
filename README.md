# BitBot Escape

Game edukasi: papan petak digambar dengan Canvas (vektor dari token warna CSS, tanpa file
gambar), suara memakai berkas WAV lokal di `sounds/`.

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
├── api/                # Endpoint telemetry (webroot = root repo)
│   ├── submit.php      # Submit batch attempts
│   └── health.php      # Health check
├── .htaccess           # Security & redirects (Apache / cPanel)
├── frontend/           # Dokumen riset (dipakai sebagai "source" GitHub Pages)
│   ├── FIELD_CHECKLIST.md
│   └── STRESS_REPORT.md
├── backend/            # Server-side code (for PHP hosting)
│   ├── config.php      # Database configuration
│   └── schema.sql      # Database schema
├── tests/              # Test files
└── README.md
```

## Demo (GitHub Pages)

Buka https://[username].github.io/[repo]/

Game berjalan offline tanpa server.

## Menjalankan Lokal

Buka `index.html` langsung di browser — tanpa server, tanpa internet, tanpa `npm install`.

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

## Menjalankan Dengan Server + Telemetry

1. Buat database MySQL dan import `backend/schema.sql`
2. Konfigurasi `backend/config.php` dengan kredensial database
3. Jalankan dengan PHP built-in server:

```bash
php -S localhost:8000
# Buka http://localhost:8000
```

Halaman yang disajikan lewat HTTP(S) akan meminta **kode siswa** dan mengirim setiap
attempt ke `/api/submit.php`. Bila game dibuka langsung dari berkas (`file://`) tidak ada
server, sehingga modal identitas dan pengiriman data otomatis dilewati.

## API Telemetry

Setelah dikonfigurasi, setiap attempt siswa akan otomatis terkirim ke server:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/submit.php` | POST | Submit batch attempts |
| `/api/health.php` | GET | Health check |

## Tests

```bash
npm install
npm test
```

## Lisensi

MIT
