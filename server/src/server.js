/**
 * FILENAME: server.js
 *
 * DESCRIPTION: Main file for the API, combining the major routes (alex and user).
 */

// -----
// SETUP
// -----
const express = require('express');
const app = express();
const cors = require('cors');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bodyParser = require('body-parser');
const { validateEnv } = require('./utils');

require('dotenv').config();

if (!validateEnv()) {
  throw 'Missing ENV variables.';
}

const corsOptions = {
  origin: process.env.CLIENT_IP,
  credentials: true
};

app.use(cors(corsOptions));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// TODO - error logic
// We're creating two connections to the DB since one is mongoose and one is mongoDB.
// Seems semi-unavoidable without giving up mongoose or rolling a custom mongoose session middleware adapter
// NOTE: This needs to be done before the routers/models are imported
mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true });

// ----
// MAIN
// ----
const { setupHttpAccessControl, handleError, logRequest } = require('./middleware');

// Session middleware, backed by a second connection to the MongoDB
app.use(
  session({
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URL }),
    secret: process.env.GOOGLE_CLIENT_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === 'production'
    }
  })
);

// Custom Middleware
app.use(setupHttpAccessControl);
app.use(handleError);
app.use(logRequest);

// ------
// ROUTES
// ------
app.post("/join/:groupName", async (req, res) => {
  console.log("JOIN RECEIVED");
});

app.listen(process.env.PORT);
console.log('Listening on ' + process.env.API_IP);
