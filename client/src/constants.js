export const spotifyAuthInfo = {
    client_id: process.env.REACT_APP_SPOTIFY_CLIENT_ID,
    redirect_uri: process.env.REACT_APP_CLIENT_URL + '/callback',
    scope: 'playlist-read-private playlist-read-private playlist-read-collaborative playlist-modify-public'
}

export const Pages = [
    'dashboard'
]

// A list of data kept/analyzed for every track
export const TrackFeatures = {
    track: [
        {
            key: 'popularity',
        }
    ],
    feature: [
        {
            key: 'duration_ms',
        },
        {
            key: 'acousticness',
        },
        {
            key: 'danceability',
        },
        {
            key: 'energy',
        },
        {
            key: 'instrumentalness',
        },
        {
            key: 'loudness',
        },
        {
            key: 'mode',
        },
        {
            key: 'key',
        },
        {
            key: 'speechiness',
        },
        {
            key: 'liveness',
        },
        {
            key: 'tempo',
        },
        {
            key: 'valence',
        }
    ]
};

// A list of data kept/analyzed for every album
export const AlbumFeatures = {
    album: [
        {
            key: 'release_date',
        },
        {
            key: 'album_type',
            customFunc: album => album.album_type === "album" ? 1 : 0
        }
    ]
};

// A list of data kept/analyzed for every artist
export const ArtistFeatures = {
    artist: [
        {
            key: 'followers',
            customFunc: artist => artist.followers ? artist.followers.total : 0
        },
        {
            key: 'genres',
            customFunc: artist => artist.genres
        },
        {
            key: 'popularity'
        }
    ]
};


export const NumFeatures = {
    tracks: Object.keys(TrackFeatures).reduce((acc, key) => acc + TrackFeatures[key].length, 0),
    albums: Object.keys(AlbumFeatures).reduce((acc, key) => acc + AlbumFeatures[key].length, 0),
    artists: Object.keys(ArtistFeatures).reduce((acc, key) => acc + ArtistFeatures[key].length, 0),
};

// export const defaultAnalysis = {
//     []
// }

export const dynamicKeyIdxs = [1, 2, 3, 4, 5, 6, 7, 9];

export const decadeBuckets = [
    y => y < 1900,
    y => y < 1950,
    y => y < 1960,
    y => y < 1970,
    y => y < 1980,
    y => y < 1990,
    y => y < 2000,
    y => y < 2010,
    y => y < 2020,
    y => true
];