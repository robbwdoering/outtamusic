import * as d3 from "d3";
import {AlbumFeatures, ArtistFeatures, TrackFeatures} from "./constants";
import {handleError} from "./analysis";

export const getUserIdx = (playlists, year, trackIdx) => {
    let count = 0;
    let userIdx = 0;
    for (const length of playlists.map(userObj => userObj[year].length)) {
        if (trackIdx >= count && trackIdx < count + length) {
            return [userIdx, trackIdx - count];
        }
        userIdx++;
        count += length;
    }

    return [-1, -1];
}

export const normalize = matrix => {
    const extents = Object.keys(matrix[0]).map(colIdx => d3.extent(matrix.map(row => row[colIdx])));
    const ranges = extents.map(([min, max]) => max - min);
    return matrix.map(row => (
        row.map((col, colIdx) => (col - extents[colIdx][0]) / ranges[colIdx])
    ));
}

/**
 * Ingest data from a track into the return structure, from both track endpoints (/track and /feature).
 * @param ret the return structure
 * @param artists an album object, see endpoint docs
 */
export const ingestTrack = (ret, track, features, idx) => {
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
export const ingestAlbum = (ret, album) => {
    const idx = ret.albums.ids.indexOf(album.id);
    if (Boolean(ret.albums.features[idx])) {
        return;
    }

    ret.albums.features[idx] = AlbumFeatures.album.map(feature => {
        return feature.customFunc ? feature.customFunc(album) : album[feature.key];
    });
};

/**
 * Ingest data from a list of artist objects into the return structure.
 * @param ret the return structure
 * @param artists a list of artist objects, see endpoint docs
 */
export const ingestArtist = (ret, artist) => {
    const idx = ret.artists.ids.indexOf(artist.id);
    if (Boolean(ret.artists.features[idx])) {
        return;
    }

    ret.artists.features[idx] = ArtistFeatures.artist.map(feature => {
        return feature.customFunc ? feature.customFunc(artist) : artist[feature.key];
    });

    // Replace genre strings with indices
    if (ret.artists.features[idx][1]) {
        for (const subIdx in ret.artists.features[idx][1]) {
            const genre = ret.artists.features[idx][1][subIdx];
            let foundIdx = ret.genres.indexOf(genre);

            if (foundIdx === -1) {
                ret.genres.push(genre);
                foundIdx = ret.genres.length - 1;
            }

            ret.artists.features[idx][1][subIdx] = foundIdx;
        }
    }
};

/**
 * Fetches a list of all the "Top Songs" playlists for the currently authenticated user.
 * @param spotify the spotify api ob
 * @param userId the id of this user
 * @returns an array of objects, see endpoint docs
 */
export const getPlaylists = async (spotify, userId) => {
    if (window.localStorage.getItem('cached_playlist_user') === userId && Date.now() < 1672578000000) {
        console.log("Fetching cached playlists...")
        return JSON.parse(window.localStorage.getItem('cached_playlist'));
    }
    return await spotify.getUserPlaylists(userId, {limit: 50})
        .then(data => {
            const ret = data.items.reduce((acc, playlist) => {
                if (playlist.name && playlist.name.match(/^Your Top Songs 20\d\d$/g)) {
                    const year = parseInt(playlist.name.split(' ')[3]);
                    if (year && !Object.keys(acc).includes(year)) {
                        acc[year] = playlist;
                    }
                }
                return acc;
            }, {});

            window.localStorage.setItem('cached_playlist_user', userId);
            window.localStorage.setItem('cached_playlist', JSON.stringify(ret));

            return ret;
        }, handleError);
}

/**
 * Fetches data for all the artists found in this group. Due to API constraints,
 * this is done in buckets of maximum length 50.
 * @param spotify the spotify api ob
 * @param userId the id of this user
 * @returns an array of objects, see endpoint docs
 */
export const getArtistData = async (spotify, ret) => {
    const numRows = ret.artists.ids.length;
    const firstNewRow = ret.artists.features.findIndex(row => !row || !row.length || row[0] === 0);
    const numNewArtists = numRows - firstNewRow;
    const numBuckets = Math.ceil(numNewArtists / 50);
    let start = firstNewRow;
    let end = Math.min(firstNewRow + 50, numRows);

    for (let bId = 0; bId < numBuckets; bId++) {
        const ids = ret.artists.ids.slice(start, end);
        await spotify.getArtists(ids, {}).then(data => {
            data.artists.forEach(artist => ingestArtist(ret, artist));
        }, handleError);

        start += 50;
        end += 50;
    }
}

/**
 * Fetches a list of "feature" objects for a list of tracks.
 * @param spotify
 * @param tracks
 * @param userId
 * @returns {Promise<void>}
 */
export const getFeatures = async (spotify, year, tracks, userId) => {
    if (window.localStorage.getItem('cached_playlist_user') === userId && Date.now() < 1672578000000) {
        const features = window.localStorage.getItem('cached_features_' + year)
        if (features && features.length > 0) {
            console.log("Fetching cached audio features for " + year + " ...")
            return JSON.parse(features);
        }
    }

    return await spotify.getAudioFeaturesForTracks(tracks).then(data => {
        window.localStorage.setItem('cached_features_' + year, JSON.stringify(data));

        if (!data.audio_features) {
            return handleError("Invalid analysis results.");
        }
        return data;
    }, handleError);
}

/**
 * Creates a new version of the passed object that only contains the top 5 most frequent entries.
 * @param obj { [ID]: [integer count]}
 * @returns A new copied object with a maximum of 5 keys.
 */
export const truncateObj = (obj) => {
    // Create a sorted array of all the entries that were found twice in one playlist
    const tmpArr = Object.keys(obj)
        .filter(key => obj[key] > 1);
    tmpArr.sort();

    // Return the top 5 most frequent entries
    return tmpArr.reduce((acc, key) => {
        if (Object.keys(acc).length < 5) {
            acc[key] = obj[key];
        }
        return acc;
    }, {});
}
