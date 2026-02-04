'use strict';

const validator = require('./workspec-validator.js');
const migrator = require('./workspec-migrate-v1-to-v2.js');

module.exports = {
    ...validator,
    ...migrator
};

