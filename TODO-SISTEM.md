# TODO Sistem GESA

Checklist ini dipakai untuk melacak sisa pekerjaan lintas modul. Centang item setelah benar-benar selesai dan sudah lolos build/test.

## Konstruksi

- [x] Rapikan detail validasi admin per tahap agar field penggalian, pembesian, pengecoran, uji beton, pemasangan tiang, kabel, dan comissioning tampil terstruktur.
- [x] Saat admin validasi/reject, status titik di `kontruksi_design_tasks.zones` ikut berubah ke `valid` atau `rejected`.
- [x] Cegah satu titik+tahap submit berkali-kali tanpa konfirmasi.
- [x] Integrasikan kebutuhan material otomatis ke BMD/Gudang untuk tahap pemasangan tiang (`TIANG`, `ARM`, `LAMPU`) saat validasi admin.
- [x] Tambahkan kategori/material `KABEL` jika tahap pemasangan kabel juga harus otomatis mengurangi stok.
- [x] Tambahkan filter tahap/status di validasi admin konstruksi.
- [x] Tambahkan preview foto yang konsisten di daftar validasi dan data valid.

## BMD & Gudang

- [x] Cegah `Log Keluar` membuat transaksi keluar dobel untuk request yang sama.
- [x] Tambahkan status request lanjutan seperti `Dikeluarkan` atau `Selesai`.
- [x] Upload foto barang/aset asli, bukan hanya label foto.
- [x] Audit trail approval lengkap: siapa approve/tolak/log keluar, waktu, dan catatan.
- [x] Flow pengembalian BMD formal oleh peminjam/petugas.
- [x] Kunci request barang berdasarkan jenis pekerjaan konstruksi/O&M.

## O&M

- [x] Buat flow status laporan lengkap: `new`, `diproses`, `selesai`, `ditolak`.
- [x] Kirim notifikasi balik ke masyarakat/petugas saat status berubah.
- [x] Finalisasi perbedaan data form corrective dan preventive.
- [x] Tambahkan detail laporan admin/O&M yang rapi per jenis laporan.
- [x] Integrasikan kebutuhan barang O&M ke BMD/Gudang.

## Masyarakat

- [x] Buat tracking status laporan masyarakat sampai selesai.
- [x] Tampilkan timeline tindak lanjut laporan.
- [x] Pastikan scan barcode membaca link sistem + ID titik APJ dan langsung prefill form.

## Pemkab

- [x] Ganti peta visual sederhana menjadi peta geografis nyata dengan marker koordinat.
- [x] Tambahkan filter wilayah, status, dan rentang tanggal.
- [x] Tambahkan dashboard ringkasan SLA/progres laporan.

## Global

- [ ] Validasi ukuran/tipe file upload di semua modul.
- [ ] Ganti `alert` menjadi toast/modal konsisten.
- [ ] Tambahkan testing end-to-end untuk login, submit, validasi, upload, dan stok keluar.
- [ ] Rapikan teks mojibake/encoding yang masih muncul di beberapa halaman.
- [ ] Review role access tiap route agar role tidak bisa membuka modul yang bukan haknya.
