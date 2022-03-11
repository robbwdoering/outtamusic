import {
    Avatar,
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
    Collapse, Card, CardActions
} from "@mui/material";
import ShareIcon from "@mui/icons-material/Share";
import VisibilityIcon from "@mui/icons-material/Visibility";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import LinkIcon from "@mui/icons-material/Link";
import React, {useState, useMemo, useEffect, useRef} from "react";
import {ingestIntoRecords, analyzeNewUserRecords} from './analysis';
import { ClusterViz } from './ClusterViz';
import { TrendViz } from './TrendViz';
import { years } from './constants';

const Dashboard = props => {
    const {isAuthenticated, query, openJoinModal, userId, getSpotify, setLoadingModal, changeFilters} = props;

    // ----------
    // STATE INIT
    // ----------
    const [lastUpdated, setLastUpdated] = useState(0);
    const [groupState, setGroupState] = useState({
        name: window.location.pathname.substring(1),
        members: [],
    });
    const [showPassword, setShowPassword] = useState(false);
    const [records, setRecords] = useState();
    const [analysis, setAnalysis] = useState();

    const isLoading = useRef(false);
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
        console.log("[fetchGroupData]", groupState.name, isLoading.current);
        if (isLoading.current || !groupState.name || groupState.name.length === 0) {
            return;
        }
        isLoading.current = true;

        const data = await query('/groups/' + groupState.name, 'GET');
        if (data.error) {
            console.log('[fetchGroupData] ERROR', data.error)
            return;
        }

        isLoading.current = false;
        setGroupState(s => Object.assign({}, s, data, {
            iAmMember: userId && isAuthenticated && data.members.find(member => member.id === userId)
        }));

        setTimeout(() => setLastUpdated(Date.now()), 1000);
    }

    const shareInvite = () => {
    }

    const generatePasscodeStr = () => {
        if (groupState.passcode && groupState.iAmMember) {
            return showPassword ? groupState.passcode : Array(('' + groupState.passcode).length + 1).join('*')
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
            console.log("[fetchRecordsAndAnalysis]", groupState.name, userId);
            isLoading.current = true;

            // Get the full lists of songs
            let {record, analysis} = await query('/groups/' + groupState.name + '/record', 'GET').then(data => {
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

            if (analysis) {
               analysis = analysis.data;
            }

            // If this user is not yet reflected in the records
            const isNewUser = groupState.members.length > record.playlists.length;
            const newUserIsMe = isNewUser && groupState.members[groupState.members.length - 1].id === userId;
            console.log("[fetchRecordsAndAnalysis]", isNewUser, newUserIsMe, groupState, record, analysis);
            if (newUserIsMe) {
                const { newRecord, newAnalysis } = await addSelfToRecords(record, analysis);
                record = newRecord;
                analysis = newAnalysis;
            }

            setRecords(record);
            setAnalysis(analysis);
            isLoading.current = false;
        }
    }

    /**
     * Add the current user to the record and analysis objects, notifying the server of the join action as well
     * so that it can be saved to the database.
     * @param record records of all other users
     * @param analysis analysis of all other users
     * @returns { newRecord, newAnalysis } containing what was just sent to the server
     */
    const addSelfToRecords = async (record, analysis) => {
        setLoadingModal(true);
        const newRecord = await ingestIntoRecords(record, getSpotify(), groupState, userId);
        if (!newRecord) {
            console.error("Failed to ingest into records");
            return;
        }

        // Analyze
        const newAnalysis = await analyzeNewUserRecords(newRecord, analysis, userId, groupState);
        console.log("analysis", newAnalysis)

        // Save to server
        query('/groups/' + groupState.name, 'PUT', {newRecord, analysis});
        setLoadingModal(false);

        return { newRecord, newAnalysis };
    }

    // -----------------
    // NESTED COMPONENTS
    // -----------------
    const StatRow = props => {
        const {name, values} = props.row;
        const [open, setOpen] = useState(false);

        return (
            <React.Fragment>
                <TableRow sx={{'& > *': {borderBottom: 'unset'}}}>
                    <TableCell>
                        <IconButton
                            aria-label="expand row"
                            size="small"
                            onClick={() => setOpen(!open)}
                        >
                            {open ? <KeyboardArrowUpIcon/> : <KeyboardArrowDownIcon/>}
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
                    <TableCell style={{paddingBottom: 0, paddingTop: 0}} colSpan={6}>
                        <Collapse in={open} timeout="auto" unmountOnExit>
                            <Box sx={{margin: 1}}>
                                hey!
                            </Box>
                        </Collapse>
                    </TableCell>
                </TableRow>
            </React.Fragment>
        )
    };

    /**
     * Renders a card describing a member. Currently, contains basically no interaction.
     * @param member The object describing this member
     */
    const MemberCard = ({ member, userIdx }) => (
        <Card className={"member-card"}>
            <Avatar alt={member.name} src={member.img}/>
            <div className={'list-row'}>
                <span className={"list-label"}>NAME</span>
                <span>{member.name}</span>
            </div>
            <div className={'list-row'}>
                <span className={"list-label"}>PLAYLISTS</span>
                <span>{member.playlists && member.playlists.map((id, yearIdx) => (
                    <React.Fragment>
                        <Button
                            user_idx={userIdx}
                            year_idx={yearIdx}
                            onClick={changeFilters}
                        >{years[yearIdx]}</Button>j
                        <IconButton
                            size="small"
                            onClick={() => window.open('https://open.spotify.com/playlist/'+id, '_blank')}
                        >
                            <LinkIcon/>
                        </IconButton>
                    </React.Fragment>
                ))}</span>
            </div>
        </Card>
    );

    // ---------
    // LIFECYCLE
    // ---------
    const trends = useMemo(generateTrends, []);
    const passcodeStr = useMemo(generatePasscodeStr, [groupState.passcode, groupState.iAmMember, showPassword])

    useEffect(() => {
        fetchGroupData()
    }, [groupState.name, userId]);
    useEffect(() => {
        fetchRecordsAndAnalysis()
    }, [isAuthenticated, groupState.iAmMember, groupState.name, groupState.members.length]);

    console.log(groupState.members);
    return (
        <div className={"dashboard-container"}>
            <div className={'group-admin-container'}>
                <h3>Members:</h3>
                <div className={'member-list'}>
                    {groupState.members.map((member, idx) => <MemberCard key={idx} member={member} userIdx={idx}/>)}
                </div>
                <div className={'list-row'}>
                    <span className={"list-label"}>LINK</span>
                    <span className={"list-contents"}> https://outtamusic.com/{groupState.name}</span>
                </div>
                <div className={'list-row'}>
                    <span className={"list-label"}>PASSCODE</span>
                    <span className={"list-contents"}> {passcodeStr} </span>
                    <Button disabled={!groupState.iAmMember} onClick={() => setShowPassword(s => !s)}>
                        <VisibilityIcon/>
                    </Button>

                    {
                        groupState.iAmMember ? (
                            <Button className={"share-button"} variant={"contained"} onClick={shareInvite}>
                                <span>Share Invite</span>
                                <ShareIcon fontSize={"small"}/>
                            </Button>
                        ) : (
                            <Button disabled={!isAuthenticated} className={"share-button"} variant={"contained"}
                                    onClick={openJoinModal}>
                                <span>Join</span>
                                <ShareIcon fontSize={"small"}/>
                            </Button>

                        )
                    }
                </div>
            </div>

            <h3>1. Clusters</h3>
            <ClusterViz records={records} analysis={analysis}/>

            <h3>2. Trends</h3>
            {trends && trends.map(trend => (
                <TrendViz/>
            ))}

            <h3>3. Stats</h3>
            <Table>
                <TableContainer component={Paper}>
                    <Table aria-label="collapsible table">
                        <TableHead>
                            <TableRow>
                                <TableCell/>
                                <TableCell/>
                                <TableCell align="right">Overall</TableCell>
                                {groupState.members.map(member => (
                                    <TableCell align="right">{member.name}</TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {[].map((row) => (
                                <StatRow key={row.name} row={row}/>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Table>
        </div>
    );
};

export default Dashboard;