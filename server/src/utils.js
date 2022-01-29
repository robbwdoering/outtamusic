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

const { UserModel, ConfigStateModel } = require('./models');
const {defaultSheetConfig} = require("./constants");

const sessionAuth = async (req, res, next) => {
  const { id } = req.session;

  if (!id) {
    return res.status(401).send({ message: 'User not authenticated.' });
  }

  // Get the _id of this user
  const foundUser = await UserModel.findOne({ id }).exec();
  if (!foundUser || !foundUser._id) {
    return res.status(401).send({ message: 'User not registered.' });
  }

  req.session._id = foundUser._id.toString();

  if (foundUser.idExpiresAt < (Date.now() / 1000)) {
    delete req.session.googleId;

    return res.status(401).send({ message: 'User token expired.' });
  }

  next();
};
module.exports.sessionAuth = sessionAuth;

module.exports.validateEnv = () => {
  const keys = Object.keys(process.env);
  return (
    keys.includes('API_IP') &&
    keys.includes('CLIENT_IP') &&
    keys.includes('MONGODB_URL') &&
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
