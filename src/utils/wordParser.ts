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
}

export function parseWord(term: string, def: string): WordDetails {
  try {
    const trimmedDef = def ? def.trim() : "";
    if (trimmedDef.startsWith("{") && trimmedDef.endsWith("}")) {
      const parsed = JSON.parse(trimmedDef);
      return {
        word: term || "",
        reading: parsed.reading || "",
        meaning: parsed.meaning || "",
        type: parsed.type || "noun",
        jlpt: parsed.jlpt || "N5",
        examples: parsed.examples || [],
        audio: parsed.audio || "",
        tags: parsed.tags || [],
        notes: parsed.notes || "",
      };
    }
  } catch (e) {
    // Fail silently and fallback
  }

  return {
    word: term || "",
    reading: term || "",
    meaning: def || "",
    type: "noun",
    jlpt: "N5",
    examples: [],
    audio: "",
    tags: [],
    notes: "",
  };
}
