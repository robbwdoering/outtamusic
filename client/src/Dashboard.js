import {
    IconButton,
    Box,
    Paper,
    Button,
    Table,
    TableBody,
    TableCell,
    TableRow,
    TableHead,
    TableContainer,
    Collapse
} from "@mui/material";
import ShareIcon from "@mui/icons-material/Share";
import VisibilityIcon from "@mui/icons-material/Visibility";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import React, {useState, useMemo} from "react";

const Dashboard = props => {
    // ----------
    // STATE INIT
    // ----------
    const [groupState, setGroupState] = useState({
        groupName: window.location.pathname,
        members: [],
        
    });
    
    
    // ----------------
    // MEMBER FUNCTIONS
    // ----------------
    /**
     * Generates an array of "trend" objects, each of which describes one line or bar chart
     * to be shown on the dashboard. 
     * Note that this is pre-processing - the actual graph rendering is done in <TrendViz/>.
     */
    const generateTrends = () => {
        return [];
    };

    const StatRow = props => {
        const { name, values } = props.row;
        const [open, setOpen] = useState(false);

        return (
            <React.Fragment>
                <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
                    <TableCell>
                        <IconButton
                            aria-label="expand row"
                            size="small"
                            onClick={() => setOpen(!open)}
                        >
                            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                        </IconButton>
                    </TableCell>
                    <TableCell component="th" scope="row">
                        {name}
                    </TableCell>
                    {values.map(value => (
                        <TableCell align="right">{value}</TableCell>
                    ))}
                </TableRow>
                <TableRow>
                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
                        <Collapse in={open} timeout="auto" unmountOnExit>
                            <Box sx={{ margin: 1 }}>
                                hey!
                            </Box>
                        </Collapse>
                    </TableCell>
                </TableRow>
            </React.Fragment>
        )
    };
    
    const ClusterViz = props => {
        return (
            <div>
               ClusterViz 
            </div>
        );
    }

    const TrendViz = props => {
        return (
            <div>
                TrendViz
            </div>

        );
    }


    // ---------
    // LIFECYCLE
    // ---------
    const trends = useMemo(generateTrends, []);

    return (
        <div className={"dashboard-container"}>
            <div className={'group-admin-container'}>
                <h3>Members:</h3>
                <div className={'member-list'}>
                    
                </div>
                <div className={'list-row'}>
                    <span className={"list-label"}>LINK</span>
                    <span className={"list-contents"}> https://outtamusic.com/BronzeWombat </span>
                    <Button className={"share-button"} variant={"contained"}>
                        <span>Share Invite</span>
                        <ShareIcon />
                    </Button>
                </div>
                <div className={'list-row'}>
                    <span className={"list-label"}>PASSWORD</span>
                    <span className={"list-contents"}> ********** </span>
                    <Button>
                        <VisibilityIcon />
                    </Button>
                </div>
            </div>

            <h3>1. Clusters</h3>
            <ClusterViz />
            
            <h3>2. Trends</h3>
            {trends && trends.map(trend => (
               <TrendViz /> 
            ))}
            
            <h3>3. Stats</h3>
            <Table>
                <TableContainer component={Paper}>
                    <Table aria-label="collapsible table">
                        <TableHead>
                            <TableRow>
                                <TableCell />
                                <TableCell />
                                <TableCell align="right">Overall</TableCell>
                                {groupState.members.map(member => (
                                    <TableCell align="right">{member.name}</TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {[].map((row) => (
                                <StatRow key={row.name} row={row} />
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>                
            </Table>
        </div>
    );
};

export default Dashboard;