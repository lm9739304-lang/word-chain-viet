const fs = require("fs");
const path = require("path");

const DICT_FILE = path.join(__dirname, "public", "dictionary.js");

class SmartWordExtender {
  constructor() {
    this.currentDictionary = new Set();
    this.wordsbyFirst = {};
    this.wordsByLast = {};
    this.loadCurrentDictionary();
  }

  loadCurrentDictionary() {
    console.log("?? Loading current dictionary...");
    const dict = require(DICT_FILE);
    this.currentDictionary = dict.DICTIONARY;
    this.wordsbyFirst = dict.WORDS_BY_FIRST;
    this.wordsByLast = dict.WORDS_BY_LAST;
    console.log(`? Loaded: ${this.currentDictionary.size} words`);
  }

  getLastSyllable(word) {
    const parts = word.trim().toLowerCase().split(" ");
    return parts[parts.length - 1];
  }

  getFirstSyllable(word) {
    const parts = word.trim().toLowerCase().split(" ");
    return parts[0];
  }

  canContinueFrom(word) {
    const lastSyllable = this.getLastSyllable(word);
    return this.wordsbyFirst[lastSyllable] && this.wordsbyFirst[lastSyllable].length > 0;
  }

  extendWords() {
    console.log("\n?? Extending dictionary by combining words...");
    
    const newWords = [];
    const twoSyllableWords = Array.from(this.currentDictionary).filter(w => w.split(" ").length === 2);
    
    console.log(`?? Processing ${twoSyllableWords.length} two-syllable words...`);
    
    let processed = 0;
    for (const word of twoSyllableWords) {
      processed++;
      if (processed % 5000 === 0) {
        console.log(`? Processed ${processed}/${twoSyllableWords.length}...`);
      }

      // Tìm t? k?t thúc b?ng âm ti?t d?u c?a t? này
      const firstSyl = this.getFirstSyllable(word);
      const wordsEndingWithThis = this.wordsByLast[firstSyl] || [];

      for (const prevWord of wordsEndingWithThis) {
        if (prevWord.split(" ").length === 2) {
          const combined = `${prevWord} ${word}`;
          
          // Ki?m tra t? ghép này có th? n?i ti?p không
          if (!this.currentDictionary.has(combined) && this.canContinueFrom(combined)) {
            newWords.push(combined);
          }
        }
      }
    }

    console.log(`? Generated ${newWords.length} new compound words`);
    return newWords;
  }

  saveResults(validWords) {
    const resultsDir = path.join(__dirname, "results");
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    const file = path.join(resultsDir, `new-words-smart-${timestamp}.json`);
    fs.writeFileSync(file, JSON.stringify(validWords, null, 2));
    console.log(`?? Saved to: ${file}`);
    
    return validWords;
  }
}

async function main() {
  try {
    console.log("?? Starting Smart Word Extender\n");
    
    const extender = new SmartWordExtender();
    const newWords = await extender.extendWords();
    const saved = extender.saveResults(newWords);

    console.log("\n" + "-".repeat(60));
    console.log("? EXTENSION COMPLETED");
    console.log("-".repeat(60));
    console.log(`?? Generated ${saved.length} new valid words`);
    console.log(`?? Current dictionary: ${extender.currentDictionary.size} words`);
    console.log(`?? New dictionary size: ${extender.currentDictionary.size + saved.length} words`);
    console.log("-".repeat(60));
    
    process.exit(0);

  } catch (error) {
    console.error("? Error:", error.message);
    process.exit(1);
  }
}

main();
