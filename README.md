# Tidigo — Keuangan Minishop

Website keuangan dengan tiga menu: Ringkasan, Transaksi, dan Laporan. Dibuat menggunakan React + Vite, Vercel Functions, dan Vercel Blob **private**.

## Fitur

- Ringkasan pemasukan, pengeluaran, saldo, grafik, dan rekap bulanan.
- Pemasukan manual: tanggal, nominal, keterangan, dan bukti wajib.
- Pengeluaran manual dengan kategori dan bukti opsional.
- Lampiran privat JPG, PNG, PDF, TXT, atau CSV maksimal 2 MB per transaksi.
- Bukti dapat dibuka melalui rincian transaksi dan daftar Bukti transaksi di menu Laporan.
- Dua akses: pengelola dan pembaca. File bukti hanya dapat diunduh pengelola.
- Pembatalan dengan alasan, saldo awal, status kelengkapan, dan jejak perubahan.
- Data bersama lintas perangkat dengan conditional writes untuk mencegah perubahan saling menimpa.
- Data contoh terpisah dan tidak disimpan sebagai transaksi nyata.

## Menjalankan

Node.js 24, pnpm. `pnpm install`, lalu `pnpm dev` untuk UI. Jalankan `vercel dev` untuk UI beserta API, setelah proyek terhubung dan variabel lingkungan tersedia. `pnpm test` menguji aturan keuangan dan sesi. `pnpm build` membuat bundle produksi.

## Deployment Vercel

1. Hubungkan repositori ke proyek Vercel, preset Vite, Node.js 24.
2. Buat Blob store **private**, hubungkan ke proyek. CLI: `vercel blob create-store tidigo-minishop-private --access private --region sin1 --yes`.
3. Atur variabel lingkungan server: `ADMIN_PASSWORD` (minimal 16 karakter acak), `VIEWER_PASSWORD` (minimal 16 karakter, berbeda dari admin), `SESSION_SECRET` (minimal 32 karakter acak). `BLOB_READ_WRITE_TOKEN` atau `BLOB_STORE_ID` disediakan integrasi Blob.
4. Deploy: `vercel --prod`. Perubahan GitHub berikutnya otomatis memicu deployment.

Jangan commit `.env*`, `.local`, token, kata sandi, laporan asli, atau data transaksi. Sesi memakai cookie HttpOnly/Secure/SameSite, berlaku 8 jam. Rotasi salah satu kata sandi/secret membatalkan sesi lama. Percobaan login dibatasi 12 kali per alamat IP dalam 15 menit melalui penyimpanan bersama; berkas pembatasan lama di `security/` dapat dibersihkan berkala oleh pemilik.

## Pencatatan dan bukti

Impor GoPay sudah diganti dengan pemasukan manual. Endpoint impor baru ditolak; arsip dan transaksi impor terdahulu tetap dapat dibaca dan dibatalkan. Parser lama dipertahankan untuk kompatibilitas riwayat dan pengujian.

Jumlah yang dimasukkan adalah rupiah bulat yang diterima/dikeluarkan. File yang dilampirkan menjadi bukti, bukan sumber perhitungan otomatis. Gambar/PDF diperiksa tanda tangan formatnya; TXT/CSV harus berupa teks UTF-8 yang valid. Pembaca dapat melihat ketersediaan bukti, tetapi berkasnya hanya dapat dibuka pengelola.

Tanpa saldo awal, ringkasan menunjukkan arus kas bersih. Koreksi dilakukan dengan membatalkan catatan lama dan memasukkan catatan yang benar. Saldo website bukan saldo bank atau GoPay.

Ledger JSON privat cocok untuk volume minishop kecil. Untuk volume besar, gunakan database transaksional dan pagination. Kegagalan penyimpanan ledger setelah unggah bukti bisa meninggalkan file tanpa referensi, tetapi tidak menghasilkan pencatatan keuangan sebagian.

## Privasi dan pemulihan

Catatan nyata hanya tersedia setelah login. Demo dapat dilihat tanpa login. Pembaca tidak menerima lokasi file privat atau ID transaksi GoPay. Unduh CSV untuk rekap, dan ekspor `ledger/main.json` melalui dashboard Blob sebagai cadangan lengkap beserta file `reports/` dan `receipts/`. Audit sebelum/sesudah tersimpan dalam ledger privat. Tidak ada laporan asli yang disertakan dalam repositori.

Logo disediakan oleh pemilik Tidigo.
