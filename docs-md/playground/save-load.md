# Playground Save/Load System Documentation

The Universal Automation Wiki's playground features a comprehensive save/load system, allowing users to save their simulations to a remote server and retrieve them later using unique 16-character save codes. This system is designed to be non-destructive, secure, and scalable.

## System Overview

The save/load system consists of three main components:

1. **Frontend (Static Site)**: JavaScript-based UI running in the user's browser
2. **API Server**: Node.js server running on Oracle Cloud Infrastructure  
3. **Storage Backend**: Private GitHub repository for persistent data storage

### Key Design Principles

- **Non-destructive**: Every save creates a new entry, never overwrites existing data
- **Privacy-focused**: Strong user consent process with clear warnings
- **Lineage tracking**: Maintains history of simulation modifications for future diff features
- **Security through obscurity**: 16-character alphanumeric save codes provide reasonable protection
- **Static-site compatible**: Uses external API to enable smart features on GitHub Pages

## Frontend Implementation

### User Interface Components

The playground includes two primary buttons in the top menu bar:

- **Save Simulation**: Opens save modal with privacy warnings and generates save codes
- **Load Simulation**: Opens load modal for entering existing save codes

### Save Modal Structure

```html
<div id="save-modal" class="dialog-overlay">
    <div class="dialog">
        <h3>Save Simulation</h3>
        
        <!-- Privacy Warning (shown on first use only) -->
        <div class="save-warning">
            <p><strong>⚠️ Privacy Notice</strong></p>
            <p>Your simulation is currently private and locally stored in your browser. 
               By continuing, you agree that your simulation will be stored on a server 
               so it can later be retrieved. Do not store confidential information in 
               simulations, as anyone who guesses your save code will be able to see 
               your simulation in full.</p>
            <label>
                <input type="checkbox" id="privacy-consent-checkbox">
                I understand and agree to the privacy terms above
            </label>
        </div>
        
        <!-- Success State -->
        <div id="save-success" class="save-success">
            <p><strong>✅ Save Successful!</strong></p>
            <p>Your save code is:</p>
            <div class="save-code-display">
                <input type="text" id="save-code-result" readonly>
                <button id="copy-save-code-btn">Copy</button>
            </div>
        </div>
        
        <!-- Loading State -->
        <div id="save-loading" class="save-loading">
            <div class="spinner"></div>
            Saving simulation...
        </div>
        
        <div class="dialog-buttons">
            <button type="button" class="btn-secondary" id="save-cancel-btn">Cancel</button>
            <button type="button" class="btn-primary" id="save-confirm-btn">Save Simulation</button>
        </div>
    </div>
</div>
```

### Load Modal Structure

```html
<div id="load-modal" class="dialog-overlay">
    <div class="dialog">
        <h3>Load Simulation</h3>
        <p>Enter your 16-character save code to load a previously saved simulation:</p>
        
        <div class="load-input-container">
            <input type="text" id="load-code-input" 
                   placeholder="Enter save code..." 
                   maxlength="16">
        </div>
        
        <!-- Error Display -->
        <div id="load-error" class="load-error">
            <p><strong>Error:</strong> <span id="load-error-message"></span></p>
        </div>
        
        <!-- Loading State -->
        <div id="load-loading" class="load-loading">
            <div class="spinner"></div>
            Loading simulation...
        </div>
        
        <div class="dialog-buttons">
            <button type="button" class="btn-secondary" id="load-cancel-btn">Cancel</button>
            <button type="button" class="btn-primary" id="load-confirm-btn">Load Simulation</button>
        </div>
    </div>
</div>
```

### JavaScript State Management

The frontend maintains several key state variables:

```javascript
// Tracks the save code of a loaded simulation (for lineage)
let loadedSaveCode = null;

// Tracks if user has seen disclaimer this session
let hasShownDisclaimer = false;
```

#### LocalStorage Usage

The system uses browser LocalStorage to persist user preferences:

- `uaw_playground_disclaimer_accepted`: Boolean indicating if user has accepted privacy terms
- Persists across browser sessions to avoid repeatedly showing disclaimer

#### Event Listener Setup

Event listeners are attached during the playground initialization phase to ensure DOM elements exist:

```javascript
function setupSaveLoadButtons() {
    console.log("INIT: Setting up save/load buttons.");
    
    const saveBtn = document.getElementById("save-simulation-btn");
    const loadBtn = document.getElementById("load-simulation-btn");
    
    if (saveBtn) {
        saveBtn.addEventListener("click", openSaveDialog);
        console.log("INIT: Save button event listener attached.");
    }
    
    if (loadBtn) {
        loadBtn.addEventListener("click", openLoadDialog);
        console.log("INIT: Load button event listener attached.");
    }
}
```

### Save Flow Logic

1. **User clicks "Save Simulation"**
2. **Privacy check**: System checks if user has previously accepted disclaimer
   - If not accepted: Show privacy warning and require checkbox consent
   - If accepted: Skip directly to save process
