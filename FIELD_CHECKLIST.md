# Panduan & Lembar Periksa Uji Lapangan (Field Study Checklist)
**BitBot Escape — Versi 0.3.1 (Build 2026.10.14)**  
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
  - Teks di bagian footer menampilkan versi: `BitBot Escape v0.3.1 (Build 2026.10.14)`.

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
- [ ] **Uji Tombol Ekspor CSV**:
  - Setelah menyelesaikan simulasi, klik tombol **"📥 Ekspor CSV"** di samping kontrol kecepatan.
  - Pastikan file `bitbot_escape_log_YYYY-MM-DD.csv` terunduh ke folder *Downloads*.
  - Buka file CSV tersebut di Microsoft Excel pada PC lab: pastikan kolom-kolom (Waktu, Level, Skor, Predikat, Jumlah Tabrakan, Petunjuk Terpakai, dan Kode Siswa) rapi dan tidak berantakan (UTF-8 BOM aman).

---

### 5. Cadangan & Media Distribusi Darurat (Rollback Copy on USB)
- [ ] **Flashdisk Master Peneliti**:
  - Siapkan minimal 2 buah flashdisk USB yang berisi folder utuh `BitBot Escape` (berisi `index.html`, `engine.js`, folder `lib/`, `package.json`, dan dokumentasi).
- [ ] **Salinan Standalone Offline**:
  - Pastikan folder di dalam flashdisk dapat langsung dibuka di PC mana pun tanpa memerlukan koneksi internet, instalasi Node.js, atau instalasi ekstensi apa pun.
- [ ] **Paket ZIP Cadangan**:
  - Sediakan file `BitBot_Escape_v0.3.1_Offline.zip` di flashdisk jika PC lab perlu didistribusikan melalui jaringan LAN sekolah (*file sharing* / NetSupport / Veyon).
- [ ] **Instruksi Ekstraksi Siswa**:
  - Jika mendistribusikan berkas ZIP, ingatkan siswa: *"Wajib klik kanan -> Extract All (Ekstrak Semua) terlebih dahulu sebelum membuka index.html agar pustaka Blockly termuat sempurna."*
