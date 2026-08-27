'use strict';

const validator = require('./workspec-validator.js');
const runtime = require('./workspec-runtime.js');
const migrator = require('./workspec-migrate-v1-to-v2.js');
const customValidationRunner = require('./custom-validation-runner.js');
const stateVisuals = require('./state-visuals.js');

module.exports = {
    runtime,
    ...validator,
    ...migrator,
    ...stateVisuals,
    ...customValidationRunner
};
