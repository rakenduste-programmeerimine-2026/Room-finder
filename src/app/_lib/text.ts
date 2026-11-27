/** The length of a text as Postgres char_length() counts it: in code points, not UTF-16 units. */
export const charLength = (text: string): number => [...text].length;
