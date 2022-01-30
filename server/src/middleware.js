/**
 * FILENAME: utils.js
 *
 * DESCRIPTION: Utilities for the outtamusic API.
 */
 
const jwt = require('express-jwt');
const jwtAuthz = require('express-jwt-authz');
const jwksRsa = require('jwks-rsa');
const { OAuth2Client } = require('google-auth-library');

const { UserModel, ConfigStateModel } = require('./models');
const { SPOTIFY_URL } = require("./constants");
const fetch = require("node-fetch");

const sessionAuth = async (req, res, next) => {
  const { spotifyId } = req.session;

  if (!spotifyId) {
    return res.status(401).send({ message: 'User not authenticated.' });
  }

  // Get the _id of this user
  const foundUser = await UserModel.findOne({ id: spotifyId }).exec();
  if (!foundUser || !foundUser._id) {
    return res.status(401).send({ message: 'User not registered.' });
  }
  req.session._id = foundUser._id.toString();

  if (foundUser.idExpiresAt < (Date.now() / 1000)) {
    delete req.session.spotifyId;
    return res.status(401).send({ message: 'User token expired.' });
  }

  next();
};
module.exports.sessionAuth = sessionAuth;

const setupHttpAccessControl = (req, res, next) => {
  res.header('Access-Control-Allow-Credentials', true);
  res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE');
  res.header("Access-Control-Allow-Origin", process.env.CLIENT_URL);
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, CustomId");
  next();
};
module.exports.setupHttpAccessControl = setupHttpAccessControl;

const handleError = (err, req, res, next) => {
  console.error(err.stack);
  return res.status(err.status).json({ message: err.message });
};
module.exports.handleError = handleError;

const logRequest = (req, res, next) => {
  console.log("RCV:", req.method, req.path);
  next();
}
module.exports.logRequest = logRequest;
