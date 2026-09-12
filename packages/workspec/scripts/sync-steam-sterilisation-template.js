#!/usr/bin/env node
'use strict';

// Derive the Studio "steam_sterilisation" template from the canonical
// steam-sterilisation dogfood project. The dogfood folder stays the single
// source of truth; the template is a derived copy with a Studio-template
// shape: no simulation.config block (templates run on resolved task times)
// and Changes / Generator / Constraints carried as authored source strings.

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const projectDir = path.join(repoRoot, 'packages', 'workspec', 'dogfood', 'steam-sterilisation');
const libraryPath = path.join(repoRoot, 'web', 'assets', 'static', 'simulation-library.json');

const read = (name) => fs.readFileSync(path.join(projectDir, name), 'utf8');

const start = JSON.parse(read('start.workspec.json'));
delete start.simulation.config;

const template = {
    id: 'steam_sterilisation',
    name: 'Implant Tray Steam Sterilisation',
    description: 'A hospital sterile-processing department reprocesses two returned implant trays: cleaning, inspection, packaging, a pre-vacuum steam cycle with generated chamber behaviour, indicator review, quarantine, and authorised release.',
    complexity: 'Expert',
    domain: 'Healthcare',
    simulation: start.simulation,
    changes: read('changes.workspec.js'),
    generator: read('generator.workspec.js'),
    constraints: read('constraints.workspec.js')
};

const library = JSON.parse(fs.readFileSync(libraryPath, 'utf8'));
const index = library.simulations.findIndex((entry) => entry.id === template.id);
if (index === -1) library.simulations.push(template);
else library.simulations[index] = template;

fs.writeFileSync(libraryPath, `${JSON.stringify(library, null, 2)}\n`);
process.stdout.write(`✓ steam_sterilisation template derived (${library.simulations.length} templates)\n`);
