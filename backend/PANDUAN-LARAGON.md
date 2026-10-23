# Panduan Menjalankan BitBot Escape di Laragon (untuk Pemula)

> Panduan ini ditulis untuk orang yang **belum pernah memakai Laragon** dan belum pernah
> membuka video tutorial. Setiap langkah berisi: **yang Anda lakukan** → **yang seharusnya
> terlihat** → **kalau gagal, apa yang harus dicek**.
>
> Kalau Anda lebih nyaman dengan XAMPP, ada tabel padanan di [Bagian 9](#9-epadanan-dengan-xampp).

---

## Ringkasan 10 Menit (versi-cepat)

| # | Yang harus dilakukan | Alamat / letak |
|---|----------------------|----------------|
| 1 | Pasang **Laragon Full** (bukan Portable) | https://laragon.org/download/ |
| 2 | Buka Laragon → klik **Start All** | Tombol hijau besar di kiri bawah |
| 3 | Salin folder repo ini → `C:\laragon\www\bitbot-escape\` | File Explorer |
| 4 | Salin `backend\config.sample.php` → `backend\config.php` (isi kredensial) | Notepad / VS Code |
| 5 | Buka http://localhost/phpmyadmin → **Import** → `backend\sql\impor-laragon.sql` | phpMyAdmin |
| 6 | Cek http://localhost/bitbot-escape/api/health.php | Harus menampilkan JSON `{"status":"ok",...}` |
| 7 | Buka http://localhost/bitbot-escape/ → main | Masukkan kode siswa |

Kalau langkah 1–7 beres, game + database sudah jalan.

---

## 1. Apa itu Laragon? (konteks 30 detik)

Laragon = **paket server lokal untuk Windows** dalam satu folder. Di dalamnya ada:

- **Apache** = server web (melayani halaman HTML/PHP)
- **MySQL** = server basis data (menyimpan data siswa)
- **PHP** = bahasa yang mengeksekusi `api/submit.php`
- **phpMyAdmin** = tampilan web untuk mengimpor SQL & melihat tabel

Semua berjalan di komputer Anda sendiri (**localhost**) — tidak perlu internet, tidak perlu
langganan. Setelah dihosting di cPanel, strukturnya sama persis, tinggal ganti nama host.

| | XAMPP (yang biasa Anda pakai) | Laragon |
|---|---|---|
| Server web | Apache | Apache (sama) |
| Basis data | MariaDB/MySQL | MySQL (sama) |
|PHP | Ya | Ya (bisa ganti versi) |
| phpMyAdmin | Ya | Ya |
| Domein lokal | `localhost` | `localhost` + bisa otomatis `nama-folder.test` |
| Port | 80 (bisa bentrok) | 80 (bisa diganti) |
| Timeout PHP | sering upsetting | tidak ada batas bawaan |
| Bawaan password MySQL | `root` / kosong | `root` / kosong |

Intinya: **Laragon = XAMPP yang lebih rapi dan lebih cepat**, dengan tampilan seragam
(tombol Start All) dan tanpa wizard yang membingungkan.

---

## 2. Memasang Laragon

1. Buka https://laragon.org/download/
2. Unduh **Laragon Full** (bukan "Portable"). Pilih "Laragon Full" yang memuat Apache,
   MySQL, PHP 8, dan phpMyAdmin.
3. Jalankan file `.exe`, biarkan lokasi instalasi **default** (`C:\laragon`).
   > Penting: **jangan** menaruhnya di `Program Files` — Windows butuh izin admin
   > untuk menulis di sana, dan Laragon bisa gagal start. `C:\laragon` aman.
4. Selesai. Buka Laragon dari Start Menu (ikonnya seperti tangga, atau cari "Laragon").

### Layar utama Laragon

```
┌──────────────────────────────────────────────────────────────┐
│ Laragon                                                     [?]│
│                                                              │
│                     (halaman kosong / icon)                  │
│                                                              │
│  http://bitbot-escape.test/                                   │
│  [ Start All ] [ Stop All ] [ Reload ]        Menu | Laragon │
└──────────────────────────────────────────────────────────────┘
```

Yang perlu Anda ingat:
- **Start All** (tombol hijau) = menyalakan Apache + MySQL + PHP.
- **Menu** (k kanan bawah) = pintasan ke MySQL, PHP, Tools, Terminal, phpMyAdmin.
- **?** (k kanan atas) = dokumentasi resmi (English).

---

## 3. Menyalakan Laragon (Start All)

1. Klik **Start All**.
2. Muncul notifikasi di pojok kanan bawah: *"Apache started"* dan *"MySQL started"*
   (pada versi tertentu keduanya otomatis menyala begitu Laragon dibuka — kalau
   sudah otomatis, tidak perlu klik apa-apa).
3. Browser akan terbuka otomatis ke `http://localhost`. **Belum apa-apa** — wajar,
   folder `www` masih kosong.

> **Kalau Apache tidak mau start:** biasanya karena **XAMPP masih jalan** dan keduanya
> memakai port 80. Buka XAMPP → klik **Stop** untuk Apache & MySQL → kembali ke Laragon
> → Start All. (Atau ganti port Laragon, lihat [Bagian 8](#8-masalah-yang-sering-terjadi).)

---

## 4. Menaruh file game

1. Buka File Explorer → `C:\laragon\www`.
2. Buat folder baru bernama **`bitbot-escape`**.
3. Salin **seluruh isi** folder repositori game ke dalam folder tersebut:

> **Tips:** folder `node_modules/` dan `tests/` tidak perlu ikut disalin untuk menjalankan
> game (hanya untuk pengembangan). Kalau ingin ringkas, hapus keduanya sebelum menyalin.

```
C:\laragon\www\bitbot-escape\
├── index.html          ← yang dibuka siswa
├── engine.js
├── lib\
│   └── blockly.min.js
├── sounds\             ← efek suara (WAV)
├── api\
│   ├── submit.php      ← endpoint telemetry
│   └── health.php
├── backend\
│   ├── config.sample.php
│   ├── config.php      ← (nanti Anda buat sendiri, langkah 5)
│   └── sql\
│       └── impor-laragon.sql
└── frontend\, tests\, tools\, .htaccess, README.md
```

> **Kenapa seluruh repo, bukan cuma `index.html`?**
> Halaman game mengambil `api/submit.php` dan `sounds/*.wav` dari folder yang sama.
> Kalau hanya `index.html` yang disalin, game tetap jalan tetapi **tidak ada telemetry**
> dan **tidak ada suara**.

---

## 5. Membuat `backend/config.php` (kredensial database)

1. Di folder `C:\laragon\www\bitbot-escape\backend\`, cari file
   **`config.sample.php`**.
2. Klik kanan → **Salin** (Copy), lalu **Tempel** (Paste) di folder yang sama.
   Hasilnya ada file baru bernama `config.php`.
3. Buka `config.php` dengan Notepad (klik kanan → Open with → Notepad).
4. Ganti bagian ini:

```php
'db_host'     => '127.0.0.1',
'db_name'     => 'bitbot_escape',
'db_user'     => 'root',
'db_pass'     => '',
```

Keterangan:
- `127.0.0.1` = komputer ini sendiri. **Bawaan Laragon.**
- `bitbot_escape` = nama database yang akan dibuat di langkah 6.
- `root` = user MySQL bawaan Laragon.
- `''` = password **kosong** (Laragon tidak memasang password default). Kalau
  phpMyAdmin meminta password, **tekan Enter saja**.
- Untuk **cPanel/hosting**, isilah dengan data dari panel hosting Anda
  (`db_name` & `db_user` biasanya berawalan `cpanel_akun_`).

5. Simpan (Ctrl+S). File `config.php` **tidak** ikut ter-upload ke GitHub (sudah
   masuk `.gitignore`) — aman.

---

## 6. Mengimpor SQL (membuat database & tabel)

1. Pastikan Laragon sudah **Start All** (MySQL hijau).
2. Klik **Menu** → **Tools** → **phpMyAdmin**. Browser membuka
   `http://localhost/phpmyadmin`.
3. Di phpMyAdmin, klik tab **Import** (di paling atas).
4. Klik **Choose File** → pilih
   `C:\laragon\www\bitbot-escape\backend\sql\impor-laragon.sql`.
5. Pastikan formatnya **SQL** (biasanya sudah otomatis) → klik **Go** (tombol
   di bagian bawah).
6. **Yang seharusnya terlihat:** pesan hijau *"#1 … CREATE DATABASE"* dan
   *"#2 … USE bitbot_escape"*, lalu daftar tabel di kiri berisi **`attempts`**.
7. Klik database **`bitbot_escape`** di panel kiri → tabel **`attempts`** → you'll
   melihat header kolom dan 0 baris data. Itu benar.

> **Gagal dengan pesan "Unknown collation"?** MySQL Anda terlalu lama.
> Buka `backend/schema.sql`, hapus baris `COLLATE utf8mb4_unicode_ci` (pakai
> `utf8mb4_general_ci`), lalu import ulang.
>
> **Gagal dengan "Access denied"?** phpMyAdmin sudah login dengan user lain.
> Keluar dulu (ikon logout di pojok kiri atas), lalu masuk dengan user `root`,
> password **kosong**.

---

## 7. Menjalankan & menguji

### 7a. Cek API dulu (penting — ini yang sering gagal diam-diam)

Buka di browser:

```
http://localhost/bitbot-escape/api/health.php
```

**Yang seharusnya terlihat** (satu baris JSON):

```json
{"status":"ok","total_attempts":0,"server_time":"2026-10-23T20:15:00+07:00"}
```

Kalau muncul `{"status":"error","message":"config.php tidak ditemukan"}` →
`backend/config.php` belum dibuat (langkah 5) atau salah nama.
Kalau muncul **404** → folder tidak berada di `C:\laragon\www\bitbot-escape\`
(langkah 4) atau Apache belum jalan.

### 7b. Mainkan gamenya

Buka:

```
http://localhost/bitbot-escape/
```

- Modal **"Identitas Siswa"** muncul → isi kode (misal `X-TKJ1-01`) → **Mulai Bermain**.
  (Kode siswa hanya untuk memisahkan rekaman tiap siswa saat penelitian.)
- Susun blok di Blockly → klik **Jalankan** → dengar efek suara, papan bergerak.
- Indikator di baris bawah berubah dari "Belum login" → "✓ Terkirim".

### 7c. Pastikan data benar-benar masuk

1. Buka phpMyAdmin → database `bitbot_escape` → tabel `attempts` → klik **Browse**.
2. **Yang seharusnya terlihat:** ada 1 baris (atau lebih) berisi kode siswa, level,
   hasil (`win`/`fail`), skor, dan waktu penerimaan.
3. Kalau tabel kosong: tekan **Refresh** di phpMyAdmin (data dikirim otomatis
   ~1 detik setelah percobaan selesai).

> **Penting — kenapa harus lewat `http://localhost`, bukan klik dua kali file?**
> Kalau `index.html` dibuka langsung (protokol `file:///`), browser tidak mengizinkan
> PHP bekerja, jadi **telemetry dan identitas siswa otomatis dimatikan** ( disengaja).
> Untuk uji lapangan di lab tanpa server, mode ini tetap dipakai — hanya saja
> rekamannya tidak masuk ke database (unduh CSV manual, lihat catatan di README).

---

## 8. Masalah yang sering terjadi

| Gejala | Penyebab | Solusi |
|---|---|---|
| Halaman `http://localhost` tidak terbuka | Apache belum start | Klik **Start All** |
| "Port 80 in use" saat start | XAMPP masih jalan | Stop Apache & MySQL di XAMPP, lalu Start All di Laragon |
| 404 di `/bitbot-escape/api/health.php` | Salah letak folder / Apache belum start | Pastikan ada di `C:\laragon\www\bitbot-escape\`, cek folder `www` |
| `{"status":"error","message":"config.php tidak ditemukan"}` | `backend/config.php` belum ada | Ulangi langkah 5 (salin dari `config.sample.php`) |
| "Error establishing a database connection" | Kredensial salah / database belum ada | Cek `db_name` = `bitbot_escape`, `db_user` = `root`, `db_pass` = kosong; pastikan langkah 6 sudah |
| phpMyAdmin minta password | Default Laragon = kosong | Tekan Enter / biarkan kosong, user `root` |
| Import SQL gagal "Unknown collation" | MySQL versi lama | Pakai `utf8mb4_general_ci` di schema.sql |
| Halaman game kosong/berantakan | Bundle file game belum utuh | Salin ulang seluruh isi repo ke `www\bitbot-escape\` |
| Tidak ada suara | Audio device lab mute / belum ada interaksi | Klik dulu di halaman; bunyi baru mulai setelah klik pertama |
| Data tidak masuk database | Game dibuka lewat `file:///` | Buka lewat `http://localhost/bitbot-escape/` |
| File `.sql`/`.md` bisa diakses lewat browser | `.htaccess` diabaikan server | Buka `C:\laragon\etc\apache2\httpd.conf`, cari blok `<Directory "C:/laragon/www">`, pastikan ada `AllowOverride All`, lalu klik **Menu → Apache → Reload** |

---

## 9. Padanan dengan XAMPP

| Yang dilakukan di Laragon | Padanan di XAMPP |
|---|---|
| Klik **Start All** | Buka XAMPP Control Panel → klik **Start** Apache + MySQL |
| Folder web: `C:\laragon\www\` | Folder web: `C:\xampp\htdocs\` |
| Salin game ke `www\bitbot-escape\` | Salin game ke `htdocs\bitbot-escape\` |
| Menu → Tools → phpMyAdmin | Buka `http://localhost/phpmyadmin` |
| File konfigurasi: `C:\laragon\etc\apache2\httpd.conf` | `C:\xampp\apache\conf\httpd.conf` |
| Error log Apache: Menu → Apache → Error log | `C:\xampp\apache\logs\error.log` |
| Error log MySQL: `C:\laragon\data\mysql\*.err` | `C:\xampp\mysql\data\*.err` |
| Ganti versi PHP: Menu → PHP → Version | Buka `php.ini` di `C:\xampp\php\php.ini` |

> Boonus Laragon: folder `C:\laragon` bisa **disalin ke flashdisk** dan dijalankan di
> PC lab mana pun (Laragon portabel) — berguna untuk uji lapangan tanpa instalasi.

---

## 10. Checklist sebelum naik kelas

- [ ] Laragon **Start All** → tidak ada notifikasi error
- [ ] `http://localhost/bitbot-escape/` terbuka, board & Blockly tampil
- [ ] `http://localhost/bitbot-escape/api/health.php` → `{"status":"ok"}`
- [ ] `backend/config.php` ada (dan **tidak** ikut ter-commit ke Git)
- [ ] phpMyAdmin → tabel `attempts` bertambah 1 baris setelah satu percobaan
- [ ] Tombol 🔊 berfungsi (mute/unmute), suara terdengar
- [ ] Kode siswa bisa diisi & tombol "Mulai Bermain" menutup modal
- [ ] Kalau memakai hosting: **domain/akun** + PHP 8 + MySQL aktif, lalu
      `backend/config.php` diisi kredensial hosting, dan `backend/sql/impor-laragon.sql`
      diimport **tanpa** baris `CREATE DATABASE` (gunakan `backend/schema.sql`)

---

## 11. File yang perlu Anda edit untuk ganti server (hanya untuk hosting)

Kalau nanti game dipindah ke hosting berbayar (cPanel/hostinger), yang berubah hanya:

1. `backend/config.php` → isi `db_host`, `db_name`, `db_user`, `db_pass` dari panel hosting.
2. Upload **seluruh isi repo** ke `public_html/`.
3. Di phpMyAdmin cPanel: buat database + user, grant semua hak akses, lalu import
   `backend/schema.sql` (file yang **tidak** membuat database).
4. Selesai — `https://domain-anda/index.html` sudah menerima telemetry.
