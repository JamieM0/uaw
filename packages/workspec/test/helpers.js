'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const cliPath = path.join(packageRoot, 'bin', 'workspec.js');

function baseDoc() {
    return {
        simulation: {
            schema_version: '2.1',
            meta: { title: 't', description: 'd', domain: 'x' },
            config: {
                time_unit: 'minutes',
                start_time: '08:00',
                end_time: '18:00',
                currency: 'USD',
                locale: 'en-US',
                timezone: 'UTC'
            },
            world: { objects: [] },
            process: { tasks: [] }
        }
    };
}

function hasMetric(problems, metricId) {
    return problems.some((problem) => problem && problem.metric_id === metricId);
}

function getMetric(problems, metricId) {
    return problems.find((problem) => problem && problem.metric_id === metricId) || null;
}

function createFixtureDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'workspec-test-'));
}

function writeJson(filePath, value) {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function runCli(args, options = {}) {
    return spawnSync(process.execPath, [cliPath, ...args], {
        encoding: 'utf8',
        ...options
    });
}

module.exports = {
    baseDoc,
    cliPath,
    createFixtureDir,
    getMetric,
    hasMetric,
    packageRoot,
    repoRoot,
    runCli,
    writeJson
};
