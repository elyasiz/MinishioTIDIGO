# Tidigo — Keuangan Minishop

Website keuangan dengan tiga menu: Ringkasan, Transaksi, dan Laporan. Dibuat menggunakan React + Vite, Vercel Functions, dan Vercel Blob **private**.

## Fitur

- Ringkasan pemasukan, pengeluaran, saldo tercatat, grafik, dan rekap bulanan.
- Impor TXT/CSV bertabel dengan pemetaan kolom, pratinjau, deteksi duplikasi, dan konfirmasi.
- Pencatatan pengeluaran, bukti JPG/PNG/PDF privat (maks. 2 MB).
- Dua akses: pengelola dan pembaca. File sumber/bukti hanya dapat diunduh pengelola.
- Pembatalan transaksi/impor, saldo awal, konfirmasi kelengkapan, dan jejak perubahan.
- Penyimpanan bersama lintas perangkat; conditional writes mencegah perubahan saling menimpa.
- Data contoh terpisah di memori browser, tidak disimpan sebagai transaksi nyata.

## Menjalankan

Node.js 24, pnpm. `pnpm install`, lalu `pnpm dev` untuk UI. Jalankan `vercel dev` untuk UI beserta API, setelah proyek terhubung dan variabel lingkungan tersedia. `pnpm test` menguji aturan keuangan dan sesi. `pnpm build` membuat bundle produksi.

## Deployment Vercel

1. Hubungkan repositori ke proyek Vercel, preset Vite, Node.js 24.
2. Buat Blob store **private**, hubungkan ke proyek. CLI: `vercel blob create-store tidigo-minishop-private --access private --region sin1 --yes`.
3. Atur variabel lingkungan server: `ADMIN_PASSWORD` (minimal 16 karakter acak), `VIEWER_PASSWORD` (minimal 16 karakter, berbeda dari admin), `SESSION_SECRET` (minimal 32 karakter acak). `BLOB_READ_WRITE_TOKEN` atau `BLOB_STORE_ID` disediakan integrasi Blob.
4. Deploy: `vercel --prod`. Perubahan GitHub berikutnya otomatis memicu deployment.

Jangan commit `.env*`, `.local`, token, kata sandi, laporan asli, atau data transaksi. Sesi memakai cookie HttpOnly/Secure/SameSite, berlaku 8 jam. Rotasi salah satu kata sandi/secret membatalkan sesi lama. Percobaan login dibatasi 12 kali per alamat IP dalam 15 menit melalui penyimpanan bersama; berkas pembatasan lama di `security/` dapat dibersihkan berkala oleh pemilik.

## Format laporan dan batasan yang disengaja

**Format `report.txt` GoPay asli belum diberikan.** Parser awal menerima tabel dengan judul kolom dan pemisah tab, titik koma, koma, atau `|`. Kolom wajib: ID transaksi unik, tanggal, nominal, status. Pengelola mencocokkan kolom sebelum impor. Contoh sintetis ada di `public/contoh-format.txt`; ini bukan spesifikasi resmi GoPay.

Nominal dalam rupiah bulat, angka tanpa pemisah atau format Indonesia (`125.000,00`). Tanggal ISO atau DD/MM/YYYY. Status sukses dihitung, gagal/tertunda dilewati, status tidak dikenal/refund harus diperiksa. Laporan pencairan tidak boleh diimpor sebagai penjualan. Bila biaya tidak tersedia, UI menandainya; jangan mengasumsikan biaya nol. Pilihan bruto mengurangi biaya yang tersedia satu kali, pilihan bersih tidak menguranginya lagi.

Sebelum memakai laporan nyata, validasi parser terhadap satu laporan asli. Saldo website bukan saldo bank atau saldo GoPay. Tanpa saldo awal, UI menunjukkan arus kas bersih. Koreksi dilakukan dengan membatalkan catatan lama lalu mencatat ulang data yang benar, tanpa menghapus riwayat.

Ledger disimpan sebagai JSON privat, cocok untuk minishop dengan volume kecil. File sumber dan bukti terpisah. Maksimal 10.000 baris dan 2 MB per impor. Untuk volume besar, pindahkan penyimpanan ledger ke database transaksional serta tambahkan pagination. Kegagalan penyimpanan ledger setelah unggah bukti dapat meninggalkan file tanpa referensi; tidak menghasilkan pencatatan keuangan sebagian. File semacam itu hanya dapat diakses pemilik store.

## Privasi dan pemulihan

Catatan nyata hanya tersedia setelah login. Demo dapat dilihat tanpa login. Pembaca tidak menerima lokasi file privat atau ID transaksi GoPay. Unduh CSV untuk rekap, dan ekspor `ledger/main.json` melalui dashboard Blob sebagai cadangan lengkap beserta file `reports/` dan `receipts/`. Audit sebelum/sesudah tersimpan dalam ledger privat. Tidak ada laporan asli yang disertakan dalam repositori.

Logo disediakan oleh pemilik Tidigo.
