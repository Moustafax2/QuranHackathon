/**
 * Verb form generation for Arabic verbs
 * This module generates missing verb forms when corpus data is incomplete
 * Supports all 10 Arabic verb forms (أوزان)
 */

interface VerbPattern {
  past: string;
  present: string;
  imperative: string;
  verbal_noun: string;
}

type VerbForm = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | 'VII' | 'VIII' | 'IX' | 'X';

/**
 * Detect the verb form (وزن) from an existing conjugation
 */
function detectVerbForm(
  root: string,
  past?: string,
  present?: string
): VerbForm | null {
  const rootLetters = root.replace(/\s/g, "").split("");
  if (rootLetters.length !== 3) return null;
  
  const [r1, r2, r3] = rootLetters;
  
  // Check past tense patterns
  if (past && past !== "-") {
    // Remove diacritics for pattern matching
    const pastClean = past.replace(/[\u064B-\u065F]/g, "");
    
    // Form X: استفعل (has است prefix)
    if (pastClean.startsWith("است") || pastClean.startsWith("ٱست")) {
      return 'X';
    }
    // Form VIII: افتعل (has ت infix)
    if (pastClean.includes("ت") && pastClean.length >= 4) {
      const pattern = `${r1}${r2}ت${r3}`;
      if (pastClean.includes(pattern.substring(0, 3))) {
        return 'VIII';
      }
    }
    // Form VII: انفعل (has ان prefix)
    if (pastClean.startsWith("ان") || pastClean.startsWith("ٱن")) {
      return 'VII';
    }
    // Form IV: أفعل (has أ prefix)
    if (pastClean.startsWith("أ") || pastClean.startsWith("ٱ")) {
      return 'IV';
    }
    // Form II: فعّل (doubled middle radical)
    if (pastClean.includes("ّ") || pastClean.length >= 4) {
      const doubled = `${r1}${r2}${r2}`;
      if (pastClean.includes(doubled)) {
        return 'II';
      }
    }
    // Form III: فاعل (has ا after first radical)
    if (pastClean.length >= 4 && pastClean[1] === "ا") {
      return 'III';
    }
  }
  
  // Check present tense patterns
  if (present && present !== "-") {
    const presentClean = present.replace(/[\u064B-\u065F]/g, "");
    
    // Form X: يستفعل (has ست after prefix)
    if (presentClean.includes("ست")) {
      return 'X';
    }
    // Form VIII: يفتعل (has ت infix)
    if (presentClean.includes("ت")) {
      return 'VIII';
    }
    // Form VII: ينفعل (has ن after prefix)
    if (presentClean.includes("ن") && presentClean.length >= 5) {
      return 'VII';
    }
  }
  
  // Default to Form I if no pattern detected
  return 'I';
}

/**
 * Generate verb forms based on the root and verb form (وزن)
 * This is a simplified generator for common Form I patterns
 * For more complex forms, we return placeholders
 */
export function generateVerbForms(
  root: string,
  existingPast?: string,
  existingPresent?: string,
  existingImperative?: string,
  existingVerbalNoun?: string
): {
  past: string;
  present: string;
  imperative: string;
  verbal_noun: string;
} {
  // If all forms exist, return them
  if (existingPast && existingPast !== "-" &&
      existingPresent && existingPresent !== "-" &&
      existingImperative && existingImperative !== "-" &&
      existingVerbalNoun && existingVerbalNoun !== "-") {
    return {
      past: existingPast,
      present: existingPresent,
      imperative: existingImperative,
      verbal_noun: existingVerbalNoun,
    };
  }

  // Extract root letters (assuming 3-letter root)
  const rootLetters = root.replace(/\s/g, "").split("");
  
  if (rootLetters.length !== 3) {
    // For non-triliteral roots, return what we have or placeholders
    return {
      past: existingPast || "-",
      present: existingPresent || "-",
      imperative: existingImperative || "-",
      verbal_noun: existingVerbalNoun || "-",
    };
  }

  const [r1, r2, r3] = rootLetters;

  // Detect the verb form from existing conjugations
  const detectedForm = detectVerbForm(root, existingPast, existingPresent);

  // Generate missing forms based on the detected pattern
  return generateByForm(
    detectedForm || 'I',
    r1, r2, r3,
    existingPast,
    existingPresent,
    existingImperative,
    existingVerbalNoun
  );
}

/**
 * Check if a root letter is weak (و or ي)
 */
