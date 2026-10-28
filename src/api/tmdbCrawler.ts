import {
  fetchTMDBMovieDetails,
  fetchTMDBCollection,
  fetchTMDBTVDetails,
  searchTMDBMovies,
  searchTMDBShows,
  getTMDBImageUrl,
} from './tmdb';
import type { TMDBMovie, TMDBTVShow } from './tmdb';
import { findUniverseForTitle, matchesExpectedTitle } from './tmdbUniverses';
import type { RawEdge } from './crawler';
import type { AniListMedia } from '../types/anime';

export interface SuiteCrawlResult {
  mediaMap: Map<number, AniListMedia>;
  rawEdges: RawEdge[];
  rootId: number;
}

interface ShowSeasonResult {
  firstSeasonId: number;
  lastSeasonId: number;
  allNodeIds: number[];
}

function mapShowToMediaMap(
  show: TMDBTVShow,
  mediaMap: Map<number, AniListMedia>,
  rawEdges: RawEdge[],
  onProgress?: (loaded: number, total: number, title?: string) => void
): ShowSeasonResult {
  const releaseYear = show.first_air_date ? parseInt(show.first_air_date.substring(0, 4), 10) : undefined;
  const youtubeTrailer = show.videos?.results?.find((v) => v.site === 'YouTube' && v.type === 'Trailer')?.key;

  const validSeasons = (show.seasons || []).filter((s) => s.episode_count > 0);
  const regularSeasons = validSeasons
    .filter((s) => s.season_number > 0)
    .sort((a, b) => a.season_number - b.season_number);
  const specialsSeason = validSeasons.find((s) => s.season_number === 0);

  let firstSeasonId = show.id;
  let lastSeasonId = show.id;
  const allNodeIds: number[] = [];

  if (regularSeasons.length > 0) {
    let prevSeasonNodeId: number | null = null;

    regularSeasons.forEach((season, idx) => {
      onProgress?.(idx + 1, regularSeasons.length, `${show.name}: ${season.name}`);
      const sYear = season.air_date ? parseInt(season.air_date.substring(0, 4), 10) : releaseYear;
      const nodeId = idx === 0 ? show.id : (season.id || (show.id * 1000 + season.season_number));

      if (idx === 0) firstSeasonId = nodeId;
      if (idx === regularSeasons.length - 1) lastSeasonId = nodeId;
      allNodeIds.push(nodeId);

      const seasonTitle = regularSeasons.length === 1 && season.name.toLowerCase() === 'season 1'
        ? show.name
        : `${show.name}: ${season.name}`;

      mediaMap.set(nodeId, {
        id: nodeId,
        title: {
          english: seasonTitle,
          romaji: seasonTitle,
        },
        format: 'TV',
        status: show.status === 'Ended' && idx === regularSeasons.length - 1 ? 'FINISHED' : 'RELEASING',
        episodes: season.episode_count,
        seasonYear: sYear,
        averageScore: show.vote_average ? Math.round(show.vote_average * 10) : undefined,
        description: season.overview || show.overview,
        genres: show.genres?.map((g) => g.name),
        studios: show.networks && show.networks.length > 0 ? {
          edges: show.networks.map((n) => ({ isMain: true, node: { id: n.id, name: n.name } })),
        } : undefined,
        trailer: idx === 0 && youtubeTrailer ? { id: youtubeTrailer, site: 'youtube' } : undefined,
        coverImage: {
          large: getTMDBImageUrl(season.poster_path || show.poster_path, 'w500') || undefined,
          medium: getTMDBImageUrl(season.poster_path || show.poster_path, 'w185') || undefined,
        },
        bannerImage: getTMDBImageUrl(show.backdrop_path, 'w780') || undefined,
        siteUrl: `https://www.themoviedb.org/tv/${show.id}/season/${season.season_number}`,
        relations: { edges: [] },
      });

      if (prevSeasonNodeId !== null) {
        rawEdges.push({
          source: prevSeasonNodeId,
          target: nodeId,
          type: 'SEQUEL',
        });
      }
      prevSeasonNodeId = nodeId;
    });

    if (specialsSeason) {
      const specialsNodeId = specialsSeason.id || (show.id * 1000);
      const specialsYear = specialsSeason.air_date ? parseInt(specialsSeason.air_date.substring(0, 4), 10) : releaseYear;
      allNodeIds.push(specialsNodeId);

      mediaMap.set(specialsNodeId, {
        id: specialsNodeId,
        title: {
          english: `${show.name}: Specials`,
          romaji: `${show.name}: Specials`,
        },
        format: 'SPECIAL',
        status: 'FINISHED',
        episodes: specialsSeason.episode_count,
        seasonYear: specialsYear,
        description: specialsSeason.overview || `${show.name} special episodes and extras.`,
        coverImage: {
          large: getTMDBImageUrl(specialsSeason.poster_path || show.poster_path, 'w500') || undefined,
          medium: getTMDBImageUrl(specialsSeason.poster_path || show.poster_path, 'w185') || undefined,
        },
        bannerImage: getTMDBImageUrl(show.backdrop_path, 'w780') || undefined,
        siteUrl: `https://www.themoviedb.org/tv/${show.id}/season/0`,
        relations: { edges: [] },
      });

      rawEdges.push({
        source: firstSeasonId,
        target: specialsNodeId,
        type: 'SIDE_STORY',
      });
    }
  } else {
    allNodeIds.push(show.id);
    mediaMap.set(show.id, {
      id: show.id,
      title: {
        english: show.name,
        romaji: show.name,
      },
      format: 'TV',
      status: show.status === 'Ended' ? 'FINISHED' : 'RELEASING',
      episodes: show.number_of_episodes || undefined,
      seasonYear: releaseYear,
      averageScore: show.vote_average ? Math.round(show.vote_average * 10) : undefined,
      description: show.overview,
      genres: show.genres?.map((g) => g.name),
      studios: show.networks && show.networks.length > 0 ? {
        edges: show.networks.map((n) => ({ isMain: true, node: { id: n.id, name: n.name } })),
      } : undefined,
      trailer: youtubeTrailer ? { id: youtubeTrailer, site: 'youtube' } : undefined,
      coverImage: {
        large: getTMDBImageUrl(show.poster_path, 'w500') || undefined,
        medium: getTMDBImageUrl(show.poster_path, 'w185') || undefined,
      },
      bannerImage: getTMDBImageUrl(show.backdrop_path, 'w780') || undefined,
      siteUrl: `https://www.themoviedb.org/tv/${show.id}`,
      relations: { edges: [] },
    });
  }

  return { firstSeasonId, lastSeasonId, allNodeIds };
}

