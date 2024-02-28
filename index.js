require("dotenv").config();
const express = require("express");
const cheerio = require("cheerio");
const consola = require("consola");

const app = express();
const port = 3000;

const dockwatchUrl = process.env.INSTANCE;
const sessionId = process.env.INSTANCE_SESSIONID;

(async () => {
    let session = await new Promise(async (resolve) => {
        consola.info(`session() » Testing session id ${redactString(sessionId)} ..`);
        resolve((await apiEndpoint("overview", sessionId, dockwatchUrl)).length > 0 ? true : false);
    });
    if (session == false) {
        return consola.error(`() » Session invalid or expired!`);
    }

    /**
     * Get object list of docker containers
     * @returns {Promise<[]>}
     */
    const getContainers = () => {
        return new Promise(async (resolve) => {
            let containers = [];
            let req = await apiEndpoint("containers", sessionId, dockwatchUrl);

            const $ = cheerio.load(req);
            $("table>tbody>tr").each((i, element) => {
                const id = $(element).attr("id");
                const name = $(`span[id=menu-${id}]`).text().trim();
                const state = $(`span[id=${id}-state]`).text().trim();
                const uptime = $(`span[id=${id}-length]`).text().trim();
                const lastPulled = `${$(`td[id=${id}-update]`).attr("title")}`.trim().split(/Last pulled: /)[1];
                const updateState = $(`td[id=${id}-update]`).text().trim().split("\n")[0];
                const health = $(`td[id=${id}-health]`).text().trim();

                let image;
                $(`span[class*=text-muted][class*=small-text]`).each((index, element) => {
                    // what the fuck is this shit but whatever it works lol
                    const parent = $(element).parent();
                    if (parent.find(`span[id=menu-${id}]`).length > 0) {
                        image = shortenString(`${$(element).attr("title")}`.trim());
                    }
                });

                let icon;
                $(`tbody tr[id=${id}]`).each((index, element) => {
                    if ($(element).find(`td img`).length > 0) {
                        icon = $(element).find(`td img`).attr("src");
                    }
                });

                if (name.length <= 0) {
                    return;
                }

                containers.push({
                    id,
                    name,
                    info: {
                        state,
                        uptime,
                        updateState,
                        lastPulled,
                        health,
                        image,
                        icon,
                    },
                });

                consola.log(`getContainers() » ${i}: ${id} ${name}`);
            });

            consola.success(`getContainers() » Found ${containers.length} containers!`);
            resolve(containers);
        });
    };

    let containers = await getContainers();
    consola.success("() »", containers);

    if (containers.length <= 0) {
        return consola.error("() » No containers found, whatcha trynna do?");
    }

    app.get("/", (req, res) => {
        res.setHeader("Content-Type", "text/html");
        res.send(require("fs").readFileSync("./index.html")); // ghetto style best style
    });

    app.get("/refresh", async (req, res) => {
        containers = await getContainers();
        res.jsonp({ containers });
    });

    app.listen(port, () => {
        consola.success("() »", `Listening on port http://0.0.0.0:${port}`);
    });
})();

/**
 * Redact secret string
 * @param {String} str
 * @returns {String}
 */
function redactString(str) {
    let length = str.length;
    let redactLength = Math.floor(length / 1.337); // Kewl

    let start = Math.floor((length - redactLength) / 2);
    let end = start + redactLength;

    let redacted = `${str.substring(0, start)}${"*".repeat(redactLength)}${str.substring(end, length)}`;

    return redacted;
}

/**
 * Shorten string, basically the same as redactString but removing chars instead of replacing
 * @param {String} str
 * @returns {String}
 */
function shortenString(str) {
    let length = str.length;
    let shortenLength = Math.floor(length / 2);

    let start = Math.floor((length - shortenLength) / 2);
    let end = start + shortenLength;

    let shorten = `${str.substring(0, start)}...${str.substring(end, length)}`;

    return shorten;
}

/**
 * Call endpoint and return raw data
 * @param {string} endpoint - Possible endpoints: overview, containers, orphans, notification, settings, tasks, commands, logs
 * @param {string} sessionId - PHP Session ID Cookie
 * @param {string} url - Dockwatch URL
 * @returns {Promise<string>} Raw data
 */
function apiEndpoint(endpoint = "overview", sessionId, url) {
    return new Promise((resolve, reject) => {
        fetch(`${url}/ajax/${endpoint}.php`, {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                Cookie: `PHPSESSID=${sessionId}`,
            },
            body: `m=init&page=${endpoint}`,
            method: "POST",
        })
            .then((response) => {
                return response.text();
            })
            .then((data) => {
                resolve(data);
            })
            .catch((err) => {
                reject(err);
            });
    });
}
