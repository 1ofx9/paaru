export interface ParsedSearchQuery {
  type: 'anilist_url' | 'mal_url' | 'tmdb_movie_url' | 'tmdb_tv_url' | 'numeric_id' | 'text';
  id?: number;
  idMal?: number;
  cleanText: string;
  format_in?: string[];
  seasonYear?: number;
}

const FORMAT_SYNONYMS: Record<string, string[]> = {
  movie: ['MOVIE'],
  movies: ['MOVIE'],
  film: ['MOVIE'],
  tv: ['TV', 'TV_SHORT'],
  series: ['TV'],
  ova: ['OVA'],
  ovas: ['OVA'],
  ona: ['ONA'],
  onas: ['ONA'],
  special: ['SPECIAL'],
  specials: ['SPECIAL'],
};

export function parseSearchInput(rawQuery: string): ParsedSearchQuery {
  const trimmed = rawQuery.trim();

  const anilistMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?anilist\.co\/anime\/(\d+)/i);
  if (anilistMatch && anilistMatch[1]) {
    const id = parseInt(anilistMatch[1], 10);
    return {
      type: 'anilist_url',
      id,
      cleanText: `#${id}`,
    };
  }

  const malMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?myanimelist\.net\/anime\/(\d+)/i);
  if (malMatch && malMatch[1]) {
    const idMal = parseInt(malMatch[1], 10);
    return {
      type: 'mal_url',
      idMal,
      cleanText: `MAL #${idMal}`,
    };
  }

  const tmdbMovieMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?themoviedb\.org\/movie\/(\d+)/i);
  if (tmdbMovieMatch && tmdbMovieMatch[1]) {
    const id = parseInt(tmdbMovieMatch[1], 10);
    return {
      type: 'tmdb_movie_url',
      id,
      cleanText: `#${id}`,
    };
  }

  const tmdbTvMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?themoviedb\.org\/tv\/(\d+)/i);
  if (tmdbTvMatch && tmdbTvMatch[1]) {
    const id = parseInt(tmdbTvMatch[1], 10);
    return {
      type: 'tmdb_tv_url',
      id,
      cleanText: `#${id}`,
    };
  }

  const idOnlyMatch = trimmed.match(/^#?(\d{1,7})$/);
  if (idOnlyMatch && idOnlyMatch[1]) {
    const id = parseInt(idOnlyMatch[1], 10);
    return {
      type: 'numeric_id',
      id,
      cleanText: `#${id}`,
    };
  }

  let workingText = trimmed;
  let detectedYear: number | undefined;
  let detectedFormats: string[] | undefined;

  const explicitYearMatch = workingText.match(/\b(?:year|y):(\d{4})\b/i);
  if (explicitYearMatch && explicitYearMatch[1]) {
    detectedYear = parseInt(explicitYearMatch[1], 10);
    workingText = workingText.replace(explicitYearMatch[0], ' ');
  }

  const explicitFormatMatch = workingText.match(/\b(?:type|format):([a-z]+)\b/i);
  if (explicitFormatMatch && explicitFormatMatch[1]) {
    const key = explicitFormatMatch[1].toLowerCase();
    if (FORMAT_SYNONYMS[key]) {
      detectedFormats = FORMAT_SYNONYMS[key];
      workingText = workingText.replace(explicitFormatMatch[0], ' ');
    }
  }

  if (!detectedYear) {
    const standaloneYearMatch = workingText.match(/\b(19[7-9]\d|20[0-3]\d)\b/);
    if (standaloneYearMatch && standaloneYearMatch[1] && workingText.length > 5) {
      const yearVal = parseInt(standaloneYearMatch[1], 10);
      detectedYear = yearVal;
      workingText = workingText.replace(standaloneYearMatch[0], ' ');
    }
  }

  if (!detectedFormats) {
    const tokens = workingText.split(/\s+/);
    if (tokens.length > 1) {
      const lastToken = tokens[tokens.length - 1].toLowerCase();
      if (FORMAT_SYNONYMS[lastToken]) {
        detectedFormats = FORMAT_SYNONYMS[lastToken];
        tokens.pop();
        workingText = tokens.join(' ');
      }
    }
  }

  const cleanText = workingText.replace(/\s+/g, ' ').trim();

  return {
    type: 'text',
    cleanText: cleanText || trimmed,
    format_in: detectedFormats,
    seasonYear: detectedYear,
  };
}
