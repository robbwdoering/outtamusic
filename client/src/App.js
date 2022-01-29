import './App.css';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
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
import * as d3 from 'd3';
import Spotify from 'spotify-web-api-js';

import Dashboard from './Dashboard';
import { spotifyAuthInfo, Pages } from './constants';

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
    // ----------
    // STATE INIT
    // ----------
    const [lastUpdated, setLastUpdated] = useState(Date.now());
    const [layoutState, setLayoutState] = useState({
        curPage: "splash",
        curModal: null,
    });
    const [authState, setAuthState] = useState({
        access_token: null,
        token_type: null,
        expires_in: null,
        state: null
    });
    const [menuAnchor, setMenuAnchor] = useState(null);

    const spotify = useRef(new Spotify());

    // ----------------
    // MEMBER FUNCTIONS
    // ----------------
    /**
     * Step 1 in the Implicit Grant authentication flow.
     */
    const initLogin = () => {
        let url = 'https://accounts.spotify.com/authorize';
        url += '?response_type=token';
        url += '&client_id=' + encodeURIComponent(spotifyAuthInfo.client_id);
        url += '&scope=' + encodeURIComponent(spotifyAuthInfo.scope);
        url += '&redirect_uri=' + encodeURIComponent(spotifyAuthInfo.redirect_uri);
        url += '&state=' + encodeURIComponent('BronzeWombat');

        console.log("initLogin", url);
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
            console.log("USING ACCESS TOKEN", access_token)

            // Get info from Spotify on current user
            await spotify.current.getMe(null, handleProfileInfo);

            // Determine where to redirect, depending on if they're joining or creating
            if (state && state.length > 0) {
                newPath = "/" + params.get('state');
            } else {
                newPath = "/create";
            }
        }

        window.history.pushState('N/A', 'N/A', newPath);
    }

    const processPath = async () => {
        if (window.location.pathname.match(/\/callback$/g)) {
            await handleAuthCallback();
        } else if (Pages.includes(window.location.pathname)) {
            console.log("NAVIGATING", window.location.pathname)
            setLayoutState(s => Object.assign({}, s, { curPage: window.location.pathname }))
        } else {
            // Else this was opened to a group page - show it
            setLayoutState(s => Object.assign({}, s, { curPage: 'dashboard' }))
        }
    }

    /**
     * Process incoming data from the Spotify API describing the current user.
     * @param err defined if there was a problem
     * @param body the body of the HTTP response
     */
    const handleProfileInfo = (err, body) => {
        if (err) {
            console.error('handleProfileInfo', err, body);
            return;
        }

        console.log('handleProfileInfo', body);
        setAuthState(s => Object.assign({}, s, {
            email: body.email,
            name: body.display_name,
            id: body.id,
            image: body.images.length ? body.images[0].url : null
        }));
    }

    /**
     * Uses the spotify API to fetch the contents of this user's best of the year playlists.
     */
    const fetchUserPlaylists = () => {
        if (!authState.id) {
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

    const openJoinModal = (event) => {
        setLayoutState(s => Object.assign({}, s, {
            curModal: "join"
        }));
    };

    /**
     * Send a request to the backend for a new group creation.
     */
    const createGroup = (event) => {
        console.log("[createGroup]", authState);
    }


    // -----------------
    // NESTED COMPONENTS
    // -----------------
    const SpotifyAuthButton = props => authState.access_token ? (
        <Button variant="contained">
            <AccountCircleIcon />
            {authState.name} Logged In
        </Button>
    ) : (
        <Button variant="contained" onClick={initLogin}>
            <span>LOG IN VIA SPOTIFY</span>
            <LoginIcon />
        </Button>
    );

    const Splash = props => (
        <div className={"splash-container"}>
            <h3 id={'first'}>feeling outta music?</h3>
            <h3 id={'second'}>tired of Spotify's guesses?</h3>
            <h3 id={'third'}>do your friends listen to good music?</h3>
            <SpotifyAuthButton />
            <a className={"button-caption"} onClick={openExplainModal}>WHY?</a>
        </div>
    );

    const Header = props => {
        const isSplash = layoutState.curPage === "splash";
        return (
            <div className={"app-header"}>
                <div className={`app-title-container`}>
                    <span>outtamusic</span>
                </div>

                {!isSplash && <SpotifyAuthButton />}

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

    const Create = props => {
       const [mode, setMode] = useState(null);
       return (
           <div className="create-container">
               <h4>This tool works by collecting the listening habits of a group.</h4>
               <h3>Do you want try it out with a new group, or join one you've already been invited to?</h3>
               <div className={"mode-choice-container"}>
                   <Button variant="contained" className="create-mode-choice-button" onClick={createGroup}>
                       <EmojiPeopleIcon />
                   </Button>
                   <span>Create</span>
               </div>
               <div className={"mode-choice-container"}>
                   <Button variant="contained" className="create-mode-choice-button" onClick={openJoinModal}>
                       <GroupIcon />
                   </Button>
                   <span>Join</span>
               </div>
           </div>
       );
    }

    const AppModal = props => {
        const [formState, setFormState] = useState({});

        const handleGroupNameChange = (event) => {
            const [name, value] = event.target;
            setFormState(s => Object.assign({}, s, { [name]: value }))
        };

        /**
         * Sends a request to the backend API to join the specified group.
         */
        const submitJoinForm = () => {
            if (formState.groupName && formState.password) {
                console.log("[submitJoinForm]", formState);
            }
        };

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
                                with the link and a password can join and add their songs to the playlists.
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
                    {layoutState.curModal === "join" && (
                        <React.Fragment>
                            <h3>Join a Group</h3>
                            <TextField
                                label={"Group Name"}
                                value={formState.groupName || ""}
                                name={"groupName"}
                                onChange={handleGroupNameChange}
                            />
                            <TextField
                                label={"Password"}
                                value={formState.password || ""}
                                name={"password"}
                                onChange={handleGroupNameChange}
                            />
                            <Button className={"join-form-submit"} variant={"contained"} onClick={submitJoinForm}>
                                Submit
                            </Button>
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

    const path = window.location.pathname;

    return (
        <div id="app-root" className="app-root">
            <Header />
            <div className={"app-body"}>
                {layoutState.curPage === "splash" && <Splash />}
                {layoutState.curPage === "create" && <Create />}
                {layoutState.curPage === "dashboard" && <Dashboard />}
            </div>
            <div className={"app-footer"}>
                This project is <a href={'https://github.com/robbwdoering/outtamusic'}>open source</a> and not affiliated with Spotify.
            </div>

            <AppModal />
        </div>
    )
}

export default App;
