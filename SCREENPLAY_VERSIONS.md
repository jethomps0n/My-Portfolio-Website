# Screenplay Version Tracking Setup

This feature automatically fetches and displays version information for screenplay files hosted on Backblaze B2 Cloud Storage.

## Prerequisites

1. Backblaze B2 account with your screenplay files uploaded
2. B2 Application Key with `listFiles` capability

## Setup Instructions

### 1. Get Backblaze B2 Credentials

1. Log into your Backblaze B2 account
2. Go to "App Keys" in the sidebar
3. Create a new application key with the following settings:
   - **Name**: Portfolio Version Tracker (or any name you prefer)
   - **Capabilities**: Check "listFiles" at minimum
   - **Allow access to**: Your screenplay bucket
   - **File name prefix**: `screenplays/` (if all your screenplays are in a subfolder)

4. Copy the **Application Key ID** and **Application Key** (the key is only shown once!)

### 2. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your credentials:
   ```
   B2_APPLICATION_KEY_ID=your_actual_key_id
   B2_APPLICATION_KEY=your_actual_application_key
   B2_BUCKET_ID=your_bucket_id
   ```

   To find your bucket ID:
   - In Backblaze B2, go to "Buckets"
   - Click on your bucket name
   - The Bucket ID is shown in the bucket details

### 3. Install Dependencies

```bash
npm install
```

### 4. Update Your Data

When you add screenplay URLs to your `data.json`, use the full Backblaze URL format:
```json
{
  "PDFSrc": "https://files.itsjonathanthompson.com/screenplays/your-screenplay.pdf",
  "Screenplay": "Yes"
}
```

### 5. Build Your Site

```bash
npm run build
```

The build process will now:
1. Fetch version information for all screenplay files from Backblaze
2. Add version data to your project data
3. Display version badges only for files with multiple versions

## How It Works

### Version Detection
- The system calls the Backblaze `b2_list_file_versions` API for each screenplay file
- Files with only one version show no version indicator
- Files with multiple versions show "v1", "v2", etc. based on upload timestamp order

### Version Display
- **Version Badge**: Shows in the project title (e.g., "My Screenplay v2")
- **Version History**: Shows in the description section with upload dates
- **Current Version**: Highlighted in the version history

### File Naming Convention
- When you upload a new version, just upload it with the same filename
- Backblaze automatically creates a new version
- The system will detect the new version on the next build

## Troubleshooting

### No Version Information Appearing
1. Check that your `.env` file exists and has correct credentials
2. Verify your application key has `listFiles` capability
3. Check the console output during build for any error messages
4. Ensure your PDFSrc URLs match the pattern `files.itsjonathanthompson.com`

### Build Errors
- If you get authentication errors, double-check your credentials
- If the build hangs, it might be a network issue - try building again
- Check that your bucket ID is correct

### API Rate Limits
- The Backblaze API has rate limits, but for a portfolio site this shouldn't be an issue
- If you have many screenplay files, the build might take a bit longer

## Development

To skip version fetching during development (faster builds):
1. Don't create a `.env` file, or
2. Leave the Backblaze credentials empty in `.env`

The site will build normally but won't show version information.
