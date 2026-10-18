# BitBot Escape

Game edukasi **tanpa file gambar/suara**: papan petak digambar dengan Canvas (vektor dari token warna CSS).

## Struktur Folder

```
├── docs/               # Game files (served by GitHub Pages / web server)
│   ├── index.html      # UI + Blockly + generator blok->Python + Canvas board
│   ├── engine.js       # Engine: parser, interpreter, scoring, level data
│   ├── lib/            # Third-party libraries
│   │   └── blockly.min.js
│   └── .htaccess       # Security & redirects
├── backend/            # Server-side code (for PHP hosting)
│   ├── api/
│   │   ├── health.php  # Health check endpoint
│   │   └── submit.php  # Submit attempts endpoint
│   ├── config.php      # Database configuration
│   └── schema.sql      # Database schema
├── tests/              # Test files
└── README.md
```

## Demo (GitHub Pages)

Buka https://[username].github.io/[repo]/docs/

Game berjalan offline tanpa server.

## Menjalankan Lokal

Buka `docs/index.html` langsung di browser — tanpa server, tanpa internet, tanpa `npm install`.

## Menjalankan Dengan Server + Telemetry

1. Buat database MySQL dan import `backend/schema.sql`
2. Konfigurasi `backend/config.php` dengan kredensial database
3. Jalankan dengan PHP built-in server:

```bash
cd docs
php -S localhost:8000
# Buka http://localhost:8000
```

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
