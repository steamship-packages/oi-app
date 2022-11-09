import path from "path";
import * as os from "os";
import * as fs from "fs";
import {readFileSync} from "fs";
import {getAuthedClient} from "@steamship/cli";
import {PackageInstance} from "@steamship/client";
import {CliUx} from "@oclif/core";

/*
 * Hello, over-engineering!
 *
 * But really.. I'm going to over-engineer this thing a tad just in case it proves
 * to be useful.
 *
 * Here's what an OI configuration looks like:
 *
 * Feed Folders
 * ------------
 *
 * Everyone has a a FEED_FOLDER:
 * ~/.oi/feeds/
 *
 * That has FEEDS inside. Each FEED is a set of facts you want to remember.
 * - LOCAL FEEDS are feeds you control. They're just files.
 * - REMOTE_FEEDS are linked from URL. They're like subscribing to other people's feeds
 *
 * Right now, I'll just implement LOCAL FEEDS. But the idea of REMOTE FEEDS is kept in there
 * from a structural standpoint so that in the future we could support it.
 *
 * Intent Structure
 * -----------------
 *
 * Steamship has a "File -> Blocks" structure. We use this to store information.
 *
 * - A single "Intent" is a "File".
 * - Each "Block" in the file contains the "Response" tailored toward a specific context.
 * - That context is described by the kind="Context" tags upon the block.
 *
 * - Here are examples of different contexts:
 *    - Example: ["cli"]
 *    - Example: ["slack", "#general"]
 *    - Example: ["slack", "#general", "after-hours"]
 *    - Example: ["slack", "#new-york", "after-hours"]
 *
 *  - In this way, the OI supports the trivial demo of "How do I remember this command line string?"
 *  - But it also supports more complex Intent -> Answer routings:
 *    - Consider "How do I get in the office?"
 *      - If your context is ["slack"] the answer might be "Ask the front desk."
 *      - If your context is ["slack", "new-york"] it might be "Ask Bob on the 4th floor"
 *      - If your context is ["slack", "new-york", "after-hours"] it might be: "The building closes at 6, so you'll have to track down someone personally on Slack."
 *
 *  - The scoring between a Block's context and the user's context is as follows:
 *    - If a block's context is not subset of user context: 0
 *    - If a block's context is subset of user context: len(intersection)
 *    - Top score wins
 *
 * Feed Structure
 * --------------
 *
 * A Feed is thus a combination of:
 * - Files (Intents)
 *   - Blocks (Response for that intent)
 *   - Prompts (Causes for that intent)
 *
 */

export interface Response {
    /* The text of the response. In Steamship: fills the whole block. */
    text: string;
    /* Each tag is a piece of context */
    context?: string[]
    /* The block this response is already stored in */
    block_id?: string
}

export interface Prompt {
    /* A prompt which matches this intent. */
    text: string;
    /* The index item this prompt is embedded in */
    embedding_id?: string;
}

export interface Intent {
    /* Lowercase and dashed. Files on Steamship, will always be `${feed.handle}--${intent-handle}` */
    handle: string;

    // Corresponds to blocsk in Steamship
    responses: Response[]

    // Corresponds to a prompt in Steamship
    prompts: Prompt[]

    // The file that tracks this intent
    file_id?: string
}

export type FeedType = "local" // Placeholder: "url"..
export interface Feed {
    /* must be lowercase and dashed */
    handle: string;
    intents?: Intent[]

    // Placeholder for the idea of remote intents
    type: FeedType
    url?: string; // Placeholder
}

const OI_DIR = path.join(os.homedir(), ".oi")
const OI_FEED_DIR = path.join(OI_DIR, 'feeds')
const OI_SETTINGS_FILE = path.join(OI_DIR, 'settings.json')

export interface ISettings {
    steamshipInstanceHandle: string;
}

const EMPTY_SETTINGS_FILE: ISettings = {
    steamshipInstanceHandle: "oi-default"
}

