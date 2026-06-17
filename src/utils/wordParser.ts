// src/utils/wordParser.ts

export interface WordDetails {
  word: string;
  reading: string;
  meaning: string;
  type: string;
  jlpt: string;
  examples: { jp: string; vn: string }[];
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
      // If the parsed object has a `word` field, use it as term fallback
      const wordValue = term || parsed.word || "";
      return {
        word: wordValue,
        reading: parsed.reading || wordValue,
        meaning: parsed.meaning || "",
        type: parsed.type || "noun",
        jlpt: parsed.jlpt || "N5",
        examples: parsed.examples || [],
        audio: parsed.audio || "",
        tags: parsed.tags || [],
        notes: parsed.notes || "",
        te: parsed.te || parsed.conjugations?.te || "",
        ta: parsed.ta || parsed.conjugations?.ta || "",
        nai: parsed.nai || parsed.conjugations?.nai || "",
        ru: parsed.ru || parsed.conjugations?.ru || "",
        masu: parsed.masu || parsed.conjugations?.masu || "",
      };
    }
  } catch (e) {
    // Fail silently and fallback
  }

  // Case 2: term itself might be a JSON string (rare edge case)
  try {
    if (typeof term === "string" && term.trim().startsWith("{")) {
      const parsedTerm = JSON.parse(term);
      return {
        word: parsedTerm.word || "",
        reading: parsedTerm.reading || parsedTerm.word || "",
        meaning: parsedTerm.meaning || (typeof def === "string" ? def : ""),
        type: parsedTerm.type || "noun",
        jlpt: parsedTerm.jlpt || "N5",
        examples: parsedTerm.examples || [],
        audio: parsedTerm.audio || "",
        tags: parsedTerm.tags || [],
        notes: parsedTerm.notes || "",
        te: parsedTerm.te || parsedTerm.conjugations?.te || "",
        ta: parsedTerm.ta || parsedTerm.conjugations?.ta || "",
        nai: parsedTerm.nai || parsedTerm.conjugations?.nai || "",
        ru: parsedTerm.ru || parsedTerm.conjugations?.ru || "",
        masu: parsedTerm.masu || parsedTerm.conjugations?.masu || "",
      };
    }
  } catch (e) {}

  // Fallback: plain text
  return {
    word: term || "",
    reading: term || "",
    meaning: typeof def === "string" ? def : "",
    type: "noun",
    jlpt: "N5",
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
