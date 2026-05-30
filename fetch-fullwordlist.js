const fs = require("fs");
const path = require("path");
const https = require("https");

const RESULTS_DIR = path.join(__dirname, "results");
const DICT_FILE = path.join(__dirname, "public", "dictionary.js");

class FullWordlistFetcher {
  constructor() {
    this.newWords = [];
    this.currentDict = new Set();
  }

  loadCurrentDictionary() {
    console.log("📖 Loading current dictionary...");
    const dictContent = fs.readFileSync(DICT_FILE, "utf-8");
    const match = dictContent.match(/const WORD_LIST = \[([\s\S]*?)\];/);
    
    if (match) {
      const words = match[1].match(/"([^"]+)"/g) || [];
      words.forEach(w => {
        this.currentDict.add(w.replace(/"/g, "").toLowerCase());
      });
    }
    console.log(`✓ Loaded ${this.currentDict.size} words from current dictionary`);
  }

  isTwoSyllable(word) {
    const parts = word.trim().split(" ");
    return parts.length === 2;
  }

  async fetchWordlist() {
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
        console.error("❌ Error fetching:", e.message);
        resolve("");
      });
    });
  }

  processWordlist(content) {
    console.log("⚙️ Processing wordlist...");
    
    const lines = content.split("\n");
    let totalWords = 0;
    let twoSyllableWords = 0;
    let newWords = 0;
    let duplicates = 0;
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const json = JSON.parse(line);
        const word = json.text ? json.text.trim().toLowerCase() : null;
        
        if (!word) continue;
        
        totalWords++;
        
        if (this.isTwoSyllable(word)) {
          twoSyllableWords++;
          
          if (!this.currentDict.has(word)) {
            this.newWords.push(word);
            newWords++;
          } else {
            duplicates++;
          }
        }
      } catch (e) {
        // Skip invalid JSON lines
      }
    }
    
    console.log(`\n📊 Statistics:`);
    console.log(`  Total words: ${totalWords}`);
    console.log(`  Two-syllable words: ${twoSyllableWords}`);
    console.log(`  New words found: ${newWords}`);
    console.log(`  Duplicate words: ${duplicates}`);
    
    return newWords;
  }

  saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const resultsFile = path.join(RESULTS_DIR, `new-words-fullwordlist-${timestamp}.json`);
    
    fs.writeFileSync(resultsFile, JSON.stringify(this.newWords, null, 2));
    console.log(`✓ Results saved to: ${resultsFile}`);
    
    return resultsFile;
  }

  async run() {
    try {
      console.log("🚀 Starting Full Wordlist Fetcher\n");
      
      this.loadCurrentDictionary();
      const content = await this.fetchWordlist();
      const newCount = this.processWordlist(content);
      this.saveResults();
      
      console.log("\n" + "=".repeat(60));
      console.log("✓ FETCH COMPLETED SUCCESSFULLY");
      console.log("=".repeat(60));
      console.log(`📊 New words found: ${this.newWords.length}`);
      console.log(`📚 Current dictionary size: ${this.currentDict.size}`);
      console.log(`📈 New dictionary size: ${this.currentDict.size + this.newWords.length}`);
      
    } catch (error) {
      console.error("❌ Error:", error.message);
      process.exit(1);
    }
  }
}

const fetcher = new FullWordlistFetcher();
fetcher.run();
