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
 * Fetches a wcms-modules.json file from the given repository URL.
 *
 * If the project has a legacy format with version+summary files, it is converted to the new
 * format.
 *
 * @param repo the URL of the repository containing the module.
 * @param type repository type, either "plugins" or "themes". Used for legacy plugins only.
 * @returns an object with the format of wcms-modules.json
 * @throws Error if the metadata could not be fetched successfully.
 */
async function fetchMeta(repo, type) {
    const repoInfo = await fetchRepoInfo(repo);

    // If we have a ready-made wcms-modules.json file, use that
    if (await asyncHeadTest(`${repoInfo.rawPrefix}/wcms-modules.json`)) {
        const meta = JSON.parse(await asyncGet(`${repoInfo.rawPrefix}/wcms-modules.json`));

        // Ensure we're using the same metadata version
        if (meta.version != 1) {
            throw new Error(`${repo} has an invalid metadata version ${meta.version}`);
        }

        return meta;
    }

    // Else convert from old format into the new one
    const meta = {
        name: repoInfo.name.replace(/[-_]/g, ' ').replace(/(^| )[a-z]/g, x => x.toUpperCase()),
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

    // Create the structure of the wcms-modules.json file.
    return {
        [type]: {
            [repoInfo.name]: meta
        }
    }
}

/**
 * Fetches all metadata for the repositories stored in the given file.
 *
 * @param file the file, relative to this script, which contains the repositories' URLs.
 * @param type repository type, either "plugins" or "themes".
 * @returns an object with the format of wcms-modules.json
 * @throws Error if any module could not be successfully fetched.
 */
async function fetchListMeta(file, type) {
    // Read list of repositories
    const absFile = path.join(__dirname, file);
    const repos = await readLines(absFile);

    /*
     * This would be faster if we'd used Promise.all here as well, but then we'd hit a GitHub
     * request limit :V
     */
    const aggregatedMeta = {
        plugins: {},
        themes: {},
    };
    for (const repo of repos) {
        const repoMeta = await fetchMeta(repo, type);

        console.log(`Metadata from ${repo}:`);

        // Log and aggregate plugins
        if (repoMeta.plugins) {
            for (const name in repoMeta.plugins) {
                console.log(` - Plugin ${name} @ v${repoMeta.plugins[name].version}`)
            }

            Object.assign(aggregatedMeta.plugins, repoMeta.plugins);
        }

        // Log and aggregate themes
        if (repoMeta.themes) {
            for (const name in repoMeta.themes) {
                console.log(` - Theme ${name} @ v${repoMeta.themes[name].version}`)
            }

            Object.assign(aggregatedMeta.themes, repoMeta.themes);
        }
    }

    return aggregatedMeta;
}

/**
 * Fetches and updates the module-list.json file.
 *
 * @throws Error if the file could not be updated successfully.
 */
async function buildList() {
    // Fetch information from plugins-list.json and themes-list.json in parallel
    const allMetas = await Promise.all([
        fetchListMeta('plugins-list.json', 'plugins'),
        fetchListMeta('themes-list.json', 'themes')
    ]);

    // Aggregate the information from both lists
    const aggregatedMeta = {
        version: 1,
        plugins: {},
        themes: {},
    };
    for (const meta of allMetas) {
        Object.assign(aggregatedMeta.plugins, meta.plugins);
        Object.assign(aggregatedMeta.themes, meta.themes);
    }

    // Pretty-print with 4 spaces indentation
    const metaJson = JSON.stringify(aggregatedMeta, null, 4);
    await fs.writeFile('wcms-modules.json', metaJson);
}

buildList().then();
