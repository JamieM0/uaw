#!/usr/bin/env node
'use strict';

const { runCustomValidationInProcess } = require('./custom-validation-runner.js');

const MAX_INPUT_BYTES = 1024 * 1024;

function readStdin() {
    return new Promise((resolve, reject) => {
        let totalBytes = 0;
        let data = '';

        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (chunk) => {
            totalBytes += chunk.length;
            if (totalBytes > MAX_INPUT_BYTES) {
                reject(new Error('Custom validation payload exceeded the allowed size.'));
                return;
            }
            data += chunk;
        });

        process.stdin.on('end', () => resolve(data));
        process.stdin.on('error', reject);
    });
}

async function main() {
    try {
        const raw = await readStdin();
        const payload = JSON.parse(raw || '{}');

        const documentValue = payload?.documentValue;
        const options = payload?.options || {};

        const problems = await runCustomValidationInProcess(documentValue, options);
        process.stdout.write(JSON.stringify({ ok: true, problems }));
        process.exitCode = 0;
    } catch (error) {
        process.stdout.write(JSON.stringify({
            ok: false,
            error: (error && error.message) ? error.message : 'Unknown custom validation worker error.'
        }));
        process.exitCode = 1;
    }
}

main();
