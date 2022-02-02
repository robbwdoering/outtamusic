/**
 * file: analysis.js
 * description: This file contains utilities for analyzing a list of songs and generating a set of
 * graphable data. Users will run this code when they try to join a group for the first time.
 * This is done on the client to save costs, which means users could pretty easily fabricate any or all
 * of the results of this analysis. Since users can only join groups with their friends, this is fine.
 */
import { Matrix } from 'ml-matrix';
import WCluster from 'w-cluster'

import { TrackFeatures, AlbumFeatures, ArtistFeatures, NumFeatures } from './constants';

export const handleError = (err) => {
    console.error(err);
    return null;
}

/**
 * Analyze the event of this user joining this group.
 * @param spotify api obj
 * @param group object describing the current group
 * @param userId current user's ID
 * @param records the existing data structure for this group
 * @returns {Promise<{albums: {features: null, ids: *[]}, artists: {features: null, ids: *[]}, genres: *[], playlists: {}, tracks: {features: null, ids: *[]}}>}
 */
export const ingestIntoRecords = async (spotify, group, userId, records) => {
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
        playlists: [...records.playlists, { userId }],
        genres: []
    };

    // Find all the "best of" playlists available to this user
    const playlists = await getPlaylists(spotify, userId);
    if (!playlists) {
        return null;
    }
    const userIdx = ret.playlists.length - 1;
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
        ret.playlists[userIdx][year] = [];

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
                    ret.playlists[userIdx][year].push([
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

/**
 *
 * @param records
 * @param analysis
 * @param userId
 * @param group
 * @returns
 */
export const analyzeNewUserRecords = async (records, analysis, userId, group) => {
    // Count years and built initial analysis object
    const userIdx = records.playlists.indexOf(playlist => playlist.userId === userId);
    let years = records.playlists.reduce((acc, userObj) => {
        Object.keys(userObj).forEach(year => {
            acc.add(year);
        })
        return acc;
    }, new Set());
    years = [...years];
    years.sort();
    console.log(`This group is now using ${years.length} years, ${years[0]}-${years[years.length - 1]}`)

    // Calculate one object per year for this user
    const ret = years.map(year => ({
        year,
        users: records.playlists.map((userObj, userIdx) => ({
            userId: userObj.userId,
            relations: [],
            staticClusters: {
                valence_tempo: [],
                danceability_energy: [],
                instrumentality_acousticness: []
            },
            dynamicClusters: {
                feature: {
                    PCA: {},
                    assignments: [],
                    relations: []
                }
            },
            stats: {
                instrumentalCount: 0, // [ int ]
                liveCount: 0, // [ int ]
                majorCount: 0, // [  int ]
                trackCounts: {}, // [ { trackIdx: int } ]
                albumCounts: {}, // [ { albumIdx: int } ]
                artistCounts: {}, // [ { artistIdx: int } ]
                decadeCounts: {}, // [ { decadeName: int } ]
                keyCounts: [0,0,0,0,0,0,0,0,0,0,0,0]
                leastPopular: [], // [ [ [trackIdx, float], ...] ] (yearsx5x2)
                mostPopular: [], // [ [ [trackIdx, float], ...] ] (yearsx5x2)
            },
        }))
    }));

    // 2. Static Feature Analysis (K-MEANS)
    const staticVars = Object.keys(ret[0].staticClusters).map((key) => {
        return key.split('_');
    })
    // Set up data array for each static graph
    const data = years.reduce((acc, year) => {
        acc[year] = {}
        Object.keys(ret[0].staticClusters).forEach((key) => {
            acc[year][key] = [];
        });
        return acc;
    }, {});

    // Fill each array for every track. Expensive but :shrugs: it's a one time operation
    let xVal, yVal;
    years.forEach(year => {
        records.playlists.forEach((acc, userObj, userIdx) => {
            if (Object.keys(userObj).includes(year)) {
                userObj[year].forEach(track => {
                    Object.keys(data[year]).forEach((key, keyIdx) => {
                        xVal = track[staticVars[keyIdx][0]]
                        yVal = track[staticVars[keyIdx][1]]
                        if (xVal !== undefined && yVal !== undefined) {
                            data[year][key].push([xVal, yVal])
                        } else {
                            // We can't skip pushing ANY values, since that would change the length
                            // of the array. So go with 0s. TODO rework
                            data[year][key].push([0, 0])
                        }
                    });
                });
            }
            return acc;
        }, []);
    });

    // Run clustering for every year
    for (const yearIdx in years) {
        const year = years[yearIdx];
        for (const key in data[year]) {
            // Initialize array
            ret[yearIdx].staticClusters[key] = new Array(data[yearIdx][key].length)

            // Perform clustering
            const clusterObj = await WCluster.cluster(data[key], {
                mode: 'k-medoids',
                kNumber: group.members.length,
                nCompNIPALS: 2
            });

            // Update return object with resulting cluster assignments
            console.log(key, year, "clustering done", clusterObj);
            clusterObj.ginds.forEach((clusterGinds, k) => {
                for (let clusterIndices of clusterGinds) {
                    clusterIndices.forEach(trackIdx => {
                        ret[yearIdx].staticClusters[key][trackIdx] = k;
                    });
                }
            });
        }
    }




    // 3. Dynamic Feature Analysis
    // 3.1 Cultural Graph (feature info)
    // 3.2 Physical Graph (analysis info) (REACH)

    // 4. Stat analysis
    // Determine stats by going track-by-track for every year/user
    for (const yearIdx in years) {
        const year = years[yearIdx];
        for (const userIdx in records.playlists) {
            // 4.1 How many hits for the most popular [track, album, artist]
            // 4.2 # Instrumentals
            // 4.3 # Live Recordings
            // 4.4 % Major
            // 4.5 Stacked area chart of % Key
            // 4.6 Avg. Popularity over time
            // 4.7 Least popular track each year
            // 4.8 Decade popularity over time
            const indices = ['instrumentalness', 'liveness', 'major', 'key'].reduce((acc, key) => {
               acc[key] = TrackFeatures.feature.findIndex(e => e.key === key);
               return acc;
            }, {});
            indices.popularity = 0;

            let retObj = ret[yearIdx][userIdx].stats;
            records.playlists[userIdx][year].forEach((track, trackIdx) => {
                // const weight = (100 - trackIdx) / 100; // (REACH)
                if (track[indices.instrumentalness] > 0.5) {
                    retObj.instrumentalCount += 1;
                }
                if (track[indices.liveness] > 0.8) {
                    retObj.liveCount++;
                }
                if (track[indices.major] > 0.999999) {
                    retObj.majorCount++;
                }

                if (track[indices.key] >= 0) {
                    retObj.keyCounts[track[indices.key]]++;
                }

                const decade = track; // TODO
            });
        }
    }
    // Popularity scores for songs

    console.log("RET", ret);
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
        });
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
