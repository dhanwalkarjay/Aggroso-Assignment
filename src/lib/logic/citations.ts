const normalizeCitation = (value: string) =>
  value
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

export const quoteExists = (
  quote: string | null | undefined,
  source: string,
) =>
  Boolean(
    quote &&
      quote.trim().length >= 10 &&
      normalizeCitation(source).includes(normalizeCitation(quote)),
  );
