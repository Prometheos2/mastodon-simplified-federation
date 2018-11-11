/**
 * Controller intercepting tab loads and redirecting them to correct modules.
 *
 * @module AutoRenameFollow
 */

import {INTERACTION_TYPE} from "./data/INTERACTION_TYPE.js";

import * as MastodonDetect from "./Detect/Mastodon.js";
import * as GnuSocialDetect from "./Detect/GnuSocial.js";

import * as MastodonRedirect from "./MastodonRedirect.js";

const FEDIVERSE_TYPE = Object.freeze({
    MASTODON: Symbol("mastodon"),
    GNU_SOCIAL: Symbol("GNU Social")
});
const FEDIVERSE_MODULE = Object.freeze({
    [FEDIVERSE_TYPE.MASTODON]: MastodonDetect,
    [FEDIVERSE_TYPE.GNU_SOCIAL]: GnuSocialDetect
});

/**
 * Listens for Mastodon requests at tab update.
 *
 * @function
 * @private
 * @param {integer} tabId
 * @param {Object} changeInfo
 * @throws {Error}
 * @returns {Promise}
 */
async function handleTabUpdate(tabId, changeInfo) {
    // ignore when URL is not changed
    if (!changeInfo.url) {
        return Promise.reject(new Error("URL info not available"));
    }

    const url = new URL(changeInfo.url);

    const [software, interaction] = getInteractionType(url);

    // detect, which network/fsoftware it uses
    let detectModule;
    switch (software) {
    case null:
        // ignore unrelated sites
        return Promise.resolve();
    case FEDIVERSE_TYPE.MASTODON:
        detectModule = MastodonDetect;
        break;
    case FEDIVERSE_TYPE.GNU_SOCIAL:
        detectModule = GnuSocialDetect;
        break;
    default:
        throw new Error(`unknown fediverse type: ${software.toString()}`);
    }

    // and get data and pass to redirect
    switch (interaction) {
    case INTERACTION_TYPE.FOLLOW: {
        const remoteUser = await detectModule.getUsername(url);
        const remoteServer = await detectModule.getServer(url);

        return MastodonRedirect.redirectFollow(remoteUser, remoteServer);
    }
    case INTERACTION_TYPE.TOOT_INTERACT: {
        const tootUrl = await detectModule.getTootUrl(url);

        return MastodonRedirect.redirectToot(tootUrl);
    }
    default:
        throw new Error(`unknown interaction type: ${interaction.toString()}`);
    }
}

/**
 * Checks what type of interaction the current URL denotes.
 *
 * @function
 * @private
 * @param {URL} url
 * @returns {[FEDIVERSE_TYPE, Symbol]|null}
 */
function getInteractionType(url) {
    for (const fedType of Object.values(FEDIVERSE_TYPE)) {
        for (const [checkRegEx, interactionType] of FEDIVERSE_MODULE[fedType].CATCH_URLS) {
            if (url.pathname.match(checkRegEx)) {
                return [fedType, interactionType];
            }
        }
    }

    return [null, null];
}

/**
 * Init AutoRemoteFollower module.
 *
 * @function
 * @returns {Promise}
 */
function init() {
    browser.tabs.onUpdated.addListener(handleTabUpdate);
}

init();