3. **JSON validation**: Validate current editor content is valid JSON
4. **API call**: Send simulation data to server with potential lineage information
5. **Success handling**: Display save code and update session state
6. **Error handling**: Show user-friendly error messages for failures

#### Save Function Implementation

```javascript
async function saveSimulation(data, previousSaveCode = null) {
    const API_BASE = 'https://api.universalautomation.wiki';
    
    const payload = {
        action: 'create', // Always create new entries
        data: data,
        previousSaveCode: previousSaveCode || undefined
    };

    const response = await fetch(`${API_BASE}/playground/save`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
    });

    return await response.json();
}
```

### Load Flow Logic

1. **User clicks "Load Simulation"**
2. **Code input**: Modal opens with input field for 16-character save code
3. **Input validation**: Auto-format to uppercase, alphanumeric only, 16 characters max
4. **API call**: Retrieve simulation data from server
5. **Editor update**: Load JSON data into Monaco editor
6. **Lineage tracking**: Store loaded save code for future saves
7. **Success notification**: Brief notification confirming load success

#### Load Function Implementation

```javascript
async function loadSimulation(saveCode) {
    const API_BASE = 'https://api.universalautomation.wiki';
    
    const response = await fetch(`${API_BASE}/playground/load`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ saveCode })
    });

    return await response.json();
}
```

## Backend API Server

### Server Architecture

The API server is built with Node.js and Express, running on Oracle Cloud Infrastructure. It serves as a bridge between the static frontend and the GitHub storage backend.

**Domain**: `api.universalautomation.wiki`  

### Apache Virtual Host Configuration

The server runs behind Apache as a reverse proxy:

```apache
<VirtualHost *:443>
    ServerName api.universalautomation.wiki
    
    # Proxy API requests to Node.js server
    ProxyPreserveHost On
    ProxyRequests Off
    
    # API endpoints
    ProxyPass /playground/ http://localhost:3001/playground/
    ProxyPassReverse /playground/ http://localhost:3001/playground/
    
    # Health check
    ProxyPass /health http://localhost:3001/health
    ProxyPassReverse /health http://localhost:3001/health
    
    # CORS headers
    Header always set Access-Control-Allow-Origin "*"
    Header always set Access-Control-Allow-Methods "GET, POST, OPTIONS"
    Header always set Access-Control-Allow-Headers "Content-Type, Authorization"
    
    # SSL Configuration
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/api.universalautomation.wiki/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/api.universalautomation.wiki/privkey.pem
    Include /etc/letsencrypt/options-ssl-apache.conf
</VirtualHost>
```

### API Endpoints

#### POST /playground/save

Saves a simulation and returns a unique save code.

**Request Body**:
```json
{
    "action": "create",
    "data": "{\"simulation\": {...}}",
    "previousSaveCode": "ABC123DEF456GHI7" // optional, for lineage tracking
}
```

**Response** (Success):
```json
{
    "success": true,
    "saveCode": "XYZ789UVW123STU4",
    "message": "Simulation saved successfully"
}
```

**Response** (Error):
```json
{
    "success": false,
    "error": "Invalid JSON data"
}
```

#### POST /playground/load

Retrieves a simulation by save code.

**Request Body**:
```json
{
    "saveCode": "XYZ789UVW123STU4"
}
```

**Response** (Success):
```json
{
    "success": true,
    "data": "{\"simulation\": {...}}",
    "message": "Simulation loaded successfully"
}
```

**Response** (Error):
```json
{
    "success": false,
    "error": "Save code not found"
}
```

#### GET /health

Health check endpoint for monitoring.

**Response**:
```json
{
    "status": "healthy",
    "timestamp": "2025-08-23T18:30:00.000Z"
}
```

### Save Code Generation

Save codes are 16-character alphanumeric strings using uppercase letters and digits:

```javascript
function generateSaveCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
```

**Characteristics**:
- 36^16 possible combinations (approximately 5 × 10^24)
- Collision detection with retry logic
- URL-safe and easy to communicate
- No ambiguous characters (no lowercase, no special symbols)

### GitHub Integration

The server uses the GitHub REST API to store simulations as JSON files in a private repository.

## Storage Backend (GitHub Repository)

### Repository Structure

```
uaw-playground-saves/                    # Private GitHub repository
├── README.md                           # Repository description
└── playground-saves/                   # Simulation storage directory
    ├── README.md                       # Directory documentation
    ├── ABC123DEF456GHI78.json         # Simulation file
    ├── XYZ789UVW123STU456.json        # Simulation file
    └── ... (more simulation files)
```

### File Format and Metadata

Each saved simulation is stored as a JSON file with comprehensive metadata:

```json
{
    "saveCode": "ABC123DEF456GHI78",
    "previousSaveCode": "XYZ789UVW123STU456",
    "savedAt": "2025-08-23T18:30:00.000Z",
    "data": {
        "simulation": {
            "meta": {
                "id": "sim_breadmaking_v3_full",
                "article_title": "Artisan Bread Making Process",
                "domain": "Bakery Operations"
            },
            "config": {
                "time_unit": "minute",
                "start_time": "06:00",
                "end_time": "18:00"
            },
            "layout": {
                "meta": {
                    "units": "meters"
                },
                "locations": [...]
            },
            "timeline": {
                "actors": [...],
                "tasks": [...],
                "resources": [...]
            }
        }
    }
}
```

