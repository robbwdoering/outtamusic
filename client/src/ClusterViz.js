import React, {useEffect, useState, useMemo} from "react";
import * as d3 from 'd3';
import { constructTracklist } from "./utils";

export const ClusterViz = props => {
    const { records, analysis, filters } = props;
    const [isDrawn, setIsDrawn] = useState(false);
    const [source, setSource] = useState(null);

    const mouseover = function (d) {
        console.log("mo", d);
    }

    const mousemove = function (d) {
        console.log("mm", d);
    }

    const getClusterData = () => {
        if (!records || !analysis) {
            return null;
        }

        let assignments;
        let values;
        switch(source) {
            case 'valence_tempo':
            case 'danceability_energy':
            case 'instrumentality_acousticness':
                assignments = constructTracklist(analysis, filters,obj => obj.staticClusters[source]);
                values = constructTracklist(records.playlists, filters);
                break;
            case 'dynamic_feature':
            default:
                // Dynamic Cluster
                assignments = constructTracklist(analysis, filters, (obj) => {
                    return obj.dynamicClusters.feature.assignments;
                });
                values = constructTracklist(analysis, filters, (obj) => {
                    return obj.dynamicClusters.feature.PCA;
                });
        }

        return { assignments, values };
    };

    /**
     * Draw a new graph from scratch.
     */
    const draw = () => {
        if (!records || !analysis || !data) {
            return;
        }
        // Use state to ensure this only happens once (unless we intentionally reset)
        // This allows us to include everything that affects the calculation in the useEffect array
        if (isDrawn) {
            return;
        }
        setIsDrawn(true);

        // set the dimensions and margins of the graph
        const margin = {top: 10, right: 30, bottom: 30, left: 60},
            width = 460 - margin.left - margin.right,
            height = 450 - margin.top - margin.bottom;

        // append the svg object to the body of the page
        const svg = d3.select("#cluster-viz")
            .append("svg") // canvas
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom);
        const body = svg.append("g") // body
            .attr("transform",
                "translate(" + margin.left + "," + margin.top + ")");

        // Add X axis
        const x = d3.scaleLinear()
            .domain([0, 3000])
            .range([0, width]);
        svg.append("g")
            .attr("transform", "translate(0," + height + ")")
            .call(d3.axisBottom(x));

        // Add Y axis
        const y = d3.scaleLinear()
            .domain([0, 400000])
            .range([height, 0]);
        body.append("g")
            .call(d3.axisLeft(y));

        // Add dots
        body.append('g')
            .selectAll("dot")
            .data(data.values)
            .enter()
            .append("circle")
            .attr("cx", function (d) {
                return x(d[0]);
            })
            .attr("cy", function (d) {
                return y(d[0]);
            })
            .attr("r", 4)
            .style("fill", "#69b3a2")
            .style("opacity", 0.3)
    };

    const data = useMemo(getClusterData, [Boolean(records), Boolean(analysis), filters && filters.lastUpdated]);
    useEffect(draw, [Boolean(records), Boolean(analysis)]);

    return (
        <div
            id={"cluster-viz"}
        />
    );
}

export default ClusterViz;
