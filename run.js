#!/usr/bin/env node

import command from '@oclif/command';
import flush from '@oclif/command/flush.js';
import handleError from '@oclif/errors/handle.js';

command.run()
    .then(flush)
    .catch(handleError)
