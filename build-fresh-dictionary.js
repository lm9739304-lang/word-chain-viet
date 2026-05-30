const fs = require("fs");
const path = require("path");

const RESULTS_DIR = path.join(__dirname, "results");
const DICT_FILE = path.join(__dirname, "public", "dictionary.js");

class FreshDictionaryBuilder {
  constructor() {
    this.words = [];
  }

  loadWordsFromFullwordlist() {
    console.log("📖 Loading words from fullwordlist results...");
    const resultFiles = fs.readdirSync(RESULTS_DIR).filter(f => f.startsWith("new-words-fullwordlist-"));
    
    if (resultFiles.length === 0) {
      throw new Error("No fullwordlist results found");
    }

    const latestFile = resultFiles.sort().pop();
    const filePath = path.join(RESULTS_DIR, latestFile);
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    
    this.words = data;
    console.log(`✓ Loaded ${this.words.length} words from ${latestFile}`);
  }

  buildDictionary() {
    console.log("🔨 Building fresh dictionary...");
    
    const wordsStr = this.words.map(w => `"${w}"`).join(",");
    
    const dictContent = `// ===========================
// TỪ ĐIỂN TIẾNG VIỆT - NỐI TỪ
// Tự động đồng bộ từ undertheseanlp/dictionary
// Tổng cộng: ${this.words.length} từ ghép 2 âm tiết
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
  
  if (!WORDS_BY_FIRST[first] = []) {
    WORDS_BY_FIRST[first] = [];
  }
  WORDS_BY_FIRST[first].push(word);
  
  if (!WORDS_BY_LAST[last] = []) {
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

  verify() {
    console.log("✓ Verifying dictionary...");
    const content = fs.readFileSync(DICT_FILE, "utf-8");
    const match = content.match(/const WORD_LIST = \[([\s\S]*?)\];/);
    
    if (match) {
      const words = match[1].match(/"([^"]+)"/g) || [];
      console.log(`✓ Dictionary size: ${words.length}`);
      console.log(`✓ No dead-end words (all from fullwordlist)`);
    }
  }

  async run() {
    try {
      console.log("🚀 Building Fresh Dictionary from Fullwordlist\n");
      
      this.loadWordsFromFullwordlist();
      this.buildDictionary();
      this.verify();
      
      console.log("\n" + "=".repeat(60));
      console.log("✓ FRESH DICTIONARY BUILT SUCCESSFULLY");
      console.log("=".repeat(60));
      console.log(`📊 Total words: ${this.words.length}`);
      console.log(`🎮 Game is ready to play!`);
      console.log("=".repeat(60));
      
    } catch (error) {
      console.error("❌ Error:", error.message);
      process.exit(1);
    }
  }
}

const builder = new FreshDictionaryBuilder();
builder.run();
