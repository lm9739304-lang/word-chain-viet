const fs = require("fs");
const path = require("path");

const RESULTS_DIR = path.join(__dirname, "results");
const DICT_FILE = path.join(__dirname, "public", "dictionary.js");

class DictionaryUpdater {
  constructor() {
    this.newWords = [];
    this.currentDict = null;
    this.maxWordsToAdd = 55000; // Ð? d?t ~100,000 t?
  }

  loadNewWords() {
    console.log("?? Loading new words from results...");
    const resultFiles = fs.readdirSync(RESULTS_DIR).filter(f => f.startsWith("new-words-smart-"));
    
    if (resultFiles.length === 0) {
      throw new Error("No new-words-smart files found");
    }

    const latestFile = resultFiles.sort().pop();
    const filePath = path.join(RESULTS_DIR, latestFile);
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    
    // Ch? l?y s? lu?ng c?n thi?t
    this.newWords = data.slice(0, this.maxWordsToAdd);
    console.log(`? Loaded ${this.newWords.length} new words (limited to ${this.maxWordsToAdd})`);
    return this.newWords;
  }

  loadCurrentDictionary() {
    console.log("?? Loading current dictionary...");
    const dictContent = fs.readFileSync(DICT_FILE, "utf-8");
    
    const match = dictContent.match(/const WORD_LIST = \[([\s\S]*?)\];/);
    if (!match) {
      throw new Error("Could not find WORD_LIST in dictionary.js");
    }

    this.currentDict = dictContent;
    console.log("? Loaded current dictionary");
  }

  updateDictionary() {
    console.log("?? Updating dictionary with new words...");
    
    const wordListMatch = this.currentDict.match(/const WORD_LIST = \[([\s\S]*?)\];/);
    if (!wordListMatch) {
      throw new Error("Could not find WORD_LIST");
    }

    const oldWordList = wordListMatch[1];
    
    const newWordsFormatted = this.newWords
      .map(w => `"${w.toLowerCase()}"`)
      .join(",");

    const updatedWordList = oldWordList.trimEnd() + ",\n  " + newWordsFormatted + "\n";
    
    const updatedDict = this.currentDict.replace(
      /const WORD_LIST = \[([\s\S]*?)\];/,
      `const WORD_LIST = [${updatedWordList}];`
    );

    return updatedDict;
  }

  saveDictionary(updatedDict) {
    console.log("?? Saving updated dictionary...");
    fs.writeFileSync(DICT_FILE, updatedDict, "utf-8");
    console.log(`? Dictionary saved`);
  }

  verify() {
    console.log("?? Verifying updated dictionary...");
    
    delete require.cache[require.resolve(DICT_FILE)];
    const dict = require(DICT_FILE);
    
    console.log(`?? Dictionary size: ${dict.DICTIONARY.size}`);
    
    let deadEnds = 0;
    for (const word of dict.DICTIONARY) {
      if (!dict.canContinueFrom(word)) {
        deadEnds++;
      }
    }
    
    if (deadEnds === 0) {
      console.log("? No dead-end words found!");
    } else {
      console.log(`??  Found ${deadEnds} dead-end words`);
    }
  }
}

async function main() {
  try {
    console.log("?? Starting Dictionary Update Process\n");
    
    const updater = new DictionaryUpdater();
    
    updater.loadNewWords();
    updater.loadCurrentDictionary();
    const updatedDict = updater.updateDictionary();
    updater.saveDictionary(updatedDict);
    updater.verify();
    
    console.log("\n" + "-".repeat(60));
    console.log("? DICTIONARY UPDATE COMPLETED SUCCESSFULLY");
    console.log("-".repeat(60));
    console.log(`?? Added ${updater.newWords.length} new words`);
    console.log("?? Game is ready to play with expanded dictionary!");
    console.log("-".repeat(60));
    
    process.exit(0);
    
  } catch (error) {
    console.error("? Error:", error.message);
    process.exit(1);
  }
}

main();
