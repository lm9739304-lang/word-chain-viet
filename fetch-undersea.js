const fs = require("fs");
const path = require("path");
const https = require("https");

const CONFIG = {
  UNDERSEA_URL: "https://raw.githubusercontent.com/undertheseanlp/dictionary/master/data/vietnamese.txt",
  TIMEOUT: 120000,
  LOG_DIR: path.join(__dirname, "logs"),
  RESULTS_DIR: path.join(__dirname, "results"),
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
};

class Logger {
  constructor() {
    this.logs = [];
    this.logFile = path.join(CONFIG.LOG_DIR, `fetch-undersea-${this.getTimestamp()}.log`);
    this.ensureDir(CONFIG.LOG_DIR);
  }

  getTimestamp() {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, "-").slice(0, -5);
  }

  log(message, level = "INFO") {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}`;
    this.logs.push(logEntry);
    console.log(logEntry);
  }

  error(message, error = null) {
    const errorMsg = error ? `${message} - ${error.message}` : message;
    this.log(errorMsg, "ERROR");
  }

  success(message) {
    this.log(message, "SUCCESS");
  }

  info(message) {
    this.log(message, "INFO");
  }

  debug(message) {
    this.log(message, "DEBUG");
  }

  ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  save() {
    this.ensureDir(CONFIG.LOG_DIR);
    fs.writeFileSync(this.logFile, this.logs.join("\n"));
    console.log(`\n?? Log saved to: ${this.logFile}`);
  }
}

class UnderSeaFetcher {
  constructor(logger) {
    this.logger = logger;
  }

  async fetchFile(url) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Download timeout"));
      }, CONFIG.TIMEOUT);

      const options = {
        headers: {
          "User-Agent": CONFIG.USER_AGENT
        }
      };

      https.get(url, options, (res) => {
        clearTimeout(timeout);
        let data = "";
        let chunks = 0;

        res.on("data", (chunk) => {
          chunks++;
          data += chunk;
          if (chunks % 100 === 0) {
            this.logger.debug(`Downloaded ${(data.length / 1024 / 1024).toFixed(2)}MB...`);
          }
        });

        res.on("end", () => {
          this.logger.success(`? Downloaded ${(data.length / 1024 / 1024).toFixed(2)}MB`);
          resolve(data);
        });
      }).on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  async fetchAllWords() {
    this.logger.info("?? Downloading UnderTheSea Dictionary...");
    this.logger.info(`?? URL: ${CONFIG.UNDERSEA_URL}`);
    
    try {
      const data = await this.fetchFile(CONFIG.UNDERSEA_URL);
      const lines = data.split("\n").map(l => l.trim()).filter(l => l.length > 0);
      
      // Remove duplicates
      const unique = [...new Set(lines)];
      this.logger.success(`? Total unique words: ${unique.length}`);
      return unique;
    } catch (error) {
      this.logger.error("Failed to fetch from UnderTheSea", error);
      throw error;
    }
  }
}

class WordProcessor {
  constructor(logger) {
    this.logger = logger;
    this.currentDictionary = new Set();
    this.loadCurrentDictionary();
  }

  loadCurrentDictionary() {
    try {
      const dict = require("./public/dictionary.js");
      this.currentDictionary = dict.DICTIONARY;
      this.wordsbyFirst = dict.WORDS_BY_FIRST;
      this.logger.success(`? Loaded current dictionary: ${this.currentDictionary.size} words`);
    } catch (error) {
      this.logger.error("Failed to load current dictionary", error);
      throw error;
    }
  }

  isTwoSyllable(word) {
    const parts = word.trim().split(" ");
    return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
  }

  normalize(word) {
    return word.trim().toLowerCase();
  }

  filterTwoSyllableWords(words) {
    this.logger.info("?? Filtering 2-syllable words...");
    const twoSyllable = words.filter(w => this.isTwoSyllable(w));
    this.logger.info(`?? Found ${twoSyllable.length} two-syllable words out of ${words.length}`);
    return twoSyllable;
  }

  findNewWords(twoSyllableWords) {
    this.logger.info("?? Comparing with current dictionary...");
    const newWords = [];
    const duplicates = [];

    for (const word of twoSyllableWords) {
      const normalized = this.normalize(word);
      if (this.currentDictionary.has(normalized)) {
        duplicates.push(word);
      } else {
        newWords.push(word);
      }
    }

    this.logger.info(`? Found ${newWords.length} new words`);
    this.logger.info(`?? Found ${duplicates.length} duplicate words`);
    
    return { newWords, duplicates };
  }
}

class WordValidator {
  constructor(logger, wordsbyFirst) {
    this.logger = logger;
    this.wordsbyFirst = wordsbyFirst;
  }

  getLastSyllable(word) {
    const parts = word.trim().toLowerCase().split(" ");
    return parts[parts.length - 1];
  }

  canContinueFrom(word) {
    const lastSyllable = this.getLastSyllable(word);
    const nextWords = this.wordsbyFirst[lastSyllable] || [];
    return nextWords.length > 0;
  }

  validateWords(newWords) {
    this.logger.info("?? Checking for dead-end words...");
    const validWords = [];
    const deadEndWords = [];

    for (const word of newWords) {
      if (this.canContinueFrom(word)) {
        validWords.push(word);
      } else {
        deadEndWords.push(word);
      }
    }

    this.logger.success(`? Valid words (can continue): ${validWords.length}`);
    this.logger.info(`?? Dead-end words (removed): ${deadEndWords.length}`);

    return { validWords, deadEndWords };
  }
}

class ResultsSaver {
  constructor(logger) {
    this.logger = logger;
    this.ensureDir(CONFIG.RESULTS_DIR);
  }

  ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  save(results) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    
    const newWordsFile = path.join(CONFIG.RESULTS_DIR, `new-words-undersea-${timestamp}.json`);
    fs.writeFileSync(newWordsFile, JSON.stringify(results.validWords, null, 2));
    this.logger.success(`?? New words saved: ${newWordsFile}`);

    const deadEndFile = path.join(CONFIG.RESULTS_DIR, `dead-end-undersea-${timestamp}.json`);
    fs.writeFileSync(deadEndFile, JSON.stringify(results.deadEndWords, null, 2));
    this.logger.info(`?? Dead-end words saved: ${deadEndFile}`);

    const summary = {
      timestamp: new Date().toISOString(),
      totalFetched: results.totalFetched,
      twoSyllable: results.twoSyllable,
      newWords: results.validWords.length,
      deadEndWords: results.deadEndWords.length,
      duplicates: results.duplicates.length,
      validWordsToAdd: results.validWords.length,
      currentDictionarySize: results.currentDictionarySize,
      newDictionarySize: results.currentDictionarySize + results.validWords.length
    };

    const summaryFile = path.join(CONFIG.RESULTS_DIR, `summary-undersea-${timestamp}.json`);
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    this.logger.success(`?? Summary saved: ${summaryFile}`);

    return { newWordsFile, deadEndFile, summaryFile };
  }
}

async function main() {
  const logger = new Logger();
  
  try {
    logger.info("?? Starting UnderTheSea Dictionary Fetcher");
    logger.info(`??  Source: UnderTheSea Dictionary (vietnamese.txt)`);

    const fetcher = new UnderSeaFetcher(logger);
    const allWords = await fetcher.fetchAllWords();

    const processor = new WordProcessor(logger);
    const twoSyllableWords = processor.filterTwoSyllableWords(allWords);
    const { newWords, duplicates } = processor.findNewWords(twoSyllableWords);

    const validator = new WordValidator(logger, processor.wordsbyFirst);
    const { validWords, deadEndWords } = validator.validateWords(newWords);

    const saver = new ResultsSaver(logger);
    const results = {
      totalFetched: allWords.length,
      twoSyllable: twoSyllableWords.length,
      newWords: newWords.length,
      validWords,
      deadEndWords,
      duplicates,
      currentDictionarySize: processor.currentDictionary.size
    };

    saver.save(results);

    logger.info("\n" + "-".repeat(60));
    logger.success("? FETCH COMPLETED SUCCESSFULLY");
    logger.info("-".repeat(60));
    logger.info(`?? Total words fetched: ${results.totalFetched}`);
    logger.info(`?? Two-syllable words: ${results.twoSyllable}`);
    logger.info(`? New words found: ${results.newWords.length}`);
    logger.info(`? Valid words (can continue): ${results.validWords.length}`);
    logger.info(`?? Dead-end words (removed): ${results.deadEndWords.length}`);
    logger.info(`?? Duplicate words: ${results.duplicates.length}`);
    logger.info(`?? Current dictionary size: ${results.currentDictionarySize}`);
    logger.info(`?? New dictionary size: ${results.currentDictionarySize + results.validWords.length}`);
    logger.info("-".repeat(60));

    logger.save();
    process.exit(0);

  } catch (error) {
    logger.error("Fatal error", error);
    logger.save();
    process.exit(1);
  }
}

main();
