import {CliUx, Command} from '@oclif/core';

import process from 'node:process';
import {Configuration} from "../helpers/Configuration.js";

export default class Index extends Command {
    static strict = false

    static description = "Query for information you've leraned.";
    static examples = [`$ oi How do I reset head to origin/main?`];

    async run() {
        const {args, flags} = await this.parse(Index);
        const {handle} = args;
        const query = process.argv.slice(2).join(" ")

        let config = new Configuration()
        let results: any = await config.query(query)

        if (results && results.data && results.data.topResponse && results.data.topResponse.text) {
            CliUx.ux.info(`\n${results.dasta.topResponse.text}\n`)
        } else {
            CliUx.ux.warn(`Unable to find a match for: ${query}`)
        }
    }
}
