import { BskyAgent } from '@atproto/api'
import axios from "axios";

import {
    appendPostedAlertToJson,
    removeAlertFromJson,
    getPostedAlerts,
    logErrorToFile,
} from "./storage.js";
import { formatSkeetFromNWSAlert } from "./textHandlers.js";

const agent = new BskyAgent({ service: 'https://bsky.social' })

axios.defaults.headers.common[
    "Authorization"
] = `Bearer ${process.env.AUTH_TOKEN}`;

const getActiveAlertsForZone = async () => {
    try {
        const getActiveAlertsForZoneResponse = await axios.get(
            `https://api.weather.gov/alerts/active?zone=${process.env.NWS_ALERT_ZONE}`,
            { headers: { "User-Agent": process.env.NWS_API_USER_AGENT } }
        );
        return getActiveAlertsForZoneResponse.data.features;
    } catch (error) {
        logErrorToFile({ error, method: "getActiveAlertsForZone" });
        return [];
    }
};

const postAlert = async (alert) => {
    try {
        const postedAlerts = getPostedAlerts();
        if (postedAlerts.find((postedAlert) => postedAlert.alertId === alert.id)) {
            return;
        }

        const skeet = formatSkeetFromNWSAlert(alert)
        console.log(skeet.length)
        const skeetResponse = await agent.post({
            text: skeet
        })
        appendPostedAlertToJson({
            alertId: alert.id,
            skeetUri: skeetResponse.uri,
        })
    } catch (error) {
        logErrorToFile({ error, method: "postAlert" });
    }
};

const postAlerts = async (alerts) =>
    await Promise.all(alerts.map(async (alert) => await postAlert(alert)));

const deleteAlert = async (alert) => {
    try {
        await agent.deletePost({ postUri: alert.skeetUri })
        removeAlertFromJson(alert.alertId);
    } catch (error) {
        logErrorToFile({ error, method: "deleteAlert" });
    }
};

const deleteInactiveAlerts = async (activeAlerts) => {
    try {
        const postedAlerts = getPostedAlerts();
        // O(n^2), but I'm not going to waste time optimizing for this use case
        const inactivePostedAlerts = [...postedAlerts].filter(
            (postedAlert) =>
                !activeAlerts.find(
                    (activeAlert) => activeAlert.id === postedAlert.alertId
                )
        );

        return await Promise.all(
            inactivePostedAlerts.map(
                async (inactiveAlert) => await deleteAlert(inactiveAlert)
            )
        );
    } catch (error) {
        logErrorToFile({ error, method: "deleteInactiveAlerts" });
    }
};

async function main() {
    try {
        await agent.login({
            identifier: process.env.BLUESKY_USERNAME,
            password: process.env.BLUESKY_PASSWORD,
        })
        setInterval(
            (async () => {
                const activeAlerts = await getActiveAlertsForZone();
                await deleteInactiveAlerts(activeAlerts);
                await postAlerts(activeAlerts)
            }),
            30000
        );
    } catch (error) {
        logErrorToFile({ error, method: "main" });
    }
}


main()