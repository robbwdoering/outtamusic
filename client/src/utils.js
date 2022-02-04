export const findFeatureIdx = (searchKey, features) => {
    console.log("findFeatureIdx", searchKey, features)
    let offset = 0;
    Object.values(features).forEach(source => {
        let idx = source.findIndex(e => e.key === searchKey);
        if (idx !== -1) {
            return idx + offset;
        }
        offset += source.length;
    });

    return -1;
};

export const getUserIdx = (playlists, year, trackIdx) => {
    let count = 0;
    let userIdx = 0;
    for (const userObj of playlists) {
        if (trackIdx > count && trackIdx < count + userObj[year].length) {
            return [userIdx, trackIdx - count];
        }
        userIdx++;
    }

    return [-1, -1];
}
