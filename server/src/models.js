/**
 * FILENAME: models.js
 *
 * DESCRIPTION: Contains Mongoose schemas for defining the database.  
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    email: {
        type: String,
        required: true
    },
    csrfSecret: String, 
    name: String,
    googleId: {
        type: String,
        required: true
    },
    refresh_token: String,
    idExpiresAt: Date,
    access_token: String,
    tokenExpiresAt: Date
});
const UserModel = mongoose.model('User', UserSchema);
module.exports.UserModel = UserModel;