const EMPTY_FEED_BASE: Feed = {
    handle: "default",
    type: "local",
    intents: []
}

const DEFAULT_FEED_BASE: Feed = {
    handle: "default",
    type: "local",
    intents: [
        {
            handle: "how-do-i-use-this",
            responses: [
                {
                    text: "Just type `oi learn` to  learn something. Or `oi (anything else)` to ask!",
                    context: ["cli"]
                }
            ],
            prompts: [
                {
                    text: "How do I use this?"
                },
                {
                    text: "How does this work?"
                }

            ]
        }
    ]
}

function createDirIfNotExistSync(fullPath: string) {
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath)
    }
}

function writeFileSync(fullPath: string, someJson: any) {
    fs.writeFileSync(fullPath, JSON.stringify(someJson, undefined, 2))
}

export function requireValidHandle(str: string) {
    if (!/^[a-z][a-z0-9-]*$/.test(str)) {
        throw Error(`Invalid handle: '${str}'. Please use only lowercase letters, numbers, and dashes. Start with a letter.`)
    }
}

export const DEFAULT_FEED_HANDLE = 'default'

function addIntentByReference(feed: Feed, intent: Intent) {
    requireValidHandle(intent.handle);
    if (!feed.intents) {
        feed.intents = []
    }
    feed.intents.push(intent)
}

export class Configuration {
    settings: ISettings

    public constructor() {
        this.prepare()
        if (!fs.existsSync(OI_SETTINGS_FILE)) {
            writeFileSync(OI_SETTINGS_FILE, EMPTY_SETTINGS_FILE);
        }
        this.settings = JSON.parse(readFileSync(OI_SETTINGS_FILE, 'utf8'));
    }

    public async getPackage(): Promise<PackageInstance> {
        const ship = await getAuthedClient();
        const oi = await ship.use("oi", this.settings.steamshipInstanceHandle)
        return oi
    }

    /* Creates or loads a feed with appropriate defaults */
    private _createOrLoadFeed(handle: string, baseTemplate?: any, type: FeedType = "local") {
        requireValidHandle(handle)
        const feedFile = path.join(OI_FEED_DIR, `${handle}.json`)
        if (!fs.existsSync(feedFile)) {
            writeFileSync(feedFile, baseTemplate || EMPTY_FEED_BASE);
        }
        return JSON.parse(readFileSync(feedFile, 'utf8'));
    }

    private _saveFeed(handle: string, feed: Feed) {
        requireValidHandle(handle);
        requireValidHandle(feed.handle);
        const feedFile = path.join(OI_FEED_DIR, `${handle}.json`)
        writeFileSync(feedFile, feed);
    }

    private async _syncFeed(handle: string, feed: Feed) {
        const oi = await this.getPackage();
        const feedResults: any = await oi.invoke("learn_feed", {feed})
        console.log("got results", JSON.stringify(feedResults))
        if (!feedResults.data) {
            CliUx.ux.error("Unable to parse response")
        }
        this._saveFeed(handle, feedResults.data)
    }

    /* Ensures that this configuration is ready to use. */
    private prepare() {
        createDirIfNotExistSync(OI_DIR)
        createDirIfNotExistSync(OI_FEED_DIR)
        this._createOrLoadFeed(DEFAULT_FEED_HANDLE, DEFAULT_FEED_BASE)
    }

    public async addIntent(intent: Intent, feedHandle: string = DEFAULT_FEED_HANDLE) {
        const feed = this._createOrLoadFeed(feedHandle)
        addIntentByReference(feed, intent);
        this._saveFeed(feedHandle, feed);
        await this._syncFeed(feedHandle, feed);
    }

    public async sync(feedHandle: string = DEFAULT_FEED_HANDLE) {
        const feed = this._createOrLoadFeed(feedHandle)
        return this._syncFeed(feedHandle, feed)
    }

    public async query(text: string, context?: string[]) {
        const oi = await this.getPackage();
        return await oi.invoke("query", {question: {text, context}})
    }

}

