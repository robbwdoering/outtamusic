/**
 * file: analysis.js
 * description: This file contains utilities for analyzing a list of songs and generating a set of
 * graphable data. Users will run this code when they try to join a group for the first time.
 * This is done on the client to save costs, which means users could pretty easily fabricate any or all
 * of the results of this analysis. Since users can only join groups with their friends, this is fine.
 */
import { Matrix } from 'ml-matrix';
import { TrackFeatures, AlbumFeatures, ArtistFeatures, NumFeatures } from './constants';

export const handleError = (err) => {
    console.error(err);
    return null;
}

const combineRecords = (lhs, rhs) => {
    const ret = {
    }
    return ret;
}

/**
 * Analyze the event of this user joining this group.
 * @param spotify api obj
 * @param group object describing the current group
 * @param userId current user's ID
 * @param records the existing data structure for this group
 * @returns {Promise<{albums: {features: null, ids: *[]}, artists: {features: null, ids: *[]}, genres: *[], playlists: {}, tracks: {features: null, ids: *[]}}>}
 */
export const performOnJoinAnalysis = async (spotify, group, userId, records) => {
    console.log("[performOnJoinAnalysis] ENTER", group)
    if (!records) {
        records = { tracks: {}, artists: {}, albums: {} }
    }

    const ret = {
        tracks: {
            ids: records.tracks.ids || [],
            features: null
        },
        artists: {
            ids: records.artists.ids || [],
            features: null
        },
        albums: {
            ids: records.albums.ids || [],
            features: null
        },
        playlists: {},
        genres: []
    };

    // Find all the "best of" playlists available to this user
    const playlists = await getPlaylists(spotify, userId);
    if (!playlists) {
        return null;
    }
    const years = Object.keys(playlists);
    years.sort();
    console.log("Calculating results for years:", years);

    // Ingest tracks for every playlist
    const trackLists = {}
    for (let i=0; i < years.length; i++) {
        const year = years[i];

        await spotify.getPlaylistTracks(playlists[year].id, {})
            .then(data => {
                // Get all non-local tracks within this playlist
                trackLists[year] = data.items.map(item => item.is_local ? null : item.track).filter(e => e);
            }, handleError);
    }

    console.log("Ingested tracks, final objects:", trackLists)

    // Determine the shape of all our arrays by counting the number of unique tracks
    const { trackIds, albumIds, artistIds, genreNames } = years.reduce((acc, year) => {
        // console.log(year, trackLists[year])

        trackLists[year].forEach(track => {
            acc.trackIds.add(track.id);
            acc.albumIds.add(track.album.id);
            track.artists.forEach(artist => {
                acc.artistIds.add(artist.id)
                // artist.genres.forEach(genre => acc.genreNames.add(genre));
                // TODO do this post-hoc instead, since it needs separate individual getArtist() calls
            });
        });

        return acc;
    }, { trackIds: new Set(ret.tracks.ids), albumIds: new Set(), artistIds: new Set(), genreNames: new Set() });
    ret.tracks.ids = [...trackIds]
    ret.tracks.features = Matrix.zeros(ret.tracks.ids.length, NumFeatures.tracks);

    ret.albums.ids = [...albumIds]
    ret.albums.features = new Array(ret.artists.ids.length)

    ret.artists.ids = [...artistIds]
    ret.artists.features = new Array(ret.artists.ids.length)


    const processedTracks = ret.tracks.ids.map(() => false);
    // ret.genres = [...genreNames]

    // Get features for every track, and ingest it all into a set of numeric arrays
    for (let i=0; i < years.length; i++) {
        const year = years[i];
        ret.playlists[year] = [];

        await spotify.getAudioFeaturesForTracks(trackLists[year].map(track => track.id))
            .then(data => {
                if (!data.audio_features || data.audio_features.length !== trackLists[year].length) {
                    return handleError("Invalid analysis arguments.");
                }

                // console.log("Audio Features:", data);
                let track, features, idx;
                // Ingest track features from both endpoints (/track and /feature)
                // These are stored in an array of floats instead of labeled JSON,
                // to reduce memory + network loads
                for (let i = 0; i < data.audio_features.length; i++) {
                    track = trackLists[year][i];
                    features = data.audio_features[i];
                    idx = ret.tracks.ids.indexOf(track.id);

                    // If this track has already been ingested, skip the following work
                    if (processedTracks[idx]) {
                        continue;
                    }
                    processedTracks[idx] = true;

                    ingestTrack(ret, track, features, idx);
                    ingestAlbum(ret, track.album);
                    ingestArtists(ret, track.artists);

                    // Record this song's presence, and tie it an album and set of artists
                    ret.playlists[year].push([
                        ret.tracks.ids.indexOf(track.id), // track record IDX
                        ret.albums.ids.indexOf(track.album.id), // album IDX
                        track.artists.map(artist => ret.artists.ids.indexOf(artist.id)) // artist IDXs
                    ]);
                }
            }, handleError);
    }

    console.log("[performOnJoinAnalysis] EXIT", ret);
    return ret;
};


// HELPER FUNCTIONS
/**
 * Ingest data from a track into the return structure, from both track endpoints (/track and /feature).
 * @param ret the return structure
 * @param artists an album object, see endpoint docs
 */
const ingestTrack = (ret, track, features, idx) => {
    // Ingest track features from /track and /feature
    TrackFeatures.track.forEach((feature, featureIdx) => {
        ret.tracks.features.set(idx, featureIdx, track[feature.key]);
    });
    TrackFeatures.feature.forEach((feature, featureIdx) => {
        const actIdx = featureIdx + TrackFeatures.track.length;
        const val = features[feature.key]
        ret.tracks.features.set(idx, actIdx, feature.customFunc ? feature.customFunc(val) : val);
    });
};

/**
 * Ingest data from an album object into the return structure.
 * @param ret the return structure
 * @param artists an album object, see endpoint docs
 */
const ingestAlbum = (ret, album) => {
    const idx = ret.albums.ids.indexOf(album.id);
    if (Boolean(ret.albums.features[idx])) {
        return;
    }

    ret.albums.features[idx] = AlbumFeatures.album.map(feature => {
        const val = album[feature.key];
        return feature.customFunc ? feature.customFunc(val) : val;
    });
};

/**
 * Ingest data from a list of artist objects into the return structure.
 * @param ret the return structure
 * @param artists a list of artist objects, see endpoint docs
 */
const ingestArtists = (ret, artists) => {
    artists.forEach(artist => {
        const idx = ret.artists.ids.indexOf(artist.id);
        if (Boolean(ret.artists.features[idx])) {
            return;
        }

        ret.artists.features[idx] = ArtistFeatures.artist.map(feature => {
            const val = artist[feature.key];
            return feature.customFunc ? feature.customFunc(val) : val;
        };
    });
};

/**
 * Fetches a list of all the "Top Songs" playlists for the currently authenticated user.
 * @param spotify the spotify api ob
 * @param userId the id of this user
 * @returns an array of objects, see endpoint docs
 */
const getPlaylists = async (spotify, userId) => {
    return await spotify.getUserPlaylists(userId, { limit: 50 })
        .then(data => {
            return data.items.reduce((acc, playlist) => {
                if (playlist.name && playlist.name.match(/^Your Top Songs 20\d\d$/g)) {
                    const year = parseInt(playlist.name.split(' ')[3]);
                    if (year && !Object.keys(acc).includes(year)) {
                        acc[year] = playlist;
                    }
                }
                return acc;
            }, {});
        }, handleError);
}
