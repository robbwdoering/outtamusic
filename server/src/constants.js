/**
 * FILENAME: constants.js
 *
 * DESCRIPTION: Constant values used for the outtamusic API.
 */

module.exports.SPOTIFY_URL = 'https://api.spotify.com/v1';

module.exports.EXPIRE_TIME = 24 * 60 * 60 * 1000;

module.exports.slugConfig = {
    format: 'kebab',
    partsOfSpeech: ['adjective', 'adjective', 'noun'],
    categories: {
        adjective: ['sounds', 'size', 'taste', 'condition', 'quantity'],
        noun: ['place', 'thing', 'time', 'animals']
    }
};