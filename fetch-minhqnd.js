const fs = require("fs");
const path = require("path");
const https = require("https");

const RESULTS_DIR = path.join(__dirname, "results");
const DICT_FILE = path.join(__dirname, "public", "dictionary.js");

class MinhqndFetcher {
  constructor() {
    this.newWords = [];
    this.currentDict = new Set();
    this.validWords = [];
    this.deadEndWords = [];
  }

  async fetchFromAPI(word) {
    return new Promise((resolve) => {
      const url = `https://dict.minhqnd.com/api/v1/lookup?word=${encodeURIComponent(word)}`;
      https.get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            resolve(json.exists ? json.word : null);
          } catch {
            resolve(null);
          }
        });
      }).on("error", () => resolve(null));
    });
  }

  async suggestWords(prefix) {
    return new Promise((resolve) => {
      const url = `https://dict.minhqnd.com/api/v1/suggest?q=${encodeURIComponent(prefix)}`;
      https.get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            resolve(json.suggestions || []);
          } catch {
            resolve([]);
          }
        });
      }).on("error", () => resolve(null));
    });
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

  async fetchAllWords() {
    console.log("🔍 Fetching words from dict.minhqnd.com...");
    
    // Vietnamese syllables to try as prefixes
    const prefixes = ["a", "ă", "â", "b", "c", "d", "đ", "e", "ê", "g", "h", "i", "k", "l", "m", "n", "o", "ô", "ơ", "p", "q", "r", "s", "t", "u", "ư", "v", "x", "y"];
    
    let totalFetched = 0;
    
    for (const prefix of prefixes) {
      try {
        const suggestions = await this.suggestWords(prefix);
        if (suggestions && suggestions.length > 0) {
          for (const word of suggestions) {
            if (this.isTwoSyllable(word) && !this.currentDict.has(word.toLowerCase())) {
              this.newWords.push(word);
              totalFetched++;
            }
          }
          console.log(`✓ Prefix "${prefix}": found ${suggestions.length} words`);
        }
      } catch (e) {
        console.log(`✗ Error fetching prefix "${prefix}"`);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n✓ Total new words found: ${totalFetched}`);
    return this.newWords;
  }

  saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const resultsFile = path.join(RESULTS_DIR, `new-words-minhqnd-${timestamp}.json`);
    
    fs.writeFileSync(resultsFile, JSON.stringify(this.newWords, null, 2));
    console.log(`✓ Results saved to: ${resultsFile}`);
    
    return resultsFile;
  }

  async run() {
    try {
      console.log("🚀 Starting Minhqnd Dictionary Fetcher\n");
      
      this.loadCurrentDictionary();
      await this.fetchAllWords();
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

const fetcher = new MinhqndFetcher();
fetcher.run();
