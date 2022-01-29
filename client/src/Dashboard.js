import {Button} from "@mui/material";
import ShareIcon from "@mui/icons-material/Share";
import React from "react";


const Dashboard = props => {
    return (
        <div className={"dashboard-container"}>
            <div className={'group-admin-container'}>
                <div className={'member-list'}>
                </div>
                <div className={'url-container'}>
                    https://outtamusic.com/BronzeWombat
                    <Button className={"share-button"} variant={"contained"}>
                        <ShareIcon />
                        Share Invite
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;