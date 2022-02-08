/**
 * file: analysis.js
 * description: This file contains utilities for analyzing a list of songs and generating a set of
 * graphable data. Users will run this code when they try to join a group for the first time.
 * This is done on the client to save costs, which means users could pretty easily fabricate any or all
 * of the results of this analysis. Since users can only join groups with their friends, this is fine.
 */
import {Matrix} from 'ml-matrix';
import WCluster from 'w-cluster'

import {getUserIdx, normalize} from './utils';
import {TrackFeatures, AlbumFeatures, ArtistFeatures, NumFeatures, dynamicKeyIdxs, decadeBuckets} from './constants';

export const handleError = (err) => {
    console.error(err);
    return null;
}

/**
 * Analyze the event of this user joining this group.
 * @param records the existing data structure for this group
 * @param spotify api obj
 * @param group object describing the current group
 * @param userId current user's ID
 * @returns {Promise<{albums: {features: null, ids: *[]}, artists: {features: null, ids: *[]}, genres: *[], playlists: {}, tracks: {features: null, ids: *[]}}>}
 */
export const ingestIntoRecords = async (records, spotify, group, userId) => {
    console.log("[performOnJoinAnalysis] ENTER", group, records)
    if (!records) {
        records = {tracks: {}, artists: {}, albums: {}}
    }

    const newRecords = {
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
        playlists: [...(records.playlists || []), {userId}],
        genres: records.genres || []
    };

    // Find all the "best of" playlists available to this user
    const playlists = await getPlaylists(spotify, userId);
    if (!playlists) {
        return null;
    }
    const userIdx = newRecords.playlists.length - 1;
    const years = Object.keys(playlists);
    years.sort();
    console.log("Calculating results for years:", years);

    // Ingest tracks for every playlist
    const trackLists = {}
    for (let i = 0; i < years.length; i++) {
        const year = years[i];

        await spotify.getPlaylistTracks(playlists[year].id, {})
            .then(data => {
                // Get all non-local tracks within this playlist
                trackLists[year] = data.items.map(item => item.is_local ? null : item.track).filter(e => e);
            }, handleError);
    }

    console.log("Ingested tracks, final objects:", trackLists)

    // Determine the shape of all our arrays by counting the number of unique tracks
    const {trackIds, albumIds, artistIds, genreNames} = years.reduce((acc, year) => {
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
    }, {
        trackIds: new Set(newRecords.tracks.ids),
        albumIds: new Set(newRecords.albums.ids),
        artistIds: new Set(newRecords.artists.ids),
        genreNames: new Set(newRecords.genres)
    });
    newRecords.tracks.ids = [...trackIds]
    newRecords.tracks.features = Matrix.zeros(newRecords.tracks.ids.length, NumFeatures.tracks);
    records.tracks.features.forEach((track, trackIdx) => {
        newRecords.tracks.features.setRow(trackIdx, track);
    });

    newRecords.albums.ids = [...albumIds]
    newRecords.albums.features = new Array(newRecords.artists.ids.length)
    records.albums.features.forEach((album, albumIdx) => {
        newRecords.albums.features[albumIdx] = album;
    });

    newRecords.artists.ids = [...artistIds]
    newRecords.artists.features = new Array(newRecords.artists.ids.length)
    records.artists.features.forEach((artist, artistIdx) => {
        newRecords.artists.features[artistIdx] = artist;
    });

    const processedTracks = newRecords.tracks.ids.map(() => false);

    // Get features for every track, and ingest it all into a set of numeric arrays
    for (let i = 0; i < years.length; i++) {
        const year = years[i];
        newRecords.playlists[userIdx][year] = [];

        const data = await getFeatures(spotify, year, trackLists[year].map(track => track.id), userId);
        if (!data) {
            return null;
        }

        let track, features, idx;
        // Ingest track features from both endpoints (/track and /feature)
        // These are stored in an array of floats instead of labeled JSON,
        // to reduce memory + network loads
        for (let i = 0; i < data.audio_features.length; i++) {
            track = trackLists[year][i];
            features = data.audio_features[i];
            idx = newRecords.tracks.ids.indexOf(track.id);

            // If this track has already been ingested, skip the following work
            if (processedTracks[idx]) {
                continue;
            }
            processedTracks[idx] = true;

            ingestTrack(newRecords, track, features, idx);
            ingestAlbum(newRecords, track.album);

            // Record this song's presence, and tie it an album and set of artists
            newRecords.playlists[userIdx][year].push([
                newRecords.tracks.ids.indexOf(track.id), // track record IDX
                newRecords.albums.ids.indexOf(track.album.id), // album IDX
                track.artists.map(artist => newRecords.artists.ids.indexOf(artist.id)) // artist IDXs
            ]);
        }
    }

    const artistData = await getArtistData(spotify, newRecords);

    console.log("[ingestIntoRecords] EXIT", newRecords);
    return newRecords;
};

