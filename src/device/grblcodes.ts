/** Penjelasan singkat kode ALARM dan error GRBL 1.1 (bahasa Indonesia). */

export const ALARM_CODES: Record<number, string> = {
  1: 'Hard limit tersentuh. Posisi mungkin hilang; lakukan Home.',
  2: 'Target gerak melewati batas travel mesin (soft limit). Cek offset koordinat kerja / origin / ukuran area.',
  3: 'Reset saat mesin bergerak. Posisi mungkin hilang; lakukan Home.',
  4: 'Probe gagal: probe sudah tersentuh sebelum siklus mulai.',
  5: 'Probe gagal: tidak menyentuh apa pun.',
  6: 'Homing gagal: siklus dibatalkan (reset).',
  7: 'Homing gagal: pintu terbuka.',
  8: 'Homing gagal: tidak bisa lepas dari limit switch (cek $27 pull-off).',
  9: 'Homing gagal: limit switch tidak ditemukan dalam jarak travel.',
};

export const ERROR_CODES: Record<number, string> = {
  1: 'Perintah G-code hanya berisi huruf tanpa angka.',
  2: 'Format angka tidak valid.',
  3: 'Perintah $ tidak dikenal.',
  4: 'Nilai negatif tidak diizinkan.',
  5: 'Homing tidak aktif ($22=0).',
  7: 'Gagal membaca EEPROM.',
  8: 'Perintah $ hanya boleh saat Idle.',
  9: 'G-code dikunci karena alarm / jog aktif. Reset alarm atau $X.',
  10: 'Soft limit butuh homing aktif.',
  11: 'Baris terlalu panjang.',
  12: 'Nilai step rate melebihi batas.',
  13: 'Pintu pengaman terbuka.',
  14: 'String build info terlalu panjang.',
  15: 'Target jog melewati batas travel.',
  16: 'Perintah jog tidak valid.',
  17: 'Laser mode butuh PWM.',
  20: 'Perintah G-code tidak didukung.',
  21: 'Lebih dari satu perintah G-code dari grup modal yang sama.',
  22: 'Feed rate (F) belum ditentukan atau nol.',
  23: 'Nilai perintah G-code bukan bilangan bulat.',
  24: 'Lebih dari satu perintah G-code yang butuh nilai axis.',
  25: 'Kata G-code berulang di baris yang sama.',
  26: 'Perintah butuh nilai axis tapi tidak ada.',
  27: 'Nomor baris (N) tidak valid.',
  28: 'Nilai yang dibutuhkan perintah tidak ada (P atau L).',
  29: 'Sistem koordinat kerja G59.x tidak didukung.',
  30: 'G53 hanya boleh dengan G0/G1.',
  31: 'Ada nilai axis pada perintah yang tidak memakainya.',
  32: 'G2/G3 butuh nilai axis pada bidang.',
  33: 'Target gerak tidak valid (busur / tak tercapai).',
  34: 'Busur dengan radius tidak bisa dihitung.',
  35: 'G2/G3 butuh offset IJK.',
  36: 'Ada kata G-code tak terpakai di baris.',
  37: 'Offset tool length hanya untuk sumbu yang dikonfigurasi.',
  38: 'Nomor tool melebihi batas.',
};

/** Ubah baris GRBL "ALARM:n" / "error:n" menjadi keterangan; null bila bukan keduanya. */
export function describeGrblLine(line: string): string | null {
  const a = /^ALARM:(\d+)/.exec(line);
  if (a) return ALARM_CODES[Number(a[1])] ?? 'Alarm tidak dikenal.';
  const e = /^error:(\d+)/.exec(line);
  if (e) return ERROR_CODES[Number(e[1])] ?? 'Error tidak dikenal.';
  return null;
}
