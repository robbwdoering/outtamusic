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
 * Analysis
 *      key
 *      major/minor
 *      tempo
 *      time_signature
 *      loudness
 *      specific sections??
 *
 * Features
 *         Acousticness
 *         Danceability
 *         Energy
 *         Instrumentalness
*         Loudness
*         Mode
*         Speechiness
*         Liveness
 *         Tempo
 *         Valence
 *
 * 1. Categories
 *      - Wordcloud appears above (REACH)
 *      - Controls appear below the grid, allowing user to change categories, which changes colors much like a choropleth
 *      - Category options:
 *          - Genre
 *          - Live
 *          - Instrumental
 *          - Key
 *          - Mode
 *          - Decade
 *
 * 2. Static Feature Analysis
 *      1.1 Valence vs. Tempo
 *      1.2 Danceability vs. Energy
 *      1.3 Instrumentality vs. Acousticness
 *      1.4 ANY (REACH)
 *
 * 3. Dynamic Feature Analysis
 *      2.1 Cultural Graph (feature info)
 *      2.2 Physical Graph (analysis info) (REACH)
 *
 * 4. Trend Analysis
 *      3.1 How many hits for the most popular [track, album, artist]
 *      3.2 # Instrumentals
 *      3.3 # Live Recordings
 *      3.4 % Major
 *      3.5 Stacked area chart of % Key
 *      3.6 Avg. Popularity over time
 *      3.7 Least popular track each year
 *      3.8 Decade popularity over time
 *      DET
 *          - Show both individuals and aggregate on each chart, allowing users to hide any lines they want
 *          - For non-line charts (such as stacked area charts), just show aggregate
 *
 * 5. Stats Analysis
 *      4.0 Straight values: most features, a few analysis points?
 *      4.1 Song length? (/an)
 *      4.2 Most explicit (/track)
 *      4.3 Popularity (/track)
 *      4.4 Average Artist Number per track (/track)
 *      4.5 # Live Recordings (/feature)
 *      DET
 *          - Show separate tables (cards?) for each year, then one for "Total"
 *          - Show a four-pointed star for each?
 *          - Just show a bar graph for each stat, where X is user?
 *
 * 5. Geographical Analysis (REACH)
 *      5.1 Artists from each country
 *      5.2 Un-available markets
 */
