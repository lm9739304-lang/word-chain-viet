const fs = require("fs");
const path = require("path");

const RESULTS_DIR = path.join(__dirname, "results");
const DICT_FILE = path.join(__dirname, "public", "dictionary.js");

class DictionaryUpdater {
  constructor() {
    this.newWords = [];
    this.currentDict = null;
  }

  loadNewWords() {
    console.log("📖 Loading new words from fullwordlist results...");
    const resultFiles = fs.readdirSync(RESULTS_DIR).filter(f => f.startsWith("new-words-fullwordlist-"));
    
    if (resultFiles.length === 0) {
      throw new Error("No new-words-fullwordlist files found in results directory");
    }

    const latestFile = resultFiles.sort().pop();
    const filePath = path.join(RESULTS_DIR, latestFile);
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    
    this.newWords = data;
    console.log(`✓ Loaded ${this.newWords.length} new words from ${latestFile}`);
    return this.newWords;
  }

  loadCurrentDictionary() {
    console.log("📖 Loading current dictionary...");
    const dictContent = fs.readFileSync(DICT_FILE, "utf-8");
    
    const match = dictContent.match(/const WORD_LIST = \[([\s\S]*?)\];/);
    if (!match) {
      throw new Error("Could not find WORD_LIST in dictionary.js");
    }

    this.currentDict = dictContent;
    console.log("✓ Loaded current dictionary");
  }

  updateDictionary() {
    console.log("📝 Updating dictionary with new words...");
    
    const wordListMatch = this.currentDict.match(/const WORD_LIST = \[([\s\S]*?)\];/);
    if (!wordListMatch) {
      throw new Error("Could not find WORD_LIST");
    }

    const currentWords = wordListMatch[1];
    const newWordsStr = this.newWords.map(w => `"${w}"`).join(",");
    
    const updatedDict = this.currentDict.replace(
      /const WORD_LIST = \[([\s\S]*?)\];/,
      `const WORD_LIST = [${currentWords},${newWordsStr}];`
    );

    fs.writeFileSync(DICT_FILE, updatedDict);
    console.log("✓ Dictionary updated");
  }

  verifyDictionary() {
    console.log("✓ Verifying updated dictionary...");
    const dictContent = fs.readFileSync(DICT_FILE, "utf-8");
    
    const match = dictContent.match(/const WORD_LIST = \[([\s\S]*?)\];/);
    if (!match) {
      throw new Error("Verification failed: WORD_LIST not found");
    }

    const words = match[1].match(/"([^"]+)"/g) || [];
    console.log(`✓ Dictionary size: ${words.length}`);
    
    // Check for dead-end words
    const deadEndWords = [];
    const wordSet = new Set(words.map(w => w.replace(/"/g, "").toLowerCase()));
    
    for (const word of wordSet) {
      const parts = word.split(" ");
      if (parts.length === 2) {
        const lastSyllable = parts[1];
        let hasNext = false;
        for (const w of wordSet) {
          if (w.startsWith(lastSyllable + " ")) {
            hasNext = true;
            break;
          }
        }
        if (!hasNext) {
          deadEndWords.push(word);
        }
      }
    }
    
    if (deadEndWords.length > 0) {
      console.log(`⚠️ Found ${deadEndWords.length} dead-end words`);
    } else {
      console.log("✓ No dead-end words found!");
    }
  }

  async run() {
    try {
      console.log("🚀 Starting Dictionary Update Process\n");
      
      this.loadNewWords();
      this.loadCurrentDictionary();
      this.updateDictionary();
      this.verifyDictionary();
      
      console.log("\n" + "=".repeat(60));
      console.log("✓ DICTIONARY UPDATE COMPLETED SUCCESSFULLY");
      console.log("=".repeat(60));
      console.log(`📊 Added ${this.newWords.length} new words`);
      console.log(`🎮 Game is ready to play with expanded dictionary!`);
      console.log("=".repeat(60));
      
    } catch (error) {
      console.error("❌ Error:", error.message);
      process.exit(1);
    }
  }
}

const updater = new DictionaryUpdater();
updater.run();
