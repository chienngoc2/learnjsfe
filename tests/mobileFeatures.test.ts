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
