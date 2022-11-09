import {Command} from '@oclif/core';
import {exec} from "child_process";

import process from 'node:process';
import {userInfo} from 'node:os';
import {createIntent} from "../helpers/CreateIntent.js";
// @ts-ignore
import {getAuthedClient} from '@steamship/cli';

export const detectDefaultShell = () => {
    const {env} = process;

    if (process.platform === 'win32') {
        return env.COMSPEC || 'cmd.exe';
    }

    try {
        const {shell} = userInfo();
        if (shell) {
            return shell;
        }
    } catch {
    }

    if (process.platform === 'darwin') {
        return env.SHELL || '/bin/zsh';
    }

    return env.SHELL || '/bin/sh';
};


async function run(cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(cmd, (error: any, stdout: string, stderr: string) => {
            if (error) {
                reject(error.message)
            }
            if (stderr) {
                reject(stderr)
            }
            resolve(stdout)
        });
    })
}

export default class Learn extends Command {
    static strict = false

    static description = 'Downloads a Jupyter demo of a Steamship Package or Plugin.';
    static examples = [`$ oi learn How do I reset head to origin/main`];
    static args = [
        {
            name: 'handle',
            description: 'The package or plugin handle.'
        }
    ];

    async run() {
        const {args, flags} = await this.parse(Learn);
        const {handle} = args;

        const prompt = process.argv.slice(3).join(" ")
        const context = ['cli']

        await createIntent({prompt, context})
    }
}
