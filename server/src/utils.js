/**
 * FILENAME: utils.js
 *
 * DESCRIPTION: Utilities for the outtamusic API.
 */
 
const jwt = require('express-jwt');
const jwtAuthz = require('express-jwt-authz');
const jwksRsa = require('jwks-rsa');
const { OAuth2Client } = require('google-auth-library');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const fetch = require('node-fetch');

const { UserModel, ConfigStateModel } = require('./models');
const { SPOTIFY_URL } = require("./constants");
const url = require("url");

module.exports.validateEnv = () => {
  const keys = Object.keys(process.env);
  return (
    keys.includes('API_URL') &&
    keys.includes('CLIENT_URL') &&
    keys.includes('MONGO_URL') &&
    keys.includes('NODE_ENV') &&
    keys.includes('PORT')
  );
}

// ----------------
// HELPER FUNCTIONS
// ----------------

/**
 * Callback function that saves the given credentials into the database for the user tied to the given session.
 * @param session express-session middleware object
 * @param credentials object with refreshed credentials
 */
const updateAuthTokens = async (session, credentials) => {
    // All authenticated users have these session values defined
    const userDoc = await UserModel.findOne({ _id: session._id }).exec();

    if (!userDoc) {
       return; 
    }

    userDoc.access_token = credentials.access_token;
    userDoc.tokenExpiresAt = new Date(credentials.expiry_date);

    await userDoc.save();
}
