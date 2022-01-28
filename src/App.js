import './App.css';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Button,
  CircularProgress,
  Tooltip,
  TextField,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Paper
} from '@mui/material';
import * as d3 from 'd3';

/**
 * REQUIREMENTS
 *
 * - Splash Page
 *    User views a spiel, can click a log in button.
 *    Once they chose to log in, ask for choice b/w creation and joining
 * - Creation Pipeline
 *    User  
 * - Join Pipeline
 *
 */

// Get the IP of the server to make requests against, or default to a test server on localhost
const api_ip = process.env.REACT_APP_API_IP || 'http://localhost:5000';

function App() {

  // --------
  // LIFECYLE
  // --------

  return (
    <div>
      <
    </div>
  );
}

export default App;