/**
 * After the "records" have been determined for a new user, this function will analyze all available
 * data and create an updated "analysis" object that is used as input for final visualizations.
 * @param records
 * @param analysis
 * @param userId
 * @param group
 * @returns
 */
export const analyzeNewUserRecords = async (records, analysis, userId, group) => {
    // Count years and built initial analysis object
    const myUserIdx = records.playlists.indexOf(playlist => playlist.userId === userId);
    let years = records.playlists.reduce((acc, userObj) => {
        Object.keys(userObj).filter(e => e !== "userId").forEach(year => {
            acc.add(year);
        })
        return acc;
    }, new Set());
    years = [...years];
    years.sort();
    console.log(`This group is now using ${years.length} years, ${years[0]}-${years[years.length - 1]}`)

    // Calculate one object per year for this user
    const ret = records.playlists.map((userObj) => (
        years.map((year) => ({
            year,
            relations: [],
            staticClusters: {
                valence_tempo: new Array(userObj[year].length),
                danceability_energy: new Array(userObj[year].length),
                instrumentality_acousticness: new Array(userObj[year].length)
            },
            dynamicClusters: {
                feature: {
                    PCA: [],
                    assignments: [],
                    relations: []
                }
            },
            stats: {
                instrumentalCount: 0, // [ int ]
                liveCount: 0, // [ int ]
                majorRatio: 0, // [  int ]
                singleToAlbumRatio: 0, // [  int ]
                trackCounts: {}, // [ { trackIdx: int } ]
                albumCounts: {}, // [ { albumIdx: int } ]
                artistCounts: {}, // [ { artistIdx: int } ]
                genreCounts: {},
                genreWeightedCounts: {},
                decadeCounts: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // [ { decadeName: int } ]
                decadeWeightedCounts: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // [ { decadeName: int } ]
                keyCounts: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                leastPopular: [], // [ [ [trackIdx, float], ...] ] (yearsx5x2)
                mostPopular: [], // [ [ [trackIdx, float], ...] ] (yearsx5x2)
            },
        }))
    ));

    console.log("[analysis] setup complete", ret);

    // 2. Static Feature Analysis

    // Set up data array for each year for every analysis step
    const {staticData, dynamicData} = years.reduce((acc, year) => {
        acc.staticData[year] = {}
        Object.keys(ret[0][0].staticClusters).forEach((key) => {
            acc.staticData[year][key] = [];
        });
        acc.dynamicData[year] = {feature: []};
        return acc;
    }, {staticData: {}, dynamicData: {}});

    // Read data in from the records into data arrays for every year
    let xVal, yVal;
    const staticFeatureIndices = [[12, 11], [3, 4], [5, 2]];
    records.playlists.forEach((userObj, userIdx) => {
        years.forEach(year => {
            if (Object.keys(userObj).includes(year)) {
                userObj[year].forEach(([trackIdx, artistIdx, albumIdx]) => {
                    // Add static data rows for this year/user/track
                    Object.keys(staticData[year]).forEach((key, keyIdx) => {
                        xVal = records.tracks.features.get(trackIdx, staticFeatureIndices[keyIdx][0]);
                        yVal = records.tracks.features.get(trackIdx, staticFeatureIndices[keyIdx][1]);
                        if (xVal !== undefined && yVal !== undefined) {
                            staticData[year][key].push([xVal, yVal]);
                        } else {
                            // We can't skip pushing ANY values, since that would change the length
                            // of the array. So go with 0s. TODO rework
                            staticData[year][key].push([0, 0]);
                        }
                    });

                    // Add dynamic data row for this year/user/track
                    dynamicData[year].feature.push(dynamicKeyIdxs.map(idx => {
                        return records.tracks.features.get(trackIdx, idx);
                    }));
                });

                dynamicData[year].feature = normalize(dynamicData[year].feature)
            }
        });
    });

    // Run clustering for every year
    for (const yearIdx in years) {
        const year = years[yearIdx];
        for (const key in staticData[year]) {
            // Initialize array
            // ret[yearIdx].staticClusters[key] = new Array(staticData[yearIdx][key].length)
            // ret[yearIdx].dynamicClusters[key] = new Array(staticData[yearIdx][key].length)

            // Perform clustering
            // console.log("Static clustering w/ data", year, key, staticData[year][key])
            const clusterObj = await WCluster.cluster(staticData[year][key], {
                mode: 'k-medoids',
                kNumber: group.members.length + 3,
                nCompNIPALS: 2
            });

            // Update return object with resulting cluster assignments
            // console.log(key, year, "clustering done", clusterObj);
            clusterObj.ginds.forEach((clusterGinds, k) => {
                for (let trackIdx of clusterGinds) {
                    const [userIdx, relativeTrackIdx] = getUserIdx(records.playlists, year, trackIdx);
                    if (userIdx === -1 || relativeTrackIdx === -1) {
                        console.error("Couldn't find user given track idx", trackIdx);
                    }
                    ret[userIdx][yearIdx].staticClusters[key][relativeTrackIdx] = k;
                }
            });
        }
    }

    // console.log('[analysis] static clustering complete', ret);
    // console.log("[analysis] starting dynamic clustering", dynamicData)

    // 3. Dynamic Feature Analysis
    for (const yearIdx in years) {
        const year = years[yearIdx];
        for (const key in dynamicData[year]) {
            // Perform PCA
            let newData = await WCluster.PCA(dynamicData[year][key], {scale: true, NCompNIPALS: 2});

            // Perform clustering on new axes
            // Does PCA automatically??
            // console.log("PCA complete, dynamic data:", newData);
            const clusterObj = await WCluster.cluster(newData, {
                mode: 'k-medoids',
                kNumber: group.members.length + 3,
                nCompNIPALS: 2,
                scale: true
            });
            // console.log(key, year, "DYNAMIC clustering done", clusterObj);

            // Initialize array to store cluster assignments
            for (const userIdx in ret) {
                const length = dynamicData[year][key].length;
                ret[userIdx][yearIdx].dynamicClusters.feature.assignments = new Array(length);
                ret[userIdx][yearIdx].dynamicClusters.feature.PCA = new Array(length)
            }

            // Update return object with resulting cluster assignments
            clusterObj.ginds.forEach((clusterGinds, k) => {
                clusterGinds.forEach((trackIdx, gindIdx) => {
                    const [userIdx, relativeTrackIdx] = getUserIdx(records.playlists, year, trackIdx);
                    if (userIdx === -1 || relativeTrackIdx === -1) {
                        console.error("Couldn't find user given track idx", trackIdx);
                    }
                    ret[userIdx][yearIdx].dynamicClusters.feature.assignments[relativeTrackIdx] = k;
                    ret[userIdx][yearIdx].dynamicClusters.feature.PCA[relativeTrackIdx] = clusterObj.gltdt[k][gindIdx].slice(0, 2);
                });
            });
        }
    }
    // console.log('[analysis] dynamic clustering complete', ret);

    // 4. Stat analysis
    // Setup indices for readability
    const indices = {
        popularity: 0,
        instrumentalness: 5,
        liveness: 10,
        mode: 7,
        key: 8,
        album_release_date: 0,
        album_type: 1
    }
    // Determine stats by going track-by-track for every year/user
    // TODO - pretty sure this only needs to be done for the new user
    for (const userIdx in records.playlists) {
        for (const yearIdx in years) {
            const year = years[yearIdx];
            let retObj = ret[userIdx][yearIdx].stats;

            records.playlists[userIdx][year].forEach(([trackIdx, albumIdx, artistIdxs], listIdx) => {
                const track = records.tracks.features.getRow(trackIdx);
                const album = records.albums.features[albumIdx]
                const weight = 100 - listIdx;

                // Track features
                if (track[indices.instrumentalness] > 0.5) {
                    retObj.instrumentalRatio += 1;
                }
                if (track[indices.liveness] > 0.8) {
                    retObj.liveRatio++;
                }
                if (track[indices.mode] > 0.999999) {
                    retObj.majorRatio++;
                }

                if (track[indices.key] >= 0) {
                    retObj.keyRatios[track[indices.key]]++;
                }

                // Album
                const year = parseInt(album[indices.album_release_date].split('-')[0]);
                const decadeIdx = decadeBuckets.findIndex(f => f(year));
                if (decadeIdx !== -1) {
                    retObj.decadeRatios[decadeIdx]++;
                    retObj.decadeWeightedRatios[decadeIdx] += weight;
                } else {
                    console.error("FAILED to ingest year:", year);
                }
                if (retObj.albumRatios[albumIdx]) {
                    retObj.albumRatios[albumIdx] += 1;
                } else {
                    retObj.albumRatios[albumIdx] = 1;
                }

                // Artists
                artistIdxs.forEach(artistIdx => {
                    const artist = records.artists.features[artistIdx];
                    if (retObj.artistRatios[artistIdx]) {
                        retObj.artistRatios[artistIdx] += 1;
                        retObj.artistWeightedRatios[artistIdx] += weight;
                    } else {
                        retObj.artistRatios[artistIdx] = 1;
                        retObj.artistWeightedRatios[artistIdx] = weight;
                    }

                    for (const genreIdx of artist[1]) {
                        if (retObj.genreRatios[genreIdx]) {
                            retObj.genreRatios[genreIdx] += 1;
                            retObj.genreWeightedRatios[genreIdx] += weight;
                        } else {
                            retObj.genreRatios[genreIdx] = 1;
                            retObj.genreWeightedRatios[genreIdx] = weight;
                        }
                    }
                })

                // Popularity
                const pop = track[indices.popularity];
                const newEntry = [trackIdx, pop];
                if (retObj.leastPopular.length < 5) {
                    retObj.leastPopular.push(newEntry)
                } else if (pop < retObj.leastPopular[0][0]) {
                    retObj.leastPopular[0] = newEntry;
                    retObj.leastPopular.sort((lhs, rhs) => lhs[1] < rhs[1] ? -1 : 1)
                }

                if (retObj.mostPopular.length < 5) {
                    retObj.mostPopular.push(newEntry)
                } else if (pop > retObj.mostPopular[0][0]) {
                    retObj.mostPopular[0] = newEntry;
                    retObj.mostPopular.sort((lhs, rhs) => lhs[1] > rhs[1] ? -1 : 1)
                }
            });

            // Truncate "top" counts
            retObj.albumCounts = truncateObj(retObj.albumCounts);
            retObj.artistCounts = truncateObj(retObj.artistCounts);

            const len = records.playlists[userIdx][year];
            retObj.instrumentalRatio /= len;
            retObj.liveRatio /= len;
            retObj.majorRatio /= len;
            retObj.singleToAlbumRatio /= len;
            for (let idx in retObj.genreRatios) {
                retObj.genreRatios[idx] /= len;
            }
        }
    }

    // Devide ratios by counts

    return ret;
};

