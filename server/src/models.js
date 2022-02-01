/**
 * FILENAME: models.js
 *
 * DESCRIPTION: Contains Mongoose schemas for defining the database.  
 */

const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');
const Schema = mongoose.Schema;

const RecordSchema = new Schema({
    tracks: {
        ids: [String],
        features: [[Number]]
    },
    artists: {
        ids:  [String],
        features: [[Number]]
    },
    albums: {
        ids: [String],
        features: [[Number]]
    },
    playlists: Object, // Don't want to use dynamic keys
    genres: [String]
});
const RecordModel = mongoose.model('Record', RecordSchema);
module.exports.RecordModel = RecordModel;

const ObjectSchema = new Schema({
    data: Object
});
const ObjectModel = mongoose.model('Object', ObjectSchema);
module.exports.ObjectModel = ObjectModel;

const GroupSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    members: [ String ],
    matchScore: Number,
    passcode: Number,
    playlists: [
        {
            year: {type: Number, required: true},
            id: {type: String, required: true}
        }
    ],
    record: ObjectId,
    staticAnalysis: ObjectId,
    dynamicAnalysis: ObjectId,
    statAnalysis: ObjectId
});
const GroupModel = mongoose.model('Group', GroupSchema);
module.exports.GroupModel = GroupModel;

const UserSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    id: {
        type: String,
        required: true
    },
    img: String,
    idExpiresAt: Date,
    groups: [String]
});
const UserModel = mongoose.model('User', UserSchema);
module.exports.UserModel = UserModel;