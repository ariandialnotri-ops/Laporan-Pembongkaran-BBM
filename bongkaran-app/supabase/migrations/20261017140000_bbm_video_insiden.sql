-- Lapor cepat (tombol tengah bar bawah): foto & video bercap waktu untuk laporan insiden / near miss /
-- kerusakan. Video direkam di aplikasi (maks. 30 detik, ±1 Mbps, tanpa suara) sehingga cukup batas 8 MB.
-- Video ikut folder daily-* sehingga terhapus pada cut-off foto tanggal 5 seperti foto lain.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'video/mp4', 'video/webm'],
    file_size_limit = 8388608
where id = 'bbm-evidence';
