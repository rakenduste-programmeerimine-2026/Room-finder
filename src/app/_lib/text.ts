/** The length of a text as Postgres char_length() counts it: in code points, not UTF-16 units. */
export const charLength = (text: string): number => [...text].length;

/**
 * Text for matching: lower case, without spaces and punctuation, so "a 543", "A-543"
 * and "a543" match. Letters stay as they are: õ, ä, ö and ü are letters of their own in Estonian.
 */
export const fold = (text: string): string => text.toLocaleLowerCase("et").replace(/[^\p{L}\p{N}]/gu, "");
