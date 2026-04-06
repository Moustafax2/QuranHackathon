// Buckwalter to Arabic conversion map
const buckwalterMap: Record<string, string> = {
  // Consonants
  'b': 'ب',
  't': 'ت',
  'v': 'ث',
  'j': 'ج',
  'H': 'ح',
  'x': 'خ',
  'd': 'د',
  '*': 'ذ',
  'r': 'ر',
  'z': 'ز',
  's': 'س',
  '$': 'ش',
  'S': 'ص',
  'D': 'ض',
  'T': 'ط',
  'Z': 'ظ',
  'E': 'ع',
  'g': 'غ',
  'f': 'ف',
  'q': 'ق',
  'k': 'ك',
  'l': 'ل',
  'm': 'م',
  'n': 'ن',
  'h': 'ه',
  'w': 'و',
  'y': 'ي',
  
  // Hamza variants
  "'": 'ء',
  '>': 'أ',
  '<': 'إ',
  '&': 'ؤ',
  '}': 'ئ',
  '|': 'آ',
  
  // Vowels and diacritics
  'a': 'َ',  // fatha
  'u': 'ُ',  // damma
  'i': 'ِ',  // kasra
  '~': 'ّ',  // shadda
  'o': 'ْ',  // sukun
  'F': 'ً',  // tanween fath
  'N': 'ٌ',  // tanween damm
  'K': 'ٍ',  // tanween kasr
  '`': 'ٰ',  // alif khanjariyah (superscript alif)
  '{': 'ٱ',  // alif wasla
  
  // Special
  'A': 'ا',  // alif
  'Y': 'ى',  // alif maqsurah
  'p': 'ة',  // taa marbutah
  '_': 'ـ',  // tatweel
  
  // Extended Buckwalter - Quranic symbols (14 additional characters)
  '^': 'ٓ',  // maddah (U+0653)
  '#': 'ٔ',  // hamza above (U+0654)
  ':': 'ۜ',  // small high seen (U+06DC)
  '@': '۟',  // small high rounded zero (U+06DF)
  '"': '۠',  // small high upright rectangular zero (U+06E0)
  '[': 'ۢ',  // small high meem isolated form (U+06E2)
  ';': 'ۣ',  // small low seen (U+06E3)
  ',': 'ۥ',  // small waw (U+06E5)
  '.': 'ۦ',  // small ya (U+06E6)
  '!': 'ۨ',  // small high noon (U+06E8)
  '-': '۪',  // empty centre low stop (U+06EA)
  '+': '۫',  // empty centre high stop (U+06EB)
  '%': '۬',  // rounded high stop with filled centre (U+06EC)
  ']': 'ۭ',  // small low meem (U+06ED)
};

// #region agent log
import { appendFileSync } from 'fs';
const unmappedChars = new Set<string>();
const logFile = 'debug-58567c.log';
// #endregion

export function buckwalterToArabic(text: string): string {
  let result = '';
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const arabicChar = buckwalterMap[char];
    
    if (arabicChar) {
      result += arabicChar;
    } else {
      // #region agent log
      // Track unmapped characters for debugging
      if (char !== ' ' && char !== '\n' && char !== '\r' && char !== '\t') {
        if (!unmappedChars.has(char)) {
          unmappedChars.add(char);
          try {
            appendFileSync(logFile, JSON.stringify({sessionId:'58567c',location:'buckwalter-to-arabic.ts:73',message:'Unmapped Buckwalter character detected',data:{char:char,charCode:char.charCodeAt(0),text:text.substring(0,50),resultSoFar:result.substring(0,50)},timestamp:Date.now(),hypothesisId:'A,D'}) + '\n');
          } catch(e) {}
        }
      }
      // #endregion
      // Keep non-Buckwalter characters as-is (spaces, numbers, etc.)
      result += char;
    }
  }
  
  return result;
}

// #region agent log
// Export for debugging purposes
export function getUnmappedChars(): Set<string> {
  return unmappedChars;
}
// #endregion