function isWeakLetter(letter: string): boolean {
  return letter === 'و' || letter === 'ي';
}

/**
 * Try to extract the actual pattern from an existing form
 * This helps with weak/hollow verbs where the root letters transform
 */
function extractPattern(existingForm: string, formType: VerbForm): string {
  if (!existingForm || existingForm === "-") return "";
  
  // Remove diacritics to get the consonantal skeleton
  const skeleton = existingForm.replace(/[\u064B-\u065F]/g, "");
  
  // For Form X, the pattern after است is what we need
  if (formType === 'X' && (skeleton.startsWith("است") || skeleton.startsWith("ٱست"))) {
    return skeleton.substring(3); // Get everything after است
  }
  
  return skeleton;
}

/**
 * Generate 3MS present tense from any present tense form
 * Works by replacing the person prefix with ي
 */
function derive3MSPresent(anyPresent: string): string | undefined {
  if (!anyPresent || anyPresent === "-") return undefined;
  
  // Remove diacritics to analyze structure
  const clean = anyPresent.replace(/[\u064B-\u065F]/g, "");
  
  // Common present tense prefixes: ن (we), ت (you/she), أ (I), ي (he)
  // If it starts with ن, ت, or أ, replace with ي
  const firstChar = clean[0];
  if (firstChar === 'ن' || firstChar === 'ت' || firstChar === 'أ') {
    // Replace first character with ي and keep the rest with diacritics
    return 'ي' + anyPresent.substring(1);
  }
  
  // Already 3MS (starts with ي)
  if (firstChar === 'ي') {
    return anyPresent;
  }
  
  return undefined;
}

/**
 * Generate Form X weak verb forms using pattern transformation
 */
function generateFormXWeakVerb(
  r1: string, r2: string, r3: string,
  existingPresent?: string
): { past: string; present: string } | null {
  // Only handle weak middle radical for now (most common case)
  if (r2 !== 'و' && r2 !== 'ي') return null;
  
  // For Form X with weak middle radical:
  // Past: و/ي → ا (e.g., ع و ن → استعان)
  // Present: و/ي → ي (e.g., ع و ن → يستعين)
  
  const past = `اِسْتَ${r1}َانَ`;
  
  // If we have existing present, derive 3MS from it
  let present: string;
  if (existingPresent && existingPresent !== "-") {
    const derived = derive3MSPresent(existingPresent);
    present = derived || `يَسْتَ${r1}ِينُ`;
  } else {
    present = `يَسْتَ${r1}ِينُ`;
  }
  
  return { past, present };
}

/**
 * Generate verb forms based on the specific verb form (وزن)
 */
