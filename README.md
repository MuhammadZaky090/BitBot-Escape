# BitBot Escape

Game edukasi **tanpa file gambar/suara**: papan petak digambar dengan Canvas (vektor dari token warna CSS).

## Struktur Folder

```
├── frontend/          # File web (served by Apache/Nginx)
│   ├── index.html    # UI + Blockly + generator blok->Python + Canvas board
│   ├── engine.js     # Engine: parser, interpreter, scoring, level data
│   ├── lib/          # Third-party libraries
│   │   └── blockly.min.js
│   ├── admin.php     # Dashboard untuk melihat data siswa
│   ├── export.php    # Export CSV
│   └── .htaccess     # Security & redirects
├── backend/           # Server-side code (protected)
│   ├── api/
│   │   ├── health.php
│   │   └── submit.php
│   ├── config.php    # Database configuration
│   └── schema.sql    # Database schema
├── tests/
│   ├── engine.test.js
│   ├── ui.smoke.test.js
│   ├── fuzz.engine.test.js
│   ├── failure.injection.test.js
│   └── monkey.ui.test.js
└── docs/
    ├── FIELD_CHECKLIST.md
    └── STRESS_REPORT.md
```

## Menjalankan (Offline/Demo)

Buka `frontend/index.html` langsung di browser — tanpa server, tanpa internet, tanpa `npm install`.

## Menjalankan (Dengan Server + Telemetry)

1. Salin `backend/config.php` ke lokasi yang aman (di luar document root)
2. Buat database MySQL dan import `backend/schema.sql`
3. Konfigurasi web server:

### Apache (document root → frontend/)

```apache
DocumentRoot /path/to/bitbot-escape/frontend
<Directory /path/to/bitbot-escape/frontend>
    AllowOverride All
    Require all granted
</Directory>

# Lindungi backend dari akses langsung
<Directory /path/to/bitbot-escape/backend>
    Require all denied
</Directory>
```

### Atau gunakan PHP built-in server (development)

```bash
cd frontend
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
