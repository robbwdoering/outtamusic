export const spotifyAuthInfo = {
    client_id: process.env.REACT_APP_SPOTIFY_CLIENT_ID,
    redirect_uri: process.env.REACT_APP_URI + '/callback',
    scope: 'user-read-private user-read-email'
}