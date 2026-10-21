# BitBot Escape

Game edukasi **tanpa file gambar/suara**: papan petak digambar dengan Canvas (vektor dari token warna CSS).

## Struktur Folder

```
├── index.html          # UI + Blockly + generator blok->Python + Canvas board
├── engine.js           # Engine: parser, interpreter, scoring, level data
├── lib/                # Third-party libraries
│   └── blockly.min.js
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

Bunyi dibuat **on the fly** dengan WebAudio (oscillator) — tidak ada berkas audio yang
dimuat, sehingga aturan "tanpa berkas gambar/suara" tetap berlaku. Blockly sendiri tetap
bisu (`sounds: false`); efek bunyi berasal dari aplikasi.

| Efek | Kapan |
|------|-------|
| `snap` | Blok tersambung ke koneksi lain |
| `buat` / `hapus` / `lepas` | Blok dibuat, dihapus, atau dilepas |
| `klik` | Tombol ditekan |
| `jalan` | Program dijalankan |
| `langkah` | Maju satu perintah |
| `menang` / `gagal` | Level selesai / program salah |

Tombol 🔊 di baris kontrol mematikan/menyalakan efek suara; pilihan disimpan di
`localStorage`. Suara baru berbunyi setelah interaksi pertama (kebijakan autoplay peramban).

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