function mapMovieToMediaMap(
  movie: TMDBMovie,
  mediaMap: Map<number, AniListMedia>
): number {
  const releaseYear = movie.release_date ? parseInt(movie.release_date.substring(0, 4), 10) : undefined;
  const youtubeTrailer = movie.videos?.results?.find((v) => v.site === 'YouTube' && v.type === 'Trailer')?.key;

  mediaMap.set(movie.id, {
    id: movie.id,
    title: {
      english: movie.title,
      romaji: movie.title,
    },
    format: 'MOVIE',
    status: 'FINISHED',
    episodes: 1,
    duration: movie.runtime || undefined,
    seasonYear: releaseYear,
    averageScore: movie.vote_average ? Math.round(movie.vote_average * 10) : undefined,
    description: movie.overview,
    genres: movie.genres?.map((g) => g.name),
    trailer: youtubeTrailer ? { id: youtubeTrailer, site: 'youtube' } : undefined,
    coverImage: {
      large: getTMDBImageUrl(movie.poster_path, 'w500') || undefined,
      medium: getTMDBImageUrl(movie.poster_path, 'w185') || undefined,
    },
    bannerImage: getTMDBImageUrl(movie.backdrop_path, 'w780') || undefined,
    siteUrl: `https://www.themoviedb.org/movie/${movie.id}`,
    relations: { edges: [] },
  });

  return movie.id;
}

