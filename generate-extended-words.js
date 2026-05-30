const fs = require("fs");
const path = require("path");

const DICT_FILE = path.join(__dirname, "public", "dictionary.js");

class ExtendedWordGenerator {
  constructor() {
    this.currentDictionary = new Set();
    this.wordsbyFirst = {};
    this.loadCurrentDictionary();
  }

  loadCurrentDictionary() {
    console.log("?? Loading current dictionary...");
    const dict = require(DICT_FILE);
    this.currentDictionary = dict.DICTIONARY;
    this.wordsbyFirst = dict.WORDS_BY_FIRST;
    console.log(`? Loaded: ${this.currentDictionary.size} words`);
  }

  // T?o t? ghép t? các t? 1 âm ti?t + 2 âm ti?t
  generateCompoundWords() {
    console.log("\n?? Generating compound words from existing dictionary...");
    
    const oneSyllableWords = [
      "a", "ác", "ai", "ám", "an", "an", "áng", "anh", "áo", "áp",
      "ba", "bà", "bác", "bài", "ban", "bàn", "bao", "bát", "bây", "bé",
      "bên", "b?nh", "bí", "bích", "biên", "bi?t", "bình", "bo", "bó", "b?",
      "b?", "b?", "b?", "b?", "b?n", "b?t", "b?", "b?", "b?i", "b?ng",
      "ca", "cà", "cách", "cái", "cam", "can", "cân", "cáng", "canh", "cánh",
      "cao", "c?p", "cát", "cay", "c?", "cách", "cái", "c?c", "c?m", "c?n",
      "c?p", "c?t", "c?u", "c?y", "cây", "co", "com", "con", "co", "co",
      "da", "dã", "d?", "d?c", "d?m", "d?ng", "d?o", "d?t", "d?y", "dây",
      "dè", "d?", "d?", "d?", "d?", "d?", "d?", "d?", "d?", "d?",
      "di", "dí", "d?ch", "di?n", "di?u", "di?p", "di?u", "d?u", "do", "dò",
      "dó", "d?", "d?", "d?", "d?", "d?", "d?", "d?", "d?", "d?",
      "du", "du", "d?", "d?c", "d?c", "d?c", "d?c", "d?c", "d?c", "d?c",
      "ga", "gà", "gác", "gái", "gam", "gan", "gàn", "gao", "gáp", "gát",
      "gây", "gà", "gác", "gái", "gam", "gan", "gàn", "gao", "gáp", "gát",
      "ge", "g?", "g?", "g?", "g?", "g?", "g?", "g?", "g?", "g?",
      "gi", "gì", "gía", "giác", "gi?i", "giàn", "giang", "giáp", "giáy", "gi?y",
      "go", "gò", "gó", "g?", "g?", "g?", "g?", "g?", "g?", "g?",
      "gu", "gu", "g?", "g?c", "g?c", "g?c", "g?c", "g?c", "g?c", "g?c",
      "ha", "há", "hà", "hác", "hài", "ham", "han", "hàn", "hàng", "hành",
      "hao", "h?p", "hát", "hay", "h?", "hác", "hài", "ham", "han", "hàn",
      "he", "hé", "h?", "h?", "h?", "h?", "h?", "h?", "h?", "h?",
      "hi", "hí", "hích", "hi?n", "hi?p", "hi?u", "hiu", "ho", "hò", "hó",
      "h?", "h?", "h?", "h?", "h?", "h?", "h?", "h?", "h?", "h?",
      "hu", "hu", "h?", "h?c", "h?c", "h?c", "h?c", "h?c", "h?c", "h?c",
      "ka", "kà", "kác", "kái", "kam", "kan", "kàn", "kao", "káp", "kát",
      "kay", "kà", "kác", "kái", "kam", "kan", "kàn", "kao", "káp", "kát",
      "ke", "ké", "k?", "k?", "k?", "k?", "k?", "k?", "k?", "k?",
      "ki", "kì", "kích", "ki?n", "ki?p", "ki?u", "kiu", "ko", "kò", "kó",
      "k?", "k?", "k?", "k?", "k?", "k?", "k?", "k?", "k?", "k?",
      "ku", "ku", "k?", "k?c", "k?c", "k?c", "k?c", "k?c", "k?c", "k?c",
      "la", "là", "lác", "lái", "lam", "lan", "làn", "lao", "láp", "lát",
      "lay", "là", "lác", "lái", "lam", "lan", "làn", "lao", "láp", "lát",
      "le", "lé", "l?", "l?", "l?", "l?", "l?", "l?", "l?", "l?",
      "li", "lì", "lích", "li?n", "li?p", "li?u", "liu", "lo", "lò", "ló",
      "l?", "l?", "l?", "l?", "l?", "l?", "l?", "l?", "l?", "l?",
      "lu", "lu", "l?", "l?c", "l?c", "l?c", "l?c", "l?c", "l?c", "l?c",
      "ma", "má", "mà", "mác", "mái", "mam", "man", "màn", "mao", "máp",
      "mát", "may", "má", "mác", "mái", "mam", "man", "màn", "mao", "máp",
      "me", "mé", "m?", "m?", "m?", "m?", "m?", "m?", "m?", "m?",
      "mi", "mì", "mích", "mi?n", "mi?p", "mi?u", "miu", "mo", "mò", "mó",
      "m?", "m?", "m?", "m?", "m?", "m?", "m?", "m?", "m?", "m?",
      "mu", "mu", "m?", "m?c", "m?c", "m?c", "m?c", "m?c", "m?c", "m?c",
      "na", "ná", "nà", "nác", "nái", "nam", "nan", "nàn", "nao", "náp",
      "nát", "nay", "ná", "nác", "nái", "nam", "nan", "nàn", "nao", "náp",
      "ne", "né", "n?", "n?", "n?", "n?", "n?", "n?", "n?", "n?",
      "ni", "nì", "nich", "ni?n", "ni?p", "ni?u", "niu", "no", "nò", "nó",
      "n?", "n?", "n?", "n?", "n?", "n?", "n?", "n?", "n?", "n?",
      "nu", "nu", "n?", "n?c", "n?c", "n?c", "n?c", "n?c", "n?c", "n?c",
      "pa", "pà", "pác", "pái", "pam", "pan", "pàn", "pao", "páp", "pát",
      "pay", "pà", "pác", "pái", "pam", "pan", "pàn", "pao", "páp", "pát",
      "pe", "pé", "p?", "p?", "p?", "p?", "p?", "p?", "p?", "p?",
      "pi", "pì", "pích", "pi?n", "pi?p", "pi?u", "piu", "po", "pò", "pó",
      "p?", "p?", "p?", "p?", "p?", "p?", "p?", "p?", "p?", "p?",
      "pu", "pu", "p?", "p?c", "p?c", "p?c", "p?c", "p?c", "p?c", "p?c",
      "ra", "rà", "rác", "rái", "ram", "ran", "ràn", "rao", "ráp", "rát",
      "ray", "rà", "rác", "rái", "ram", "ran", "ràn", "rao", "ráp", "rát",
      "re", "ré", "r?", "r?", "r?", "r?", "r?", "r?", "r?", "r?",
      "ri", "rì", "rich", "ri?n", "ri?p", "ri?u", "riu", "ro", "rò", "ró",
      "r?", "r?", "r?", "r?", "r?", "r?", "r?", "r?", "r?", "r?",
      "ru", "ru", "r?", "r?c", "r?c", "r?c", "r?c", "r?c", "r?c", "r?c",
      "sa", "sà", "sác", "sái", "sam", "san", "sàn", "sao", "sáp", "sát",
      "say", "sà", "sác", "sái", "sam", "san", "sàn", "sao", "sáp", "sát",
      "se", "sé", "s?", "s?", "s?", "s?", "s?", "s?", "s?", "s?",
      "si", "sì", "sich", "si?n", "si?p", "si?u", "siu", "so", "sò", "só",
      "s?", "s?", "s?", "s?", "s?", "s?", "s?", "s?", "s?", "s?",
      "su", "su", "s?", "s?c", "s?c", "s?c", "s?c", "s?c", "s?c", "s?c",
      "ta", "tà", "tác", "tái", "tam", "tan", "tàn", "tao", "táp", "tát",
      "tay", "tà", "tác", "tái", "tam", "tan", "tàn", "tao", "táp", "tát",
      "te", "té", "t?", "t?", "t?", "t?", "t?", "t?", "t?", "t?",
      "ti", "tì", "tích", "ti?n", "ti?p", "ti?u", "tiu", "to", "tò", "tó",
      "t?", "t?", "t?", "t?", "t?", "t?", "t?", "t?", "t?", "t?",
      "tu", "tu", "t?", "t?c", "t?c", "t?c", "t?c", "t?c", "t?c", "t?c",
      "va", "và", "vác", "vái", "vam", "van", "vàn", "vao", "váp", "vát",
      "vay", "và", "vác", "vái", "vam", "van", "vàn", "vao", "váp", "vát",
      "ve", "vé", "v?", "v?", "v?", "v?", "v?", "v?", "v?", "v?",
      "vi", "vì", "vích", "vi?n", "vi?p", "vi?u", "viu", "vo", "vò", "vó",
      "v?", "v?", "v?", "v?", "v?", "v?", "v?", "v?", "v?", "v?",
      "vu", "vu", "v?", "v?c", "v?c", "v?c", "v?c", "v?c", "v?c", "v?c",
      "xa", "xà", "xác", "xái", "xam", "xan", "xàn", "xao", "xáp", "xát",
      "xay", "xà", "xác", "xái", "xam", "xan", "xàn", "xao", "xáp", "xát",
      "xe", "xé", "x?", "x?", "x?", "x?", "x?", "x?", "x?", "x?",
      "xi", "xì", "xích", "xi?n", "xi?p", "xi?u", "xiu", "xo", "xò", "xó",
      "x?", "x?", "x?", "x?", "x?", "x?", "x?", "x?", "x?", "x?",
      "xu", "xu", "x?", "x?c", "x?c", "x?c", "x?c", "x?c", "x?c", "x?c",
      "ya", "yà", "yác", "yái", "yam", "yan", "yàn", "yao", "yáp", "yát",
      "yay", "yà", "yác", "yái", "yam", "yan", "yàn", "yao", "yáp", "yát",
      "ye", "yé", "y?", "y?", "y?", "y?", "y?", "y?", "y?", "y?",
      "yi", "yì", "yích", "yi?n", "yi?p", "yi?u", "yiu", "yo", "yò", "yó",
      "y?", "y?", "y?", "y?", "y?", "y?", "y?", "y?", "y?", "y?",
      "yu", "yu", "y?", "y?c", "y?c", "y?c", "y?c", "y?c", "y?c", "y?c",
      "za", "zà", "zác", "zái", "zam", "zan", "zàn", "zao", "záp", "zát",
      "zay", "zà", "zác", "zái", "zam", "zan", "zàn", "zao", "záp", "zát",
      "ze", "zé", "z?", "z?", "z?", "z?", "z?", "z?", "z?", "z?",
      "zi", "zì", "zich", "zi?n", "zi?p", "zi?u", "ziu", "zo", "zò", "zó",
      "z?", "z?", "z?", "z?", "z?", "z?", "z?", "z?", "z?", "z?",
      "zu", "zu", "z?", "z?c", "z?c", "z?c", "z?c", "z?c", "z?c", "z?c"
    ];

    const twoSyllableArray = Array.from(this.currentDictionary).filter(w => w.includes(" "));
    
    const newCompoundWords = [];
    
    for (const oneSyl of oneSyllableWords) {
      for (const twoSyl of twoSyllableArray) {
        const compound = `${oneSyl} ${twoSyl}`;
        if (!this.currentDictionary.has(compound) && compound.split(" ").length === 3) {
          newCompoundWords.push(compound);
        }
      }
    }

    console.log(`? Generated ${newCompoundWords.length} potential compound words`);
    return newCompoundWords;
  }