#### Metadata Fields

- **saveCode**: The unique 16-character identifier for this simulation
- **previousSaveCode**: The save code of the parent simulation (null for new simulations)
- **savedAt**: ISO 8601 timestamp of when the simulation was saved
- **data**: The actual simulation JSON object as created by the user

### Commit Messages

The system generates descriptive commit messages that indicate lineage:

- **New simulation**: `Save simulation ABC123DEF456GHI78 (new)`
- **Derived simulation**: `Save simulation XYZ789UVW123STU456 (derived from ABC123DEF456GHI78)`

### Lineage Tracking for Future Features

The `previousSaveCode` field enables powerful future features:

1. **Diff Visualization**: Compare current simulation with its parent
2. **Version History**: Show the complete evolution of a simulation
3. **Branching Analysis**: Identify popular starting points for new simulations
4. **Collaboration Features**: Multiple users building on the same base simulation

## Security Considerations

- **Clear Warnings**: Prominent privacy notice explains data storage implications
- **User Consent**: Explicit checkbox consent required before first save
- **No Personal Data**: System only stores simulation JSON, no user identification
- **Private Repository**: All simulations stored in private GitHub repository

## Non-Destructive Architecture Benefits

### Why Non-Destructive?

The original plan included "update" functionality that would overwrite existing simulations. This was changed to a non-destructive approach for several critical reasons:

1. **Security**: Prevents malicious users from guessing save codes and destroying others' work
2. **Data Integrity**: Ensures no simulation data is ever lost
3. **Audit Trail**: Maintains complete history for debugging and analysis
4. **Future Features**: Enables diff, merge, and collaboration features

### Implementation Details

- **Always Generate New Codes**: Every save operation creates a unique save code
- **Preserve Lineage**: Track parent-child relationships through `previousSaveCode`
- **Immutable Storage**: Once saved, simulation files are never modified
- **Version Trees**: Multiple users can branch from the same parent simulation

## User Experience Flow

### First-Time Save Experience

1. User creates or modifies a simulation in the playground
2. User clicks "Save Simulation" button
3. Privacy warning modal appears with detailed explanation
4. User must check consent checkbox to enable save button
5. System validates JSON and sends to server
6. Server generates unique save code and stores simulation with metadata
7. Success modal displays save code with copy-to-clipboard functionality
8. User's consent choice persists for future saves in this browser

### Subsequent Save Experience

1. User clicks "Save Simulation" button
2. Privacy warning is skipped (already consented)
3. Save process proceeds immediately
4. New save code generated (even if loaded from existing simulation)
5. Lineage preserved through `previousSaveCode` field

### Load Experience

1. User clicks "Load Simulation" button
2. Modal opens with formatted input field (auto-uppercase, 16-char limit)
3. User enters or pastes save code
4. System validates format and sends request to server
5. Server retrieves simulation from GitHub repository
6. JSON data loaded into Monaco editor
7. Simulation automatically renders in the visualization panel
8. Success notification appears briefly

## Error Handling

### Frontend Error Scenarios

- **Invalid JSON**: User attempts to save malformed JSON
- **Network Failure**: API server unreachable or slow
- **Invalid Save Code**: User enters non-existent or malformed save code
- **Server Errors**: API returns error response

### Backend Error Scenarios

- **GitHub API Failures**: Rate limiting, authentication issues, repository problems
- **Save Code Collisions**: Extremely rare but handled with retry logic
- **Invalid Payloads**: Malformed requests from frontend
- **Storage Failures**: Disk space, permission issues

### Error Messages

All error messages are user-friendly and actionable:

- **Save Errors**: "Save failed: Please check your internet connection and try again"
- **Load Errors**: "Save code not found: Please verify the code and try again"
- **Validation Errors**: "Please fix JSON errors before saving"

## Future Enhancement Possibilities

### Planned Features

1. **Diff Visualization**: Show changes between parent and child simulations
2. **Version History Browser**: Navigate through simulation evolution
3. **Popular Simulations**: Identify most-used base simulations
4. **Collaboration Tools**: Share and iterate on simulations

## Conclusion

The Universal Automation Wiki playground save/load system provides a robust, secure, and user-friendly way for users to persist and share their simulations. The non-destructive architecture ensures data integrity while enabling powerful future features. The system successfully bridges the gap between static site limitations and modern web application functionality.

The implementation demonstrates several key architectural patterns:

- **Progressive Enhancement**: Static site enhanced with dynamic features
- **Service-Oriented Architecture**: Clean separation between frontend, API, and storage
- **Security by Design**: Privacy warnings and consent management
- **Future-Proof Design**: Metadata structure supports planned enhancements

This system serves as a foundation for more advanced collaboration and analysis features while maintaining the simplicity and reliability that users expect from the Universal Automation Wiki platform.