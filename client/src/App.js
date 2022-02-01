import './App.css';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Card,
    CardActions,
    IconButton,
    Button,
    Menu,
    MenuItem,
    Modal,
    Paper,
    TextField
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LoginIcon from '@mui/icons-material/Login';
import ShareIcon from '@mui/icons-material/Share';
import PasswordIcon from '@mui/icons-material/Password';
import CheckIcon from '@mui/icons-material/Check';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import EmojiPeopleIcon from '@mui/icons-material/EmojiPeople';
import GroupIcon from '@mui/icons-material/Group';
import Spotify from 'spotify-web-api-js';

import Dashboard from './Dashboard';
import { spotifyAuthInfo, Pages } from './constants';

/**
 * REQUIREMENTS
 *
 * - Index Page
 *    User views a spiel, can click a log in button.
 *    Once they chose to log in, ask for choice b/w creation and joining
 * - Creation Pipeline
 *    User
 * - Join Pipeline
 *
 */

// Get the IP of the server to make requests against, or default to a test server on localhost
const api_ip = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';

function App() {
    // ----------
    // STATE INIT
    // ----------
    const [lastUpdated, setLastUpdated] = useState(Date.now());
    const [layoutState, setLayoutState] = useState({
        curPage: "index",
        curModal: null,
    });
    const [authState, setAuthState] = useState({
        access_token: null,
        token_type: null,
        expires_in: null,
        state: null,
        id: null,
        name: null
    });
    const [menuAnchor, setMenuAnchor] = useState(null);
    const isAuthenticated = Boolean(authState.id);

    const spotify = useRef(new Spotify());

    // ----------------
    // MEMBER FUNCTIONS
    // ----------------
    const navigate = (path) => {
        window.history.pushState('N/A', 'N/A', path);
        setLastUpdated(Date.now());
    }
    
    /**
     * Step 1 in the Implicit Grant authentication flow.
     */
    const initLogin = () => {
        let url = 'https://accounts.spotify.com/authorize';
        url += '?response_type=token';
        url += '&client_id=' + encodeURIComponent(spotifyAuthInfo.client_id);
        url += '&scope=' + encodeURIComponent(spotifyAuthInfo.scope);
        url += '&redirect_uri=' + encodeURIComponent(spotifyAuthInfo.redirect_uri);
        const path = window.location.pathname.substring(1);
        if (path.length > 0) {
            url += '&state=' + encodeURIComponent(path);
        }

        window.location.href = url;
    };


    /**
     * Step 2 in the Implicit Grant authentication flow.
     * Checks if the pathname means we've just received a callback from the spotify
     * authentication API. If so, picks up where we left off with joining or creating.
     */
    const handleAuthCallback = async () => {
        const params = new URLSearchParams(window.location.hash.substring(1));
        let newPath;
        if (params.get('error')) {
            console.error("Failed to authenticate.");
            newPath = "/";
        } else {
            // Save information to state
            const access_token = params.get('access_token');
            const state = params.get('state');
            setAuthState(s => Object.assign({}, s, {
                access_token,
                state,
                token_type: params.get('token_type'),
                expires_in: params.get('expires_in')
            }));
            spotify.current.setAccessToken(access_token);

            // Determine where to redirect, depending on if they're joining or creating
            if (state && state.length > 0) {
                newPath = "/" + state;
            } else {
                newPath = "/";
            }
        }

        navigate(newPath);
    }

    /**
     * Step 3 in the Implicit Grant authentication flow.
     * Gets profile information for this user from spotify, and starts a session with the server.
     */
    const finishAuthentication = async () => {
        if (authState.access_token) {
            // Get info from Spotify on current user
            await query('/users/me', 'GET').then(async (data) => {
                if (data.err) {
                    console.error('finishAuthentication', data.err);
                    return;
                }

                console.log('finishAuthentication', data);
                setAuthState(s => Object.assign({}, s, data));
            });
        }
    }

    /**
     * This important method is called whenever the path changes, and decides
     * what page to show. This is basically the view router for the project.
     */
    const processPath = async () => {
        const path = window.location.pathname.substring(1);
        console.log("[processPath]", path);
        if (path.length === 0) {
            // Index Page
            setLayoutState(s => Object.assign({}, s, { curPage: 'index' }))
        } else if (path === 'callback') {
            // Auth callback
            await handleAuthCallback();
        // } else if (Pages.includes(path)) {
        //     // Any named page
        //     setLayoutState(s => Object.assign({}, s, { curPage: path }))
        } else {
            // Else this was opened to a group page - show it
            setLayoutState(s => Object.assign({}, s, { curPage: 'dashboard' }))
        }
    }

    /**
     * Uses the spotify API to fetch the contents of this user's best of the year playlists.
     */
    const fetchUserPlaylists = () => {
        if (!isAuthenticated) {
            console.error("Couldn't fetch playlists; not logged in.");
            return;
        }
    }

    /**
     * High level call that performs all analysis tasks on a newly inputted user.
     */
    const analyzeUser = () => {
    }

    const openMenu = (event) => {
        setMenuAnchor(event.currentTarget);
    }

    const closeMenu = () => {
        setMenuAnchor(null);
    }

    const closeModal = () => {
        setLayoutState(s => Object.assign({}, s, { curModal: null }))
    }

    const processMenuSelect = (event) => {
        switch(event.target.name) {
            case "about":
                setLayoutState(s => Object.assign({}, s, {
                    curModal: "about"
                }));
                break;
            case "github":
                window.open('https://github.com/robbwdoering/outtamusic');
                break;
        }
    };

    const openExplainModal = (event) => {
        setLayoutState(s => Object.assign({}, s, {
            curModal: "explain"
        }));
    };

    const openCreateModal = (event) => {
        setLayoutState(s => Object.assign({}, s, {
            curModal: "create"
        }));
    };

    const openJoinModal = (event) => {
        setLayoutState(s => Object.assign({}, s, {
            curModal: "join"
        }));
    };

    /**
     * 
     * @param path the path on the server
     * @param method the HTTP verb to use
     * @param body [optional] JSON body to attach to the message
     * @return [PROMISE] Either JSON response data, or something with an 'error' field
     */
    const query = async (path, method, body) => {
        const fetchOptions = {
            method: method,
            credentials: 'include',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                // 'Access-Control-Allow-Credentials': 'true'
            }
        }
        // Add authorization if we're logged in, otherwise assume this is a public endpoint
        if (authState.access_token) {
            fetchOptions.headers.Authorization = 'Bearer ' + authState.access_token;
        }
        
        // Add a body for non-GET requests
        if (method !== 'GET' && body) {
            fetchOptions.body = JSON.stringify(body);
        }
        
        console.log("[query]", process.env.REACT_APP_SERVER_URL + path, method)

        return fetch(process.env.REACT_APP_SERVER_URL + path, fetchOptions)
            .then(response => {
                if (!response.ok) {
                    return { error: `status ${response.status}` };
                }

                return response.json();
            })
            .catch(err => ({ error: err }));
    };

    /**
     *
     * Open the page for a specific group.
     * @param event
     */
    const navToGroup = (event) => {
        const groupName = event.target.name;
        console.log('[navToGroup]', groupName);
        if (!groupName) {
            return;
        }

        navigate('/'+groupName);
    };


    // -----------------
    // NESTED COMPONENTS
    // -----------------
    const SpotifyAuthButton = props => isAuthenticated ? (
        <Button variant="contained">
            <span>{authState.name}</span>
            <AccountCircleIcon fontSize={"small"} />
        </Button>
    ) : (
        <Button variant="contained" onClick={initLogin}>
            <span>LOG IN VIA SPOTIFY</span>
            <LoginIcon fontSize={"small"}  />
        </Button>
    );

    const Index = props => {
        const [existingGroups, setExistingGroups] = useState(null);
        const [loading, setLoading] = useState(false);
        
        // Get group data for authenticated users
        useEffect(async () => {
           if (isAuthenticated && authState.groups.length && !existingGroups && !loading) {
               setLoading(true);
               query('/groups/multi', 'POST', { groups: [...authState.groups] })
                   .then(data => {
                       if (data.error) {
                           console.error("Failed to authenticate.", data.error);
                       }

                       setExistingGroups(data.groups);
                       setLoading(false);
                   });
           }
        }, [authState.access_token, authState.id]);
        
        if (!authState.access_token) {
            return (
                <div className={"noauth-index-container"}>
                    <h3 id={'first'}>feeling outta music?</h3>
                    <h3 id={'second'}>used Spotify for a few years?</h3>
                    <h3 id={'third'}>your friends listen to good music?</h3>
                    <SpotifyAuthButton/>
                    <a className={"button-caption"} onClick={openExplainModal}>WHY?</a>
                </div>
            );
        } else {
            return (
                <div className="auth-index-container">
                    <h4>This tool works by collecting the listening habits of a group.</h4>
                    <h4>Do you want try it out with a new group, or join one you've already been invited to?</h4>
                    
                    <div className={"mode-choice-container"}>
                        <div>
                            <IconButton size="large" variant="contained" className="create-mode-choice-button" onClick={openCreateModal}>
                                <EmojiPeopleIcon/>
                            </IconButton>
                            <span>Create</span>
                        </div>
                        <div>
                            <IconButton size="large" variant="contained" className="create-mode-choice-button" onClick={openJoinModal}>
                                <GroupIcon/>
                            </IconButton>
                            <span>Join</span>
                        </div>
                    </div>
                    {existingGroups && (
                        <React.Fragment>
                            <h3>Existing Groups</h3>
                            <div className={"existing-groups-container"}>
                                {existingGroups.map(group => (
                                    <Card className={"group-card"} name={group.name}>
                                        <div className={'list-row'}>
                                            <span className={"list-label"}>NAME</span>
                                            <span>{group.name}</span>
                                        </div>
                                        <div className={'list-row'}>
                                            <span className={"list-label"}>MEMBERS ({group.members.length})</span>
                                            <span>
                                                {group.members.reduce((acc, member, i) => (
                                                    acc + (i ? ', ' : '') + member.name
                                                ), '')}
                                            </span>
                                        </div>
                                        <CardActions>
                                            <Button name={group.name} onClick={navToGroup}>OPEN</Button>
                                        </CardActions>
                                    </Card>
                                ))}
                            </div>
                        </React.Fragment>
                    )}
                </div>
            );
        }
    };

    const Header = props => {
        const isIndex = layoutState.curPage === "index";
        return (
            <div className={"app-header"}>
                <div className={`app-title-container`}>
                    <div onClick={() => navigate('/')}>outtamusic</div>
                </div>

                {(!isIndex || authState.id) && <SpotifyAuthButton />}
                
                <Button className="app-header-menu-button" onClick={openMenu} >
                    <MenuIcon />
                </Button>

                <div className={"app-header-menu-container"}>
                    <Menu
                        id="basic-menu"
                        className={"app-header-menu"}
                        anchorEl={menuAnchor}
                        open={menuAnchor !== null}
                        onClose={closeMenu}
                    >
                        <MenuItem name="about" onClick={processMenuSelect}>About</MenuItem>
                        <MenuItem name="github" onClick={processMenuSelect}>Github</MenuItem>
                    </Menu>
                </div>

            </div>
        );
    };

    const AppModal = props => {
        const { layoutState } = props;
        const [formState, setFormState] = useState({});

        const handleGroupNameChange = (event) => {
            const { name, value } = event.target;
            setFormState(s => Object.assign({}, s, { [name]: value }))
        };

        /**
         * Sends a request to the backend API to join the specified group.
         */
        const submitJoinForm = () => {
            if (formState.groupName && formState.passcode) {
                console.log("[submitJoinForm]", formState);
            }

            closeModal();
        };

        /**
         * Sends a request to the backend API for a new group creation.
         */
        const submitCreateForm = (event) => {
            console.log("submitCreateForm", formState.passcode);
           query('/groups', 'POST', { passcode: formState.passcode })
                .then(data => {
                    if (data.error) {
                        console.error(data.error);
                        return;
                    }

                    navigate('/'+data.name);
                });

            closeModal();
        }

        useEffect(() => {
            let newFormState = {};
            const path = window.location.pathname.substring(1);
            if (layoutState.curModal === "join" && path.length) {
                newFormState.groupName = path;
            }

            setFormState(newFormState);
        }, [layoutState.curModal]);

        return (
            <Modal
                open={layoutState.curModal !== null}
                onClose={closeModal}
            >
                <Paper>
                    {layoutState.curModal === "explain" && (
                        <React.Fragment>
                            <h2>What does this do?</h2>
                            <p>
                                This website is a simple open source tool that builds and analyzes playlists
                                based on the top songs of you and your friends over time. One person creates a group on the site, then anyone
                                with the link and a passcode can join and add their songs to the playlists.
                            </p>

                            <h2>Do you keep any of my info?</h2>
                            <p>
                                This app remembers a list of users and tracks for every group, but otherwise keeps
                                no user data. Logging into Spotify gives the app temporary access, which it uses once to
                                get a list of that user's top songs of the year.
                            </p>
                        </React.Fragment>
                    )}
                    {layoutState.curModal === "about" && (
                        <React.Fragment>
                            <img className={"about-img"} />
                            <div className={"about-link-container"}>
                                <span>robbwdoering@gmail.com</span>
                            </div>
                            <p>Lorem Ipsum</p>
                        </React.Fragment>
                    )}
                    {layoutState.curModal === "create" && (
                        <React.Fragment>
                            <h3>Create a Group</h3>
                            <div className={"form-container"}>
                                <TextField
                                    label={"Passcode"}
                                    value={formState.passcode || ""}
                                    name={"passcode"}
                                    onChange={handleGroupNameChange}
                                />
                                <Button
                                    disabled={!formState.passcode || formState.passcode.length === 0}
                                    className={"join-form-submit"}
                                    variant={"contained"}
                                    onClick={submitCreateForm}
                                >
                                    Submit
                                </Button>
                            </div>
                            <p>This passcode will be needed by anyone who wants to join the group.</p>
                        </React.Fragment>
                    )}
                    {layoutState.curModal === "join" && (
                        <React.Fragment>
                            <h3>Join a Group</h3>
                            <div className={"form-container"}>
                                <TextField
                                    label={"Group Name"}
                                    value={formState.groupName || ""}
                                    name={"groupName"}
                                    onChange={handleGroupNameChange}
                                />
                                <TextField
                                    label={"Passcode"}
                                    value={formState.passcode || ""}
                                    name={"passcode"}
                                    onChange={handleGroupNameChange}
                                />
                                <Button className={"join-form-submit"} variant={"contained"} onClick={submitJoinForm}>
                                    Submit
                                </Button>
                            </div>
                        </React.Fragment>
                    )}
                </Paper>
            </Modal>
        );
    }


    // ---------
    // LIFECYCLE
    // ---------
    useEffect(processPath, [window.location.pathname]);
    useEffect(finishAuthentication, [authState.access_token])

    const path = window.location.pathname;

    return (
        <div id="app-root" className="app-root">
            <Header />
            <div className={"app-body"}>
                {layoutState.curPage === "index" && <Index />}
                {layoutState.curPage === "dashboard" && (
                    <Dashboard
                        userId={authState.id}
                        isAuthenticated={isAuthenticated}
                        query={query}
                        openJoinModal={openJoinModal}
                        getSpotify={() => spotify.current}
                    />
                )}
            </div>
            <div className={"app-footer"}>
                This project is <a href={'https://github.com/robbwdoering/outtamusic'}>open source</a> and not affiliated with Spotify.
            </div>

            <AppModal layoutState={layoutState}/>
        </div>
    )
}

export default App;
