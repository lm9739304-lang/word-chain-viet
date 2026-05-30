const fs = require("fs");
const path = require("path");
const https = require("https");

const RESULTS_DIR = path.join(__dirname, "results");
const DICT_FILE = path.join(__dirname, "public", "dictionary.js");

class FullWordlistBuilder {
  constructor() {
    this.allWords = [];
  }

  async fetchFullWordlist() {
    console.log("🔍 Fetching full wordlist from GitHub...");
    
    return new Promise((resolve) => {
      const url = "https://raw.githubusercontent.com/undertheseanlp/dictionary/master/dictionary/words.txt";
      https.get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
          process.stdout.write(".");
        });
        res.on("end", () => {
          console.log("\n✓ Downloaded wordlist");
          resolve(data);
        });
      }).on("error", (e) => {
        console.error("❌ Error:", e.message);
        resolve("");
      });
    });
  }

  isTwoSyllable(word) {
    const parts = word.trim().split(" ");
    return parts.length === 2;
  }

  processWordlist(content) {
    console.log("⚙️ Processing wordlist...");
    
    const lines = content.split("\n");
    let totalWords = 0;
    let twoSyllableWords = 0;
    const wordSet = new Set();
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const json = JSON.parse(line);
        const word = json.text ? json.text.trim().toLowerCase() : null;
        
        if (!word) continue;
        
        totalWords++;
        
        if (this.isTwoSyllable(word)) {
          twoSyllableWords++;
          wordSet.add(word);
        }
      } catch (e) {
        // Skip invalid JSON lines
      }
    }
    
    this.allWords = Array.from(wordSet);
    
    console.log(`\n📊 Statistics:`);
    console.log(`  Total words: ${totalWords}`);
    console.log(`  Two-syllable words: ${twoSyllableWords}`);
    console.log(`  Unique two-syllable words: ${this.allWords.length}`);
    
    return this.allWords.length;
  }

  buildDictionary() {
    console.log("🔨 Building fresh dictionary with ALL fullwordlist words...");
    
    const wordsStr = this.allWords.map(w => `"${w}"`).join(",");
    
    const dictContent = `// ===========================
// TỪ ĐIỂN TIẾNG VIỆT - NỐI TỪ
// Tự động đồng bộ từ undertheseanlp/dictionary
// Tổng cộng: ${this.allWords.length} từ ghép 2 âm tiết
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

  verify() {
    console.log("✓ Verifying dictionary...");
    const content = fs.readFileSync(DICT_FILE, "utf-8");
    const match = content.match(/const WORD_LIST = \[([\s\S]*?)\];/);
    
    if (match) {
      const words = match[1].match(/"([^"]+)"/g) || [];
      console.log(`✓ Dictionary size: ${words.length}`);
    }
  }

  async run() {
    try {
      console.log("🚀 Building Fresh Dictionary from FULL Fullwordlist\n");
      
      const content = await this.fetchFullWordlist();
      this.processWordlist(content);
      this.buildDictionary();
      this.verify();
      
      console.log("\n" + "=".repeat(60));
      console.log("✓ FRESH DICTIONARY BUILT SUCCESSFULLY");
      console.log("=".repeat(60));
      console.log(`📊 Total words: ${this.allWords.length}`);
      console.log(`🎮 Game is ready to play!`);
      console.log("=".repeat(60));
      
    } catch (error) {
      console.error("❌ Error:", error.message);
      process.exit(1);
    }
  }
}

const builder = new FullWordlistBuilder();
builder.run();
