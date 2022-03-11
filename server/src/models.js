/**
 * FILENAME: models.js
 *
 * DESCRIPTION: Contains Mongoose schemas for defining the database.  
 */

const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');
const Schema = mongoose.Schema;

const AnalysisSchema = new Schema({
    // Rows are years, columns are users, values are analysis objects
    data: [
        [
            {
                relations: [Number],
                staticClusters: {
                    valence_tempo: [Number],
                    danceability_energy: [Number],
                    instrumentality_acousticness: [Number]
                },
                dynamicClusters: {
                    feature: {
                        PCA: Schema.Types.Mixed,
                        assignments: [Number],
                        relations: [Number]
                    }
                },
                stats: {
                    instrumentalRatio: Number,
                    liveRatio: Number,
                    majorRatio: Number,
                    singleToAlbumRatio: Number,
                    // variable keys
                    albumCounts: Schema.Types.Mixed,
                    artistCounts: Schema.Types.Mixed,
                    genreRatios: Schema.Types.Mixed,
                    genreWeightedRatios: Schema.Types.Mixed,
                    // array index is tied to key
                    keyRatios: [ Number ],
                    decadeRatios: [Number],
                    decadeWeightedRatios: [Number],
                    // years x 5 (tracks) x 2 ([trackIdx, float]
                    leastPopular: [ [ [Number, Number] ] ],
                    mostPopular: [ [ [Number, Number] ] ]
                },
            }
        ]
    ]
});
const AnalysisModel = mongoose.model('Analysis', AnalysisSchema);
module.exports.AnalysisModel = AnalysisModel;

const RecordSchema = new Schema({
    tracks: {
        ids: [String],
        features: [[Number]]
    },
    artists: {
        ids:  [String],
        features: [Schema.Types.Mixed]
    },
    albums: {
        ids: [String],
        features: [Schema.Types.Mixed]
    },
    playlists: [Schema.Types.Mixed],
    playlistIds: [[String]],
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
    passcode: String,
    record: ObjectId,
    analysis: ObjectId,
    playlists: [ String ]
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
    playlists: [String],
    groups: [String]
});
const UserModel = mongoose.model('User', UserSchema);
module.exports.UserModel = UserModel;