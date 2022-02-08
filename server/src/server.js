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
const { ObjectId } = require('mongodb');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bodyParser = require('body-parser');
const { totalUniqueSlugs, generateSlug } = require("random-word-slugs");

const { validateEnv, cleanMongoDoc } = require('./utils');
const { UserModel, GroupModel, RecordModel, AnalysisModel } = require('./models');
const { EXPIRE_TIME, slugConfig, defaultRecord } = require('./constants');

require('dotenv').config();

if (!validateEnv()) {
  throw 'Missing ENV variables.';
}

console.log("Accepting connections from", process.env.CLIENT_URL)

const corsOptions = {
  origin: process.env.CLIENT_URL,
  credentials: true
};

app.use(cors(corsOptions));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session middleware, backed by a second connection to the MongoDB
app.use(
    session({
        store: MongoStore.create({ mongoUrl: process.env.MONGO_URL }),
        secret: process.env.SPOTIFY_SECRET,
        resave: false,
        saveUninitialized: true,
        cookie: {
            secure: process.env.NODE_ENV === 'production'
        }
    })
);

// TODO - error logic
// We're creating two connections to the DB since one is mongoose and one is mongoDB.
// Seems semi-unavoidable without giving up mongoose or rolling a custom mongoose session middleware adapter
// NOTE: This needs to be done before the routers/models are imported
mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true });

// ----
// MAIN
// ----
const { setupHttpAccessControl, handleError, logRequest, sessionAuth } = require('./middleware');
const {SPOTIFY_URL} = require("./constants");
const fetch = require("node-fetch");

// Custom Middleware
// app.use(setupHttpAccessControl);
app.use(handleError);
app.use(logRequest);

// ------
// ROUTES
// ------
/**
 * Retrieve the contents of a group from the database.
 * This is a public endpoint for some groups - no authentication required.
 */
app.get("/groups/:groupName", async (req, res) => {
    const { groupName } = req.params;
    console.log("GET /groups", groupName);

    const groupDoc = await GroupModel.findOne({ name: groupName });
    if (!groupDoc) {
        return res.status(500).send({message: 'Internal Error'});
    }
    let ret = {
        name: groupDoc.name,
        members: groupDoc.members.map(id => ({ id })),
        matchScore: groupDoc.matchScore,
        playlists: groupDoc.playlists.map(playlist => ({
            year: playlist.year,
            id: playlist.id
        }))
    }

    // Add passcode if we're authenticated as part of this group
    if (req.session.spotifyId && groupDoc.members.includes(req.session.spotifyId)) {
        ret.passcode = groupDoc.passcode;
    }

    const userDocs = await UserModel.find({ id: groupDoc.members }).exec();
    for (let i = 0; i < groupDoc.members.length; i++) {
        const userId = groupDoc.members[i];
        const userDoc = userDocs.find(doc => doc.id === userId);
        ret.members[i].name = userDoc.name;
        ret.members[i].img = userDoc.img;
    }

    return res.json(ret);
});

/**
 * Creates a new group.
 */
app.post("/groups", sessionAuth, async (req, res) => {
    if (!req.body.passcode) {
        return res.status(400).send({ message: "No passcode provided"});
    }

    console.log("POST /groups", req.body.passcode);
    const groupDoc = {
        name: null,
        members: [req.session.spotifyId],
        matchScore: 0,
        playlists: [],
        passcode: req.body.passcode
    };

    let slugIsUnique = false;
    while (!groupDoc.name || !slugIsUnique) {
        groupDoc.name = generateSlug(3, slugConfig);
        slugIsUnique = !Boolean(await GroupModel.findOne({ name: groupDoc.name }).exec());
    }

    GroupModel.create(groupDoc)
        .then(result => console.log('Inserted', result))
        .catch(err => console.log('DB User insertion error:', err));

    // Add this group to the user's document as well
    const userDoc = await UserModel.findOne({ _id: ObjectId(req.session._id) }).exec();
    if (userDoc) {
       userDoc.groups = userDoc.groups.concat([groupDoc.name]);
       await userDoc.save();
    }

    cleanMongoDoc(groupDoc);
    return res.json(groupDoc);
});

