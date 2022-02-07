import * as d3 from "d3";

export const getUserIdx = (playlists, year, trackIdx) => {
    let count = 0;
    let userIdx = 0;
    for (const length of playlists.map(userObj => userObj[year].length)) {
        if (trackIdx >= count && trackIdx < count + length) {
            return [userIdx, trackIdx - count];
        }
        userIdx++;
        count += length;
    }

    return [-1, -1];
}

export const normalize = matrix => {
    const extents = Object.keys(matrix[0]).map(colIdx => d3.extent(matrix.map(row => row[colIdx])));
    const ranges = extents.map(([min, max]) => max - min);
    return matrix.map(row => (
        row.map((col, colIdx) => (col - extents[colIdx][0]) / ranges[colIdx])
    ));
}
