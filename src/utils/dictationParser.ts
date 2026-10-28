/**
 * Tiện ích tách phân đoạn bài nghe MP3 thành từng câu, từng dấu câu
 * và gán mốc thời gian âm thanh tương ứng để luyện chép chính tả (Dictation)
 */

export interface DictationSegmentInput {
  id: number;
  start: number;
  end: number;
  startFormatted?: string;
  endFormatted?: string;
  text: string;
  pinyin?: string;
  meaningVi?: string;
}

export interface DictationItem {
  id: string;
  parentSegId: number;
  text: string;
  cleanText: string;
  punctuation: string;
  start: number;
  end: number;
  startFormatted: string;
  endFormatted: string;
  pinyin?: string;
  meaningVi?: string;
}

export function formatSecs(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m < 10 ? "0" + m : m}:${s < 10 ? "0" + s : s}`;
}

/**
 * Phân chia câu theo từng dấu câu (, . ! ? ;)，kèm mốc âm thanh start/end tương ứng
 */
export function parseSegmentsToDictationItems(segments: DictationSegmentInput[]): DictationItem[] {
  const items: DictationItem[] = [];

  segments.forEach((seg, sIdx) => {
    const rawText = seg.text || "";
    // Bóc tách từng mệnh đề theo các dấu câu: ，, 。. !！ ?？ ;；
    const clauseRegex = /([^，,。\.！!？\?；;]+)([，,。\.！!？\?；;]*)/g;
    let match: RegExpExecArray | null;
    const matches: { textPart: string; punctPart: string }[] = [];

    while ((match = clauseRegex.exec(rawText)) !== null) {
      const textPart = match[1]?.trim();
      const punctPart = match[2]?.trim() || "";
      if (textPart) {
        matches.push({ textPart, punctPart });
      }
    }

    if (matches.length <= 1) {
      const clean = rawText.replace(/[，,。\.！!？\?；;\s]/g, "");
      const punctMatch = rawText.match(/[，,。\.！!？\?；;]+$/);
      items.push({
        id: `dict_${sIdx}_0`,
        parentSegId: seg.id,
        text: rawText,
        cleanText: clean,
        punctuation: punctMatch ? punctMatch[0] : "",
        start: seg.start,
        end: seg.end,
        startFormatted: seg.startFormatted || formatSecs(seg.start),
        endFormatted: seg.endFormatted || formatSecs(seg.end),
        pinyin: seg.pinyin,
        meaningVi: seg.meaningVi,
      });
    } else {
      const totalChars = Math.max(1, rawText.length);
      const segDuration = Math.max(0.2, seg.end - seg.start);
      let charAccum = 0;

      matches.forEach((m, cIdx) => {
        const fullClauseStr = m.textPart + m.punctPart;
        const clauseStart = seg.start + (charAccum / totalChars) * segDuration;
        charAccum += fullClauseStr.length;
        const clauseEnd = seg.start + (charAccum / totalChars) * segDuration;

        items.push({
          id: `dict_${sIdx}_${cIdx}`,
          parentSegId: seg.id,
          text: fullClauseStr,
          cleanText: m.textPart.replace(/[，,。\.！!？\?；;\s]/g, ""),
          punctuation: m.punctPart,
          start: Number(clauseStart.toFixed(2)),
          end: Number(clauseEnd.toFixed(2)),
          startFormatted: formatSecs(clauseStart),
          endFormatted: formatSecs(clauseEnd),
          pinyin: seg.pinyin,
          meaningVi: seg.meaningVi,
        });
      });
    }
  });

  return items;
}
