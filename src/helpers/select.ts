import {CliUx} from '@oclif/core';
import inquirer from 'inquirer';

export interface ISelectParams {
    url?: string;
    tree?: IChoiceTree;
    choices?: IChoice[];
    preSelected?: string;
    requirePreselect?: boolean;
    limitOptions?: string[];
    recurse?: boolean;
    limitToPropertyNotNull?: string;
    prompt?: string;
}

export interface IChoice {
    id?: string;
    name?: string;
    description?: string;
    url?: string;

    // If non-null, this will cause the select() method to recurse
    choices?: IChoiceTree;
}

export interface IChoiceTree {
    prompt: string;
    choices: IChoice[];
}


async function getIdRecursive(
    choices: IChoice[],
    preSelected: string
): Promise<IChoice | undefined> {
    for (const c of choices) {
        if (c.id == preSelected) {
            return c;
        }
        if (c.choices && Array.isArray(c.choices)) {
            const r = getIdRecursive(c.choices, preSelected);
            if (r) {
                return r;
            }
        }
    }
}

function makeChoicePropertyFilter(limitToPropertyNotNull: string) {
    const returnFunction = (choice: IChoice) => {
        // If it just indirects to a remote file, we just won't check..
        // If this choice has the property itself, and it's not null or an empty list, return true
        if (
            (choice as any)[limitToPropertyNotNull!] !== null &&
            (choice as any)[limitToPropertyNotNull!] !== undefined
        ) {
            const value = (choice as any)[limitToPropertyNotNull!];
            if (!(Array.isArray(value) && (value as any[]).length == 0)) {
                return true;
            }
        }
        // If this choice itself has choices, and one of those choices returns true, return true.
        if (choice.choices?.choices) {
            for (const c of choice.choices.choices) {
                if (returnFunction(c)) {
                    return true;
                }
            }
        }
        // Otherwise, we're toast.
        return false;
    };
    return returnFunction;
}

export async function inquireString(prompt: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        inquirer
            .prompt([
                {
                    type: 'input',
                    name: 'choice',
                    message: prompt
                }
            ])
            .then((answers: any) => {
                const answer = answers['choice'];
                resolve(answer);
            })
            .catch((error: any) => {
                if (error.isTtyError) {
                    reject('Unable to get answer from user.');
                } else {
                    reject(error);
                }
            });
    });
}

export async function inquire(prompt: string, choices: IChoice[]): Promise<IChoice> {
    return new Promise<IChoice>((resolve, reject) => {
        const choiceList = choices.map((choice) => {
            return choice.description ? `${choice.name} - ${choice.description}` : choice.name;
        });
        inquirer
            .prompt([
                {
                    type: 'list',
                    name: 'choice',
                    message: prompt,
                    choices: choiceList
                }
            ])
            .then((answers: any) => {
                const answer = answers['choice'];
                const idx = choiceList.indexOf(answer);
                resolve(choices[idx]);
            })
            .catch((error: any) => {
                if (error.isTtyError) {
                    reject('Unable to render list of choices in your current TTY environment.');
                } else {
                    reject(error);
                }
            });
    });
}

export async function select(params: ISelectParams): Promise<IChoice> {
    let {
        choices,
        limitToPropertyNotNull,
        preSelected,
        limitOptions,
        prompt,
        recurse,
        requirePreselect
    } = params;

    if (!choices) {
        throw Error('`choices` required to select choices.');
    }

    if (typeof limitToPropertyNotNull != 'undefined') {
        choices = choices.filter(makeChoicePropertyFilter(limitToPropertyNotNull));
    }

    if (choices.length == 0) {
        throw Error('No choices were found to choose from.');
    }

    if (preSelected) {
        // Maybe just return the choice!
        const res = await getIdRecursive(choices, preSelected);
        if (res) return res;
        if (requirePreselect === true) {
            throw Error(`Unable to preselect value ${preSelected}`);
        }
    }

    // Enable the caller to limit the choices
    if (limitOptions) {
        choices = choices.filter((choice) => choice.id && limitOptions?.includes(choice.id));
    }

    const selection = await inquire(prompt || 'Please make a selection:', choices);

    /*
     * We offer the option for recursion here.
     */
    if (recurse === false) {
        return selection;
    } else if (selection.choices?.choices && Array.isArray(selection.choices?.choices)) {
        return selectFromJson({
            ...params,
            tree: selection.choices,
            url: undefined,
            choices: undefined,
            prompt: undefined,
            limitOptions: undefined // HACK. Clear out on recurse
        });
    } else {
        // The selection doesn't specify a further object.
        return selection;
    }
}

export async function selectFromJson(params: ISelectParams): Promise<IChoice> {
    if (!params.tree) {
        throw Error(`'tree' required to select options from JSON. Got ${JSON.stringify(params)}`);
    }
    if (!params.tree.choices) {
        CliUx.ux.error(
            `Empty set of choices from choice selection tree with prompt: ${params.tree.prompt}`
        );
    }
    return select({
        ...params,
        choices: params.tree.choices,
        prompt: params.prompt || params.tree.prompt
    });
}

