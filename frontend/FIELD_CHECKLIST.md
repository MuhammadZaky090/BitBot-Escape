# Panduan & Lembar Periksa Uji Lapangan (Field Study Checklist)
**BitBot Escape — Versi 0.4.0 (Build 2026.10.23)**  
*Daftar verifikasi fisik dan teknis langsung di laboratorium komputer sekolah (SMK Kelas 10/11 Fase E)*

Dokumen ini memuat langkah-langkah wajib yang harus diverifikasi oleh peneliti / guru pengampu secara manual pada perangkat PC laboratorium sekolah sebelum sesi penelitian pretest dan posttest dimulai.

---

## 📋 Checklist Verifikasi Laboratorium Komputer

### 1. Kompatibilitas Versi Browser Laboratorium (Oldest Browser Check)
- [ ] **Buka browser bawaan di PC tertua lab**: Pastikan PC laboratorium (termasuk PC berspesifikasi terendah atau beroperasi dengan Windows 7/10 lama) memiliki minimal salah satu browser modern:
  - Google Chrome versi ≥ 90
  - Microsoft Edge (Chromium) versi ≥ 90
  - Mozilla Firefox versi ≥ 88
- [ ] **Buka index.html secara lokal**: Klik dua kali berkas `index.html` dari folder lokal (protokol `file:///`).
- [ ] **Verifikasi rendering awal**:
  - Papan kanvas grid robot tampil utuh dengan warna kontras tajam.
  - Workspace visual Blockly termuat dengan toolbox kategori (Robot, Perulangan, Logika, Matematika).
  - Teks di bagian footer menampilkan versi: `BitBot Escape v0.4.0 (Build 2026.10.23)`.

---

### 2. Resolusi Layar & Tampilan Proyektor Guru (Display & Resolution Check)
- [ ] **Layar Siswa (Monitor 4:3 / 16:9)**:
  - Coba resolusi standar lab: `1366x768`, `1280x720`, atau `1024x768`.
  - Pastikan papan kanvas, blok workspace, dan dashboard HUD skor Berpikir Komputasional berada dalam satu tampilan tanpa mengharuskan siswa menggulir (*scroll*) horizontal.
- [ ] **Proyektor LCD Guru**:
  - Sambungkan laptop/PC guru ke proyektor LCD di depan kelas.
  - Periksa apakah teks kode Python hasil terjemahan di panel kanan terbaca jelas dari baris belakang kelas.
  - Pastikan warna dinding rintangan (border mencolok) dan petak tujuan hijau terlihat kontras pada sorotan lampu proyektor.

---

### 3. Kebijakan Profil Browser Bersama (Shared Browser Profile & Cache)
PC laboratorium sekolah umumnya dipakai bergantian oleh banyak kelas (*shared PC*). Lakukan prosedur berikut sebelum sesi penelitian:
- [ ] **Bersihkan LocalStorage sesi sebelumnya**:
  - Di browser PC siswa, tekan `F12` -> Buka tab **Application** (atau **Storage**) -> **Local Storage** -> Klik *Clear All* (atau jalankan `localStorage.clear()` di konsol).
  - Ini memastikan skor, petunjuk yang dibuka, dan blok kode siswa dari kelas sebelumnya tidak tertinggal ke siswa yang sedang diuji.
- [ ] **Nonaktifkan Ekstensi Pihak Ketiga**:
  - Pastikan tidak ada ekstensi penerjemah otomatis (*Google Translate extension*) atau adblocker agresif yang memodifikasi DOM halaman HTML secara acak.
- [ ] **Uji Mode Penyamaran (Incognito / InPrivate)**:
  - Buka game di jendela Incognito/Private. Pastikan game tetap dapat dijalankan dan fitur ekspor CSV tetap dapat mengunduh data percobaan.

---