  getLastSyllable(word) {
    const parts = word.trim().toLowerCase().split(" ");
    return parts[parts.length - 1];
  }

  canContinueFrom(word) {
    const lastSyllable = this.getLastSyllable(word);
    return this.wordsbyFirst[lastSyllable] && this.wordsbyFirst[lastSyllable].length > 0;
  }

  validateWords(words) {
    console.log("?? Validating words...");
    const validWords = [];
    
    for (const word of words) {
      if (this.canContinueFrom(word)) {
        validWords.push(word);
      }
    }
    
    console.log(`? Valid words: ${validWords.length}`);
    return validWords;
  }

  saveResults(validWords) {
    const resultsDir = path.join(__dirname, "results");
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    const file = path.join(resultsDir, `new-words-extended-${timestamp}.json`);
    fs.writeFileSync(file, JSON.stringify(validWords, null, 2));
    console.log(`?? Saved to: ${file}`);
    
    return validWords;
  }
}

async function main() {
  try {
    console.log("?? Starting Extended Word Generator\n");
    
    const generator = new ExtendedWordGenerator();
    const compoundWords = generator.generateCompoundWords();
    const validWords = generator.validateWords(compoundWords);
    const saved = generator.saveResults(validWords);

    console.log("\n" + "-".repeat(60));
    console.log("? GENERATION COMPLETED");
    console.log("-".repeat(60));
    console.log(`?? Generated ${saved.length} new valid words`);
    console.log(`?? Current dictionary: ${generator.currentDictionary.size} words`);
    console.log(`?? New dictionary size: ${generator.currentDictionary.size + saved.length} words`);
    console.log("-".repeat(60));
    
    process.exit(0);

  } catch (error) {
    console.error("? Error:", error.message);
    process.exit(1);
  }
}

main();
