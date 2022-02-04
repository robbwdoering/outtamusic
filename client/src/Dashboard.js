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
import React, {useState, useMemo, useEffect, useRef} from "react";
import { ingestIntoRecords, analyzeNewUserRecords } from './analysis';
// import { ClusterViz } from './ClusterViz';

const Dashboard = props => {
    const { isAuthenticated, query, openJoinModal, userId, getSpotify } = props;

    // ----------
    // STATE INIT
    // ----------
    const [groupState, setGroupState] = useState({
        name: window.location.pathname.substring(1),
        members: [],
    });
    const [showPassword, setShowPassword] = useState(false);
    const [records, setRecords] = useState();
    const [analysis, setAnalysis] = useState();

    const isLoading= useRef(false);
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

    /**
     * Queries the server for data tied to this group.
     */
    const fetchGroupData = async () => {
        console.log("[fetchGroupData]");
        if (isLoading.current || !groupState.name || groupState.name.length === 0 || !userId) {
            return;
        }
        isLoading.current = true;

        const data = await query('/groups/'+groupState.name, 'GET');
        if (data.error) {
            console.log('[fetchGroupData] ERROR', data.error)
            return;
        }

        isLoading.current = false;
        setGroupState(s => Object.assign({}, s, data, {
            iAmMember: isAuthenticated && data.members.find(member => member.id === userId)
        }));
    }

    const shareInvite = () => {
    }

    const generatePasscodeStr = () => {
        if (groupState.passcode && groupState.iAmMember) {
            return showPassword ? groupState.passcode : Array((''+groupState.passcode).length+1).join('*')
        }
        return "*******";
    }

    /**
     * Contacts the server if necessary for new records describing this group.
     * Also, responsible for uploading records if it's found that the current user
     * doesn't have any records uploaded.
     */
    const fetchRecordsAndAnalysis = async () => {
        if (!isLoading.current && !records && groupState.members.length > 0) {
            console.log("[fetchRecordsAndAnalysis]", groupState.name);
            isLoading.current = true;

            // Get the full lists of songs
            let { record, analysis } = await query('/groups/'+groupState.name+'/record', 'GET').then(data => {
                if (data.error) {
                    console.error(data.error);
                    return {};
                }
                data.record.playlists = data.record.playlists.filter(e => Object.keys(e).length > 0);
                return data;
            });

            if (!record) {
                console.error("Invalid /groups/record response", record);
                return;
            } else if (!record.playlists) {
                record.playlists = [];
            }

            // If this user is not yet reflected in the records
            const isNewUser = groupState.members.length > record.playlists.length;
            const newUserIsMe = isNewUser && !record.playlists.some(playlist => playlist.userId === groupState.name);
            console.log("[fetchRecordsAndAnalysis]", isNewUser, newUserIsMe, groupState, record);
            if (newUserIsMe) {
                record = await ingestIntoRecords(record, getSpotify(), groupState, userId);
                if (!record) {
                    console.error("Failed to ingest into records");
                    return;
                }

                // Analyze
                analysis = await analyzeNewUserRecords(record, analysis, userId, groupState);
                console.log("analysis", analysis)

                // Save to server
            }


            setRecords(record);
            setAnalysis(analysis);
            isLoading.current = false;
        }
    }

    // -----------------
    // NESTED COMPONENTS
    // -----------------
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
    const passcodeStr = useMemo(generatePasscodeStr, [groupState.passcode, groupState.iAmMember, showPassword])
    
    useEffect(() => { fetchGroupData() }, [groupState.name, userId]);
    useEffect(() => { fetchRecordsAndAnalysis() }, [isAuthenticated, groupState.iAmMember, groupState.name, groupState.members.length]);

    return (
        <div className={"dashboard-container"}>
            <div className={'group-admin-container'}>
                <h3>Members:</h3>
                <div className={'member-list'}>
                    
                </div>
                <div className={'list-row'}>
                    <span className={"list-label"}>LINK</span>
                    <span className={"list-contents"}> https://outtamusic.com/{groupState.name}</span>
                </div>
                <div className={'list-row'}>
                    <span className={"list-label"}>PASSCODE</span>
                    <span className={"list-contents"}> {passcodeStr} </span>
                    <Button disabled={!groupState.iAmMember} onClick={() => setShowPassword(s => !s)}>
                        <VisibilityIcon />
                    </Button>

                    {
                       groupState.iAmMember ? (
                           <Button className={"share-button"} variant={"contained"} onClick={shareInvite}>
                               <span>Share Invite</span>
                               <ShareIcon fontSize={"small"} />
                           </Button>
                       ) : (
                           <Button disabled={!isAuthenticated} className={"share-button"} variant={"contained"} onClick={openJoinModal}>
                               <span>Join</span>
                               <ShareIcon fontSize={"small"} />
                           </Button>

                       )
                    }
                </div>
            </div>

            <h3>1. Clusters</h3>
            {/*<ClusterViz />*/}
            
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