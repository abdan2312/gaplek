# Gaplek Online

Game domino (gaplek) 4 pemain, multiplayer, dimainkan lewat browser di Windows dan Android.
Kursi kosong diisi bot. Server memegang semua kartu, jadi kartu lawan tidak terlihat.

## Menjalankan di VS Code
1. Pasang Node.js (https://nodejs.org, versi LTS).
2. Buka folder ini di VS Code (File > Open Folder).
3. Buka terminal (Ctrl+`) lalu jalankan:
       npm install
       npm start
4. Buka http://localhost:3000 di browser.

## Main bersama
- Satu jaringan Wi-Fi: cari IP PC (jalankan `ipconfig`, lihat IPv4, misalnya 192.168.1.5).
  Teman membuka http://192.168.1.5:3000 dari HP atau PC mereka.
  Jika tidak bisa, izinkan Node.js di Windows Firewall (port 3000).
- Lewat internet: deploy folder ini ke layanan hosting Node.js (Render, Railway, Fly.io),
  atau sementara pakai tunnel (cloudflared / ngrok) ke port 3000.
- Semua pemain memakai kode meja yang sama. Pemain pertama jadi tuan rumah.

## Aturan
- 28 kartu, 7 per pemain. Pemegang 6-6 jalan pertama dan wajib mengeluarkan 6-6.
- Tidak ada kartu cocok = otomatis lewat.
- Menang: kartu habis duluan. Jika buntu (4 kali lewat berturut-turut), jumlah titik terkecil menang.

## Jadi aplikasi sungguhan (opsional)
- Android (.apk): bungkus URL server dengan Capacitor (`npm i @capacitor/core @capacitor/cli`,
  `npx cap init`, atur `server.url` ke alamat server, `npx cap add android`, buka di Android Studio).
- Windows (.exe): bungkus dengan Electron yang memuat alamat server yang sama.
Untuk keduanya, server perlu di-host online agar bisa dijangkau dari mana saja.