export async function crawlTMDBMovieCollection(
  rootMovieId: number,
  onProgress?: (loaded: number, total: number, title?: string) => void,
  signal?: AbortSignal
): Promise<SuiteCrawlResult> {
  onProgress?.(1, 3, 'Fetching movie details...');
  const rootMovie = await fetchTMDBMovieDetails(rootMovieId, signal);

  const mediaMap = new Map<number, AniListMedia>();
  const rawEdges: RawEdge[] = [];
  const processedMovieIds = new Set<number>();

  const collectionId = rootMovie.belongs_to_collection?.id;
  let lastCollectionMovieId = rootMovie.id;

  if (collectionId) {
    onProgress?.(1, 3, `Loading collection: ${rootMovie.belongs_to_collection?.name}...`);
    try {
      const collection = await fetchTMDBCollection(collectionId, signal);
      const sortedParts = [...collection.parts].sort((a, b) => {
        const dateA = a.release_date || '9999-99-99';
        const dateB = b.release_date || '9999-99-99';
        return dateA.localeCompare(dateB);
      });

      let prevId: number | null = null;
      let idx = 0;

      for (const part of sortedParts) {
        idx++;
        onProgress?.(idx, sortedParts.length, part.title);
        processedMovieIds.add(part.id);
        lastCollectionMovieId = part.id;

        const releaseYear = part.release_date ? parseInt(part.release_date.substring(0, 4), 10) : undefined;
        mediaMap.set(part.id, {
          id: part.id,
          title: {
            english: part.title,
            romaji: part.title,
          },
          format: 'MOVIE',
          status: 'FINISHED',
          episodes: 1,
          seasonYear: releaseYear,
          averageScore: part.vote_average ? Math.round(part.vote_average * 10) : undefined,
          description: part.overview,
          genres: rootMovie.genres?.map((g) => g.name),
          coverImage: {
            large: getTMDBImageUrl(part.poster_path, 'w500') || undefined,
            medium: getTMDBImageUrl(part.poster_path, 'w185') || undefined,
          },
          bannerImage: getTMDBImageUrl(part.backdrop_path, 'w780') || undefined,
          siteUrl: `https://www.themoviedb.org/movie/${part.id}`,
          relations: { edges: [] },
        });

        if (prevId !== null) {
          rawEdges.push({
            source: prevId,
            target: part.id,
            type: 'SEQUEL',
          });
        }
        prevId = part.id;
      }
    } catch {
      mapMovieToMediaMap(rootMovie, mediaMap);
      processedMovieIds.add(rootMovie.id);
    }
  } else {
    mapMovieToMediaMap(rootMovie, mediaMap);
    processedMovieIds.add(rootMovie.id);
  }

  const universe = findUniverseForTitle(rootMovie.title);
  if (universe) {
    onProgress?.(2, 3, `Expanding ${universe.name}...`);
    const companionQueries = universe.queries.filter(
      (q) => !matchesExpectedTitle(rootMovie.title, q.title)
    );

    const companionResults = await Promise.allSettled(
      companionQueries.map(async (cq) => {
        try {
          if (cq.type === 'movie') {
            const searchResults = await searchTMDBMovies(cq.title, cq.year, signal);
            const candidates = searchResults.filter((r) => matchesExpectedTitle(r.title, cq.title));
            const match = candidates.find((r) => r.title.toLowerCase() === cq.title.toLowerCase()) || candidates[0];
            if (!match || processedMovieIds.has(match.id)) return null;
            const movieData = await fetchTMDBMovieDetails(match.id, signal);
            return { cq, movieData, showData: null };
          } else {
            const searchResults = await searchTMDBShows(cq.title, cq.year, signal);
            const candidates = searchResults.filter((r) => matchesExpectedTitle(r.name, cq.title));
            const match = candidates.find((r) => r.name.toLowerCase() === cq.title.toLowerCase()) || candidates[0];
            if (!match) return null;
            const showData = await fetchTMDBTVDetails(match.id, signal);
            return { cq, showData, movieData: null };
          }
        } catch {
          return null;
        }
      })
    );

    for (const res of companionResults) {
      if (res.status !== 'fulfilled' || !res.value) continue;
      const { cq, movieData, showData } = res.value;

      if (cq.type === 'movie' && movieData) {
        mapMovieToMediaMap(movieData, mediaMap);
        processedMovieIds.add(movieData.id);

        let targetId = rootMovieId;
        if (cq.anchorTitle) {
          for (const mId of processedMovieIds) {
            const media = mediaMap.get(mId);
            if (media && matchesExpectedTitle(media.title.english, cq.anchorTitle)) {
              targetId = mId;
              break;
            }
          }
        }

        if (cq.relation === 'PREQUEL') {
          rawEdges.push({ source: movieData.id, target: targetId, type: 'PREQUEL' });
        } else if (cq.relation === 'SEQUEL') {
          rawEdges.push({ source: targetId, target: movieData.id, type: 'SEQUEL' });
        } else {
          rawEdges.push({ source: targetId, target: movieData.id, type: cq.relation });
        }
      } else if (cq.type === 'tv' && showData) {
        const { firstSeasonId, lastSeasonId } = mapShowToMediaMap(showData, mediaMap, rawEdges);
        const targetId = lastCollectionMovieId || rootMovieId;

        if (cq.relation === 'PREQUEL') {
          rawEdges.push({ source: lastSeasonId, target: rootMovieId, type: 'PREQUEL' });
        } else {
          rawEdges.push({ source: targetId, target: firstSeasonId, type: cq.relation });
        }
      }
    }
  }

  return {
    mediaMap,
    rawEdges,
    rootId: rootMovieId,
  };
}