### 4. Gladi Bersih Skenario Penuh (Full Pretest-to-Posttest Rehearsal)
Lakukan simulasi alur belajar 1 kali dari awal hingga akhir pada setidaknya 1 unit PC lab:
- [ ] **Level 1 (Sekuens Urutan)**: Susun perintah maju, belok kanan, belok kiri untuk mencapai bendera tujuan. Klik *Jalankan*. Dialog evaluasi kemenangan harus muncul dengan skor dan rincian rubrik.
- [ ] **Level 2 (Perulangan & Kuota Ketat)**: Buat solusi menggunakan blok `ulangi (repeat)`. Pastikan kuota ketat berhasil dilewati dan mendapatkan predikat *Mahir*.
- [ ] **Level 3 (Mode Kode Python Murni)**: Ketik kode di editor teks. Pastikan tombol Tab menyisipkan 4 spasi (bukan pindah fokus), dan tombol *Petunjuk* membuka arahan bertingkat.
- [ ] **Alur Pengambilan Data (penting — berubah di v0.4.0)**:
  - Mulai v0.4.0 **tombol "📥 Ekspor CSV" tidak lagi terpasang**; ekspor digantikan oleh
    **auto-submit ke server** (lihat Bagian 6).
  - Bila memakai mode **offline** (`file:///` tanpa server), data percobaan tetap
    tersimpan di `localStorage` browser dan dapat diunduh manual lewat DevTools:
    tekan `F12` → tab **Console** → tempel `eksporLogCSV()` → tekan Enter → file
    `bitbot_escape_log_YYYY-MM-DD.csv` terunduh.
  - Buka file CSV tersebut di Microsoft Excel pada PC lab: pastikan kolom-kolom (Waktu,
    Level, Skor, Predikat, Jumlah Tabrakan, Petunjuk Terpakai, dan Kode Siswa) rapi dan
    tidak berantakan (UTF-8 BOM aman).

---

### 6. Verifikasi Efek Suara di Labkom (Audio Check)
v0.4.0 menambahkan 10 efek suara (berkas WAV lokal di folder `sounds/`).
- [ ] **Klik pertama memunculkan bunyi**: buka `index.html`, klik satu blok di Blockly →
  terdengar bunyi "snap" (blok tersambung). *Catatan: peramban hanya mengizinkan suara
  setelah klik pertama — ini normal.*
- [ ] **Audio device aktif**: pastikan speaker PC lab tidak dalam mode mute dan volume
  Windows > 30%. Uji juga dengan headphone bila tersedia.
- [ ] **Tombol 🔊 berfungsi**: klik ikon 🔊 di baris kontrol → ikon berubah jadi 🔇
  (bisu) dan bunyi berhenti; klik lagi → 🔊 dan bunyi kembali.
- [ ] **Pilihan bertahan**: muat ulang halaman (F5) → ikon tetap 🔇 (status tersimpan di
  `localStorage`), lalu kembalikan ke 🔊 sebelum sesi uji.

---

### 7. Verifikasi Telemetry via Server Lokal (opsional, bila memakai Laragon/XAMPP)
Kalau guru memakai server lokal (bukan mode offline), pastikan data benar-benar masuk:
- [ ] **Health check**: buka `http://localhost/bitbot-escape/api/health.php` → harus
  menampilkan JSON `{"status":"ok","total_attempts":N}`.
- [ ] **Satu percobaan = satu baris**: main 1 level di `http://localhost/bitbot-escape/`
  dengan kode siswa → buka phpMyAdmin → database `bitbot_escape` → tabel `attempts` →
  `Browse` → jumlah baris bertambah 1.
- [ ] **Indikator status**: di baris kontrol, status berubah dari "Belum login" menjadi
  "✓ Terkirim" setelah percobaan selesai.
- [ ] **Jalur pandu**: `backend/PANDUAN-LARAGON.md` (pasang Laragon, import SQL, cek
  health endpoint, tabel troubleshooting).

---

### 5. Cadangan & Media Distribusi Darurat (Rollback Copy on USB)
- [ ] **Flashdisk Master Peneliti**:
  - Siapkan minimal 2 buah flashdisk USB yang berisi folder utuh `BitBot Escape`
    (berisi `index.html`, `engine.js`, folder `lib/`, folder `sounds/`, folder `api/`,
    folder `backend/`, `package.json`, dan dokumentasi).
- [ ] **Salinan Standalone Offline**:
  - Pastikan folder di dalam flashdisk dapat langsung dibuka di PC mana pun tanpa
    memerlukan koneksi internet, instalasi Node.js, atau instalasi ekstensi apa pun.
  - Pastikan folder `sounds/` ikut terbawa (10 berkas WAV, ±212 KB) — tanpa itu game tetap
    berjalan tetapi tanpa efek suara.
- [ ] **Paket ZIP Cadangan**:
  - Sediakan file `BitBot_Escape_v0.4.0_Offline.zip` di flashdisk jika PC lab perlu didistribusikan melalui jaringan LAN sekolah (*file sharing* / NetSupport / Veyon).
- [ ] **Instruksi Ekstraksi Siswa**:
  - Jika mendistribusikan berkas ZIP, ingatkan siswa: *"Wajib klik kanan -> Extract All (Ekstrak Semua) terlebih dahulu sebelum membuka index.html agar pustaka Blockly termuat sempurna."*
