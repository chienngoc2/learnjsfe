// src/utils/wordParser.ts

export interface WordDetails {
  word: string;
  reading: string;
  pinyin?: string;
  zhuyin?: string;
  hanviet?: string;
  meaning: string;
  type: string;
  level: string;
  jlpt?: string;
  examples: { cn?: string; jp?: string; pinyin?: string; vn: string }[];
  audio: string;
  tags: string[];
  notes: string;
  te?: string;
  ta?: string;
  nai?: string;
  ru?: string;
  masu?: string;
}

export function parseWord(term: string, def: string | object): WordDetails {
  try {
    // Case 1: def is already an object (MongoDB may return it as-is)
    let parsed: any = null;
    
    if (typeof def === "object" && def !== null) {
      parsed = def;
      // If this is a raw DB word object with term/def, recursively parse
      if (parsed.term !== undefined && parsed.def !== undefined) {
        return parseWord(parsed.term, parsed.def);
      }
    } else if (typeof def === "string") {
      const trimmedDef = def.trim();
      if (trimmedDef.startsWith("{") && trimmedDef.endsWith("}")) {
        parsed = JSON.parse(trimmedDef);
        // Also check if parsed result is a raw DB word object
        if (parsed.term !== undefined && parsed.def !== undefined) {
          return parseWord(parsed.term, parsed.def);
        }
      }
    }

    if (parsed) {
      const wordValue = term || parsed.word || parsed.term || "";
      const pinyinVal = parsed.pinyin || parsed.reading || "";
      return {
        word: wordValue,
        reading: pinyinVal || wordValue,
        pinyin: pinyinVal,
        zhuyin: parsed.zhuyin || "",
        hanviet: parsed.hanviet || "",
        meaning: parsed.meaning || parsed.def || "",
        type: parsed.type || "noun",
        level: parsed.level || parsed.jlpt || "TOCFL A1",
        jlpt: parsed.level || parsed.jlpt || "TOCFL A1",
        examples: parsed.examples || [],
        audio: parsed.audio || "",
        tags: parsed.tags || [],
        notes: parsed.notes || "",
        te: parsed.te || "",
        ta: parsed.ta || "",
        nai: parsed.nai || "",
        ru: parsed.ru || "",
        masu: parsed.masu || "",
      };
    }
  } catch (e) {
    // Fail silently and fallback
  }

  // Case 2: term itself might be a JSON string (rare edge case)
  try {
    if (typeof term === "string" && term.trim().startsWith("{")) {
      const parsedTerm = JSON.parse(term);
      const pinyinVal = parsedTerm.pinyin || parsedTerm.reading || "";
      return {
        word: parsedTerm.word || parsedTerm.term || "",
        reading: pinyinVal || parsedTerm.word || "",
        pinyin: pinyinVal,
        zhuyin: parsedTerm.zhuyin || "",
        hanviet: parsedTerm.hanviet || "",
        meaning: parsedTerm.meaning || parsedTerm.def || (typeof def === "string" ? def : ""),
        type: parsedTerm.type || "noun",
        level: parsedTerm.level || parsedTerm.jlpt || "TOCFL A1",
        jlpt: parsedTerm.level || parsedTerm.jlpt || "TOCFL A1",
        examples: parsedTerm.examples || [],
        audio: parsedTerm.audio || "",
        tags: parsedTerm.tags || [],
        notes: parsedTerm.notes || "",
        te: "",
        ta: "",
        nai: "",
        ru: "",
        masu: "",
      };
    }
  } catch (e) {}

  // Fallback: plain text
  return {
    word: term || "",
    reading: term || "",
    pinyin: "",
    zhuyin: "",
    hanviet: "",
    meaning: typeof def === "string" ? def : "",
    type: "noun",
    level: "TOCFL A1",
    jlpt: "TOCFL A1",
    examples: [],
    audio: "",
    tags: [],
    notes: "",
    te: "",
    ta: "",
    nai: "",
    ru: "",
    masu: "",
  };
}

export function formatWordForDisplay(word: WordDetails): string {
  if (!word) return "";
  return word.reading ? `${word.word} (${word.reading})` : word.word;
}
