export const handleError = (err) => {
    console.error(err);
}

/**
 * Analyze the event of this user joining this group.
 */
export const performOnJoinAnalysis = async (spotify, group, userId, songList) => {
    let playlists = null;
    await spotify.getUserPlaylists(userId, { limit: 50 })
        .then(data => {
            console.log(data);
            playlists = data.items.reduce((acc, playlist) => {
                if (playlist.name && playlist.name.match(/^Your Top Songs 20\d\d$/g)) {
                    const year = parseInt(playlist.name.split(' ')[3]);
                    if (year && !Object.keys(acc).includes(year)) {
                        acc[year] = playlist;
                    }
                }
                return acc;
            }, {});
        }, handleError);

    const years = Object.keys(playlists);
    years.sort();

    for (let i=0; i < years.length; i++) {
        const year = years[i];
        await spotify.getPlaylistTracks(playlists[year].id, {}, (err, data) => {
            if (err) {
                console.error(err);
                return;
            }

            console.log(data);
        });
    }
    return 5;
};