app.post("/groups/:groupName/join", async (req, res) => {
    const { groupName } = req.params;
    const { passcode, userId } = req.body;
    console.log("POST /groups/join", groupName);
    const groupDoc = await GroupModel.findOne({name: groupName}).exec();
    if (!groupDoc) {
        return res.status(500).send({message: 'Invalid group name'});
    }

    if (passcode && passcode === groupDoc.passcode) {
        const userDoc = await UserModel.findOne({id: userId}).exec();
        if (!userDoc) {
            return res.status(500).send({message: 'Invalid userId'});
        }
        if (groupDoc.members.includes(userId) || userDoc.groups.includes(groupName)) {
            return res.status(503).send({message:'Already part of this group.'});
        }

        groupDoc.members = groupDoc.members.concat([userId]);
        userDoc.groups = userDoc.groups.concat([groupName]);

        await groupDoc.save();
        await userDoc.save();
    }

    return res.status(503).send({message:'Unauthorized.'});
});

/**
 * Modifies a group, such as by adding or deleting a member, or adding newly calculated data.
 */
app.put("/groups/:groupName", sessionAuth, async (req, res) => {
    const { groupName } = req.params;
    const { record, analysis } = req.body;
    console.log("PUT /groups", groupName);
    let doSave = false;

    const groupDoc = await GroupModel.findOne({name: groupName}).exec();
    if (!groupDoc) {
        return res.status(500).send({message: 'Invalid group'});
    }

    if (record) {
        let recordDoc;
        if (groupDoc.record) {
            // Update existing entry
            recordDoc = await RecordModel.findOne({_id: groupDoc.record}).exec();
            if (!recordDoc) {
                return res.status(500).send({message: 'Invalid record'});
            }
            Object.assign(recordDoc, record);
            await recordDoc.save();
        } else {
            // Create new entry
            recordDoc = await RecordModel.create(record);
            if (!recordDoc) {
                return res.status(500).send({message: 'Internal error.'});
            }
            groupDoc.record = recordDoc._id;
            doSave = true;
        }
        console.log('Record changed: ', recordDoc)
    }

    if (analysis) {
        let analysisDoc;
        if (groupDoc.analysis) {
            // Update existing entry
            analysisDoc = await AnalysisModel.findOne({_id: groupDoc.analysis}).exec();
            if (!analysisDoc) {
                return res.status(500).send({message: 'Invalid analysis'});
            }
            Object.assign(analysisDoc.data, analysis);
            await analysisDoc.save();
        } else {
            // Create new entry
            analysisDoc = await AnalysisModel.create({ data: analysis });
            if (!analysisDoc) {
                return res.status(500).send({message: 'Internal error.'});
            }
            groupDoc.analysis = analysisDoc._id;
            doSave = true;
        }
        console.log('Analysis changed: ', analysisDoc)
    }

    if (doSave) {
        await groupDoc.save();
    }
    return res.status(200);
});

/**
 * Fetches basic info for a list of groups.
 */
app.post('/groups/multi', sessionAuth, async (req, res) => {
    const {groups} = req.body;
    console.log("POST /groups/multi", groups);
    if (!groups || !groups.length) {
        return res.status(400).send({message: "Invalid group list passed."});
    }

    const ret = [];

    // Iterate through all the groups
    const groupDocs = await GroupModel.find({name: groups}).exec();
    for (let i = 0; i < groups.length; i++) {
        const groupName = groups[i];
        const groupDoc = groupDocs.find(doc => doc.name === groupName);
        if (groupDoc) {
            // Get basic info describing this group
            let groupResult = {
                name: groupDoc.name,
                members: groupDoc.members.map(id => ({ id })),
                matchScore: groupDoc.matchScore
            };

            // Get a little more info on every member in this group
            const userDocs = await UserModel.find({ id: groupDoc.members }).exec();
            for (let j = 0; j < groupDoc.members.length; j++) {
                const userId = groupDoc.members[j];
                const userDoc = userDocs.find(doc => doc.id === userId);
                groupResult.members[j].name = userDoc.name;
            }

            ret.push(groupResult);
        }
    }

    return res.json({ groups: ret });
});

