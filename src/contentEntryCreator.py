import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import json
import os
import re
import subprocess
import tempfile
from datetime import datetime
from urllib.parse import urlparse, parse_qs
import requests
import shutil
import threading
import time

try:
    from yt_dlp import YoutubeDL
except ImportError:
    YoutubeDL = None
try:
    import PyPDF2
except ImportError:
    PyPDF2 = None

DATA_JSON_PATH = "resources/json/data.json"
PREVIEW_DIR = "resources/videos/previews"
PREVIEW_EXTENSION = ".webm"
PDF_THUMBNAIL_PATH = "/resources/images/thumbnails/screenplay-thumbnail.webp"
PDF_AUTOFILL_PREFIX = "https://files.itsjonathanthompson.com/screenplays/"
VIDEO_THUMBNAIL_TEMPLATE = "/resources/images/thumbnails/[file-name.webp]"

# ===== WINDOW SIZE VARIABLE =====
DEFAULT_WINDOW_WIDTH = 1200
DEFAULT_WINDOW_HEIGHT = 900

# ===== PREVIEW GENERATION SETTINGS =====
PREVIEW_START_SECONDS = 30
PREVIEW_END_SECONDS = "third"
PREVIEW_NUM_MINI_CLIPS = 5
PREVIEW_MINI_CLIP_LENGTH = 2
PREVIEW_CRF = 30
PREVIEW_BITRATE = "5M"
PREVIEW_PRESET = "fast"
PREVIEW_INCLUDE_AUDIO = False
PREVIEW_RESOLUTION = None

ENTRY_TYPES = [
    "Short Film", "Rescore", "Advertisement", "Documentary",
    "Video Essay", "Feature Film", "Audio Mix", "Show"
]
ENTRY_ROLES = [
    "Writer", "Editor", "Director", "Producer", "DP",
    "Camera Operator", "Production Assistant", "Sound Recordist", "Actor"
]

os.makedirs(PREVIEW_DIR, exist_ok=True)

# Global variable to track generation status
generation_status = {
    'in_progress': False,
    'completed': False,
    'result_path': None,
    'error': None
}

# Global flag to track if this is the first debug log call
_first_debug_log = True

def debug_log(message):
    """Log debug messages to a file for Automator troubleshooting"""
    global _first_debug_log
    try:
        # Use write mode for first call to overwrite, then append mode
        mode = "w" if _first_debug_log else "a"
        with open("debug.log", mode) as f:
            if _first_debug_log:
                f.write(f"=== NEW SESSION STARTED: {datetime.now()} ===\n")
                _first_debug_log = False
            f.write(f"{datetime.now()}: {message}\n")
        print(f"DEBUG: {message}")
    except:
        print(f"DEBUG: {message}")

def find_executable(name):
    """Find executable in common paths, especially for macOS installations"""
    debug_log(f"Looking for {name}")
    
    # Common paths where tools might be installed
    common_paths = [
        '/opt/homebrew/bin',  # Apple Silicon Homebrew
        '/usr/local/bin',     # Intel Homebrew
        '/opt/local/bin',     # MacPorts
        '/usr/bin',           # System
        '/bin',               # System
    ]
    
    # First try the system PATH
    try:
        debug_log(f"Trying 'which {name}'")
        result = subprocess.run(['which', name], capture_output=True, text=True, timeout=5)
        if result.returncode == 0 and result.stdout.strip():
            path = result.stdout.strip()
            debug_log(f"Found {name} via 'which': {path}")
            return path
        else:
            debug_log(f"'which {name}' failed: returncode={result.returncode}, stderr={result.stderr}")
    except Exception as e:
        debug_log(f"'which {name}' exception: {e}")
    
    # Then try common paths
    for path in common_paths:
        full_path = os.path.join(path, name)
        debug_log(f"Checking {full_path}")
        if os.path.isfile(full_path) and os.access(full_path, os.X_OK):
            debug_log(f"Found {name} at: {full_path}")
            return full_path
        else:
            debug_log(f"Not found or not executable: {full_path}")
    
    debug_log(f"Could not find {name} anywhere")
    return None

def get_ffmpeg_tools():
    """Get paths to ffmpeg and ffprobe, with fallback to system PATH"""
    debug_log("Getting ffmpeg tools")
    
    ffmpeg_path = find_executable('ffmpeg')
    ffprobe_path = find_executable('ffprobe')
    
    if not ffmpeg_path:
        debug_log("ffmpeg not found, using fallback")
        ffmpeg_path = 'ffmpeg'  # Fallback to PATH
    if not ffprobe_path:
        debug_log("ffprobe not found, using fallback")
        ffprobe_path = 'ffprobe'  # Fallback to PATH
        
    debug_log(f"Final paths - ffmpeg: {ffmpeg_path}, ffprobe: {ffprobe_path}")
    return ffmpeg_path, ffprobe_path

