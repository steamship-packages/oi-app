import {shellHistory} from "shell-history";
import {inquireString, select} from "./select.js";
import {CliUx} from "@oclif/core";
import {Configuration, DEFAULT_FEED_HANDLE, Intent, Prompt, requireValidHandle} from "./Configuration.js";
import {v4 as uuidv4} from 'uuid';

export interface IAddIntent {
    handle?: string
    prompt?: string
    feed?: string
    response?: string
    context?: string[]
}

export function getLastShellCommand(): string | undefined {
    const shellHistoryList = shellHistory();
    if (shellHistoryList.length > 1) {
        return shellHistoryList[shellHistoryList.length - 2]
    }
    return undefined
}

async function getPrompts(prompt?: string): Promise<string[]> {
    let prompts: string[] = []

    if (prompt) {
        CliUx.ux.info(`You can ask for that fact with questions like the one you provided:`)
        CliUx.ux.info(`  ${prompt}`)
        CliUx.ux.info(`Enter some other ways to ask for it, followed by an empty line.`)
        prompts.push(prompt)
    } else {
        CliUx.ux.info(`Enter some ways to ask for this fact, followed by an empty line.`)
    }

    let newPrompt = await inquireString("Prompt:");
    while (newPrompt) {
        prompts.push(newPrompt)
        newPrompt = await inquireString("Prompt:");
    }

    return prompts;
}

async function getResponse(response?: string): Promise<string> {
    if (response) {
        return response;
    }

    CliUx.ux.info(`Let's learn something!`)

    const lastShellCommand = getLastShellCommand()

    if (lastShellCommand) {
        CliUx.ux.info(`Your last shell command was:\n   ${lastShellCommand}`)
        let answer = await select({
            prompt: `Is that what you want to learn?`,
            choices: [
                {
                    id: 'yes',
                    name: 'Yes'
                },
                {
                    id: 'no',
                    name: 'No',
                }
            ]
        })
        if (answer.id == "yes") {
            return lastShellCommand
        }
    }

    let newResponse = await inquireString("What do you want to remember?");
    return newResponse;
}

export async function createIntent(params: IAddIntent) {
    let {prompt, feed, response, context, handle} = params;

    let newResponse = await getResponse(response)
    if (!newResponse) {
        CliUx.ux.error('No response was provided. Unable to continue')
    }

    let prompts = await getPrompts(prompt);
    if (!prompts) {
        CliUx.ux.error('No prompts were provided. Unable to continue')
    }

    let feedHandle = feed || DEFAULT_FEED_HANDLE;

    let theContext = context || ['cli']
    let theHandle = handle || `intent-${uuidv4().toLowerCase()}`
    requireValidHandle(theHandle)

    let intent: Intent = {
        handle: theHandle,
        responses: [
            {text: newResponse, context: theContext}
        ],
        prompts: prompts.map((text): Prompt => ({
            text
        }))
    }

    let config = new Configuration()
    await config.addIntent(intent, feed)
}