import nj from 'numjs';
import { TrackFeatures, AlbumFeatures, ArtistFeatures, NumFeatures } from './constants';

export const handleError = (err) => {
    console.error(err);
    return null;
}

/**
 * Analyze the event of this user joining this group.
 */
export const performOnJoinAnalysis = async (spotify, group, userId, records) => {
    console.log("[performOnJoinAnalysis] ENTER", group)
    const ret = {
        tracks: {
            ids: [],
            features: null
        },
        artists: {
            ids: [],
            features: null
        },
        albums: {
            ids: [],
            features: null
        },
        playlists: {},
        genres: []
    };

    // Find all the "best of" playlists available to this user
    const playlists = await getPlaylists(spotify, userId);
    if (!playlists) {
        return;
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
        console.log(year, trackLists[year])

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
    }, { trackIds: new Set(), albumIds: new Set(), artistIds: new Set(), genreNames: new Set() });
    ret.tracks.ids = [...trackIds]
    ret.tracks.features = nj.zeros([ret.tracks.ids.length, NumFeatures.tracks]);

    ret.albums.ids = [...albumIds]
    ret.albums.features = nj.zeros([ret.albums.ids.length, NumFeatures.albums]);

    ret.artists.ids = [...artistIds]
    ret.artists.features = nj.zeros([ret.artists.ids.length, NumFeatures.artists]);

    // ret.genres = [...genreNames]
    console.log(ret);

    // Get features for every track, and ingest it all into a set of numeric arrays
    for (let i=0; i < years.length; i++) {
        const year = years[i];

        await spotify.getAudioFeaturesForTracks(trackLists[year].map(track => track.id))
            .then(data => {
                if (!data.audio_features || data.audio_features.length !== trackLists[year].length) {
                    return handleError("Invalid analysis arguments.");
                }

                console.log("Audio Features:", data);
                let track, features, idx;
                // Ingest track features from both endpoints (/track and /feature)
                // These are stored in an array of floats instead of labeled JSON,
                // to reduce memory + network loads
                for (let i = 0; i < data.audio_features.length; i++) {
                    track = trackLists[year][i];
                    features = data.audio_features[i];
                    idx = ret.tracks.ids.indexOf(track.id);

                    // If this track has already been ingested, skip the following work
                    if (Boolean(ret.tracks.features[idx])) {
                        continue;
                    }

                    ingestTrack(ret, track, features, idx);
                    ingestAlbum(ret, track.album);
                    ingestArtists(ret, track.artists);
                }
            }, handleError);
    }

    // Build the track list for every playlist
    // Each entry is 2D(ish) array of format [trackId, [genreIds...]]
    ret.playlists = years.reduce((acc, year) => {
        acc[year] = trackLists[year].map(track => [
            ret.tracks.ids.indexOf(track.id),
            []
            // track.artists.reduce((innerAcc, artist) => {
            //     return innerAcc.concat(artist.genres.map(genre => ret.genres.indexOf(genre)))
            // }, [])
        ]);
        return acc;
    }, {});

    console.log("[performOnJoinAnalysis] EXIT", ret);

    return ret;
};


// HELPER FUNCTIONS
const ingestTrack = (ret, track, features, idx) => {
    // Ingest track features from /track and /feature
    TrackFeatures.track.forEach((featureDesc, featureIdx) => {
        ret.tracks.features[idx][featureIdx] = track[featureDesc.key];
    });
    TrackFeatures.feature.forEach((featureDesc, featureIdx) => {
        const actIdx = featureIdx + TrackFeatures.track.length;
        ret.tracks.features[idx][actIdx] = features[featureDesc.key];
    });
};

const ingestAlbum = (ret, album) => {
    const idx = ret.albums.ids.indexOf(album.id);
    if (Boolean(ret.albums.features[idx][0])) {
        return;
    }

    AlbumFeatures.album.forEach((featureDesc, featureIdx) => {
        ret.albums.features[idx][featureIdx] = album[featureDesc.key];
    });
};


const ingestArtists = (ret, artists) => {
    artists.forEach(artist => {
        const idx = ret.artists.ids.indexOf(artist.id);
        if (Boolean(ret.artists.features[idx][0])) {
            return;
        }

        ArtistFeatures.artist.forEach((featureDesc, featureIdx) => {
            ret.artists.features[idx][featureIdx] = artist[featureDesc.key];
        });
    });
};

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