def test_tool(tool_path, tool_name):
    """Test if a tool is working"""
    debug_log(f"Testing {tool_name} at {tool_path}")
    try:
        result = subprocess.run([tool_path, '-version'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            debug_log(f"{tool_name} test successful")
            debug_log(f"{tool_name} version output: {result.stdout[:100]}...")
            return True
        else:
            debug_log(f"{tool_name} test failed: returncode={result.returncode}")
            debug_log(f"{tool_name} stderr: {result.stderr}")
            return False
    except subprocess.TimeoutExpired:
        debug_log(f"{tool_name} test timed out")
        return False
    except FileNotFoundError:
        debug_log(f"{tool_name} not found at {tool_path}")
        return False
    except Exception as e:
        debug_log(f"{tool_name} test exception: {e}")
        return False

def slugify(value):
    value = re.sub(r'[^\w\s-]', '', value).strip().lower()
    return re.sub(r'[\s]+', '-', value)

def youtube_embed(url):
    query = urlparse(url)
    if 'youtube' in query.netloc or 'youtu.be' in query.netloc:
        if 'youtu.be' in query.netloc:
            video_id = query.path.lstrip('/')
        else:
            qs = parse_qs(query.query)
            video_id = qs.get('v', [None])[0]
        if video_id:
            return f"https://www.youtube.com/embed/{video_id}"
    return url

def vimeo_embed(url):
    match = re.match(r'https?://vimeo\.com/(\d+)', url)
    if match:
        return f"https://player.vimeo.com/video/{match.group(1)}"
    return url

def gdrive_embed(url):
    match = re.search(r'/d/([^/]+)', url)
    if match:
        return f"https://drive.google.com/file/d/{match.group(1)}/preview"
    match = re.search(r'id=([^&]+)', url)
    if match:
        return f"https://drive.google.com/file/d/{match.group(1)}/preview"
    return url

def detect_and_embed_video(url):
    if 'youtube' in url or 'youtu.be' in url:
        return youtube_embed(url)
    if 'vimeo.com' in url:
        return vimeo_embed(url)
    if 'drive.google.com' in url:
        return gdrive_embed(url)
    return url

def is_pure_playlist_url(url):
    """Detect if URL is a PURE playlist (not an individual video)"""
    if not url:
        return False
    
    debug_log(f"Checking if pure playlist: {url}")
    
    # YouTube playlist patterns - ONLY pure playlists, not videos in playlists
    if 'youtube.com' in url and ('list=' in url):
        parsed = parse_qs(urlparse(url).query)
        # It's a playlist ONLY if it has 'list' but NO 'v' parameter
        is_pure = 'list' in parsed and 'v' not in parsed
        debug_log(f"YouTube playlist check: list={('list' in parsed)}, v={('v' in parsed)}, pure={is_pure}")
        return is_pure
    
    # Vimeo playlist/showcase patterns
    if 'vimeo.com' in url and ('/showcase/' in url or '/channels/' in url or '/groups/' in url):
        # Make sure it's not an individual video within a showcase
        is_pure = not re.match(r'https?://vimeo\.com/\d+', url)
        debug_log(f"Vimeo playlist check: pure={is_pure}")
        return is_pure
    
    debug_log("Not a pure playlist")
    return False

def get_playlist_info(url):
    """Get playlist information using yt-dlp"""
    if YoutubeDL is None:
        debug_log("YoutubeDL not available")
        return None
    
    debug_log(f"Getting playlist info for: {url}")
    ffmpeg_path, _ = get_ffmpeg_tools()
    
    ydl_opts = {
        'quiet': True,
        'extract_flat': True,  # Don't extract individual video info, just playlist structure
        'force_generic_extractor': False,
    }
    
    if ffmpeg_path != 'ffmpeg':
        ydl_opts['ffmpeg_location'] = os.path.dirname(ffmpeg_path)
    
    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if info and info.get('_type') == 'playlist':
                entries = info.get('entries', [])
                playlist_info = {
                    'title': info.get('title', 'Unknown Playlist'),
                    'count': len(entries),
                    'entries': entries,
                    'description': info.get('description', ''),
                    'uploader': info.get('uploader', ''),
                }
                debug_log(f"Playlist info extracted: {playlist_info['title']} with {playlist_info['count']} videos")
                return playlist_info
    except Exception as e:
        debug_log(f"Failed to extract playlist info: {e}")
        return None
    
    debug_log("No playlist info found")
    return None

def get_video_info(url):
    if YoutubeDL is None:
        return {}
    
    debug_log(f"Getting video info for: {url}")
    
    # Get ffmpeg path for yt-dlp
    ffmpeg_path, _ = get_ffmpeg_tools()
    
    ydl_opts = {
        'quiet': True,
        'skip_download': True,
        'force_generic_extractor': False,
        'extract_flat': False
    }
    
    # Add ffmpeg location if we found it
    if ffmpeg_path != 'ffmpeg':  # If we found an absolute path
        ydl_opts['ffmpeg_location'] = os.path.dirname(ffmpeg_path)
    
    with YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
            video_info = {
                'title': info.get('title', ''),
                'date': info.get('upload_date', ''),
                'description': info.get('description', ''),
                'thumbnail': info.get('thumbnail', ''),
                'url': info.get('webpage_url', url),
                # Get additional date fields for debugging
                'timestamp': info.get('timestamp', ''),
                'release_timestamp': info.get('release_timestamp', ''),
                'modified_timestamp': info.get('modified_timestamp', ''),
                'release_date': info.get('release_date', ''),
                'modified_date': info.get('modified_date', '')
            }
            debug_log(f"Video info extracted: {video_info['title']}")
            return video_info
        except Exception as e:
            debug_log(f"Failed to fetch video info: {e}")
            return {}

def parse_video_date(date_str, video_title="", url=""):
    """Robust date parsing for YouTube videos"""
    if not date_str:
        return ""
    
    # Convert to string in case it's not already
    date_str = str(date_str).strip()
    
    # Check for YYYYMMDD format (most common from yt-dlp)
    if re.match(r'^\d{8}$', date_str):
        try:
            date_obj = datetime.strptime(date_str, '%Y%m%d')
            return date_obj.strftime('%B %d, %Y')
        except ValueError:
            pass
    
    # Check for other common formats
    elif re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
        try:
            date_obj = datetime.strptime(date_str, '%Y-%m-%d')
            return date_obj.strftime('%B %d, %Y')
        except ValueError:
            pass
    
    return date_str

def calculate_trim_seconds(keyword, total_duration):
    """Calculate actual seconds from keywords like 'half', 'third', etc."""
    if isinstance(keyword, (int, float)):
        return int(keyword)
    
    keyword = str(keyword).lower()
    if keyword == "half":
        return total_duration // 2
    elif keyword == "third":
        return total_duration // 3
    elif keyword == "fourth":
        return total_duration // 4
    elif keyword == "fifth":
        return total_duration // 5
    elif keyword == "sixth":
        return total_duration // 6
    else:
        # Try to convert to number
        try:
            return int(float(keyword))
        except (ValueError, TypeError):
            return 0

def parse_credits_text(credits_text):
    """Enhanced smart parse credits text into role: [names] dictionary"""
    credits = {}
    current_role = None
    lines = credits_text.strip().split('\n')
    
    # Clean and normalize the text first
    normalized_lines = []
    for line in lines:
        line = line.strip()
        if line:
            normalized_lines.append(line)
    
    for line in normalized_lines:
        # Skip empty lines
        if not line:
            continue
        
        # Check for various role header patterns
        role_header_found = False
        
        # Pattern 1: "Role:" format (most common)
        if ':' in line:
            parts = line.split(':', 1)
            if len(parts) == 2:
                potential_role = parts[0].strip()
                remaining_text = parts[1].strip()
                
                # Check if this looks like a role
                role_indicators = [
                    'producer', 'director', 'writer', 'editor', 'dp', 'cinematographer',
                    'gaffer', 'sound', 'boom', 'art', 'composer', 'music', 'actor',
                    'starring', 'cast', 'assistant', 'associate', 'executive', 'camera',
                    'operator', 'recordist', 'engineer', 'lead', 'department', 'graphic',
                    'design', 'vfx', 'effects', 'researcher', 'band', 'production'
                ]
                
                # Check if the potential role contains any role indicators
                potential_role_lower = potential_role.lower()
                is_likely_role = any(indicator in potential_role_lower for indicator in role_indicators)
                
                # Also check if it's a short phrase (roles are usually 1-4 words)
                word_count = len(potential_role.split())
                is_reasonable_length = 1 <= word_count <= 6
                
                # Check if remaining text looks like names
                has_names_after = bool(remaining_text and not remaining_text.lower().startswith('http'))
                
                if is_likely_role and is_reasonable_length:
                    current_role = potential_role
                    role_header_found = True
                    
                    if current_role not in credits:
                        credits[current_role] = []
                    
                    # Process names that come after the colon on the same line
                    if has_names_after:
                        names = parse_names_from_text(remaining_text)
                        credits[current_role].extend(names)
        
        # Pattern 2: Lines that end with "by:" or "by"
        if not role_header_found:
            by_patterns = [
                r'^(.+?)\s+by:?\s*$',  # "Written and Directed by:" or "Written and Directed by"
                r'^(.+?):\s*$',        # Just ending with colon
            ]
            
            for pattern in by_patterns:
                match = re.match(pattern, line, re.IGNORECASE)
                if match:
                    current_role = match.group(1).strip()
                    role_header_found = True
                    
                    if current_role not in credits:
                        credits[current_role] = []
                    break
        
        # If this line is not a role header, treat it as names for the current role
        if not role_header_found and current_role:
            names = parse_names_from_text(line)
            if names:
                credits[current_role].extend(names)
        
        # Handle case where there's no current role but line looks like names
        elif not role_header_found and not current_role and line:
            # This might be names without a clear role - add to a generic "Credits" role
            if ':' not in line:  # Make sure it's not a malformed role line
                if "Credits" not in credits:
                    credits["Credits"] = []
                names = parse_names_from_text(line)
                if names:
                    credits["Credits"].extend(names)
    
    # Clean up credits - remove duplicates and empty roles
    final_credits = {}
    for role, names in credits.items():
        if names:  # Only keep roles that have names
            # Remove duplicates while preserving order
            unique_names = []
            seen = set()
            for name in names:
                if name and name not in seen:
                    unique_names.append(name)
                    seen.add(name)
            if unique_names:
                final_credits[role] = unique_names
    
    return final_credits

def parse_names_from_text(text):
    """Extract and clean names from a text string"""
    if not text:
        return []
    
    names = []
    
    # Handle different separators
    # Replace " and " with "," for consistent splitting
    text = re.sub(r'\s+and\s+', ', ', text, flags=re.IGNORECASE)
    
    # Split by commas
    parts = [part.strip() for part in text.split(',')]
    
    for part in parts:
        if not part:
            continue
            
        # Handle "Name as Character" format
        if ' as ' in part.lower():
            name_parts = part.split(' as ', 1)
            name = name_parts[0].strip()
        else:
            name = part.strip()
        
        # Clean up the name
        name = clean_name(name)
        
        if name and len(name) > 1:  # Make sure it's a reasonable name
            names.append(name)
    
    return names

def clean_name(name):
    """Clean and normalize a person's name"""
    if not name:
        return ""
    
    # Remove social media handles and extra info
    name = re.sub(r'\s*[@#]\w+.*$', '', name)  # Remove @handles
    name = re.sub(r'\s*\([^)]*\).*$', '', name)  # Remove (parentheses)
    name = re.sub(r'\s*‪.*$', '', name)  # Remove special characters
    name = re.sub(r'\s*-\s*@.*$', '', name)  # Remove "- @handle" format
    name = re.sub(r'\s*https?://.*$', '', name)  # Remove URLs
    
    # Remove extra whitespace
    name = re.sub(r'\s+', ' ', name).strip()
    
    # Remove common prefixes that aren't part of names
    prefixes_to_remove = ['and', 'with', 'featuring', 'ft.', 'feat.']
    name_lower = name.lower()
    for prefix in prefixes_to_remove:
        if name_lower.startswith(prefix + ' '):
            name = name[len(prefix):].strip()
            break
    
    # Make sure it looks like a name (contains letters, reasonable length)
    if re.search(r'[a-zA-Z]', name) and 2 <= len(name) <= 50:
        return name
    
    return ""

class UniversalScrollMixin:
    """Mixin to add universal scroll wheel support to any tkinter window"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.scrollable_widgets = []
        
    def register_scrollable(self, canvas):
        """Register a canvas as scrollable"""
        self.scrollable_widgets.append(canvas)
        
    def setup_universal_scroll(self):
        """Set up universal scrolling for the entire window"""
        def on_mousewheel(event):
            # Find the canvas that should be scrolled based on focus or mouse position
            if self.scrollable_widgets:
                # Use the first (main) scrollable widget
                canvas = self.scrollable_widgets[0]
                
                # Calculate scroll amount
                if hasattr(event, 'delta') and event.delta:
                    delta = -1 * (event.delta / 120)
                else:
                    delta = -1 if event.num == 4 else 1
                
                # Scroll the canvas
                try:
                    canvas.yview_scroll(int(delta), "units")
                except:
                    pass
        
        # Bind to the entire window
        self.bind_all("<MouseWheel>", on_mousewheel)
        self.bind_all("<Button-4>", on_mousewheel)
        self.bind_all("<Button-5>", on_mousewheel)

def setup_responsive_scrollable_frame(parent):
    """
    Create a responsive scrollable frame with ACTUALLY WORKING universal scroll wheel support
    """
    # Main container
    container = ttk.Frame(parent)
    container.pack(fill='both', expand=True)
    
    # Create canvas for scrolling
    canvas = tk.Canvas(container, highlightthickness=0, bg='#f8f8f8')
    scrollbar = ttk.Scrollbar(container, orient="vertical", command=canvas.yview)
    scrollable_frame = ttk.Frame(canvas)
    
    # Configure canvas scrolling
    canvas.configure(yscrollcommand=scrollbar.set)
    
    # Create window in canvas
    canvas_window = canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
    
    # Responsive width handling
    def configure_canvas_width(event=None):
        canvas_width = canvas.winfo_width()
        if canvas_width > 1:
            canvas.itemconfig(canvas_window, width=canvas_width)
    
    def configure_scroll_region(event=None):
        canvas.configure(scrollregion=canvas.bbox("all"))
    
    canvas.bind('<Configure>', configure_canvas_width)
    scrollable_frame.bind('<Configure>', configure_scroll_region)
    
    # WORKING UNIVERSAL SCROLL - Based on proven tkinter solutions
    def on_mousewheel(event):
        # Calculate scroll amount
        if event.delta:
            delta = -1 * (event.delta / 120)
        else:
            delta = -1 if event.num == 4 else 1
        
        # Scroll the canvas
        canvas.yview_scroll(int(delta), "units")
    
    def bind_to_mousewheel(event):
        canvas.bind_all("<MouseWheel>", on_mousewheel)
        canvas.bind_all("<Button-4>", on_mousewheel)
        canvas.bind_all("<Button-5>", on_mousewheel)
    
    def unbind_from_mousewheel(event):
        canvas.unbind_all("<MouseWheel>")
        canvas.unbind_all("<Button-4>")
        canvas.unbind_all("<Button-5>")
    
    # Bind when mouse enters the container area
    container.bind('<Enter>', bind_to_mousewheel)
    container.bind('<Leave>', unbind_from_mousewheel)
    
    # Also bind when the canvas gets focus
    canvas.bind('<Enter>', bind_to_mousewheel)
    canvas.bind('<Leave>', unbind_from_mousewheel)
    
    # Pack components
    canvas.pack(side="left", fill="both", expand=True)
    scrollbar.pack(side="right", fill="y")
    
    return container, scrollable_frame

def fetch_pdf_and_get_local_path(pdf_url):
    try:
        response = requests.get(pdf_url, timeout=10)
        if response.status_code == 200:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                tmp.write(response.content)
                tmp.flush()
                return tmp.name
    except Exception as e:
        print(f"Failed to fetch PDF from url: {e}")
    return None

def get_pdf_title(pdf_path):
    local_path = pdf_path
    cleanup = False
    if str(pdf_path).startswith("http://") or str(pdf_path).startswith("https://"):
        local_path = fetch_pdf_and_get_local_path(pdf_path)
        cleanup = True
    title = None
    try:
        if PyPDF2 is not None and local_path and os.path.exists(local_path):
            with open(local_path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                if reader.metadata and getattr(reader.metadata, "title", None):
                    title = reader.metadata.title
                if not title and reader.pages:
                    first_page = reader.pages[0]
                    text = first_page.extract_text() or ""
                    for line in text.split('\n'):
                        line = line.strip()
                        if line:
                            possible_title = line.split(" by ")[0].strip()
                            if len(possible_title) > 1:
                                title = possible_title
                                break
            if not title and local_path:
                title = os.path.splitext(os.path.basename(local_path))[0]
    except Exception as e:
        print(f"Failed to read PDF: {e}")
        title = os.path.splitext(os.path.basename(pdf_path))[0]
    if cleanup and local_path and os.path.exists(local_path):
        try:
            os.remove(local_path)
        except Exception:
            pass
    return title or os.path.splitext(os.path.basename(pdf_path))[0]

def get_pdf_first_page_text(pdf_path):
    local_path = pdf_path
    cleanup = False
    if str(pdf_path).startswith("http://") or str(pdf_path).startswith("https://"):
        local_path = fetch_pdf_and_get_local_path(pdf_path)
        cleanup = True
    text = ""
    try:
        if PyPDF2 is not None and local_path and os.path.exists(local_path):
            with open(local_path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                if reader.pages:
                    first_page = reader.pages[0]
                    text = first_page.extract_text() or ""
    except Exception as e:
        print(f"Failed to extract PDF text: {e}")
    if cleanup and local_path and os.path.exists(local_path):
        try:
            os.remove(local_path)
        except Exception:
            pass
    return text

def load_data():
    if os.path.exists(DATA_JSON_PATH):
        with open(DATA_JSON_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def save_data(data):
    with open(DATA_JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def fetch_thumbnail_oembed(url):
    if "youtube" in url or "youtu.be" in url:
        oembed_url = f"https://www.youtube.com/oembed?url={url}&format=json"
    elif "vimeo.com" in url:
        oembed_url = f"https://vimeo.com/api/oembed.json?url={url}"
    else:
        return ""
    try:
        resp = requests.get(oembed_url, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            return data.get("thumbnail_url", "")
    except Exception as e:
        print(f"Failed to fetch oEmbed thumbnail: {e}")
    return ""

def generate_preview_background(input_path_or_url, slug="preview", output_dir=PREVIEW_DIR):
    """Generate preview in background and update global status"""
    global generation_status
    
    generation_status['in_progress'] = True
    generation_status['completed'] = False
    generation_status['result_path'] = None
    generation_status['error'] = None
    
    debug_log("=== STARTING PREVIEW GENERATION ===")
    debug_log(f"Input: {input_path_or_url}")
    debug_log(f"Slug: {slug}")
    debug_log(f"Output dir: {output_dir}")
    debug_log(f"Current working directory: {os.getcwd()}")
    debug_log(f"Environment PATH: {os.environ.get('PATH', 'NOT SET')}")
    
    try:
        # Get the tools with proper path resolution
        ffmpeg_path, ffprobe_path = get_ffmpeg_tools()
        debug_log(f"Tool paths - ffmpeg: {ffmpeg_path}, ffprobe: {ffprobe_path}")
        
        # Test if tools are available
        if not test_tool(ffprobe_path, "ffprobe"):
            error_msg = (f"ffprobe not working at {ffprobe_path}. "
                        f"Please install ffmpeg via Homebrew:\nbrew install ffmpeg\n\n"
                        f"Check debug.log for more details.")
            debug_log(f"ERROR: {error_msg}")
            generation_status['error'] = error_msg
            generation_status['in_progress'] = False
            generation_status['completed'] = True
            return
        
        if not test_tool(ffmpeg_path, "ffmpeg"):
            error_msg = (f"ffmpeg not working at {ffmpeg_path}. "
                        f"Please install ffmpeg via Homebrew:\nbrew install ffmpeg\n\n"
                        f"Check debug.log for more details.")
            debug_log(f"ERROR: {error_msg}")
            generation_status['error'] = error_msg
            generation_status['in_progress'] = False
            generation_status['completed'] = True
            return

        debug_log("Both tools tested successfully")

        os.makedirs(output_dir, exist_ok=True)
        ext = PREVIEW_EXTENSION
        output_name = f"{slug}-preview{ext}"
        output_path = os.path.join(output_dir, output_name)
        debug_log(f"Output path: {output_path}")

        # Use the configurable settings
        numminiclips = PREVIEW_NUM_MINI_CLIPS
        minicliplength = PREVIEW_MINI_CLIP_LENGTH
        crf = PREVIEW_CRF
        bitrate = PREVIEW_BITRATE
        preset = PREVIEW_PRESET
        audiotoggle = PREVIEW_INCLUDE_AUDIO
        resolution = PREVIEW_RESOLUTION

        is_url = re.match(r'^https?://', input_path_or_url)
        debug_log(f"Is URL: {is_url is not None}")
        temp_file = None
        input_file = input_path_or_url
        
        if is_url:
            debug_log("Processing URL input")
            
            if not YoutubeDL:
                raise Exception("yt-dlp not installed, cannot download video URLs")
            with tempfile.TemporaryDirectory() as dl_temp_dir:
                temp_file = os.path.join(dl_temp_dir, "downloaded_video.mp4")
                debug_log(f"Downloading to: {temp_file}")
                
                # Updated yt-dlp options for no audio and max 1080p
                ydl_opts = {
                    'quiet': True,
                    'outtmpl': temp_file,
                    'format': 'bestvideo[height<=1080][ext=mp4]/bestvideo[height<=1080]/best[height<=1080]',
                    'noplaylist': True,
                }
                
                # Add ffmpeg location for yt-dlp
                if ffmpeg_path != 'ffmpeg':  # If we found an absolute path
                    ydl_opts['ffmpeg_location'] = os.path.dirname(ffmpeg_path)
                    debug_log(f"Setting yt-dlp ffmpeg_location to: {os.path.dirname(ffmpeg_path)}")
                
                debug_log(f"yt-dlp options: {ydl_opts}")
                
                with YoutubeDL(ydl_opts) as ydl:
                    ydl.download([input_path_or_url])
                    
                if not os.path.exists(temp_file) or os.path.getsize(temp_file) < 1000:
                    candidates = [f for f in os.listdir(dl_temp_dir) if f.endswith(('.mp4', '.webm', '.mkv'))]
                    debug_log(f"Downloaded file not found, candidates: {candidates}")
                    if candidates:
                        temp_file = os.path.join(dl_temp_dir, candidates[0])
                        debug_log(f"Using candidate file: {temp_file}")
                        
                if not os.path.exists(temp_file) or os.path.getsize(temp_file) < 1000:
                    debug_log("yt-dlp did not download the video correctly.")
                    generation_status['error'] = "Failed to download video"
                    generation_status['in_progress'] = False
                    generation_status['completed'] = True
                    return
                    
                with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
                    shutil.copyfile(temp_file, tmp.name)
                    temp_file = tmp.name
                input_file = temp_file
                debug_log(f"Downloaded file: {input_file}, size: {os.path.getsize(input_file)} bytes")

        debug_log(f"Processing input file: {input_file}")
        if not os.path.exists(input_file) or os.path.getsize(input_file) < 1000:
            debug_log("Input file not found or too small.")
            generation_status['error'] = "Input file not found or too small"
            generation_status['in_progress'] = False
            generation_status['completed'] = True
            return

        debug_log("Getting video duration...")
        try:
            duration_cmd = [ffprobe_path, "-v", "error", "-show_entries", "format=duration", "-of",
                           "default=noprint_wrappers=1:nokey=1", input_file]
            debug_log(f"Duration command: {' '.join(duration_cmd)}")
            result = subprocess.run(duration_cmd, capture_output=True, text=True, timeout=30)
            debug_log(f"Duration result: returncode={result.returncode}")
            debug_log(f"Duration stdout: {result.stdout}")
            debug_log(f"Duration stderr: {result.stderr}")
            
            if result.returncode != 0:
                debug_log(f"ffprobe failed with return code {result.returncode}")
                generation_status['error'] = f"Failed to analyze video: {result.stderr}"
                generation_status['in_progress'] = False
                generation_status['completed'] = True
                return
                
            duration = int(float(result.stdout.strip()))
            debug_log(f"Video duration: {duration} seconds")
        except Exception as e:
            debug_log(f"Failed to retrieve video duration: {e}")
            generation_status['error'] = f"Failed to get video duration: {str(e)}"
            generation_status['in_progress'] = False
            generation_status['completed'] = True
            return
        
        # Calculate start and end seconds from keywords or use as-is
        startseconds = calculate_trim_seconds(PREVIEW_START_SECONDS, duration)
        endseconds = calculate_trim_seconds(PREVIEW_END_SECONDS, duration)
        debug_log(f"Calculated start seconds to trim: {startseconds}")
        debug_log(f"Calculated end seconds to trim: {endseconds}")
        
        # Calculate working duration
        working_duration = duration - startseconds - endseconds
        debug_log(f"Working duration: {working_duration} seconds")
        
        minlength = minicliplength * numminiclips
        if working_duration < minlength:
            debug_log(f"Video too short for preview. Need {minlength}s, have {working_duration}s")
            generation_status['error'] = f"Video too short for preview. Need {minlength} seconds after trimming, have {working_duration} seconds."
            generation_status['in_progress'] = False
            generation_status['completed'] = True
            return

        debug_log("Creating mini clips...")
        interval = int(working_duration / numminiclips)
        miniclips = []
        tmp_dir = tempfile.mkdtemp()
        debug_log(f"Temp directory: {tmp_dir}")
        
        for i in range(numminiclips):
            start = startseconds + i * interval
            mini_out = os.path.join(tmp_dir, f"mini_{i}{ext}")
            debug_log(f"Creating clip {i} starting at {start}s -> {mini_out}")
            
            if ext == ".webm":
                ffmpeg_cmd = [
                    ffmpeg_path, "-y",
                    "-ss", str(start),
                    "-i", input_file,
                    "-t", str(minicliplength),
                    "-c:v", "libvpx-vp9",
                    "-crf", str(crf),
                    "-b:v", bitrate,
                    "-preset", preset,
                ]
            else:
                ffmpeg_cmd = [
                    ffmpeg_path, "-y",
                    "-ss", str(start),
                    "-i", input_file,
                    "-t", str(minicliplength),
                    "-c:v", "libx264",
                    "-crf", str(crf),
                    "-b:v", bitrate,
                    "-preset", preset,
                ]
            if not audiotoggle:
                ffmpeg_cmd += ["-an"]
            if resolution:
                ffmpeg_cmd += ["-vf", f"scale={resolution}:-2"]
            ffmpeg_cmd.append(mini_out)
            
            debug_log(f"ffmpeg command: {' '.join(ffmpeg_cmd)}")
            result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, timeout=60)
            debug_log(f"ffmpeg clip {i} result: returncode={result.returncode}")
            if result.returncode != 0:
                debug_log(f"ffmpeg error for clip {i}: {result.stderr}")
            else:
                debug_log(f"ffmpeg clip {i} success: {result.stdout}")
            miniclips.append(mini_out)

        debug_log("Concatenating clips...")
        concat_file = os.path.join(tmp_dir, "concat.txt")
        with open(concat_file, "w") as f:
            for m in miniclips:
                f.write(f"file '{m}'\n")
        debug_log(f"Concat file created: {concat_file}")
        
        ffmpeg_concat_cmd = [
            ffmpeg_path, "-y", "-f", "concat", "-safe", "0", "-i",
            concat_file, "-c", "copy", output_path
        ]
        debug_log(f"Concat command: {' '.join(ffmpeg_concat_cmd)}")
        result = subprocess.run(ffmpeg_concat_cmd, capture_output=True, text=True, timeout=60)
        debug_log(f"Concat result: returncode={result.returncode}")
        debug_log(f"Concat stdout: {result.stdout}")
        debug_log(f"Concat stderr: {result.stderr}")
        
        if result.returncode != 0:
            debug_log(f"ffmpeg concat error: {result.stderr}")
            shutil.rmtree(tmp_dir)
            if temp_file and os.path.exists(temp_file):
                os.remove(temp_file)
            generation_status['error'] = f"Failed to combine clips: {result.stderr}"
            generation_status['in_progress'] = False
            generation_status['completed'] = True
            return

        debug_log("Cleaning up...")
        shutil.rmtree(tmp_dir)
        if temp_file and os.path.exists(temp_file):
            os.remove(temp_file)
            
        debug_log(f"Preview generation successful: {output_path}")
        generation_status['result_path'] = os.path.relpath(output_path)
        generation_status['in_progress'] = False
        generation_status['completed'] = True
        
    except Exception as e:
        debug_log(f"Error generating preview: {e}")
        generation_status['error'] = str(e)
        generation_status['in_progress'] = False
        generation_status['completed'] = True

def ensure_leading_slash_if_local(path):
    if not path:
        return path
    if path.startswith("http://") or path.startswith("https://"):
        return path
    if os.path.abspath(path) == os.path.abspath(DATA_JSON_PATH):
        return path
    if not path.startswith("/"):
        return "/" + path
    return path

def delete_local_files_from_entry(entry):
    """Delete local files referenced by an entry"""
    for key in ["imgSrc", "previewSrc", "videoSrc", "PDFSrc"]:
        path = entry.get(key, "")
        if path and path.startswith("/"):
            # Remove leading slash to get relative path
            relative_path = path.lstrip("/")
            if os.path.exists(relative_path):
                try:
                    os.remove(relative_path)
                    print(f"Deleted local file: {relative_path}")
                except Exception as e:
                    print(f"Failed to delete file {relative_path}: {e}")

class GeneratingDialog(tk.Toplevel):
    """Simple non-blocking dialog that just shows 'Generating...' message"""
    def __init__(self, parent):
        super().__init__(parent)
        self.title("Generating Preview")
        self.geometry("300x120")
        self.resizable(False, False)
        self.transient(parent)
        
        # Center the dialog
        self.geometry("+{}+{}".format(
            parent.winfo_rootx() + 100,
            parent.winfo_rooty() + 100
        ))
        
        # Create widgets
        main_frame = ttk.Frame(self, padding="20")
        main_frame.pack(fill='both', expand=True)
        
        # Generating message
        self.message_label = ttk.Label(main_frame, text="Generating preview...", font=("Arial", 12))
        self.message_label.pack(pady=(0, 10))
        
        # Spinning indicator (using text animation)
        self.spinner_label = ttk.Label(main_frame, text="●", font=("Arial", 20))
        self.spinner_label.pack()
        
        # Start spinner animation
        self.spinner_chars = ["●", "○", "●", "○"]
        self.spinner_index = 0
        self.animate_spinner()
        
        # Make it stay on top
        self.lift()
        self.attributes('-topmost', True)
        
    def animate_spinner(self):
        """Animate the spinner"""
        if self.winfo_exists():
            try:
                self.spinner_label.config(text=self.spinner_chars[self.spinner_index])
                self.spinner_index = (self.spinner_index + 1) % len(self.spinner_chars)
                self.after(500, self.animate_spinner)  # Update every 500ms
            except tk.TclError:
                pass  # Dialog was closed
        
    def close_dialog(self):
        """Close the dialog safely"""
        try:
            self.destroy()
        except tk.TclError:
            pass  # Already destroyed

class PlaylistDialog(tk.Toplevel):
    """Dialog for handling playlist processing options"""
    def __init__(self, parent, playlist_info, original_url, app_instance):
        super().__init__(parent)
        self.title("Playlist Detected")
        self.geometry("600x500")
        self.resizable(True, True)
        self.transient(parent)
        self.grab_set()  # Make modal
        
        self.playlist_info = playlist_info
        self.original_url = original_url
        self.app_instance = app_instance  # Reference to main app
        self.result = None
        self.selected_videos = []
        
        # Center the dialog
        self.geometry("+{}+{}".format(
            parent.winfo_rootx() + 50,
            parent.winfo_rooty() + 50
        ))
        
        self.setup_ui()
        
    def setup_ui(self):
        # Main container
        main_frame = ttk.Frame(self, padding="20")
        main_frame.pack(fill='both', expand=True)
        
        # Header info
        header_frame = ttk.Frame(main_frame)
        header_frame.pack(fill='x', pady=(0, 20))
        
        title_label = ttk.Label(header_frame, text=f"Playlist: {self.playlist_info['title']}", 
                               font=("Arial", 12, "bold"))
        title_label.pack(anchor='w')
        
        count_label = ttk.Label(header_frame, text=f"Contains {self.playlist_info['count']} videos")
        count_label.pack(anchor='w', pady=(5, 0))
        
        if self.playlist_info.get('uploader'):
            uploader_label = ttk.Label(header_frame, text=f"By: {self.playlist_info['uploader']}")
            uploader_label.pack(anchor='w', pady=(2, 0))
        
        # Options
        options_frame = ttk.LabelFrame(main_frame, text="Processing Options")
        options_frame.pack(fill='x', pady=(0, 20))
        
        self.option_var = tk.StringVar(value="all")
        
        # Process all videos option
        all_radio = ttk.Radiobutton(options_frame, text=f"Process all {self.playlist_info['count']} videos", 
                                   variable=self.option_var, value="all")
        all_radio.pack(anchor='w', padx=10, pady=5)
        
        # Select specific videos option
        select_radio = ttk.Radiobutton(options_frame, text="Select specific videos", 
                                      variable=self.option_var, value="select")
        select_radio.pack(anchor='w', padx=10, pady=5)
        
        # Process first video only option
        first_radio = ttk.Radiobutton(options_frame, text="Process only the first video", 
                                     variable=self.option_var, value="first")
        first_radio.pack(anchor='w', padx=10, pady=5)
        
        # Video selection area (for when "select" is chosen)
        selection_frame = ttk.LabelFrame(main_frame, text="Video Selection")
        selection_frame.pack(fill='both', expand=True, pady=(0, 20))
        
        # Create scrollable list of videos
        list_container = ttk.Frame(selection_frame)
        list_container.pack(fill='both', expand=True, padx=10, pady=10)
        
        # Listbox with scrollbar
        list_frame = ttk.Frame(list_container)
        list_frame.pack(fill='both', expand=True)
        
        self.video_listbox = tk.Listbox(list_frame, selectmode='multiple', height=10)
        list_scrollbar = ttk.Scrollbar(list_frame, orient="vertical", command=self.video_listbox.yview)
        self.video_listbox.configure(yscrollcommand=list_scrollbar.set)
        
        self.video_listbox.pack(side='left', fill='both', expand=True)
        list_scrollbar.pack(side='right', fill='y')
        
        # Populate video list
        for i, entry in enumerate(self.playlist_info['entries']):
            title = entry.get('title', f'Video {i+1}')
            duration = entry.get('duration', '')
            if duration:
                duration_str = f" ({duration}s)"
            else:
                duration_str = ""
            self.video_listbox.insert(tk.END, f"{i+1}. {title}{duration_str}")
        
        # Select all/none buttons
        select_buttons_frame = ttk.Frame(list_container)
        select_buttons_frame.pack(fill='x', pady=(10, 0))
        
        ttk.Button(select_buttons_frame, text="Select All", 
                  command=self.select_all_videos).pack(side='left', padx=(0, 5))
        ttk.Button(select_buttons_frame, text="Select None", 
                  command=self.select_no_videos).pack(side='left')
        
        # Buttons
        button_frame = ttk.Frame(main_frame)
        button_frame.pack(fill='x')
        
        ttk.Button(button_frame, text="Cancel", command=self.cancel).pack(side='right', padx=(5, 0))
        ttk.Button(button_frame, text="Process", command=self.process).pack(side='right')
        
        # FIXED: Use the correct trace method for Python 3.13
        try:
            self.option_var.trace_add('write', self.on_option_change)
        except AttributeError:
            # Fallback for older Python versions
            self.option_var.trace('w', self.on_option_change)
        
        self.on_option_change()
        
    def on_option_change(self, *args):
        """Update UI based on selected option"""
        option = self.option_var.get()
        if option == "select":
            self.video_listbox.config(state='normal')
        else:
            self.video_listbox.config(state='disabled')
    
    def select_all_videos(self):
        self.video_listbox.selection_set(0, tk.END)
        
    def select_no_videos(self):
        self.video_listbox.selection_clear(0, tk.END)
        
    def cancel(self):
        self.result = None
        self.destroy()
        
    def process(self):
        debug_log("Process button clicked in playlist dialog")
        option = self.option_var.get()
        
        if option == "all":
            self.result = "all"
            self.selected_videos = list(range(len(self.playlist_info['entries'])))
        elif option == "first":
            self.result = "first"
            self.selected_videos = [0] if self.playlist_info['entries'] else []
        elif option == "select":
            selected_indices = self.video_listbox.curselection()
            if not selected_indices:
                messagebox.showwarning("No Selection", "Please select at least one video.")
                return
            self.result = "select"
            self.selected_videos = list(selected_indices)
        
        debug_log(f"Processing option: {option}, selected videos: {self.selected_videos}")
        
        # CRITICAL FIX: Call processing directly on main thread
        try:
            # Close dialog first
            self.withdraw()
            
            # Call processing directly (no additional threading needed)
            self.app_instance.process_playlist_videos(self.playlist_info, self.selected_videos, self.original_url)
            
            # Destroy dialog
            self.destroy()
            
        except Exception as e:
            debug_log(f"Error in process method: {e}")
            messagebox.showerror("Processing Error", f"Error starting processing: {str(e)}")
            self.destroy()

class PlaylistProgressDialog(tk.Toplevel):
    """Dialog showing progress of playlist processing"""
    def __init__(self, parent, total_videos):
        super().__init__(parent)
        self.title("Processing Playlist")
        self.geometry("500x200")
        self.resizable(False, False)
        self.transient(parent)
        self.grab_set()  # Make modal
        
        self.total_videos = total_videos
        self.current_video = 0
        self.cancelled = False
        
        # Center the dialog
        self.geometry("+{}+{}".format(
            parent.winfo_rootx() + 100,
            parent.winfo_rooty() + 100
        ))
        
        self.setup_ui()
        
    def setup_ui(self):
        main_frame = ttk.Frame(self, padding="20")
        main_frame.pack(fill='both', expand=True)
        
        # Status label
        self.status_label = ttk.Label(main_frame, text="Processing playlist videos...")
        self.status_label.pack(pady=(0, 10))
        
        # Current video label
        self.video_label = ttk.Label(main_frame, text="", font=("Arial", 10))
        self.video_label.pack(pady=(0, 10))
        
        # Progress bar
        self.progress_var = tk.DoubleVar()
        self.progress_bar = ttk.Progressbar(main_frame, length=400, mode='determinate', 
                                          variable=self.progress_var, maximum=self.total_videos)
        self.progress_bar.pack(pady=(0, 10))
        
        # Progress text
        self.progress_text = ttk.Label(main_frame, text=f"0 of {self.total_videos} videos processed")
        self.progress_text.pack(pady=(0, 10))
        
        # Current step label
        self.step_label = ttk.Label(main_frame, text="Starting...", font=("Arial", 9))
        self.step_label.pack(pady=(0, 10))
        
        # Cancel button
        ttk.Button(main_frame, text="Cancel", command=self.cancel).pack()
        
    def update_progress(self, current, video_title="", step=""):
        """Update progress display"""
        if self.cancelled:
            return
            
        self.current_video = current
        self.progress_var.set(current)
        
        if video_title:
            display_title = video_title[:60] + "..." if len(video_title) > 60 else video_title
            self.video_label.config(text=f"Current: {display_title}")
        
        self.progress_text.config(text=f"{current} of {self.total_videos} videos processed")
        
        if step:
            self.step_label.config(text=step)
        
        self.update_idletasks()
        
    def cancel(self):
        self.cancelled = True
        self.destroy()

class CreditsEditor(tk.Toplevel):
    def __init__(self, master, credits, on_save=None):
        super().__init__(master)
        self.title("Edit Credits")
        self.geometry("900x750")
        self.resizable(True, True)
        self.original_credits = credits.copy()  # Store original for cancel functionality
        self.credits = credits.copy()  # Working copy
        self.role_vars = []
        self.name_vars = []
        self.rows = []
        self.on_save = on_save
        self.configure(bg="#f8f8f8")
        self.setup_ui()

    def setup_ui(self):
        # Use responsive scrollable frame
        main_container, self.scrollable_frame = setup_responsive_scrollable_frame(self)
        
        # Register the canvas for universal scrolling
        if hasattr(self.master, 'register_scrollable'):
            for widget in main_container.winfo_children():
                if isinstance(widget, tk.Canvas):
                    self.master.register_scrollable(widget)
                    break
        
        # Smart add section
        smart_frame = ttk.LabelFrame(self.scrollable_frame, text="Smart Add Credits")
        smart_frame.pack(fill='x', pady=(10, 10), padx=10)
        
        # Instructions
        instructions = ttk.Label(smart_frame, text="Paste credits text below and click 'Parse' to automatically add them:", 
                                foreground="black")
        instructions.pack(anchor='w', padx=5, pady=2)
        
        # Text area for pasting credits
        text_container = ttk.Frame(smart_frame)
        text_container.pack(fill='x', padx=5, pady=5)
        
        self.credits_text = tk.Text(text_container, height=10, wrap="word", fg="black", bg="white", 
                                   insertbackground='black', font=("Arial", 10))
        self.credits_text.pack(side='left', fill='x', expand=True)
        
        # Scrollbar for text area
        text_scroll = ttk.Scrollbar(text_container, orient="vertical", command=self.credits_text.yview)
        text_scroll.pack(side="right", fill="y")
        self.credits_text.configure(yscrollcommand=text_scroll.set)
        
        # Button container for smart add
        smart_btn_frame = ttk.Frame(smart_frame)
        smart_btn_frame.pack(fill='x', padx=5, pady=5)
        ttk.Button(smart_btn_frame, text="Parse Credits", command=self.parse_credits).pack(side='left', padx=(0, 5))
        ttk.Button(smart_btn_frame, text="Clear All", command=self.clear_all_credits).pack(side='left')
        
        # Separator
        ttk.Separator(self.scrollable_frame, orient='horizontal').pack(fill='x', pady=10, padx=10)
        
        # Manual edit section
        manual_frame = ttk.LabelFrame(self.scrollable_frame, text="Manual Edit")
        manual_frame.pack(fill='x', padx=10, pady=(0, 100))  # Extra bottom padding for button bar
        
        # Simple frame for rows
        self.rows_frame = ttk.Frame(manual_frame)
        self.rows_frame.pack(fill='x', padx=5, pady=5)
        
        # Header
        header = ttk.Frame(self.rows_frame)
        header.pack(fill='x', pady=(0, 10))
        ttk.Label(header, text="Role", foreground="black").pack(side='left', padx=(0, 10))
        ttk.Label(header, text="Names (comma separated)", foreground="black").pack(side='left', expand=True)
        ttk.Label(header, text="Actions", foreground="black").pack(side='right', padx=(10, 0))
        
        # Add existing credits
        for role, names in list(self.credits.items()):
            self.add_row(role, ", ".join(names))
        
        # Add role button
        add_btn = ttk.Button(self.rows_frame, text="Add Role", command=lambda: self.add_row("", ""))
        add_btn.pack(pady=10)
        
        # FIXED BUTTON BAR AT BOTTOM
        button_bar = ttk.Frame(self)
        button_bar.pack(side='bottom', fill='x', pady=10, padx=10)
        
        # Button bar with separator line
        ttk.Separator(button_bar, orient='horizontal').pack(fill='x', pady=(0, 10))
        
        btns = ttk.Frame(button_bar)
        btns.pack(fill='x')
        ttk.Button(btns, text="Save", command=self.save).pack(side='right', padx=5)
        ttk.Button(btns, text="Cancel", command=self.cancel).pack(side='right')

    def clear_all_credits(self):
        """Clear all credits after confirmation"""
        if messagebox.askyesno("Clear All Credits", "Are you sure you want to clear all credits? This cannot be undone."):
            self.credits.clear()
            self.refresh_rows()

    def parse_credits(self):
        """Parse the credits text and add to the current credits"""
        text = self.credits_text.get("1.0", tk.END).strip()
        if not text:
            messagebox.showwarning("No Text", "Please paste some credits text first.")
            return
        
        try:
            parsed_credits = parse_credits_text(text)
            
            if not parsed_credits:
                messagebox.showwarning("Parse Failed", "Could not parse any credits from the text.")
                return
            
            # Add parsed credits to current credits
            for role, names in parsed_credits.items():
                if role in self.credits:
                    # Merge with existing role
                    existing_names = set(self.credits[role])
                    new_names = [name for name in names if name not in existing_names]
                    if new_names:
                        self.credits[role].extend(new_names)
                else:
                    # New role
                    self.credits[role] = names
            
            # Refresh the UI
            self.refresh_rows()
            
            # Clear the text area
            self.credits_text.delete("1.0", tk.END)
            
            messagebox.showinfo("Parse Successful", 
                f"Successfully parsed {len(parsed_credits)} roles with {sum(len(names) for names in parsed_credits.values())} names total.")
        
        except Exception as e:
            messagebox.showerror("Parse Error", f"Error parsing credits: {str(e)}")

    def refresh_rows(self):
        """Refresh all the credit rows"""
        # Clear existing rows
        for row in self.rows:
            row.destroy()
        self.role_vars.clear()
        self.name_vars.clear()
        self.rows.clear()
        
        # Add all credits as rows
        for role, names in self.credits.items():
            self.add_row(role, ", ".join(names))

    def add_row(self, role, names):
        row = ttk.Frame(self.rows_frame)
        row.pack(fill='x', pady=2)
        role_var = tk.StringVar(value=role)
        name_var = tk.StringVar(value=names)
        self.role_vars.append(role_var)
        self.name_vars.append(name_var)
        self.rows.append(row)
        
        # NO FIXED WIDTHS - responsive design
        e1 = tk.Entry(row, textvariable=role_var, insertbackground='black', fg="black", bg="white")
        e2 = tk.Entry(row, textvariable=name_var, insertbackground='black', fg="black", bg="white")
        e1.pack(side='left', padx=(0, 5))
        e2.pack(side='left', fill='x', expand=True, padx=(0, 5))
        
        # Action buttons
        action_frame = tk.Frame(row, bg="#f8f8f8")
        action_frame.pack(side='left', padx=5)
        
        btn_up = ttk.Button(action_frame, text="↑", width=3, command=lambda r=row: self.move_row(r, -1))
        btn_down = ttk.Button(action_frame, text="↓", width=3, command=lambda r=row: self.move_row(r, 1))
        btn_remove = ttk.Button(action_frame, text="×", width=3, command=lambda: self.remove_row(row, role_var, name_var))
        
        btn_up.pack(side='left', padx=1)
        btn_down.pack(side='left', padx=1)
        btn_remove.pack(side='left', padx=1)

    def move_row(self, row, direction):
        idx = self.rows.index(row)
        new_idx = idx + direction
        if 0 <= new_idx < len(self.rows):
            self.role_vars[idx], self.role_vars[new_idx] = self.role_vars[new_idx], self.role_vars[idx]
            self.name_vars[idx], self.name_vars[new_idx] = self.name_vars[new_idx], self.name_vars[idx]
            self.rows[idx], self.rows[new_idx] = self.rows[new_idx], self.rows[idx]
            for r in self.rows:
                r.pack_forget()
            for r in self.rows:
                r.pack(fill='x', pady=2)

    def remove_row(self, row, role_var, name_var):
        row.destroy()
        idx = self.role_vars.index(role_var)
        del self.role_vars[idx]
        del self.name_vars[idx]
        del self.rows[idx]

    def save(self):
        """Save changes and close"""
        new_credits = {}
        for r, n in zip(self.role_vars, self.name_vars):
            role = r.get().strip()
            names = [x.strip() for x in n.get().split(",") if x.strip()]
            if role and names:
                new_credits[role] = names
        self.credits = new_credits
        if self.on_save:
            self.on_save(self.credits)
        self.destroy()

    def cancel(self):
        """Cancel changes and revert to original"""
        # No callback - just close without saving
        self.destroy()

class TileEditor(tk.Toplevel):
    def __init__(self, master, entry, on_save, on_delete):
        super().__init__(master)
        self.title("Edit Entry")
        self.geometry("1000x900")
        self.resizable(True, True)
        self.entry = entry
        self.on_save = on_save
        self.on_delete = on_delete
        self.vars = {}
        self.role_vars = []
        self.type_var = tk.StringVar()
        self.screenplay_var = tk.StringVar()
        self.credits = entry.get("credits", {}).copy() if entry.get("credits") else {}
        self.create_widgets()

    def create_widgets(self):
        # Use responsive scrollable frame
        main_container, self.scrollable_frame = setup_responsive_scrollable_frame(self)
        
        # Register the canvas for universal scrolling
        if hasattr(self.master, 'register_scrollable'):
            for widget in main_container.winfo_children():
                if isinstance(widget, tk.Canvas):
                    self.master.register_scrollable(widget)
                    break
        
        # Content frame with responsive grid layout
        content_frame = ttk.Frame(self.scrollable_frame)
        content_frame.pack(fill='x', padx=10, pady=(10, 100))  # Extra bottom padding for button bar
        
        # Configure grid weights for responsive design
        content_frame.columnconfigure(0, weight=0)  # Left labels
        content_frame.columnconfigure(1, weight=1)  # Left inputs
        content_frame.columnconfigure(2, weight=0)  # Spacing
        content_frame.columnconfigure(3, weight=0)  # Right labels
        content_frame.columnconfigure(4, weight=1)  # Right inputs
        
        gridrow = 0
        label_opts = {"fg": "black", "bg": "#f8f8f8"}
        
        # Two-column layout for basic fields
        left_fields = ["imgSrc", "videoSrc", "slug", "date"]
        right_fields = ["previewSrc", "PDFSrc", "title", ""]
        
        for left_key, right_key in zip(left_fields, right_fields):
            # Left column
            if left_key:
                tk.Label(content_frame, text=left_key + ":", anchor='w', **label_opts).grid(
                    row=gridrow, column=0, sticky='w', pady=2, padx=(0, 5))
                var = tk.StringVar(value=str(self.entry.get(left_key, "")))
                # NO FIXED WIDTH - responsive
                ent = tk.Entry(content_frame, textvariable=var, fg="black", bg="white", insertbackground='black')
                ent.grid(row=gridrow, column=1, sticky='ew', pady=2, padx=(0, 10))
                self.vars[left_key] = var
            
            # Right column
            if right_key:
                tk.Label(content_frame, text=right_key + ":", anchor='w', **label_opts).grid(
                    row=gridrow, column=3, sticky='w', pady=2, padx=(10, 5))
                var = tk.StringVar(value=str(self.entry.get(right_key, "")))
                # NO FIXED WIDTH - responsive
                ent = tk.Entry(content_frame, textvariable=var, fg="black", bg="white", insertbackground='black')
                ent.grid(row=gridrow, column=4, sticky='ew', pady=2)
                self.vars[right_key] = var
            
            gridrow += 1

        # Description (full width, NO FIXED HEIGHT)
        tk.Label(content_frame, text="description:", anchor='w', **label_opts).grid(
            row=gridrow, column=0, sticky='nw', pady=(10, 2))
        desc_frame = tk.Frame(content_frame, bg="#f8f8f8")
        desc_frame.grid(row=gridrow, column=1, columnspan=4, sticky='ew', pady=(10, 2))
        
        # NO FIXED HEIGHT - responsive
        desc_text = tk.Text(desc_frame, fg="black", bg="white", wrap="word", insertbackground='black')
        desc_val = self.entry.get("description", "")
        desc_text.insert("1.0", desc_val)
        desc_text.pack(side='left', fill='both', expand=True)
        
        # Add scrollbar to description
        desc_scroll = ttk.Scrollbar(desc_frame, orient="vertical", command=desc_text.yview)
        desc_scroll.pack(side="right", fill="y")
        desc_text.configure(yscrollcommand=desc_scroll.set)
        
        self.vars["description"] = desc_text
        gridrow += 1

        # Credits button
        credits_btn = ttk.Button(content_frame, text="Edit Credits", command=self.open_credits_editor)
        credits_btn.grid(row=gridrow, column=0, columnspan=5, sticky='w', pady=10)
        gridrow += 1

        # Role and Type (side by side)
        tk.Label(content_frame, text="role:", anchor='w', **label_opts).grid(
            row=gridrow, column=0, sticky='nw', pady=2, padx=(0, 5))
        role_frame = tk.Frame(content_frame, bg="#f8f8f8")
        role_frame.grid(row=gridrow, column=1, sticky='ew', pady=2, padx=(0, 10))
        
        tk.Label(content_frame, text="type:", anchor='w', **label_opts).grid(
            row=gridrow, column=3, sticky='nw', pady=2, padx=(10, 5))
        type_frame = tk.Frame(content_frame, bg="#f8f8f8")
        type_frame.grid(row=gridrow, column=4, sticky='ew', pady=2)
        
        # Role checkboxes
        current_roles = (self.entry.get('role') or "").split("/")
        self.role_vars = []
        for i, role in enumerate(ENTRY_ROLES):
            var = tk.BooleanVar()
            if role in current_roles:
                var.set(True)
            cb = tk.Checkbutton(role_frame, text=role, variable=var, fg="black", bg="#f8f8f8")
            cb.grid(row=i//3, column=i%3, sticky='w', padx=2)
            self.role_vars.append((role, var))
        
        # Type radio buttons
        current_type = self.entry.get("type", "")
        self.type_var.set(current_type)
        for i, t in enumerate(ENTRY_TYPES):
            rb = tk.Radiobutton(type_frame, text=t, variable=self.type_var, value=t, fg="black", bg="#f8f8f8")
            rb.grid(row=i//3, column=i%3, sticky='w', padx=2)
        gridrow += 1

        # Screenplay (full width)
        tk.Label(content_frame, text="Screenplay:", anchor='w', **label_opts).grid(
            row=gridrow, column=0, sticky='w', pady=2, padx=(0, 5))
        screenplay_frame = tk.Frame(content_frame, bg="#f8f8f8")
        screenplay_frame.grid(row=gridrow, column=1, columnspan=4, sticky='w', pady=2)
        current_screenplay = self.entry.get("Screenplay", "")
        self.screenplay_var.set(current_screenplay)
        for i, (label, val) in enumerate([("None", ""), ("Yes", "Yes"), ("Sole", "Sole")]):
            rb = tk.Radiobutton(screenplay_frame, text=label, variable=self.screenplay_var, value=val, fg="black", bg="#f8f8f8")
            rb.pack(side="left", padx=10)
        gridrow += 1

        # FIXED BUTTON BAR AT BOTTOM
        button_bar = ttk.Frame(self)
        button_bar.pack(side='bottom', fill='x', pady=10, padx=10)
        
        # Button bar with separator line
        ttk.Separator(button_bar, orient='horizontal').pack(fill='x', pady=(0, 10))
        
        btns = ttk.Frame(button_bar)
        btns.pack(fill='x')
        ttk.Button(btns, text="Delete", command=self.confirm_delete).pack(side='left', padx=5)
        ttk.Button(btns, text="Save", command=self.save).pack(side='right', padx=5)
        ttk.Button(btns, text="Cancel", command=self.destroy).pack(side='right')

    def open_credits_editor(self):
        def credits_callback(new_credits):
            self.credits = new_credits
        CreditsEditor(self, self.credits, on_save=credits_callback)

    def confirm_delete(self):
        if messagebox.askyesno("Delete", "Are you sure you want to delete this entry?"):
            delete_local_files_from_entry(self.entry)
            self.on_delete(self.entry)
            self.destroy()

    def save(self):
        for key in ["imgSrc", "previewSrc", "videoSrc", "PDFSrc", "slug", "title", "date"]:
            if key in self.vars:
                self.entry[key] = self.vars[key].get()
        roles_selected = [role for role, var in self.role_vars if var.get()]
        self.entry["role"] = "/".join(roles_selected)
        self.entry["description"] = self.vars["description"].get("1.0", "end-1c")
        self.entry["credits"] = self.credits
        self.entry["type"] = self.type_var.get()
        self.entry["Screenplay"] = self.screenplay_var.get()
        self.on_save(self.entry)
        self.destroy()

class DataJsonViewer(ttk.Frame):
    def __init__(self, master, data, on_entry_update):
        super().__init__(master)
        self.data = data
        self.on_entry_update = on_entry_update
        self.tiles = []
        self.create_widgets()

    def create_widgets(self):
        # Use responsive scrollable frame
        main_container, self.scrollable_frame = setup_responsive_scrollable_frame(self)
        
        self.populate_tiles()

    def populate_tiles(self):
        for widget in self.scrollable_frame.winfo_children():
            widget.destroy()
        self.tiles.clear()
        for idx, entry in enumerate(self.data):
            tile = tk.Frame(self.scrollable_frame, relief="groove", borderwidth=2, bg="#f4f4f4")
            tile.pack(fill='x', padx=6, pady=5)
            header = f"{entry.get('title', '(untitled)')} | {entry.get('slug', '')} | {entry.get('date', '')}"
            tk.Label(tile, text=header, font=("Arial", 12, "bold"), anchor='w', bg="#f4f4f4", fg="black").pack(anchor='w', padx=5)
            for key in ["role", "type", "Screenplay"]:
                value = entry.get(key, "")
                if value:
                    tk.Label(tile, text=f"{key}: {value}", anchor='w', bg="#f4f4f4", fg="black").pack(anchor='w', padx=10)
            for key, value in entry.items():
                if key not in ("title", "slug", "date", "role", "type", "Screenplay"):
                    tk.Label(tile, text=f"{key}: {str(value)[:100]}", anchor='w', bg="#f4f4f4", fg="#333").pack(anchor='w', padx=10)
            btns = tk.Frame(tile, bg="#f4f4f4")
            btns.pack(anchor='sw', side='bottom', padx=8, pady=2, fill='x')
            ttk.Button(btns, text="Edit", command=lambda idx=idx: self.edit_entry(idx)).pack(side='left')

    def edit_entry(self, idx):
        def on_save(updated_entry):
            self.data[idx] = updated_entry
            self.on_entry_update(self.data)
            self.populate_tiles()
        def on_delete(entry):
            del self.data[idx]
            self.on_entry_update(self.data)
            self.populate_tiles()
        TileEditor(self, dict(self.data[idx]), on_save, on_delete)

class ContentEntryCreatorApp(UniversalScrollMixin, tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Content Entry Creator")
        self.geometry(f"{DEFAULT_WINDOW_WIDTH}x{DEFAULT_WINDOW_HEIGHT}")
        self.minsize(800, 600)
        self.configure(bg="#f8f8f8")
        self.style = ttk.Style(self)
        self.style.theme_use("clam")
        self.data = load_data()
        self.credits = {}
        self.editing_idx = None
        self.generating_dialog = None
        self.create_widgets()
        
        # Set up universal scrolling after widgets are created
        self.after_idle(self.setup_universal_scroll)

    def create_widgets(self):
        self.tabs = ttk.Notebook(self)
        self.tabs.pack(expand=True, fill='both')

        self.entry_tab = ttk.Frame(self.tabs)
        self.tabs.add(self.entry_tab, text="Create/Edit Entry")
        self._setup_entry_tab(self.entry_tab)

        self.data_tab = DataJsonViewer(self.tabs, self.data, self._on_data_update)
        self.tabs.add(self.data_tab, text="View/Edit data.json")

    def _setup_entry_tab(self, parent):
        # Use responsive scrollable frame
        main_container, self.scrollable_frame = setup_responsive_scrollable_frame(parent)
        
        # Register the canvas for universal scrolling
        for widget in main_container.winfo_children():
            if isinstance(widget, tk.Canvas):
                self.register_scrollable(widget)
                break
        
        # Mode selection at top
        self.mode_var = tk.StringVar(value="video")
        mode_frame = ttk.LabelFrame(self.scrollable_frame, text="Start from")
        mode_frame.pack(fill='x', pady=(10, 10), padx=10)
        ttk.Radiobutton(mode_frame, text="Video", variable=self.mode_var, value="video", command=self.switch_mode).pack(side='left', padx=10)
        ttk.Radiobutton(mode_frame, text="PDF", variable=self.mode_var, value="pdf", command=self.switch_mode).pack(side='left', padx=10)

        # Source section
        source_frame = tk.Frame(self.scrollable_frame, bg="#f8f8f8")
        source_frame.pack(fill='x', pady=(0, 10), padx=10)
        
        self.source_label = tk.Label(source_frame, text="Video Source:", anchor='w', fg="black", bg="#f8f8f8")
        self.source_label.pack(anchor='w')
        
        self.source_var = tk.StringVar()
        src_row = tk.Frame(source_frame, bg="#f8f8f8")
        src_row.pack(fill='x', pady=3)
        
        # NO FIXED WIDTH - responsive
        self.src_entry = tk.Entry(src_row, textvariable=self.source_var, insertbackground='black', fg="black", bg="white")
        self.src_entry.pack(side='left', fill='x', expand=True, padx=(0, 5))
        
        ttk.Button(src_row, text="Browse...", command=self.browse_source).pack(side='left', padx=2)
        ttk.Button(src_row, text="Fetch Info", command=self.fetch_info).pack(side='left', padx=2)
        ttk.Button(src_row, text="Generate Preview", command=self.generate_preview_for_current).pack(side='left', padx=2)

        # Main form area with two-column layout
        form_container = tk.Frame(self.scrollable_frame, bg="#f8f8f8")
        form_container.pack(fill='x', padx=10, pady=(0, 100))  # Extra bottom padding for button bar
        
        # Configure grid for responsive design
        form_container.columnconfigure(0, weight=0)  # Left labels
        form_container.columnconfigure(1, weight=1)  # Left inputs
        form_container.columnconfigure(2, weight=0)  # Spacing
        form_container.columnconfigure(3, weight=0)  # Right labels
        form_container.columnconfigure(4, weight=1)  # Right inputs
        
        self.fields = {}
        gridrow = 0
        
        # Two-column layout for form fields
        left_fields = [
            ("imgSrc", "Image Source"),
            ("videoSrc", "Video Source"),
            ("slug", "Slug"),
            ("date", "Date")
        ]
        
        right_fields = [
            ("previewSrc", "Preview Source"),
            ("PDFSrc", "PDF Source"),
            ("title", "Title"),
            ("", "")  # Empty for alignment
        ]

        for (left_key, left_label), (right_key, right_label) in zip(left_fields, right_fields):
            # Left column
            if left_key:
                tk.Label(form_container, text=left_label + ":", anchor='w', fg="black", bg="#f8f8f8").grid(
                    row=gridrow, column=0, sticky='w', pady=2, padx=(0, 5))
                var = tk.StringVar()
                # NO FIXED WIDTH - responsive
                ent = tk.Entry(form_container, textvariable=var, insertbackground='black', fg="black", bg="white")
                ent.grid(row=gridrow, column=1, sticky='ew', pady=2, padx=(0, 10))
                self.fields[left_key] = var
            
            # Right column
            if right_key:
                tk.Label(form_container, text=right_label + ":", anchor='w', fg="black", bg="#f8f8f8").grid(
                    row=gridrow, column=3, sticky='w', pady=2, padx=(10, 5))
                var = tk.StringVar()
                # NO FIXED WIDTH - responsive
                ent = tk.Entry(form_container, textvariable=var, insertbackground='black', fg="black", bg="white")
                ent.grid(row=gridrow, column=4, sticky='ew', pady=2)
                self.fields[right_key] = var
            
            gridrow += 1

        # Description (full width, NO FIXED HEIGHT)
        tk.Label(form_container, text="Description:", anchor='w', fg="black", bg="#f8f8f8").grid(
            row=gridrow, column=0, sticky='nw', pady=(10, 2), padx=(0, 5))
        
        desc_frame = tk.Frame(form_container, bg="#f8f8f8")
        desc_frame.grid(row=gridrow, column=1, columnspan=4, sticky='ew', pady=(10, 2))
        
        # NO FIXED HEIGHT - responsive
        self.description_text = tk.Text(desc_frame, wrap="word", fg="black", bg="white", insertbackground='black')
        self.description_text.pack(side='left', fill='both', expand=True)
        self.fields['description'] = self.description_text
        
        desc_scroll = ttk.Scrollbar(desc_frame, orient="vertical", command=self.description_text.yview)
        desc_scroll.pack(side="right", fill="y")
        self.description_text.configure(yscrollcommand=desc_scroll.set)
        gridrow += 1

        # Role and Type sections (side by side)
        # Roles (left side)
        tk.Label(form_container, text="Roles:", anchor='w', fg="black", bg="#f8f8f8").grid(
            row=gridrow, column=0, sticky='nw', pady=(10, 2), padx=(0, 5))
        role_container = tk.Frame(form_container, bg="#f8f8f8")
        role_container.grid(row=gridrow, column=1, sticky='ew', pady=(10, 2), padx=(0, 10))
        
        self.role_vars = []
        for i, role in enumerate(ENTRY_ROLES):
            var = tk.BooleanVar()
            cb = tk.Checkbutton(role_container, text=role, variable=var, fg="black", bg="#f8f8f8")
            cb.grid(row=i//3, column=i%3, sticky='w', padx=2)
            self.role_vars.append((role, var))
        
        # Type (right side)
        tk.Label(form_container, text="Type:", anchor='w', fg="black", bg="#f8f8f8").grid(
            row=gridrow, column=3, sticky='nw', pady=(10, 2), padx=(10, 5))
        type_container = tk.Frame(form_container, bg="#f8f8f8")
        type_container.grid(row=gridrow, column=4, sticky='ew', pady=(10, 2))
        
        self.type_var = tk.StringVar()
        for i, t in enumerate(ENTRY_TYPES):
            rb = tk.Radiobutton(type_container, text=t, variable=self.type_var, value=t, fg="black", bg="#f8f8f8")
            rb.grid(row=i//3, column=i%3, sticky='w', padx=2)
        gridrow += 1

        # Screenplay section (full width)
        tk.Label(form_container, text="Screenplay:", anchor='w', fg="black", bg="#f8f8f8").grid(
            row=gridrow, column=0, sticky='w', pady=(10, 2), padx=(0, 5))
        screenplay_container = tk.Frame(form_container, bg="#f8f8f8")
        screenplay_container.grid(row=gridrow, column=1, columnspan=4, sticky='w', pady=(10, 2))
        
        self.screenplay_var = tk.StringVar(value="")
        for i, (label, val) in enumerate([("None", ""), ("Yes", "Yes"), ("Sole", "Sole")]):
            rb = tk.Radiobutton(screenplay_container, text=label, variable=self.screenplay_var, value=val, fg="black", bg="#f8f8f8")
            rb.pack(side="left", padx=15)
        gridrow += 1

        # Credits section (full width)
        credits_frame = ttk.LabelFrame(form_container, text="Credits")
        credits_frame.grid(row=gridrow, column=0, columnspan=5, sticky='ew', pady=10)
        self.credits_label = ttk.Label(credits_frame, text="(No credits yet)", foreground="black")
        self.credits_label.pack(anchor='w', padx=5, pady=2)
        ttk.Button(credits_frame, text="Edit Credits", command=self.edit_credits).pack(anchor='w', padx=5, pady=2)
        gridrow += 1

        # FIXED BUTTON BAR AT BOTTOM
        button_bar = ttk.Frame(parent)
        button_bar.pack(side='bottom', fill='x', pady=10, padx=10)
        
        # Button bar with separator line
        ttk.Separator(button_bar, orient='horizontal').pack(fill='x', pady=(0, 10))
        
        btns = ttk.Frame(button_bar)
        btns.pack(fill='x')
        ttk.Button(btns, text="Save Entry", command=self.save_entry).pack(side='right', padx=10)
        ttk.Button(btns, text="Clear", command=self.clear_fields).pack(side='right')

        self.switch_mode()
        self.clear_fields()

    def switch_mode(self):
        mode = self.mode_var.get()
        if mode == "video":
            self.source_label['text'] = "Video Source:"
            self.src_entry['state'] = 'normal'
            self.source_var.set('')
            # Auto-fill video thumbnail template
            self.fields['imgSrc'].set(VIDEO_THUMBNAIL_TEMPLATE)
        else:
            self.source_label['text'] = "PDF File:"
            self.src_entry['state'] = 'normal'
            self.source_var.set(f"{PDF_AUTOFILL_PREFIX}[file-name.pdf]")
            self.fields['imgSrc'].set(PDF_THUMBNAIL_PATH)

    def browse_source(self):
        mode = self.mode_var.get()
        if mode == "video":
            filetypes = [('Video files', '*.mp4 *.webm *.mov'), ('All files', '*.*')]
        else:
            filetypes = [('PDF files', '*.pdf')]
        path = filedialog.askopenfilename(filetypes=filetypes)
        if path:
            if self.mode_var.get() == "pdf":
                file_name = os.path.basename(path)
                self.source_var.set(f"{PDF_AUTOFILL_PREFIX}{file_name}")
            else:
                self.source_var.set(path)

    def fetch_info(self):
        """FIXED: Main fetch_info method with corrected playlist handling"""
        mode = self.mode_var.get()
        src = self.source_var.get()
        
        debug_log(f"=== FETCH INFO CALLED ===")
        debug_log(f"Mode: {mode}, Source: {src}")
        
        if mode == "video":
            # CRITICAL FIX: Check individual video in playlist FIRST with youtu.be support
            if self.is_individual_video_in_playlist_fixed(src):
                debug_log("Individual video in playlist detected - extracting clean URL")
                clean_url = self.extract_individual_video_url_fixed(src)
                debug_log(f"Extracted clean URL: {clean_url}")
                # Process as individual video with clean URL
                self.process_single_video(clean_url)
                return
            
            # ONLY check for pure playlists if it's not an individual video
            elif is_pure_playlist_url(src):
                debug_log("Pure playlist detected - showing playlist dialog")
                self.handle_pure_playlist(src)
                return
            
            # Regular single video
            else:
                debug_log("Regular single video detected")
                self.process_single_video(src)
                return
        
        else:
            # PDF mode
            debug_log("PDF mode processing")
            filename = os.path.basename(src)
            pdf_title = get_pdf_title(src)
            slug = slugify(pdf_title)
            self.fields['title'].set(pdf_title)
            self.fields['PDFSrc'].set(src)
            self.fields['slug'].set(slug)
            self.fields['date'].set(datetime.now().strftime('%B %d, %Y'))
            self.fields['imgSrc'].set(PDF_THUMBNAIL_PATH)
            desc_text = get_pdf_first_page_text(src)
            self.description_text.delete(1.0, tk.END)
            if desc_text:
                desc_snippet = re.sub(r'\s+', ' ', desc_text).strip()[:300]
                self.description_text.insert(tk.END, desc_snippet)

    def is_individual_video_in_playlist_fixed(self, url):
        """FIXED: Detect individual video in playlist including youtu.be format"""
        if not url:
            return False
        
        debug_log(f"Checking if individual video in playlist: {url}")
        
        # YouTube video in playlist - has BOTH 'v' and 'list' parameters (youtube.com)
        if 'youtube.com' in url:
            parsed = parse_qs(urlparse(url).query)
            is_individual = 'list' in parsed and 'v' in parsed
            debug_log(f"YouTube individual check: list={('list' in parsed)}, v={('v' in parsed)}, individual={is_individual}")
            return is_individual
        
        # FIXED: Handle youtu.be format with playlist
        elif 'youtu.be' in url:
            parsed_url = urlparse(url)
            # youtu.be has video ID in path and playlist in query
            has_video_id = bool(parsed_url.path.strip('/'))
            query_params = parse_qs(parsed_url.query)
            has_playlist = 'list' in query_params
            is_individual = has_video_id and has_playlist
            debug_log(f"youtu.be individual check: video_id={has_video_id}, list={has_playlist}, individual={is_individual}")
            return is_individual
        
        debug_log("Not an individual video in playlist")
        return False

    def extract_individual_video_url_fixed(self, url):
        """FIXED: Extract clean individual video URL including youtu.be format"""
        debug_log(f"Extracting individual video URL from: {url}")
        
        if 'youtube.com' in url:
            parsed = urlparse(url)
            query_params = parse_qs(parsed.query)
            if 'v' in query_params:
                video_id = query_params['v'][0]
                clean_url = f"https://www.youtube.com/watch?v={video_id}"
                debug_log(f"Extracted clean YouTube URL: {clean_url}")
                return clean_url
        
        # FIXED: Handle youtu.be format
        elif 'youtu.be' in url:
            parsed_url = urlparse(url)
            video_id = parsed_url.path.strip('/')
            if video_id:
                clean_url = f"https://www.youtube.com/watch?v={video_id}"
                debug_log(f"Extracted clean youtu.be URL: {clean_url}")
                return clean_url
        
        debug_log(f"No extraction needed, returning original: {url}")
        return url

    def process_single_video(self, video_url):
        """Process a single video URL and populate form fields"""
        debug_log(f"Processing single video: {video_url}")
        
        embed_src = detect_and_embed_video(video_url)
        self.fields['videoSrc'].set(embed_src)
        
        if video_url.startswith('http'):
            info = get_video_info(video_url)
            title = info.get('title', '')
            date = info.get('date', '')
            desc = info.get('description', '')
            thumbnail_url = info.get('thumbnail', '')
            
            if not thumbnail_url:
                thumbnail_url = fetch_thumbnail_oembed(video_url)
            
            if date:
                date = parse_video_date(date, title, video_url)
                
            slug = slugify(title) if title else ""
        else:
            filename = os.path.basename(video_url)
            base, _ = os.path.splitext(filename)
            title = base
            slug = slugify(base)
            date = datetime.now().strftime('%B %d, %Y')
            thumbnail_url = ""

        # Only update imgSrc if it's still the template or empty
        current_img = self.fields['imgSrc'].get()
        if not current_img or current_img == VIDEO_THUMBNAIL_TEMPLATE:
            self.fields['imgSrc'].set(thumbnail_url)
        
        self.fields['title'].set(title)
        self.fields['slug'].set(slug)
        self.fields['date'].set(date)
        self.description_text.delete(1.0, tk.END)
        self.description_text.insert(tk.END, desc)
        
        # Update source field with processed URL
        self.source_var.set(video_url)
        
        debug_log(f"Single video processing complete: {title}")

    def handle_pure_playlist(self, playlist_url):
        """Handle pure playlist URLs by showing dialog"""
        debug_log(f"Handling pure playlist: {playlist_url}")
        
        playlist_info = get_playlist_info(playlist_url)
        if not playlist_info:
            messagebox.showerror("Playlist Error", "Failed to retrieve playlist information.")
            return
        
        debug_log(f"Playlist info retrieved: {playlist_info['title']} with {playlist_info['count']} videos")
        
        # Show playlist dialog with reference to this app instance
        dialog = PlaylistDialog(self, playlist_info, playlist_url, self)
        # Dialog will handle processing via self.process_playlist_videos()

    def process_playlist_videos(self, playlist_info, selected_indices, original_url):
        """FIXED: Use simple dialog approach like regular preview generation"""
        debug_log(f"=== PROCESSING PLAYLIST VIDEOS ===")
        debug_log(f"Selected indices: {selected_indices}")
        
        videos_to_process = [playlist_info['entries'][i] for i in selected_indices]
        
        if not videos_to_process:
            debug_log("No videos to process")
            return
        
        # Show simple generating dialog immediately (like regular preview)
        self.playlist_generating_dialog = GeneratingDialog(self)
        self.playlist_generating_dialog.message_label.config(text=f"Processing {len(videos_to_process)} playlist videos...")
        
        # Use the same global status approach as regular preview generation
        global generation_status
        generation_status['in_progress'] = True
        generation_status['completed'] = False
        generation_status['result_path'] = None
        generation_status['error'] = None
        
        def process_videos_background():
            """Background processing function"""
            try:
                processed_count = 0
                skipped_count = 0
                
                for i, entry in enumerate(videos_to_process):
                    video_title = entry.get('title', f'Video {i+1}')
                    debug_log(f"Processing video {i+1}/{len(videos_to_process)}: {video_title}")
                    
                    try:
                        # Construct video URL
                        video_url = self.construct_video_url_from_entry(entry, original_url)
                        debug_log(f"Constructed URL: {video_url}")
                        
                        if not video_url:
                            debug_log("Failed to construct video URL")
                            skipped_count += 1
                            continue
                        
                        # Check for duplicates (on main thread)
                        existing_slugs = [item.get('slug', '') for item in self.data]
                        potential_slug = slugify(video_title)
                        
                        if potential_slug in existing_slugs:
                            # Handle duplicate check on main thread
                            duplicate_result = {'result': None}
                            
                            def ask_duplicate():
                                duplicate_result['result'] = messagebox.askyesnocancel(
                                    "Duplicate Found", 
                                    f"Entry with slug '{potential_slug}' already exists.\n\n"
                                    f"Yes: Update existing entry\n"
                                    f"No: Skip this video\n"
                                    f"Cancel: Stop processing"
                                )
                            
                            # Run on main thread and wait for result
                            self.after_idle(ask_duplicate)
                            
                            # Wait for user response
                            while duplicate_result['result'] is None:
                                time.sleep(0.1)
                            
                            if duplicate_result['result'] is None:  # Cancel
                                debug_log("Processing cancelled due to duplicate")
                                break
                            elif duplicate_result['result'] is False:  # Skip
                                debug_log(f"Skipping duplicate: {potential_slug}")
                                skipped_count += 1
                                continue
                        
                        # Get video info
                        info = get_video_info(video_url)
                        if not info:
                            debug_log("Failed to get video info")
                            skipped_count += 1
                            continue
                        
                        # Create entry
                        embed_src = detect_and_embed_video(video_url)
                        thumbnail_url = info.get('thumbnail', '')
                        if not thumbnail_url:
                            thumbnail_url = fetch_thumbnail_oembed(video_url)
                        
                        title = info.get('title', video_title)
                        date = info.get('date', '')
                        if date:
                            date = parse_video_date(date, title, video_url)
                        else:
                            date = datetime.now().strftime('%B %d, %Y')
                        
                        slug = slugify(title)
                        desc = info.get('description', '')
                        
                        new_entry = {
                            "imgSrc": ensure_leading_slash_if_local(thumbnail_url) if thumbnail_url else VIDEO_THUMBNAIL_TEMPLATE,
                            "previewSrc": "",
                            "videoSrc": ensure_leading_slash_if_local(embed_src),
                            "PDFSrc": "",
                            "slug": slug,
                            "title": title,
                            "date": date,
                            "role": "",
                            "description": desc,
                            "credits": {},
                            "type": "",
                            "Screenplay": ""
                        }
                        
                        debug_log(f"Created entry for: {title}")
                        
                        # Add or update entry
                        updated = False
                        for idx, existing_entry in enumerate(self.data):
                            if existing_entry.get('slug') == slug:
                                self.data[idx] = new_entry
                                updated = True
                                break
                        
                        if not updated:
                            self.data.append(new_entry)
                        
                        # Generate preview
                        try:
                            preview_path = self.generate_preview_sync(video_url, slug)
                            if preview_path:
                                new_entry["previewSrc"] = ensure_leading_slash_if_local(preview_path)
                                # Update the entry in data
                                if updated:
                                    for idx, existing_entry in enumerate(self.data):
                                        if existing_entry.get('slug') == slug:
                                            self.data[idx] = new_entry
                                            break
                                debug_log(f"Preview generated for: {title}")
                            else:
                                debug_log(f"Preview generation failed for: {title}")
                        except Exception as e:
                            debug_log(f"Preview generation error for {title}: {e}")
                        
                        processed_count += 1
                        
                    except Exception as e:
                        debug_log(f"Error processing video {i+1}: {e}")
                        skipped_count += 1
                        continue
                
                # Set completion status (like regular preview generation)
                generation_status['in_progress'] = False
                generation_status['completed'] = True
                generation_status['result_path'] = f"Processed {processed_count} videos"
                if skipped_count > 0:
                    generation_status['result_path'] += f", skipped {skipped_count}"
                    
            except Exception as e:
                debug_log(f"Error in video processing thread: {e}")
                generation_status['error'] = str(e)
                generation_status['in_progress'] = False
                generation_status['completed'] = True
        
        # Start background thread
        debug_log("Starting background processing thread")
        threading.Thread(target=process_videos_background, daemon=True).start()
        
        # Start checking for completion (same as regular preview)
        self.check_playlist_generation_status()

    def check_playlist_generation_status(self):
        """Check playlist generation status (same pattern as regular preview)"""
        global generation_status
        
        if generation_status['completed']:
            # Close the generating dialog
            if hasattr(self, 'playlist_generating_dialog') and self.playlist_generating_dialog:
                self.playlist_generating_dialog.close_dialog()
                self.playlist_generating_dialog = None
            
            if generation_status['error']:
                messagebox.showerror("Playlist Processing Error", f"Failed to process playlist:\n{generation_status['error']}")
            else:
                # Save data and update UI
                save_data(self.data)
                self.data_tab.data = self.data
                self.data_tab.populate_tiles()
                
                # Show success message
                result_msg = f"Playlist processing complete!\n\n{generation_status['result_path']}\n\nEntries saved to {DATA_JSON_PATH}"
                messagebox.showinfo("Processing Complete", result_msg)
            
            # Reset status
            generation_status['completed'] = False
            generation_status['in_progress'] = False
            generation_status['result_path'] = None
            generation_status['error'] = None
            
        elif generation_status['in_progress']:
            # Still processing, check again in 500ms
            self.after(500, self.check_playlist_generation_status)

    def construct_video_url_from_entry(self, entry, original_url):
        """Construct individual video URL from playlist entry"""
        if 'url' in entry:
            return entry['url']
        elif 'webpage_url' in entry:
            return entry['webpage_url']
        elif 'id' in entry:
            # Construct URL from ID based on platform
            if 'youtube.com' in original_url:
                return f"https://www.youtube.com/watch?v={entry['id']}"
            elif 'vimeo.com' in original_url:
                return f"https://vimeo.com/{entry['id']}"
        return None

    def generate_preview_sync(self, video_url, slug):
        """Generate preview synchronously for playlist processing"""
        debug_log(f"Generating preview for: {slug}")
        
        try:
            output_dir = PREVIEW_DIR
            os.makedirs(output_dir, exist_ok=True)
            ext = PREVIEW_EXTENSION
            output_name = f"{slug}-preview{ext}"
            output_path = os.path.join(output_dir, output_name)
            
            # Get tools
            ffmpeg_path, ffprobe_path = get_ffmpeg_tools()
            
            # Download video if it's a URL
            temp_file = None
            input_file = video_url
            
            if video_url.startswith('http'):
                if not YoutubeDL:
                    debug_log("YoutubeDL not available")
                    return None
                    
                with tempfile.TemporaryDirectory() as dl_temp_dir:
                    temp_file = os.path.join(dl_temp_dir, "downloaded_video.mp4")
                    
                    ydl_opts = {
                        'quiet': True,
                        'outtmpl': temp_file,
                        'format': 'bestvideo[height<=1080][ext=mp4]/bestvideo[height<=1080]/best[height<=1080]',
                        'noplaylist': True,
                    }
                    
                    if ffmpeg_path != 'ffmpeg':
                        ydl_opts['ffmpeg_location'] = os.path.dirname(ffmpeg_path)
                    
                    with YoutubeDL(ydl_opts) as ydl:
                        ydl.download([video_url])
                    
                    if not os.path.exists(temp_file) or os.path.getsize(temp_file) < 1000:
                        candidates = [f for f in os.listdir(dl_temp_dir) if f.endswith(('.mp4', '.webm', '.mkv'))]
                        if candidates:
                            temp_file = os.path.join(dl_temp_dir, candidates[0])
                        else:
                            debug_log("No video file downloaded")
                            return None
                    
                    # Copy to persistent temp file
                    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
                        shutil.copyfile(temp_file, tmp.name)
                        temp_file = tmp.name
                    input_file = temp_file
            
            # Get duration
            duration_cmd = [ffprobe_path, "-v", "error", "-show_entries", "format=duration", "-of",
                           "default=noprint_wrappers=1:nokey=1", input_file]
            result = subprocess.run(duration_cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode != 0:
                debug_log(f"ffprobe failed: {result.stderr}")
                return None
            
            duration = int(float(result.stdout.strip()))
            debug_log(f"Video duration: {duration}s")
            
            # Use configured settings for preview generation
            num_clips = PREVIEW_NUM_MINI_CLIPS
            clip_length = PREVIEW_MINI_CLIP_LENGTH
            start_trim = calculate_trim_seconds(PREVIEW_START_SECONDS, duration)
            end_trim = calculate_trim_seconds(PREVIEW_END_SECONDS, duration)
            working_duration = duration - start_trim - end_trim
            
            if working_duration < num_clips * clip_length:
                debug_log("Video too short for preview")
                return None
            
            # Generate clips
            interval = int(working_duration / num_clips)
            miniclips = []
            tmp_dir = tempfile.mkdtemp()
            
            for i in range(num_clips):
                start = start_trim + i * interval
                mini_out = os.path.join(tmp_dir, f"mini_{i}{ext}")
                
                ffmpeg_cmd = [
                    ffmpeg_path, "-y", "-ss", str(start), "-i", input_file, "-t", str(clip_length),
                    "-c:v", "libvpx-vp9", "-crf", str(PREVIEW_CRF), "-b:v", PREVIEW_BITRATE, 
                    "-preset", PREVIEW_PRESET, mini_out
                ]

                # Add audio and resolution based on settings
                if not PREVIEW_INCLUDE_AUDIO:
                    ffmpeg_cmd.insert(-1, "-an")
                if PREVIEW_RESOLUTION:
                    ffmpeg_cmd.insert(-1, "-vf")
                    ffmpeg_cmd.insert(-1, f"scale={PREVIEW_RESOLUTION}:-2")
                
                result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, timeout=30)
                if result.returncode == 0:
                    miniclips.append(mini_out)
            
            if not miniclips:
                debug_log("No clips generated")
                return None
            
            # Concatenate clips
            concat_file = os.path.join(tmp_dir, "concat.txt")
            with open(concat_file, "w") as f:
                for m in miniclips:
                    f.write(f"file '{m}'\n")
            
            ffmpeg_concat_cmd = [
                ffmpeg_path, "-y", "-f", "concat", "-safe", "0", "-i",
                concat_file, "-c", "copy", output_path
            ]
            result = subprocess.run(ffmpeg_concat_cmd, capture_output=True, text=True, timeout=30)
            
            # Cleanup
            shutil.rmtree(tmp_dir)
            if temp_file and os.path.exists(temp_file):
                os.remove(temp_file)
            
            if result.returncode == 0 and os.path.exists(output_path):
                debug_log(f"Preview generated successfully: {output_path}")
                return os.path.relpath(output_path)
            else:
                debug_log(f"Preview generation failed: {result.stderr}")
            
        except Exception as e:
            debug_log(f"Sync preview generation error: {e}")
            
        return None

    def clear_fields(self):
        for key, var in self.fields.items():
            if key == "description":
                var.delete(1.0, tk.END)
            else:
                var.set('')
        self.credits = {}
        self.update_credits_label()
        self.source_var.set('')
        self.editing_idx = None
        if self.mode_var.get() == "pdf":
            self.fields['imgSrc'].set(PDF_THUMBNAIL_PATH)
            self.source_var.set(f"{PDF_AUTOFILL_PREFIX}[file-name.pdf]")
        else:
            self.fields['imgSrc'].set(VIDEO_THUMBNAIL_TEMPLATE)
        for _, var in self.role_vars:
            var.set(False)
        self.type_var.set("")
        self.screenplay_var.set("")

    def update_credits_label(self):
        if not self.credits:
            self.credits_label.config(text="(No credits yet)")
            return
        lines = []
        for role, names in self.credits.items():
            lines.append(f"{role}: {', '.join(names)}")
        self.credits_label.config(text="\n".join(lines))

    def edit_credits(self):
        editor = CreditsEditor(self, self.credits)
        self.wait_window(editor)
        self.credits = editor.credits
        self.update_credits_label()

    def check_generation_status(self):
        """Check if generation is complete and update UI accordingly"""
        global generation_status
        
        if generation_status['completed']:
            # Generation is done, close dialog and show result
            if self.generating_dialog:
                self.generating_dialog.close_dialog()
                self.generating_dialog = None
            
            if generation_status['error']:
                messagebox.showerror("Preview Error", f"Failed to generate preview:\n{generation_status['error']}")
            elif generation_status['result_path']:
                self.fields["previewSrc"].set(ensure_leading_slash_if_local(generation_status['result_path']))
                messagebox.showinfo("Preview Generated", f"Preview file created at {generation_status['result_path']}")
            
            # Reset status
            generation_status['completed'] = False
            generation_status['in_progress'] = False
            generation_status['result_path'] = None
            generation_status['error'] = None
        elif generation_status['in_progress']:
            # Still generating, check again in 500ms
            self.after(500, self.check_generation_status)

    def generate_preview_for_current(self):
        global generation_status
        
        src = self.source_var.get()
        slug = self.fields.get("slug").get() or "preview"
        if not src:
            messagebox.showerror("No source", "Please specify a source file or URL first.")
            return
        
        # Show generating dialog immediately
        self.generating_dialog = GeneratingDialog(self)
        
        # Start background generation
        thread = threading.Thread(target=generate_preview_background, args=(src, slug), daemon=True)
        thread.start()
        
        # Start checking for completion
        self.check_generation_status()

    def save_entry(self):
        def add_slash_if_local(path):
            return ensure_leading_slash_if_local(path) if path else ""

        roles_selected = [role for role, var in self.role_vars if var.get()]
        joined_roles = "/".join(roles_selected)

        entry = {
            "imgSrc": add_slash_if_local(self.fields['imgSrc'].get()),
            "previewSrc": add_slash_if_local(self.fields['previewSrc'].get()),
            "videoSrc": add_slash_if_local(self.fields['videoSrc'].get()),
            "PDFSrc": add_slash_if_local(self.fields['PDFSrc'].get()),
            "slug": self.fields['slug'].get(),
            "title": self.fields['title'].get(),
            "date": self.fields['date'].get(),
            "role": joined_roles,
            "description": self.description_text.get(1.0, tk.END).rstrip(),
            "credits": self.credits.copy(),
            "type": self.type_var.get(),
            "Screenplay": self.screenplay_var.get()
        }
        if not entry["title"] or not entry["slug"]:
            messagebox.showerror("Missing fields", "Title and slug are required.")
            return

        if self.editing_idx is not None:
            self.data[self.editing_idx] = entry
            self.editing_idx = None
        else:
            for idx, obj in enumerate(self.data):
                if obj.get("slug") == entry["slug"]:
                    self.data[idx] = entry
                    break
            else:
                self.data.append(entry)

        save_data(self.data)
        self.data_tab.data = self.data
        self.data_tab.populate_tiles()
        messagebox.showinfo("Saved", f"Entry saved to {DATA_JSON_PATH}.")
        self.clear_fields()

    def _on_data_update(self, new_data):
        self.data = new_data
        save_data(self.data)

if __name__ == '__main__':
    app = ContentEntryCreatorApp()
    app.mainloop()