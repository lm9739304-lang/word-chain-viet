const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DICT_FILE = path.join(__dirname, "public", "dictionary.js");
const DB_PATH = "D:\\dictionary.db";

class BuildVietnameseDictionary {
  constructor() {
    this.words = new Set();
    this.db = null;
  }

  isVietnameseWord(word) {
    if (!word || word.length === 0) return false;
    
    // Vietnamese diacritical marks - MUST contain at least one
    const vietnameseDiacritics = /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i;
    
    // Only accept words that contain Vietnamese diacritical marks
    // This ensures we only get Vietnamese words
    return vietnameseDiacritics.test(word);
  }

  openDatabase() {
    return new Promise((resolve, reject) => {
      try {
        this.db = new Database(DB_PATH, { readonly: true });
        console.log("✓ Connected to SQLite database");
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  loadDictionary() {
    return new Promise((resolve, reject) => {
      console.log("📖 Loading Vietnamese words from SQLite database...");
      
      try {
        // Get all tables
        const tables = this.db.prepare(
          "SELECT name FROM sqlite_master WHERE type='table';"
        ).all();
        
        // Find the words table
        let wordTable = null;
        if (tables.find(t => t.name === "words")) wordTable = "words";
        else if (tables.find(t => t.name === "entries")) wordTable = "entries";
        else if (tables.find(t => t.name === "dictionary")) wordTable = "dictionary";
        else if (tables.find(t => t.name === "word")) wordTable = "word";
        else wordTable = tables[0].name;
        
        console.log(`📚 Using table: ${wordTable}`);
        
        // Get sample row to find word column
        const sampleRow = this.db.prepare(`SELECT * FROM ${wordTable} LIMIT 1`).get();
        
        // Determine word column
        let wordColumn = null;
        if (sampleRow) {
          if (sampleRow.word) wordColumn = "word";
          else if (sampleRow.entry) wordColumn = "entry";
          else if (sampleRow.name) wordColumn = "name";
          else if (sampleRow.text) wordColumn = "text";
          else wordColumn = Object.keys(sampleRow)[0];
        }
        
        console.log(`🔤 Using word column: ${wordColumn}`);
        
        // Load all words and filter for Vietnamese
        const rows = this.db.prepare(`SELECT ${wordColumn} FROM ${wordTable}`).all();
        
        let loadedCount = 0;
        let filteredCount = 0;
        
        for (const row of rows) {
          const word = row[wordColumn]?.trim().toLowerCase();
          if (word) {
            loadedCount++;
            
            // Filter to only Vietnamese words
            if (this.isVietnameseWord(word)) {
              this.words.add(word);
              filteredCount++;
            }
          }
        }
        
        console.log(`✓ Loaded ${loadedCount} total words from database`);
        console.log(`✓ Vietnamese words: ${filteredCount}`);
        console.log(`✓ Unique Vietnamese words: ${this.words.size}`);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  buildDictionary() {
    console.log("🔨 Building Vietnamese dictionary...");
    
    const wordArray = Array.from(this.words).sort();
    
    // Escape special characters in words
    const escapedWords = wordArray.map(w => {
      return w
        .replace(/\\/g, '\\\\')  // Escape backslashes first
        .replace(/"/g, '\\"')    // Escape double quotes
        .replace(/\n/g, '\\n')   // Escape newlines
        .replace(/\r/g, '\\r')   // Escape carriage returns
        .replace(/\t/g, '\\t');  // Escape tabs
    });
    
    const wordsStr = escapedWords.map(w => `"${w}"`).join(",");
    
    const dictContent = `// ===========================
// TỪ ĐIỂN TIẾNG VIỆT - NỐI TỪ
// Tự động đồng bộ từ SQLite Database (dictionary.db)
// Chỉ chứa từ tiếng Việt
// Tổng cộng: ${this.words.size} từ tiếng Việt
// ===========================
const WORD_LIST = [${wordsStr}];

// Xây dựng index cho tìm kiếm nhanh
const WORDS_BY_FIRST = new Map();
const WORDS_BY_LAST = new Map();
const DICTIONARY = new Set();

for (const word of WORD_LIST) {
  const parts = word.trim().split(' ');
  if (parts.length < 1) continue;
  
  const first = parts[0];
  const last = parts[parts.length - 1];
  
  if (!WORDS_BY_FIRST.has(first)) {
    WORDS_BY_FIRST.set(first, []);
  }
  WORDS_BY_FIRST.get(first).push(word);
  
  if (!WORDS_BY_LAST.has(last)) {
    WORDS_BY_LAST.set(last, []);
  }
  WORDS_BY_LAST.get(last).push(word);
  
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
  return WORDS_BY_FIRST.get(syllable.toLowerCase()) || [];
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

  closeDatabase() {
    if (this.db) {
      this.db.close();
      console.log("✓ Database connection closed");
    }
  }

  async run() {
    try {
      console.log("🚀 Building Vietnamese Dictionary\n");
      
      await this.openDatabase();
      await this.loadDictionary();
      this.buildDictionary();
      this.closeDatabase();
      
      console.log("\n" + "=".repeat(60));
      console.log("✓ VIETNAMESE DICTIONARY BUILT SUCCESSFULLY");
      console.log("=".repeat(60));
      console.log(`📊 Total Vietnamese words: ${this.words.size}`);
      console.log(`🎮 Game is ready to play!`);
      console.log("=".repeat(60));
      
    } catch (error) {
      console.error("❌ Error:", error.message);
      this.closeDatabase();
      process.exit(1);
    }
  }
}

const builder = new BuildVietnameseDictionary();
builder.run();