function generateByForm(
  form: VerbForm,
  r1: string, r2: string, r3: string,
  existingPast?: string,
  existingPresent?: string,
  existingImperative?: string,
  existingVerbalNoun?: string
): VerbPattern {
  // Use existing forms if available
  const hasPast = existingPast && existingPast !== "-";
  const hasPresent = existingPresent && existingPresent !== "-";
  const hasImperative = existingImperative && existingImperative !== "-";
  const hasVerbalNoun = existingVerbalNoun && existingVerbalNoun !== "-";

  let past: string, present: string, imperative: string, verbalNoun: string;
  
  // Check if we have weak radicals
  const hasWeakRadical = isWeakLetter(r1) || isWeakLetter(r2) || isWeakLetter(r3);

  switch (form) {
    case 'X': // استفعل
      // Special handling for Form X weak verbs
      if (hasWeakRadical && hasPresent) {
        const generated = generateFormXWeakVerb(r1, r2, r3, existingPresent);
        if (generated) {
          // Override past tense even if it exists, because Qutrub might have given us Form I
          past = generated.past;
          present = generated.present;
          imperative = hasImperative ? existingImperative : "-";
          verbalNoun = hasVerbalNoun ? existingVerbalNoun : "-";
          break;
        }
      }
      
      // For strong verbs or when we have past, generate missing forms
      past = hasPast ? existingPast : (hasWeakRadical ? "-" : `اِسْتَ${r1}ْ${r2}َ${r3}َ`);
      present = hasPresent ? existingPresent : (hasWeakRadical ? "-" : `يَسْتَ${r1}ْ${r2}ِ${r3}ُ`);
      imperative = hasImperative ? existingImperative : (hasWeakRadical ? "-" : `اِسْتَ${r1}ْ${r2}ِ${r3}ْ`);
      // Verbal noun is often irregular, so keep as "-" if not in corpus
      verbalNoun = hasVerbalNoun ? existingVerbalNoun : "-";
      break;

    case 'VIII': // افتعل
      past = hasPast ? existingPast : (hasWeakRadical ? "-" : `اِ${r1}ْتَ${r2}َ${r3}َ`);
      present = hasPresent ? existingPresent : (hasWeakRadical ? "-" : `يَ${r1}ْتَ${r2}ِ${r3}ُ`);
      imperative = hasImperative ? existingImperative : (hasWeakRadical ? "-" : `اِ${r1}ْتَ${r2}ِ${r3}ْ`);
      verbalNoun = hasVerbalNoun ? existingVerbalNoun : "-";
      break;

    case 'VII': // انفعل
      past = hasPast ? existingPast : (hasWeakRadical ? "-" : `اِنْ${r1}َ${r2}َ${r3}َ`);
      present = hasPresent ? existingPresent : (hasWeakRadical ? "-" : `يَنْ${r1}َ${r2}ِ${r3}ُ`);
      imperative = hasImperative ? existingImperative : (hasWeakRadical ? "-" : `اِنْ${r1}َ${r2}ِ${r3}ْ`);
      verbalNoun = hasVerbalNoun ? existingVerbalNoun : "-";
      break;

    case 'IV': // أفعل
      past = hasPast ? existingPast : (hasWeakRadical ? "-" : `أَ${r1}ْ${r2}َ${r3}َ`);
      present = hasPresent ? existingPresent : (hasWeakRadical ? "-" : `يُ${r1}ْ${r2}ِ${r3}ُ`);
      imperative = hasImperative ? existingImperative : (hasWeakRadical ? "-" : `أَ${r1}ْ${r2}ِ${r3}ْ`);
      verbalNoun = hasVerbalNoun ? existingVerbalNoun : "-";
      break;

    case 'III': // فاعل
      past = hasPast ? existingPast : (hasWeakRadical ? "-" : `${r1}َا${r2}َ${r3}َ`);
      present = hasPresent ? existingPresent : (hasWeakRadical ? "-" : `يُ${r1}َا${r2}ِ${r3}ُ`);
      imperative = hasImperative ? existingImperative : (hasWeakRadical ? "-" : `${r1}َا${r2}ِ${r3}ْ`);
      verbalNoun = hasVerbalNoun ? existingVerbalNoun : "-";
      break;

    case 'II': // فعّل
      past = hasPast ? existingPast : (hasWeakRadical ? "-" : `${r1}َ${r2}َّ${r3}َ`);
      present = hasPresent ? existingPresent : (hasWeakRadical ? "-" : `يُ${r1}َ${r2}ِّ${r3}ُ`);
      imperative = hasImperative ? existingImperative : (hasWeakRadical ? "-" : `${r1}َ${r2}ِّ${r3}ْ`);
      verbalNoun = hasVerbalNoun ? existingVerbalNoun : "-";
      break;

    case 'I': // فعل
    default:
      // Form I: Generate for strong verbs, use corpus data for weak verbs
      past = hasPast ? existingPast : (hasWeakRadical ? "-" : `${r1}َ${r2}َ${r3}َ`);
      present = hasPresent ? existingPresent : (hasWeakRadical ? "-" : `يَ${r1}ْ${r2}ُ${r3}ُ`);
      imperative = hasImperative ? existingImperative : (hasWeakRadical ? "-" : `اِ${r1}ْ${r2}َ${r3}ْ`);
      // Verbal noun is highly irregular in Form I, never generate
      verbalNoun = hasVerbalNoun ? existingVerbalNoun : "-";
      break;
  }

  return { past, present, imperative, verbal_noun: verbalNoun };
}

/**
 * Ensure all verb forms are present, generating missing ones if needed
 */
export function ensureCompleteVerbForms(
  root: string | undefined,
  forms: {
    past?: string;
    present?: string;
    imperative?: string;
    verbal_noun?: string;
  } | undefined
): {
  past: string;
  present: string;
  imperative: string;
  verbal_noun: string;
} {
  if (!root) {
    // No root available, return what we have or placeholders
    return {
      past: forms?.past || "-",
      present: forms?.present || "-",
      imperative: forms?.imperative || "-",
      verbal_noun: forms?.verbal_noun || "-",
    };
  }

  return generateVerbForms(
    root,
    forms?.past,
    forms?.present,
    forms?.imperative,
    forms?.verbal_noun
  );
}
