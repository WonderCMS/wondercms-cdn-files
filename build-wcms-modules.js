#!/usr/bin/env node
'use strict';

const fs = require('fs').promises;
const https = require('https');
const path = require('path');

/********************
* UTILITY FUNCTIONS *
********************/

/**
 * Reads lines from a text file.
 *
 * @param file file to read from.
 * @returns an array of lines.
 * @throws Error if the file could not be read or decoded
 */
async function readLines(file) {
    // Read as string
    let contents = await fs.readFile(file, 'utf-8');

    // Split by lines
    contents = contents.split('\n');

    // Trim spaces from start and end of each line
    contents = contents.map(x => x.trim());

    // Remove empty lines
    contents = contents.filter(x => x.length);

    return contents;
}

/**
 * Executes an asynchronous GET call.
 *
 * Adapted from https://stackoverflow.com/a/67054798
 *
 * @param url The URL to fetch
 * @returns a Buffer
 * @throws Error if the fetch failed
 */
async function asyncGet(url) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, { timeout: 30000 }, (res) => {
            if (res.statusCode < 200 || res.statusCode > 299) {
                return reject(new Error(`HTTP status code ${res.statusCode}`))
            }

            const body = [];
            res.on('data', (chunk) => body.push(chunk));
            res.on('end', () => {
                return resolve(Buffer.concat(body));
            });
        });
        request.on('error', (err) => {
            reject(err);
        });
        request.on('timeout', () => {
            request.destroy()
            reject(new Error('timed out'))
        })
    });
}

/**
 * Checks if a remote file exists, by executing a HEAD call.
 *
 * @param url The URL to check
 * @returns true if file exists, false otherwise
 * @throws Error if the fetch failed
 */
async function asyncHeadTest(url) {
    return new Promise((resolve, reject) => {
        const options = {
            method: 'HEAD',
            timeout: 30000
        };

        const request = https.request(url, options, (res) => {
            request.destroy();
            resolve(res.statusCode >= 200 && res.statusCode <= 299);
        });
        request.on('error', (err) => {
            reject(err);
        });
        request.on('timeout', () => {
            request.destroy()
            reject(new Error('timed out'))
        })
        request.end();
    });
}

/********************
* METADATA BUILDING *
********************/

/**
 * Extracts information about the Git repository URL.
 *
 * This function returns an object with the following properties:
 *  - name: the repository name
 *  - rawPrefix: the prefix to use for reading raw, unprocessed files from the repository.
 *  - zipUrl: the URL to download the full repository contents as a ZIP file.
 *  - htmlUrl: the clean repository URL for accessing via a browser the exact branch we're using.
 *
 * @param repo repository URL
 * @returns the extracted information, in the aforementioned format
 * @throws Error if the base URL could not be determined
 */
async function fetchRepoInfo(repo) {
    // Check if URL is a GitHub one, optionally with a branch name
    const githubMatch = repo.match(/^https?:\/\/github\.com\/(?<owner>[^/]+)\/(?<name>[^/]+)(\/tree\/(?<branch>[^/]+))?/);
    if (githubMatch) {
        const owner = githubMatch.groups.owner;
        const name = githubMatch.groups.name;
        let branch = githubMatch.groups.branch;

        // If no branch was specified, attempt to guess it
        if (!branch) {
            for (const guess of ['master', 'main']) {
                if (await asyncHeadTest(`https://github.com/${owner}/${name}/tree/${guess}`)) {
                    branch = guess;
                    break;
                }
            }

            if (!branch) {
                throw new Error(`Could not determine default GitHub branch for ${repo}`);
            }
        }

        return {
            name,
            rawPrefix: `https://raw.githubusercontent.com/${owner}/${name}/${branch}`,
            zipUrl: `https://github.com/${owner}/${name}/archive/${branch}.zip`,
            htmlUrl: `https://github.com/${owner}/${name}/tree/${branch}`,
        }
    }

    throw new Error(`Unsupported Git repo ${repo}`);
}

/**
 * Fetches module (plugin/theme) metadata from the given repository URL.
 *
 * This returns an object with the following properties:
 *  - dirName: the internal, filesystem-friendly folder where this module will be installed.
 *  - name: an user-friendly module name.
 *  - version: the module's version, like "v1.2.3".
 *  - summary: a short description of the module's functionality.
 *  - image: an optional sample image displaying the new functionality.
 *  - zip: the URL of a ZIP file containing the module.
 *  - repo: the user-friendly URL of the project's page, for opening on a web browser.
 *
 * @param repo the URL of the repository containing the module.
 * @returns an object with aforementioned entries.
 * @throws Error if the metadata could not be fetched successfully.
 */
async function fetchMeta(repo) {
    const repoInfo = await fetchRepoInfo(repo);

    // Begin building meta
    const meta = {
        name: repoInfo.name.replace(/[-_]/g, ' ').replace(/(^| )[a-z]/g, x => x.toUpperCase()),
        dirName: repoInfo.name,
        repo: repoInfo.htmlUrl,
        zip: repoInfo.zipUrl,
    };

    // Fill summary
    meta.summary = (await asyncGet(`${repoInfo.rawPrefix}/summary`)).toString('utf-8').trim();

    // Fill version
    meta.version = (await asyncGet(`${repoInfo.rawPrefix}/version`)).toString('utf-8').trim();

    // If the image exists, link it
    for (const guess of ['preview.png', 'preview.jpg']) {
        const image = `${repoInfo.rawPrefix}/${guess}`;
        if (await asyncHeadTest(image)) {
            meta.image = image;
            break;
        }
    }

    console.log(`Repo ${repoInfo.name}, version ${meta.version}`);

    return meta;
}

/**
 * Fetches all metadata for the repositories stored in the given file.
 *
 * @param file the file, relative to this script, which contains the repositories' URLs.
 * @returns an object, mapping the installation folder to the module's metadata, as described
 *          in the fetchMeta function.
 * @throws Error if any module could not be successfully fetched.
 */
async function fetchListMeta(file) {
    // Read list of repositories
    const absFile = path.join(__dirname, file);
    const repos = await readLines(absFile);

    /*
     * This would be faster if we'd used Promise.all here as well, but then we'd hit a GitHub
     * request limit :V
     */
    const meta = {};
    for (const repo of repos) {
        const repoMeta = await fetchMeta(repo);
        meta[repoMeta.dirName] = repoMeta;
        delete repoMeta.dirName;
    }

    return meta;
}

/**
 * Fetches and updates the module-list.json file.
 *
 * @throws Error if the file could not be updated successfully.
 */
async function buildList() {
    const [plugins, themes] = await Promise.all([
        fetchListMeta('plugins-list.json'),
        fetchListMeta('themes-list.json')
    ]);

    const metadata = {
        version: 1,
        timestamp: new Date().toISOString(),
        plugins,
        themes,
    }

    // Pretty-print with 4 spaces indentation
    const metaJson = JSON.stringify(metadata, null, 4);
    await fs.writeFile('wcms-modules.json', metaJson);
}

buildList().then();
