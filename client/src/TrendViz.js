import React, {useEffect, useState} from "react";
import * as d3 from 'd3';

export const TrendViz = props => {
    const [isDrawn, setIsDrawn] = useState(false);
    const [source, setSource] = useState('valence-tempo');

    /**
     * Draw a new graph from scratch.
     */
    const draw = () => {
        // Use state to ensure this only happens once (unless we intentionally reset)
        // This allows us to include everything that affects the calculation in the useEffect array
        if (isDrawn) {
            return;
        }
        setIsDrawn(true);

        // set the dimensions and margins of the graph
        var margin = {top: 10, right: 30, bottom: 30, left: 60},
            width = 460 - margin.left - margin.right,
            height = 450 - margin.top - margin.bottom;

        // append the svg object to the body of the page
        var svg = d3.select("#my_dataviz")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform",
                "translate(" + margin.left + "," + margin.top + ")");
    };

    useEffect(draw, []);

    return (
        <div>
            TrendViz
        </div>
    );
}

export default TrendViz;
