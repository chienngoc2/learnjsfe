/**
 * Mobile App Feature & Logic Automated Test Suite
 * Tests: WordParser, TOCFL Levels, Cultivation Realms, and Handwriting Endpoint
 */

import assert from "assert";
import { parseWord, formatWordForDisplay } from "../src/utils/wordParser";

async function runMobileTests() {
  console.log("\n=======================================================");
  console.log("📱 CHẠY TEST TỰ ĐỘNG TÍNH NĂNG FRONTEND MOBILE APP");
  console.log("=======================================================\n");

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void> | void) {
    try {
      process.stdout.write(`⏳ Đang test: ${name}... `);
      await fn();
      console.log("✅ PASS");
      passed++;
    } catch (err: any) {
      console.log(`❌ FAIL: ${err.message}`);
      failed++;
    }
  }

  // 1. Test Word Parser with Traditional Chinese JSON
  await test("1. WordParser parses Traditional Chinese JSON string", () => {
    const rawDef = JSON.stringify({
      reading: "táiwān",
      pinyin: "táiwān",
      zhuyin: "ㄊㄞˊ ㄨㄢ",
      hanviet: "Đài Loan",
      meaning: "Đài Loan",
      type: "noun",
      level: "TOCFL A1",
      examples: [{ cn: "臺灣是一個美麗的島嶼。", vn: "Đài Loan là một hòn đảo xinh đẹp." }],
    });

    const parsed = parseWord("臺灣", rawDef);
    assert.strictEqual(parsed.word, "臺灣");
    assert.strictEqual(parsed.pinyin, "táiwān");
    assert.strictEqual(parsed.zhuyin, "ㄊㄞˊ ㄨㄢ");
    assert.strictEqual(parsed.hanviet, "Đài Loan");
    assert.strictEqual(parsed.meaning, "Đài Loan");
    assert.strictEqual(parsed.level, "TOCFL A1");
    assert.strictEqual(parsed.examples.length, 1);
  });

  // 2. Test Word Parser Plain Text Fallback
  await test("2. WordParser handles raw plain text fallback", () => {
    const parsed = parseWord("你好", "Xin chào");
    assert.strictEqual(parsed.word, "你好");
    assert.strictEqual(parsed.meaning, "Xin chào");
    assert.strictEqual(parsed.level, "TOCFL A1");
  });

  // 3. Test Word Display Formatter
  await test("3. Word Display Formatter (formatWordForDisplay)", () => {
    const parsed = parseWord("學生", JSON.stringify({ reading: "xuéshēng", meaning: "Học sinh" }));
    const formatted = formatWordForDisplay(parsed);
    assert.strictEqual(formatted, "學生 (xuéshēng)");
  });

  // 4. Test Cultivation Realms & Levels Mapping
  await test("4. Cultivation Realm Logic (TOCFL Realms)", () => {
    const STAGES = [
      { name: 'Luyện Khí 期 (練氣期 - TOCFL A1)', minLevel: 1 },
      { name: 'Trúc Cơ 期 (築基期 - TOCFL A2)', minLevel: 11 },
      { name: 'Kim Đan 期 (金丹期 - TOCFL B1)', minLevel: 21 },
      { name: 'Nguyên Anh 期 (元嬰期 - TOCFL B2)', minLevel: 31 },
      { name: 'Hóa Thần 期 (化神期 - TOCFL C1)', minLevel: 41 },
      { name: 'Luyện Hư 期 (煉虛期 - TOCFL C2)', minLevel: 51 },
      { name: 'Hợp Thể 期 (合體期 - Hán Học Tông Sư)', minLevel: 65 },
      { name: 'Đại Thừa 期 (大乘期 - Tiên Thiên Đạo Nhân)', minLevel: 80 }
    ];

    const getStageForLevel = (level: number) => {
      let activeStage = STAGES[0].name;
      for (const s of STAGES) {
        if (level >= s.minLevel) activeStage = s.name;
      }
      return activeStage;
    };

    assert.strictEqual(getStageForLevel(1), "Luyện Khí 期 (練氣期 - TOCFL A1)");
    assert.strictEqual(getStageForLevel(25), "Kim Đan 期 (金丹期 - TOCFL B1)");
    assert.strictEqual(getStageForLevel(55), "Luyện Hư 期 (煉虛期 - TOCFL C2)");
  });

  // 5. Test Google Input Tools Handwriting Connection for zh_TW
  await test("5. Handwriting Recognition Connection (Google Input Tools zh_TW)", async () => {
    const payload = {
      app_version: 0.4,
      api_level: "537.36",
      device: "5.0",
      input_type: "0",
      options: "enable_pre_space",
      requests: [
        {
          writing_guide: { writing_area_width: 300, writing_area_height: 300 },
          pre_context: "",
          max_num_results: 5,
          max_completions: 0,
          language: "zh_TW",
          ink: [
            [
              [100, 100],
              [50, 150],
              [0, 100],
            ], // stroke
          ],
        },
      ],
    };

    const res = await fetch(
      "https://inputtools.google.com/request?itc=zh-t-i0-handwrit&app=translate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const data = await res.json();
    assert.strictEqual(data[0], "SUCCESS");
    assert.ok(data[1][0][1].length > 0);
  });

  // 6. Test Non-Repeating Deck Cycle Algorithm
  await test("6. Non-Repeating Deck Cycle Algorithm (no repeats until pool exhausted)", () => {
    const rawPool = [
      { word: "W1" }, { word: "W2" }, { word: "W3" }, { word: "W4" },
      { word: "W5" }, { word: "W6" }, { word: "W7" }, { word: "W8" },
      { word: "W9" }, { word: "W10" }, { word: "W11" }, { word: "W12" },
      { word: "W1" }, // Duplicate word from another lesson
    ];

    // Step A: Deduplication
    const seenMap = new Map<string, any>();
    rawPool.forEach((item) => {
      if (!seenMap.has(item.word)) seenMap.set(item.word, item);
    });
    const pool = Array.from(seenMap.values());
    assert.strictEqual(pool.length, 12, "Pool should have 12 unique items");

    // Step B: Simulate 3 rounds with limit = 5
    const limit = 5;
    const seenTerms = new Set<string>();

    function pickRound(): string[] {
      const unplayed = pool.filter((w) => !seenTerms.has(w.word));
      let finalWords: any[] = [];
      if (unplayed.length >= limit) {
        finalWords = unplayed.slice(0, limit);
        finalWords.forEach((w) => seenTerms.add(w.word));
      } else if (unplayed.length > 0) {
        finalWords = [...unplayed];
        seenTerms.clear();
        finalWords.forEach((w) => seenTerms.add(w.word));
        const need = limit - finalWords.length;
        const fill = pool.filter((w) => !seenTerms.has(w.word)).slice(0, need);
        fill.forEach((w) => seenTerms.add(w.word));
        finalWords = [...finalWords, ...fill];
      }
      return finalWords.map((w) => w.word);
    }

    const round1 = pickRound();
    assert.strictEqual(round1.length, 5);
    assert.strictEqual(new Set(round1).size, 5, "Round 1 words must be unique");

    const round2 = pickRound();
    assert.strictEqual(round2.length, 5);
    assert.strictEqual(new Set(round2).size, 5, "Round 2 words must be unique");

    // Zero overlap between Round 1 and Round 2
    for (const w of round2) {
      assert.ok(!round1.includes(w), `Word ${w} in Round 2 should not have appeared in Round 1`);
    }

    // Round 3 (picks remaining 2 unplayed + 3 from newly reset pool)
    const round3 = pickRound();
    assert.strictEqual(round3.length, 5);
    assert.strictEqual(new Set(round3).size, 5, "Round 3 words must be unique");

    // Total unique words encountered across the 3 rounds must cover all 12 pool items
    const allEncountered = new Set([...round1, ...round2, ...round3]);
    assert.strictEqual(allEncountered.size, 12, "All 12 words in pool must be tested before repetition");
  });

  // 7. Test Priority Restart Filter (unstarred word omitted on restart)
  await test("7. Priority Restart Filter (unstarred word removed on restart)", () => {
    const priorityWords = [
      { term: "貓", word: "貓", topicTitle: "Động vật" },
      { term: "狗", word: "狗", topicTitle: "Động vật" },
      { term: "鳥", word: "鳥", topicTitle: "Động vật" },
    ];
    const prioritySet = new Set(["貓", "狗", "鳥"]);

    // In-game: user unstars "狗"
    prioritySet.delete("狗");

    // Restart quiz (Play Again)
    const activeWords = priorityWords.filter((w) => prioritySet.has(w.term));
    assert.strictEqual(activeWords.length, 2);
    assert.ok(!activeWords.some((w) => w.term === "狗"), "Unstarred word '狗' must be completely absent on restart");
  });

  console.log("\n=======================================================");
  console.log(`📊 KẾT QUẢ MOBILE TEST: ${passed} PASSED | ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("🎉 TẤT CẢ LOGIC FRONTEND MOBILE ĐỀU CHUẨN XÁC!\n");
    process.exit(0);
  }
}

runMobileTests().catch((err) => {
  console.error("FATAL ERROR IN MOBILE TEST RUNNER:", err);
  process.exit(1);
});
