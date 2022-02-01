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
            key: 'id',
        },
        {
            key: 'popularity',
        },
        {
            key: 'artist',
        },
        {
            key: 'album',
        },
    ],
    feature: [
        {
            key: 'duration',
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
            key: 'id',
        },
        {
            key: 'release_date',
        }
    ]
};

// A list of data kept/analyzed for every artist
export const ArtistFeatures = {
    artist: [
        {
            key: 'id',
        },
        {
            key: 'genres',
        }
    ]
};


export const NumFeatures = {
    tracks: Object.keys(TrackFeatures).reduce((acc, key) => acc + TrackFeatures[key].length, 0),
    albums: Object.keys(AlbumFeatures).reduce((acc, key) => acc + AlbumFeatures[key].length, 0),
    artists: Object.keys(ArtistFeatures).reduce((acc, key) => acc + ArtistFeatures[key].length, 0),
};
