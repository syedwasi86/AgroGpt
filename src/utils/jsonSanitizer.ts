/**
 * Sanitizes a string returned by Gemini to make it parseable as JSON.
 * - Uses regex to extract only the text content inside markdown code blocks if the model wrapped it.
 * - Escapes raw, unescaped line breaks and tabs inside JSON string property values.
 * - Removes control characters (ASCII 0-31) inside JSON string property values.
 * - Removes trailing commas from objects and arrays.
 */
export function sanitizeJsonString(text: string): string {
  let cleaned = text.trim();

  // 1. Extract only the content inside markdown code block if present
  const markdownRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = cleaned.match(markdownRegex);
  if (match) {
    cleaned = match[1].trim();
  }

  // 2. Character-by-character scan to sanitize string literals (handling unescaped newlines/control characters)
  let pass1 = '';
  let inString = false;
  let escapeActive = false;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (escapeActive) {
      pass1 += char;
      escapeActive = false;
      continue;
    }

    if (char === '\\') {
      pass1 += char;
      escapeActive = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      pass1 += char;
      continue;
    }

    if (inString) {
      if (char === '\n') {
        pass1 += '\\n';
      } else if (char === '\r') {
        // Skip carriage return, as we will represent newlines with \n
      } else if (char === '\t') {
        pass1 += '\\t';
      } else {
        const code = char.charCodeAt(0);
        // Remove other control characters (ASCII 0 to 31)
        if (code >= 32) {
          pass1 += char;
        }
      }
    } else {
      pass1 += char;
    }
  }

  // 3. Remove trailing commas from objects/arrays
  let finalResult = '';
  inString = false;
  escapeActive = false;

  for (let i = 0; i < pass1.length; i++) {
    const char = pass1[i];

    if (escapeActive) {
      finalResult += char;
      escapeActive = false;
      continue;
    }

    if (char === '\\') {
      finalResult += char;
      escapeActive = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      finalResult += char;
      continue;
    }

    if (!inString && char === ',') {
      // Check if the next non-whitespace characters are '}' or ']'
      let lookAheadIdx = i + 1;
      let isTrailing = false;
      while (lookAheadIdx < pass1.length) {
        const nextChar = pass1[lookAheadIdx];
        if (nextChar === ' ' || nextChar === '\n' || nextChar === '\r' || nextChar === '\t') {
          lookAheadIdx++;
          continue;
        }
        if (nextChar === '}' || nextChar === ']') {
          isTrailing = true;
        }
        break;
      }

      if (isTrailing) {
        // Skip trailing comma
        continue;
      }
    }

    finalResult += char;
  }

  return finalResult;
}
