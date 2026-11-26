/**
 * Tiện ích xử lý và tra cứu Pinyin (Bính âm Hán ngữ)
 */

export const PINYIN_TONE_MAP: Record<string, string> = {
  ā: "a", á: "a", ǎ: "a", à: "a",
  ē: "e", é: "e", ě: "e", è: "e",
  ī: "i", í: "i", ǐ: "i", ì: "i",
  ō: "o", ó: "o", ǒ: "o", ò: "o",
  ū: "u", ú: "u", ǔ: "u", ù: "u",
  ǖ: "u", ǘ: "u", ǚ: "u", ǜ: "u", ü: "u",
  Ā: "a", Á: "a", Ǎ: "a", À: "a",
  Ē: "e", É: "e", Ě: "e", È: "e",
  Ī: "i", Í: "i", Ǐ: "i", Ì: "i",
  Ō: "o", Ó: "o", Ǒ: "o", Ò: "o",
  Ū: "u", Ú: "u", Ǔ: "u", Ù: "u",
  Ǖ: "u", Ǘ: "u", Ǚ: "u", Ǜ: "u", Ü: "u",
  ń: "n", ň: "n", ǹ: "n",
  ḿ: "m",
};

// Loại bỏ dấu thanh điệu Pinyin
export function stripPinyinTones(str: string): string {
  if (!str) return "";
  let out = "";
  for (const ch of str) {
    out += PINYIN_TONE_MAP[ch] || ch;
  }
  return out;
}

// Chuẩn hóa chuỗi Pinyin để so khớp (bỏ dấu, bỏ khoảng trắng, bỏ số thanh điệu, chữ thường)
export function cleanPinyinForMatching(str: string): string {
  if (!str) return "";
  return stripPinyinTones(str)
    .toLowerCase()
    .replace(/[0-9]/g, "")
    .replace(/[^a-z]/g, "");
}

// Bảng các ký tự thanh điệu Pinyin để người dùng nhập nhanh
export const PINYIN_TONE_GROUPS = [
  { base: "a", chars: ["ā", "á", "ǎ", "à"] },
  { base: "e", chars: ["ē", "é", "ě", "è"] },
  { base: "i", chars: ["ī", "í", "ǐ", "ì"] },
  { base: "o", chars: ["ō", "ó", "ǒ", "ò"] },
  { base: "u", chars: ["ū", "ú", "ǔ", "ù"] },
  { base: "ü", chars: ["ǖ", "ǘ", "ǚ", "ǜ"] },
];

// Danh sách Thanh Mẫu (Initials) trong Pinyin
export const PINYIN_INITIALS = [
  "Tất cả", "b", "p", "m", "f", "d", "t", "n", "l",
  "g", "k", "h", "j", "q", "x", "zh", "ch", "sh", "r",
  "z", "c", "s", "y", "w",
];

// Kiểm tra xem chuỗi nhập vào có phải là Pinyin không (không chứa chữ Hán)
export function isPinyinQuery(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  const hasHanzi = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(trimmed);
  if (hasHanzi) return false;
  // Chứa ít nhất 1 chữ cái Latin hoặc ký tự có dấu Pinyin
  return /[a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/.test(trimmed);
}

// So khớp Pinyin thông minh (hỗ trợ cả không dấu, có dấu, số thanh điệu)
export function matchesPinyin(itemPinyin: string, query: string): { isMatch: boolean; exactTone: boolean } {
  if (!itemPinyin || !query) return { isMatch: false, exactTone: false };

  const rawItem = itemPinyin.toLowerCase().trim();
  const rawQ = query.toLowerCase().trim();

  // Khớp chính xác hoàn toàn cả dấu thanh
  if (rawItem === rawQ || rawItem.replace(/\s+/g, "") === rawQ.replace(/\s+/g, "")) {
    return { isMatch: true, exactTone: true };
  }

  const cleanItem = cleanPinyinForMatching(rawItem);
  const cleanQ = cleanPinyinForMatching(rawQ);

  if (!cleanItem || !cleanQ) return { isMatch: false, exactTone: false };

  // Khớp chính xác không dấu
  if (cleanItem === cleanQ) {
    return { isMatch: true, exactTone: false };
  }

  // Khớp bắt đầu bằng hoặc chứa
  if (cleanItem.startsWith(cleanQ) || cleanItem.includes(cleanQ)) {
    return { isMatch: true, exactTone: false };
  }

  return { isMatch: false, exactTone: false };
}

// Chuẩn hóa tiếng Việt (bỏ dấu thanh, đ -> d) để tìm kiếm không dấu chính xác
export function normalizeViForSearch(str: string): string {
  if (!str) return "";
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function scoreLocalWordMatch(
  item: { word: string; pinyin?: string; hanviet?: string; meaning: string },
  rawQuery: string
): number {
  const q = String(rawQuery || "").trim();
  if (!q) return 0;

  const qLower = q.toLowerCase();
  const qVi = normalizeViForSearch(q);
  const qPinyin = cleanPinyinForMatching(q);
  const hasHanzi = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(q);
  const hasSpaces = /\s/.test(q);

  const wLower = item.word.toLowerCase();
  const pClean = cleanPinyinForMatching(item.pinyin || "");
  const mVi = normalizeViForSearch(item.meaning || "");
  const hvVi = normalizeViForSearch(item.hanviet || "");

  if (item.word === q || wLower === qLower) return 1000;
  if (hvVi && qVi && hvVi === qVi) return 860;
  if (pClean && qPinyin && !hasHanzi && pClean === qPinyin) return 820;

  if (mVi && qVi) {
    const segments = mVi.split(/[,;/]+/).map((s) => s.trim()).filter(Boolean);
    if (mVi === qVi || segments.includes(qVi)) return 780;
  }

  if (wLower.startsWith(qLower)) return 650;
  if (wLower.includes(qLower)) return 550;

  if (pClean && qPinyin && !hasHanzi && !hasSpaces) {
    if (pClean.startsWith(qPinyin)) return 460;
    if (qPinyin.length >= 2 && pClean.includes(qPinyin)) return 360;
  }

  if (mVi && qVi) {
    if (mVi.startsWith(qVi)) return 420;
    const escaped = qVi.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const wordBoundary = new RegExp(`(^|\\s|[,;/()])${escaped}(\\s|[,;/()]|$)`);
    if (wordBoundary.test(mVi)) return 340;
    if (qVi.length >= 2 && mVi.includes(qVi)) return 240;
  }

  if (hvVi && qVi && qVi.length >= 2 && hvVi.includes(qVi)) return 220;

  return 0;
}
