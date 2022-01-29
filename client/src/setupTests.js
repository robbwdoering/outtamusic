// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

/**
 * FEATURE LIST
 * - Basic layout
 *      - header/body/footer layout
 *      - use menu to view options, all options there work
 *      - Dashboard shows members
 *          - right number of members
 *          - can change member colors
 *          - uses images if possible
 *          - Can remove members
 *      - Dashboard shows sharing info
 *          - generateUrl()
 *          - can change password
 *      - Possible?
 *          - export to csv option
 * - Ingest Functions
 *      - fetchPlaylists()
 *          - Gets all available playlists for the given info
 *      - addUser()
 *          - Given a list of best-of playlists for a user, adds those songs to the communal entries
 *          - Calculates a bunch of metrics for the found songs - see analyzePlaylist()
 * - Analysis Functions
 *      - analyzePlaylist()
 *          - This is one-time,
 *          - calculates similarity along the static metrics
 *              - depends on available features, but instrumentality, rhythm, genre, tempo, etc.
 *          - calculates similarity along the dynamic metrics (PCA, t-SNE)
 *          - calculates number of songs shared with every other user
 *       - prepareVizData()
 *          - This is many-time, executed every time the user changes filters
 *          - Counts some metrics, tracking the leader:
 *              - Most popular artist
 *              - Most popular album
 *              - number of songs shared with all other users
 *              -
 */
