/**
 * Qutrub Integration for Arabic Verb Conjugation
 * Uses Qutrub as fallback for missing verb forms, especially weak verbs
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

interface QutrubResult {
  past_3ms: string;
  present_3ms: string;
  imperative_2ms: string;
  success: boolean;
  error?: string;
}

/**
 * Get conjugation from Qutrub Python library
 * Uses a Python subprocess to call libqutrub
 */
export function getQutrubConjugation(
  root: string,
  futureType: 'ضمة' | 'كسرة' | 'فتحة' = 'ضمة'
): QutrubResult {
  try {
    // Clean the root
    const cleanRoot = root.replace(/\s/g, '');
    
    // Create a temporary Python script
    const tempScript = join(process.cwd(), 'temp-qutrub-call.py');
    const tempOutput = join(process.cwd(), 'temp-qutrub-output.json');
    
    const pythonScript = `
# -*- coding: utf-8 -*-
import json
import sys
import libqutrub.conjugator

root = "${cleanRoot}"
future_type = "${futureType}"

try:
    result = libqutrub.conjugator.conjugate(
        root,
        future_type,
        transitive=True,
        display_format="DICT"
    )
    
    if result and isinstance(result, dict):
        past_dict = result.get('الماضي المعلوم', {})
        present_dict = result.get('المضارع المعلوم', {})
        imperative_dict = result.get('الأمر', {})
        
        past_3ms = past_dict.get('هو', '-')
        present_3ms = present_dict.get('هو', '-')
        imperative_2ms = imperative_dict.get('أنت', '-')
        
        # Clean empty strings
        if not past_3ms or past_3ms.strip() == '':
            past_3ms = '-'
        if not present_3ms or present_3ms.strip() == '':
            present_3ms = '-'
        if not imperative_2ms or imperative_2ms.strip() == '':
            imperative_2ms = '-'
        
        output = {
            'past_3ms': past_3ms,
            'present_3ms': present_3ms,
            'imperative_2ms': imperative_2ms,
            'success': True
        }
    else:
        output = {'success': False, 'error': 'No result returned'}
    
    with open('${tempOutput.replace(/\\/g, '\\\\')}', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False)
        
except Exception as e:
    output = {'success': False, 'error': str(e)}
    with open('${tempOutput.replace(/\\/g, '\\\\')}', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False)
`;
    
    // Write the Python script
    writeFileSync(tempScript, pythonScript, 'utf-8');
    
    // Execute Python script
    try {
      execSync(`python "${tempScript}"`, {
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 5000 // 5 second timeout
      });
    } catch (execError) {
      // Even if exec fails, check if output file was created
    }
    
    // Read the result
    if (existsSync(tempOutput)) {
      const resultData = readFileSync(tempOutput, 'utf-8');
      const result = JSON.parse(resultData) as QutrubResult;
      
      // Cleanup
      try {
        unlinkSync(tempScript);
        unlinkSync(tempOutput);
      } catch (e) {
        // Ignore cleanup errors
      }
      
      return result;
    }
    
    // Cleanup on failure
    try {
      if (existsSync(tempScript)) unlinkSync(tempScript);
      if (existsSync(tempOutput)) unlinkSync(tempOutput);
    } catch (e) {
      // Ignore cleanup errors
    }
    
    return {
      past_3ms: '-',
      present_3ms: '-',
      imperative_2ms: '-',
      success: false,
      error: 'No output file created'
    };
    
  } catch (error) {
    return {
      past_3ms: '-',
      present_3ms: '-',
      imperative_2ms: '-',
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Detect future type from existing present form
 */
export function detectFutureType(presentForm?: string): 'ضمة' | 'كسرة' | 'فتحة' {
  if (!presentForm || presentForm === '-') {
    return 'ضمة'; // Default
  }
  
  // Check for kasra (most distinctive)
  if (presentForm.includes('ِ')) {
    return 'كسرة';
  }
  
  // Check for fatha
  if (presentForm.includes('َ') && !presentForm.includes('ُ')) {
    return 'فتحة';
  }
  
  // Default to damma
  return 'ضمة';
}

/**
 * Check if a root contains weak letters
 */
export function isWeakRoot(root: string): boolean {
  return root.includes('و') || root.includes('ي') || root.includes('ء');
}
