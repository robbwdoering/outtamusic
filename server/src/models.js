/**
 * FILENAME: models.js
 *
 * DESCRIPTION: Contains Mongoose schemas for defining the database.  
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const GroupSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    members: [ String ],
    matchScore: Number,
    playlists: [
        {
            year: {type: Number, required: true},
            id: {type: String, required: true},
            analysis: [String]
        }
    ],
    analysis: [String]
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