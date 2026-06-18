# BigQuery Release Notes Viewer

A lightweight, elegant Flask web application that fetches, parses, and displays the official Google Cloud BigQuery release notes. It processes the Atom XML feed, extracts structured updates, caches data to minimize latency, and renders them in a clean, interactive user interface.

## Project Structure

```
bq_release_notes/
├── app.py                  # Flask application (backend, XML parser, and caching logic)
├── requirements.txt        # Python package dependencies
├── templates/
│   └── index.html          # Main HTML structure for the web interface
└── static/
    ├── css/
    │   └── style.css       # Custom application styling
    └── js/
        └── app.js          # Interactive frontend logic (filtering, search, and dynamic rendering)
```

## Features

- **Live Parser**: Automatically fetches and parses Google's official BigQuery Atom Feed (`https://docs.cloud.google.com/feeds/bigquery-release-notes.xml`).
- **Structured Updates**: Splits feed content into individual updates (Features, Deprecations, Changes, Bug Fixes, etc.) using regex parsing.
- **Smart Caching**: Implements a 5-minute in-memory caching system to reduce network request overhead and prevent rate limits.
- **Graceful Degradation**: Automatically falls back to the last successfully cached version of the release notes if the live feed fails to load.
- **Force Refresh**: Provides a direct way to bypass the cache via a `refresh` query parameter or frontend trigger.
- **Copy to Clipboard**: Quick-copy button on every release note card to instantly copy clean-text descriptions.
- **Export to CSV**: Download the currently displayed release notes (matching active search terms or category filters) in CSV format.

## API Endpoints

### 1. Web Page
- **Route**: `/`
- **Method**: `GET`
- **Description**: Renders the main release notes dashboard interface.

### 2. Release Notes JSON API
- **Route**: `/api/releases`
- **Method**: `GET`
- **Query Parameters**:
  - `refresh=true` (optional): Forces a live feed fetch and updates the cache.
- **Response Format**:
  ```json
  {
    "success": true,
    "data": [
      {
        "date": "June 15, 2026",
        "updated": "2026-06-15T12:00:00Z",
        "link": "https://cloud.google.com/bigquery/docs/release-notes",
        "updates": [
          {
            "id": "June_15_2026_0_feature",
            "type": "Feature",
            "description": "..."
          }
        ]
      }
    ],
    "source": "live",
    "last_updated": "09:30:15 AM"
  }
  ```

## Getting Started

### Prerequisites

- Python 3.8 or higher installed on your machine.

### Installation

1. Clone or download this project repository.
2. Navigate to the project root directory:
   ```bash
   cd bq_release_notes
   ```
3. Create a virtual environment:
   ```bash
   python -m venv venv
   ```
4. Activate the virtual environment:
   - **Windows (Command Prompt)**:
     ```cmd
     venv\Scripts\activate.bat
     ```
   - **Windows (PowerShell)**:
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   - **macOS/Linux**:
     ```bash
     source venv/bin/activate
     ```
5. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### Running the Application

1. Start the Flask server:
   ```bash
   python app.py
   ```
2. Open your web browser and navigate to `http://127.0.0.1:5000`.

## Contributors

- **Yugapriya** ([@duttayugapriya](https://github.com/duttayugapriya))
