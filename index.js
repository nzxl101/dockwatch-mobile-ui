require("dotenv").config();
const express = require("express");
const consola = require("consola");

const app = express();
const port = 3000;

const instance = process.env.INSTANCE;
const api_key = process.env.API_KEY;

(async () => {
    let connection = await new Promise(async (resolve) => {
        consola.info(`Connecting to instance using API key: ${redactString(api_key)} ..`);
        let result = await apiEndpoint("server-ping", api_key, instance);

        resolve(result.length > 0 ? result : false);
    });
    if (connection == false) {
        return consola.error(`Failed to connect to instance!`);
    } else {
        consola.success(`Connected to instance, version: ${JSON.parse(connection)["response"]["result"]}`);
    }

    /**
     * Get object list of docker containers
     * @returns {Promise<[]>}
     */
    const getContainers = () => {
        return new Promise(async (resolve) => {
            let containers = JSON.parse(await apiEndpoint("stats-getContainersList", api_key, instance))["response"];
            if (containers.length < 0) {
                return resolve(null);
            }

            consola.success(`getContainers » Found ${containers.length} containers!`);

            resolve(containers);
        });
    };

    app.get("/", (_, res) => {
        res.setHeader("Content-Type", "text/html");
        res.send(require("fs").readFileSync("./index.html"));
    });

    app.get("/refresh", async (_, res) => {
        containers = await getContainers();
        res.jsonp({ containers });
    });

    app.listen(port, () => {
        consola.success(`Listening on port http://0.0.0.0:${port}`);
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
 * Call endpoint and return raw data
 * @param {string} endpoint - Possible endpoints: server-ping, stats-getContainersList
 * @param {string} api_key - Instance API key
 * @param {string} instance - Instance URL
 * @returns {Promise<string>} Raw data
 */
function apiEndpoint(endpoint = "server-ping", api_key, instance) {
    return new Promise((resolve, reject) => {
        fetch(`http://${instance}/api/?request=${endpoint}&apikey=${api_key}`, {
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            method: "GET",
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