const analyzeYearForUser = (records, analysis, userId, group, year) => {
}


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
        return feature.customFunc ? feature.customFunc(album) : album[feature.key];
    });
};

/**
 * Ingest data from a list of artist objects into the return structure.
 * @param ret the return structure
 * @param artists a list of artist objects, see endpoint docs
 */
const ingestArtist = (ret, artist) => {
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
const getPlaylists = async (spotify, userId) => {
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
const getArtistData = async (spotify, ret) => {
    const numRows = ret.artists.ids.length;
    const firstNewRow = ret.artists.features.findIndex(row => !row || !row.length || row[0] === 0);
    const numNewArtists = numRows - firstNewRow;
    const numBuckets = Math.ceil(numNewArtists / 50);

    for (let bId = 0; bId < numBuckets; bId++) {
        const ids = ret.artists.ids.slice(firstNewRow, Math.min(firstNewRow + 50, numRows));
        await spotify.getArtists(ids, {}).then(data => ingestArtist(ret, data), handleError);
    }
}

/**
 * Fetches a list of "feature" objects for a list of tracks.
 * @param spotify
 * @param tracks
 * @param userId
 * @returns {Promise<void>}
 */
const getFeatures = async (spotify, year, tracks, userId) => {
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
const truncateObj = (obj) => {
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