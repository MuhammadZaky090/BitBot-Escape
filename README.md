# BitBot Escape

Versi game yang **tidak memakai satu pun file gambar/suara**: papan petak digambar langsung
dengan Canvas (vektor dari token warna), jadi folder ini hanya berisi kode.

## Menjalankan

Buka `index.html` di browser — cukup dari `file://`, tanpa server, tanpa internet, tanpa `npm install`.

## Isi folder

| File | Peran |
| --- | --- |
| `index.html` | UI + Blockly + generator blok->Python + penggambar board vektor |
| `engine.js` | Engine murni (parser, interpreter, penilaian, data 3 level) — salinan identik dari `PuzzleGame/demo/engine.js` |
| `lib/blockly.min.js` | Blockly v11 lokal (UMD), tanpa CDN |
| `tests/engine.test.js` | 46 tes Node bawaan: engine, kontras tema, dan guard "tanpa aset" |
| `tests/ui.smoke.test.js` | 12 tes UI Playwright (auto-skip kalau Playwright belum terpasang) |
| `package.json` | Skrip `npm test` saja; nol dependensi |

Total folder 1,15 MB — 91 % nya adalah `blockly.min.js`.

## Perbedaan dengan `PuzzleGame/demo`

| | `PuzzleGame/demo` | edisi ini |
| --- | --- | --- |
| Board | sprite Kenney 16x16 (PNG, CC0) | digambar dengan kode: pelat nat+baut, dinding bata, pad tujuan + paket, roda gigi, robot beroda |
| Folder `assets/` | ada | tidak ada |
| Folder `lib/media/` (Blockly) | ada | tidak ada — aturan CSS yang meminta sprite/kursor dinetralkan, `sounds: false` |
| Level, misi, kuota, bintang, pesan galat | — | **sama persis** (engine disalin utuh) |

Bukti offline: memuat halaman + main sampai menang hanya meminta 3 file `file://`
(`index.html`, `engine.js`, `lib/blockly.min.js`), 0 permintaan keluar, 0 pesan konsol.

## Tes

```
node --test
```

Guard tanpa aset ada di `tests/engine.test.js`: ia gagal kalau `index.html` menyebut
ekstensi gambar/audio, memakai `new Image()`, merujuk `http(s)://`, atau kalau ada file aset
yang nyelip di folder ini.