/**
 * Authenticates for a given user, also fetching that user's info.
 */
app.get("/users/me", async (req, res) => {
    // Authentication
    if (!req.session.isAuthenticated) {
        const auth = req.header('Authorization');

        if (!auth) {
            return res.status(401).send({message: 'Not authenticated.'});
        }

        const requestUrl = SPOTIFY_URL + '/me';
        const fetchOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': auth
            }
        }

        // Send the message, storing success on response
        console.log("auth fetch...", requestUrl)
        await fetch(requestUrl, fetchOptions)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`status ${response.status}`);
                }
                return response.json();
            })
            .then(async json => {
                req.session.isAuthenticated = true;
                req.session.spotifyId = json.id;
                req.session.name = json.display_name;
                if (json.images && json.images.length) {
                    req.session.img = json.images[0].url;
                }

                console.log("...auth response", req.session.spotifyId, req.session.name);
            })
            .catch(err => {
                console.error(err);
            });
    }

    // Returning user data
    if (req.session.isAuthenticated) {
        let userDoc = await UserModel.findOne({ id: req.session.spotifyId }).exec();

        // If no record was found, create a new one
        if (!userDoc) {
            userDoc = {
                name: req.session.name,
                id: req.session.spotifyId,
                img: req.session.img,
                idExpiresAt: new Date(Date.now() + EXPIRE_TIME),
                groups: []
            };

            // Cleanup our session object usage
            delete req.session.name;
            if (req.session.img) {
                delete req.session.img;
            }

            // If the user doesn't exist, create it
            UserModel.create(userDoc)
                .then(result => console.log('Inserted', result))
                .catch(err => console.log('DB User insertion error:', err));
        }

        cleanMongoDoc(userDoc);
        return res.json(userDoc);
    }

    return res.status(401).send({ message: "Failed to authenticate."});
});

app.get('/groups/:groupName/record', async (req, res) => {
    const { groupName } = req.params;
    const groupDoc = await GroupModel.findOne({ name: groupName }).exec();
    if (!groupDoc) {
        console.log("ERR /groups/record - invalid group name")
        return res.status(500).send({message: 'Invalid group name.'});
    }

    let ret = {};
    let doSave = false;

    let recordDoc;
    if (groupDoc.record) {
        recordDoc = await RecordModel.findOne({ _id: groupDoc.record }).exec();
    } else {
        recordDoc = await RecordModel.create(defaultRecord);
        groupDoc.record = recordDoc._id;
        doSave = true;
    }

    let analysisDoc;
    if (groupDoc.analysis) {
        analysisDoc = await AnalysisModel.findOne({ _id: groupDoc.analysis }).exec();
    } else {
        console.log("Creating analysis doc", analysisDoc, groupDoc);
        analysisDoc = await AnalysisModel.create(defaultRecord);
        groupDoc.analysis = analysisDoc._id;
        console.log("DONE w/ analysis doc", analysisDoc, groupDoc);
        doSave = true;
    }

    if (doSave) {
        await groupDoc.save();
    }

    cleanMongoDoc(recordDoc);
    cleanMongoDoc(analysisDoc);

    ret.record = recordDoc || null;
    ret.analysis = analysisDoc || null;
    console.log("/groups/records ret", ret);

    return res.json(ret)
});

app.listen(process.env.PORT);
console.log('Listening on ' + process.env.API_URL);
