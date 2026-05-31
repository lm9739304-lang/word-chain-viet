const fs = require("fs");
const path = require("path");

const DICT_FILE = path.join(__dirname, "public", "dictionary.js");
const EXTERNAL_DICT = "C:\\Users\\Admin\\Desktop\\tu_dien_2_am_tiet.txt";

class MergeDictionariesFull {
  constructor() {
    this.currentWords = new Set();
    this.externalWords = [];
    this.mergedWords = new Set();
  }

  loadCurrentDictionary() {
    console.log("📖 Loading current dictionary...");
    const dictContent = fs.readFileSync(DICT_FILE, "utf-8");
    const match = dictContent.match(/const WORD_LIST = \[([\s\S]*?)\];/);
    
    if (match) {
      const words = match[1].match(/"([^"]+)"/g) || [];
      words.forEach(w => {
        this.currentWords.add(w.replace(/"/g, "").toLowerCase());
      });
    }
    console.log(`✓ Loaded ${this.currentWords.size} words from current dictionary`);
  }

  loadExternalDictionary() {
    console.log("📖 Loading FULL external dictionary from C:\\Users\\Admin\\Desktop\\tu_dien_2_am_tiet.txt...");
    const content = fs.readFileSync(EXTERNAL_DICT, "utf-8");
    const lines = content.split("\n");
    
    let totalWords = 0;
    let twoSyllableWords = 0;
    let otherWords = 0;
    
    for (const line of lines) {
      const word = line.trim().toLowerCase();
      
      if (!word) continue;
      
      totalWords++;
      this.externalWords.push(word);
      
      if (word.includes(" ")) {
        twoSyllableWords++;
      } else {
        otherWords++;
      }
    }
    
    console.log(`✓ Loaded ${totalWords} total words`);
    console.log(`✓ Two-syllable words: ${twoSyllableWords}`);
    console.log(`✓ Other words: ${otherWords}`);
  }

  mergeAndBuild() {
    console.log("🔨 Merging ALL words from external dictionary...");
    
    let newWords = 0;
    let duplicates = 0;
    
    for (const word of this.externalWords) {
      if (!this.currentWords.has(word)) {
        this.mergedWords.add(word);
        newWords++;
      } else {
        duplicates++;
      }
    }
    
    // Add current words
    for (const word of this.currentWords) {
      this.mergedWords.add(word);
    }
    
    console.log(`✓ New words from external: ${newWords}`);
    console.log(`✓ Duplicate words: ${duplicates}`);
    console.log(`✓ Total merged words: ${this.mergedWords.size}`);
    
    return newWords;
  }

  buildDictionary() {
    console.log("🔨 Building merged dictionary with ALL words...");
    
    const allWords = Array.from(this.mergedWords);
    const wordsStr = allWords.map(w => `"${w}"`).join(",");
    
    const dictContent = `// ===========================
// TỪ ĐIỂN TIẾNG VIỆT - NỐI TỪ
// Tự động đồng bộ từ 3 nguồn từ điển + FULL dictionary
// Tổng cộng: ${allWords.length} từ (bao gồm tất cả từ)
// ===========================
const WORD_LIST = [${wordsStr}];

// Xây dựng index cho tìm kiếm nhanh
const WORDS_BY_FIRST = {};
const WORDS_BY_LAST = {};
const DICTIONARY = new Set();

for (const word of WORD_LIST) {
  const parts = word.trim().split(' ');
  if (parts.length < 2) continue;
  
  const first = parts[0];
  const last = parts[parts.length - 1];
  
  if (!WORDS_BY_FIRST[first]) {
    WORDS_BY_FIRST[first] = [];
  }
  WORDS_BY_FIRST[first].push(word);
  
  if (!WORDS_BY_LAST[last]) {
    WORDS_BY_LAST[last] = [];
  }
  WORDS_BY_LAST[last].push(word);
  
  DICTIONARY.add(word);
}

function getLastSyllable(word) {
  const parts = word.trim().split(' ');
  return parts[parts.length - 1];
}

function getFirstSyllable(word) {
  return word.trim().split(' ')[0];
}

function isValidWord(word) {
  return DICTIONARY.has(word.toLowerCase());
}

function getWordsStartingWith(syllable) {
  return WORDS_BY_FIRST[syllable.toLowerCase()] || [];
}

function getRandomWord() {
  return WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
}

function canContinueFrom(word) {
  const lastSyllable = getLastSyllable(word);
  const nextWords = getWordsStartingWith(lastSyllable);
  return nextWords.length > 0;
}

function getRandomValidWord() {
  let attempts = 0;
  const maxAttempts = 100;
  
  while (attempts < maxAttempts) {
    const word = getRandomWord();
    if (canContinueFrom(word)) {
      return word;
    }
    attempts++;
  }
  
  // Fallback: find first valid word
  for (const word of DICTIONARY) {
    if (canContinueFrom(word)) {
      return word;
    }
  }
  
  return 'học sinh'; // Ultimate fallback
}

// Export cho Node.js (server)
if (typeof module !== 'undefined') {
  module.exports = {
    DICTIONARY,
    isValidWord,
    getLastSyllable,
    getFirstSyllable,
    getWordsStartingWith,
    getRandomWord,
    canContinueFrom,
    getRandomValidWord
  };
}
`;

    fs.writeFileSync(DICT_FILE, dictContent);
    console.log("✓ Dictionary built and saved");
  }

  async run() {
    try {
      console.log("🚀 Merging FULL Dictionary (All Words)\n");
      
      this.loadCurrentDictionary();
      this.loadExternalDictionary();
      this.mergeAndBuild();
      this.buildDictionary();
      
      console.log("\n" + "=".repeat(60));
      console.log("✓ FULL DICTIONARY MERGE COMPLETED SUCCESSFULLY");
      console.log("=".repeat(60));
      console.log(`📊 Total words: ${this.mergedWords.size}`);
      console.log(`🎮 Game is ready to play!`);
      console.log("=".repeat(60));
      
    } catch (error) {
      console.error("❌ Error:", error.message);
      process.exit(1);
    }
  }
}

const merger = new MergeDictionariesFull();
merger.run();