export async function crawlTMDBTVUniverse(
  rootTvId: number,
  onProgress?: (loaded: number, total: number, title?: string) => void,
  signal?: AbortSignal
): Promise<SuiteCrawlResult> {
  onProgress?.(1, 3, 'Fetching series details...');
  const rootShow = await fetchTMDBTVDetails(rootTvId, signal);

  const mediaMap = new Map<number, AniListMedia>();
  const rawEdges: RawEdge[] = [];

  const rootShowInfo = mapShowToMediaMap(rootShow, mediaMap, rawEdges, onProgress);
  const showInfoMap = new Map<number, ShowSeasonResult>();
  showInfoMap.set(rootShow.id, rootShowInfo);

  const universe = findUniverseForTitle(rootShow.name);

  if (universe) {
    onProgress?.(2, 3, `Expanding ${universe.name}...`);
    const companionQueries = universe.queries.filter(
      (q) => !matchesExpectedTitle(rootShow.name, q.title)
    );

    const settled = await Promise.allSettled(
      companionQueries.map(async (cq) => {
        try {
          if (cq.type === 'tv') {
            const searchResults = await searchTMDBShows(cq.title, cq.year, signal);
            const candidates = searchResults.filter((r) => matchesExpectedTitle(r.name, cq.title));
            const match = candidates.find((r) => r.name.toLowerCase() === cq.title.toLowerCase()) || candidates[0];
            if (!match || match.id === rootTvId) return null;
            const showData = await fetchTMDBTVDetails(match.id, signal);
            return { cq, showData, movieData: null };
          } else {
            const searchResults = await searchTMDBMovies(cq.title, cq.year, signal);
            const candidates = searchResults.filter((r) => matchesExpectedTitle(r.title, cq.title));
            const match = candidates.find((r) => r.title.toLowerCase() === cq.title.toLowerCase()) || candidates[0];
            if (!match) return null;
            const movieData = await fetchTMDBMovieDetails(match.id, signal);
            return { cq, showData: null, movieData };
          }
        } catch {
          return null;
        }
      })
    );

    for (const res of settled) {
      if (res.status !== 'fulfilled' || !res.value) continue;
      const { cq, showData, movieData } = res.value;

      let targetShowInfo = rootShowInfo;
      if (cq.anchorTitle) {
        for (const [sId, sInfo] of showInfoMap.entries()) {
          const media = mediaMap.get(sId);
          if (media && matchesExpectedTitle(media.title.english, cq.anchorTitle)) {
            targetShowInfo = sInfo;
            break;
          }
        }
      }

      if (cq.type === 'tv' && showData) {
        const companionInfo = mapShowToMediaMap(showData, mediaMap, rawEdges);
        showInfoMap.set(showData.id, companionInfo);

        if (cq.relation === 'SEQUEL') {
          rawEdges.push({
            source: targetShowInfo.lastSeasonId,
            target: companionInfo.firstSeasonId,
            type: 'SEQUEL',
          });
        } else {
          // SPIN_OFF or PREQUEL branch cleanly from the anchor show's first season to the companion show's first season
          rawEdges.push({
            source: targetShowInfo.firstSeasonId,
            target: companionInfo.firstSeasonId,
            type: cq.relation,
          });
        }
      } else if (cq.type === 'movie' && movieData) {
        const movieId = mapMovieToMediaMap(movieData, mediaMap);

        if (cq.relation === 'SEQUEL') {
          rawEdges.push({
            source: targetShowInfo.lastSeasonId,
            target: movieId,
            type: 'SEQUEL',
          });
        } else if (cq.relation === 'PREQUEL') {
          rawEdges.push({
            source: movieId,
            target: targetShowInfo.firstSeasonId,
            type: 'PREQUEL',
          });
        } else {
          rawEdges.push({
            source: targetShowInfo.firstSeasonId,
            target: movieId,
            type: cq.relation,
          });
        }
      }
    }
  }

  onProgress?.(3, 3, 'Complete');

  return {
    mediaMap,
    rawEdges,
    rootId: rootTvId,
  };
}
