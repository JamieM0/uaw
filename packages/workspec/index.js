'use strict';

const validator = require('./workspec-validator.js');
const migrator = require('./workspec-migrate-v1-to-v2.js');
const customValidationRunner = require('./custom-validation-runner.js');

module.exports = {
    ...validator,
    ...migrator,
    ...customValidationRunner
};
