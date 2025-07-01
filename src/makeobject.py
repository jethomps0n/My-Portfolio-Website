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
PDF_THUMBNAIL_PATH = "/resources/images/screenplay-thumbnail.webp"
PDF_AUTOFILL_PREFIX = "https://files.itsjonathanthompson.com/screenplays/"

# ===== WINDOW SIZE VARIABLE =====
DEFAULT_WINDOW_WIDTH = 1000
DEFAULT_WINDOW_HEIGHT = 800

ENTRY_TYPES = [
    "Short Film", "Rescore", "Advertisement", "Documentary",
    "Video Essay", "Feature Film", "Audio Mix", "Show"
]
ENTRY_ROLES = [
    "Writer", "Editor", "Director", "Producer", "DP",
    "Camera Operator", "Production Assistant", "Sound Recordist", "Actor"
]

os.makedirs(PREVIEW_DIR, exist_ok=True)

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

def get_video_info(url):
    if YoutubeDL is None:
        return {}
    ydl_opts = {
        'quiet': True,
        'skip_download': True,
        'force_generic_extractor': False,
        'extract_flat': False
    }
    with YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
            return {
                'title': info.get('title', ''),
                'date': info.get('upload_date', ''),
                'description': info.get('description', ''),
                'thumbnail': info.get('thumbnail', '')
            }
        except Exception as e:
            print(f"Failed to fetch video info: {e}")
            return {}

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

def generate_preview(input_path_or_url, slug="preview", output_dir=PREVIEW_DIR):
    os.makedirs(output_dir, exist_ok=True)
    ext = PREVIEW_EXTENSION
    output_name = f"{slug}-preview{ext}"
    output_path = os.path.join(output_dir, output_name)

    startseconds = 20
    numminiclips = 5
    minicliplength = 2
    crf = 23
    bitrate = "5M"
    preset = "fast"
    audiotoggle = False
    resolution = None

    is_url = re.match(r'^https?://', input_path_or_url)
    temp_file = None
    input_file = input_path_or_url
    try:
        if is_url:
            if not YoutubeDL:
                raise Exception("yt-dlp not installed, cannot download video URLs")
            with tempfile.TemporaryDirectory() as dl_temp_dir:
                temp_file = os.path.join(dl_temp_dir, "downloaded_video.mp4")
                ydl_opts = {
                    'quiet': True,
                    'outtmpl': temp_file,
                    'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/mp4',
                    'merge_output_format': 'mp4',
                    'noplaylist': True,
                }
                with YoutubeDL(ydl_opts) as ydl:
                    ydl.download([input_path_or_url])
                if not os.path.exists(temp_file) or os.path.getsize(temp_file) < 1000:
                    candidates = [f for f in os.listdir(dl_temp_dir) if f.endswith('.mp4')]
                    if candidates:
                        temp_file = os.path.join(dl_temp_dir, candidates[0])
                if not os.path.exists(temp_file) or os.path.getsize(temp_file) < 1000:
                    print("yt-dlp did not download the video correctly.")
                    return None
                with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
                    shutil.copyfile(temp_file, tmp.name)
                    temp_file = tmp.name
                input_file = temp_file

        if not os.path.exists(input_file) or os.path.getsize(input_file) < 1000:
            print("yt-dlp did not download the video correctly.")
            return None

        try:
            result = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of",
                 "default=noprint_wrappers=1:nokey=1", input_file],
                capture_output=True, text=True, check=True)
            duration = int(float(result.stdout.strip()))
        except Exception as e:
            print("Failed to retrieve video duration:", e)
            return None
        if duration < (startseconds + minicliplength * numminiclips):
            print("Video too short for preview.")
            return None

        interval = int((duration - startseconds) / numminiclips)
        miniclips = []
        tmp_dir = tempfile.mkdtemp()
        for i in range(numminiclips):
            start = startseconds + i * interval
            mini_out = os.path.join(tmp_dir, f"mini_{i}{ext}")
            if ext == ".webm":
                ffmpeg_cmd = [
                    "ffmpeg", "-y",
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
                    "ffmpeg", "-y",
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
            subprocess.run(ffmpeg_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
            miniclips.append(mini_out)

        concat_file = os.path.join(tmp_dir, "concat.txt")
        with open(concat_file, "w") as f:
            for m in miniclips:
                f.write(f"file '{m}'\n")
        ffmpeg_concat_cmd = [
            "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i",
            concat_file, "-c", "copy", output_path
        ]
        subprocess.run(ffmpeg_concat_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)

        shutil.rmtree(tmp_dir)
        if temp_file and os.path.exists(temp_file):
            os.remove(temp_file)
        return os.path.relpath(output_path)
    except Exception as e:
        print("Error generating preview:", e)
        if temp_file and os.path.exists(temp_file):
            os.remove(temp_file)
        return None

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

class CreditsEditor(tk.Toplevel):
    def __init__(self, master, credits, on_save=None):
        super().__init__(master)
        self.title("Edit Credits")
        self.geometry("400x400")
        self.credits = credits.copy()
        self.role_vars = []
        self.name_vars = []
        self.rows = []
        self.on_save = on_save
        self.configure(bg="#f8f8f8")
        self.setup_ui()

    def setup_ui(self):
        self.frame = ttk.Frame(self)
        self.frame.pack(fill='both', expand=True, padx=10, pady=10)
        header = ttk.Frame(self.frame)
        header.pack(fill='x')
        ttk.Label(header, text="Role", width=15, foreground="black").pack(side='left')
        ttk.Label(header, text="Names (comma separated)", foreground="black").pack(side='left')
        ttk.Label(header, text="Move", width=15, foreground="black").pack(side='left')
        for role, names in list(self.credits.items()):
            self.add_row(role, ", ".join(names))
        add_btn = ttk.Button(self.frame, text="Add Role", command=lambda: self.add_row("", ""))
        add_btn.pack(pady=10)
        btns = ttk.Frame(self.frame)
        btns.pack(side='bottom', fill='x', pady=10)
        ttk.Button(btns, text="Save", command=self.save).pack(side='right', padx=5)
        ttk.Button(btns, text="Cancel", command=self.cancel).pack(side='right')

    def add_row(self, role, names):
        row = ttk.Frame(self.frame)
        row.pack(fill='x', pady=2)
        role_var = tk.StringVar(value=role)
        name_var = tk.StringVar(value=names)
        self.role_vars.append(role_var)
        self.name_vars.append(name_var)
        self.rows.append(row)
        e1 = tk.Entry(row, textvariable=role_var, width=15, insertbackground='black', fg="black", bg="#f8f8f8")
        e2 = tk.Entry(row, textvariable=name_var, insertbackground='black', fg="black", bg="#f8f8f8")
        e1.pack(side='left')
        e2.pack(side='left', fill='x', expand=True)
        move_frame = tk.Frame(row, bg="#f8f8f8")
        move_frame.pack(side='left', padx=10)
        btn_up = ttk.Button(move_frame, text="↑", width=2, command=lambda r=row: self.move_row(r, -1))
        btn_down = ttk.Button(move_frame, text="↓", width=2, command=lambda r=row: self.move_row(r, 1))
        btn_up.pack(side='left')
        btn_down.pack(side='left')
        ttk.Button(row, text="Remove", command=lambda: self.remove_row(row, role_var, name_var)).pack(side='left')

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
        self.destroy()

class TileEditor(tk.Toplevel):
    def __init__(self, master, entry, on_save, on_delete):
        super().__init__(master)
        self.title("Edit Entry")
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
        frame = tk.Frame(self)
        frame.pack(fill='both', expand=True, padx=10, pady=10)
        label_opts = {"fg": "black", "bg": "#f8f8f8"}
        width = 28

        gridrow = 0
        for key in ["imgSrc", "previewSrc", "videoSrc", "PDFSrc", "slug", "title", "date"]:
            tk.Label(frame, text=key, width=10, anchor='w', **label_opts).grid(row=gridrow, column=0, sticky='w')
            var = tk.StringVar(value=str(self.entry.get(key, "")))
            ent = tk.Entry(frame, textvariable=var, width=width, fg="black", bg="#f8f8f8")
            ent.grid(row=gridrow, column=1, sticky='ew')
            self.vars[key] = var
            gridrow += 1

        tk.Label(frame, text="role", width=10, anchor='w', **label_opts).grid(row=gridrow, column=0, sticky='w')
        role_frame = tk.Frame(frame, bg="#f8f8f8")
        role_frame.grid(row=gridrow, column=1, sticky='w')
        current_roles = (self.entry.get('role') or "").split("/")
        self.role_vars = []
        for role in ENTRY_ROLES:
            var = tk.BooleanVar()
            if role in current_roles:
                var.set(True)
            cb = tk.Checkbutton(role_frame, text=role, variable=var, fg="black", bg="#f8f8f8")
            cb.pack(side='left')
            self.role_vars.append((role, var))
        gridrow += 1

        tk.Label(frame, text="description", width=10, anchor='w', **label_opts).grid(row=gridrow, column=0, sticky='nw')
        desc_text = tk.Text(frame, height=4, width=width, fg="black", bg="#f8f8f8", wrap="word")
        desc_val = self.entry.get("description", "")
        desc_text.insert("1.0", desc_val)
        desc_text.grid(row=gridrow, column=1, sticky='ew')
        self.vars["description"] = desc_text
        gridrow += 1

        credits_btn = ttk.Button(frame, text="Edit Credits", command=self.open_credits_editor)
        credits_btn.grid(row=gridrow, column=0, columnspan=2, sticky='w', pady=5)
        gridrow += 1

        tk.Label(frame, text="type", width=10, anchor='w', **label_opts).grid(row=gridrow, column=0, sticky='w')
        type_frame = tk.Frame(frame, bg="#f8f8f8")
        type_frame.grid(row=gridrow, column=1, sticky='w')
        current_type = self.entry.get("type", "")
        self.type_var.set(current_type)
        for t in ENTRY_TYPES:
            rb = tk.Radiobutton(type_frame, text=t, variable=self.type_var, value=t, fg="black", bg="#f8f8f8")
            rb.pack(side="left")
        gridrow += 1

        tk.Label(frame, text="Screenplay", width=10, anchor='w', **label_opts).grid(row=gridrow, column=0, sticky='w')
        screenplay_frame = tk.Frame(frame, bg="#f8f8f8")
        screenplay_frame.grid(row=gridrow, column=1, sticky='w')
        current_screenplay = self.entry.get("Screenplay", "")
        self.screenplay_var.set(current_screenplay)
        for label, val in [("None", ""), ("Yes", "Yes"), ("Sole", "Sole")]:
            rb = tk.Radiobutton(screenplay_frame, text=label, variable=self.screenplay_var, value=val, fg="black", bg="#f8f8f8")
            rb.pack(side="left")
        gridrow += 1

        btns = tk.Frame(self)
        btns.pack(fill='x', pady=5)
        ttk.Button(btns, text="Delete", command=self.confirm_delete).pack(side='left', padx=5)
        ttk.Button(btns, text="Save", command=self.save).pack(side='right', padx=5)
        ttk.Button(btns, text="Cancel", command=self.destroy).pack(side='right')

    def open_credits_editor(self):
        def credits_callback(new_credits):
            self.credits = new_credits
        CreditsEditor(self, self.credits, on_save=credits_callback).grab_set()

    def confirm_delete(self):
        if messagebox.askyesno("Delete", "Are you sure you want to delete this entry?"):
            self.on_delete(self.entry)
            self.destroy()

    def save(self):
        for key in ["imgSrc", "previewSrc", "videoSrc", "PDFSrc", "slug", "title", "date"]:
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
        self.canvas = tk.Canvas(self, borderwidth=0, background="#f8f8f8")
        self.frame = tk.Frame(self.canvas, background="#f8f8f8")
        self.scroll = ttk.Scrollbar(self, orient="vertical", command=self.canvas.yview)
        self.canvas.configure(yscrollcommand=self.scroll.set)
        self.scroll.pack(side="right", fill="y")
        self.canvas.pack(side="left", fill="both", expand=True)
        self.canvas.create_window((0, 0), window=self.frame, anchor='nw')
        self.frame.bind("<Configure>", lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all")))
        self.populate_tiles()

    def populate_tiles(self):
        for widget in self.frame.winfo_children():
            widget.destroy()
        self.tiles.clear()
        for idx, entry in enumerate(self.data):
            tile = tk.Frame(self.frame, relief="groove", borderwidth=2, bg="#f4f4f4")
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
        self.frame.update_idletasks()

    def edit_entry(self, idx):
        def on_save(updated_entry):
            self.data[idx] = updated_entry
            self.on_entry_update(self.data)
            self.populate_tiles()
        def on_delete(entry):
            del self.data[idx]
            self.on_entry_update(self.data)
            self.populate_tiles()
        TileEditor(self, dict(self.data[idx]), on_save, on_delete).grab_set()

class ContentEntryApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Content Entry Creator")
        self.geometry(f"{DEFAULT_WINDOW_WIDTH}x{DEFAULT_WINDOW_HEIGHT}")
        self.minsize(600, 600)
        self.configure(bg="#f8f8f8")
        self.style = ttk.Style(self)
        self.style.theme_use("clam")
        self.data = load_data()
        self.credits = {}
        self.editing_idx = None
        self.create_widgets()

    def create_widgets(self):
        self.tabs = ttk.Notebook(self)
        self.tabs.pack(expand=True, fill='both')

        self.entry_tab = ttk.Frame(self.tabs)
        self.tabs.add(self.entry_tab, text="Create/Edit Entry")
        self._setup_entry_tab(self.entry_tab)

        self.data_tab = DataJsonViewer(self.tabs, self.data, self._on_data_update)
        self.tabs.add(self.data_tab, text="View/Edit data.json")

    def _setup_entry_tab(self, parent):
        self.mode_var = tk.StringVar(value="video")
        mode_frame = ttk.LabelFrame(parent, text="Start from")
        mode_frame.pack(fill='x', padx=10, pady=5)
        ttk.Radiobutton(mode_frame, text="Video", variable=self.mode_var, value="video", command=self.switch_mode).pack(side='left', padx=10)
        ttk.Radiobutton(mode_frame, text="PDF", variable=self.mode_var, value="pdf", command=self.switch_mode).pack(side='left', padx=10)

        self.fields = {}
        form = tk.Frame(parent, bg="#f8f8f8")
        form.pack(fill='both', expand=True, padx=10, pady=5)

        def add_field(label, var_type=tk.StringVar, **kwargs):
            row = tk.Frame(form, bg="#f8f8f8")
            row.pack(fill='x', pady=3)
            tk.Label(row, text=label, width=10, anchor='w', fg="black", bg="#f8f8f8").pack(side='left')
            var = var_type()
            entry = tk.Entry(row, textvariable=var, insertbackground='black', fg="black", bg="#f8f8f8", width=28, **kwargs)
            entry.pack(side='left', fill='x', expand=True)
            self.fields[label] = var
            return entry

        self.source_label = tk.Label(form, text="Video Source:", fg="black", bg="#f8f8f8")
        self.source_label.pack(anchor='w')
        self.source_var = tk.StringVar()
        src_row = tk.Frame(form, bg="#f8f8f8")
        src_row.pack(fill='x', pady=3)
        self.src_entry = tk.Entry(src_row, textvariable=self.source_var, insertbackground='black', fg="black", bg="#f8f8f8", width=28)
        self.src_entry.pack(side='left', fill='x', expand=True)
        ttk.Button(src_row, text="Browse...", command=self.browse_source).pack(side='left', padx=3)
        ttk.Button(src_row, text="Fetch Info", command=self.fetch_info).pack(side='left', padx=3)
        ttk.Button(src_row, text="Generate Preview", command=self.generate_preview_for_current).pack(side='left', padx=3)

        self.img_entry = add_field("imgSrc")
        self.preview_entry = add_field("previewSrc")
        self.video_entry = add_field("videoSrc")
        self.pdf_entry = add_field("PDFSrc")
        self.slug_entry = add_field("slug")
        self.title_entry = add_field("title")
        self.date_entry = add_field("date")

        roles_frame = tk.Frame(form, bg="#f8f8f8")
        roles_frame.pack(fill='x', pady=3)
        tk.Label(roles_frame, text="role", width=10, anchor='w', fg="black", bg="#f8f8f8").pack(side='left')
        self.role_vars = []
        for role in ENTRY_ROLES:
            var = tk.BooleanVar()
            cb = tk.Checkbutton(roles_frame, text=role, variable=var, fg="black", bg="#f8f8f8")
            cb.pack(side='left')
            self.role_vars.append((role, var))
        self.fields['role'] = tk.StringVar()

        row = tk.Frame(form, bg="#f8f8f8")
        row.pack(fill='both', pady=3, expand=True)
        tk.Label(row, text="description", width=10, anchor='nw', fg="black", bg="#f8f8f8").pack(side='left', anchor='n')
        self.description_text = tk.Text(row, height=6, wrap="word", fg="black", bg="#f8f8f8", width=28)
        self.description_text.pack(side='left', fill='both', expand=True)
        self.fields['description'] = self.description_text
        desc_scroll = ttk.Scrollbar(row, orient="vertical", command=self.description_text.yview)
        desc_scroll.pack(side="right", fill="y")
        self.description_text.configure(yscrollcommand=desc_scroll.set)

        type_frame = tk.Frame(form, bg="#f8f8f8")
        type_frame.pack(fill='x', pady=3)
        tk.Label(type_frame, text="type", width=10, anchor='w', fg="black", bg="#f8f8f8").pack(side='left')
        self.type_var = tk.StringVar()
        for t in ENTRY_TYPES:
            rb = tk.Radiobutton(type_frame, text=t, variable=self.type_var, value=t, fg="black", bg="#f8f8f8")
            rb.pack(side='left')
        self.fields['type'] = self.type_var

        screenplay_frame = tk.Frame(form, bg="#f8f8f8")
        screenplay_frame.pack(fill='x', pady=3)
        tk.Label(screenplay_frame, text="Screenplay", width=10, anchor='w', fg="black", bg="#f8f8f8").pack(side='left')
        self.screenplay_var = tk.StringVar(value="")
        for label, val in [("None", ""), ("Yes", "Yes"), ("Sole", "Sole")]:
            rb = tk.Radiobutton(screenplay_frame, text=label, variable=self.screenplay_var, value=val, fg="black", bg="#f8f8f8")
            rb.pack(side='left')
        self.fields['Screenplay'] = self.screenplay_var

        credits_frame = ttk.LabelFrame(form, text="Credits")
        credits_frame.pack(fill='x', pady=5)
        self.credits_label = ttk.Label(credits_frame, text="(No credits yet)", foreground="black")
        self.credits_label.pack(anchor='w')
        ttk.Button(credits_frame, text="Edit Credits", command=self.edit_credits).pack(anchor='w', pady=2)

        btns = ttk.Frame(parent)
        btns.pack(fill='x', pady=5)
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
        mode = self.mode_var.get()
        src = self.source_var.get()
        if mode == "video":
            embed_src = detect_and_embed_video(src)
            self.fields['videoSrc'].set(embed_src)
            thumbnail_url = ""
            title = ""
            date = ""
            desc = ""
            slug = ""

            if src.startswith('http'):
                info = get_video_info(src)
                title = info.get('title', '')
                date = info.get('date', '')
                desc = info.get('description', '')
                thumbnail_url = info.get('thumbnail', '')
                if not thumbnail_url:
                    thumbnail_url = fetch_thumbnail_oembed(src)
                if date and re.match(r'\d{8}', date):
                    date = datetime.strptime(date, '%Y%m%d').strftime('%B %d, %Y')
                slug = slugify(title) if title else ""
            else:
                filename = os.path.basename(src)
                base, _ = os.path.splitext(filename)
                title = base
                slug = slugify(base)
                date = datetime.now().strftime('%B %d, %Y')

            self.fields['imgSrc'].set(thumbnail_url)
            self.fields['title'].set(title)
            self.fields['slug'].set(slug)
            self.fields['date'].set(date)
            self.description_text.delete(1.0, tk.END)
            self.description_text.insert(tk.END, desc)
        else:
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

    def generate_preview_for_current(self):
        src = self.source_var.get()
        slug = self.fields.get("slug").get() or "preview"
        if not src:
            messagebox.showerror("No source", "Please specify a source file or URL first.")
            return
        messagebox.showinfo("Generating Preview", "This may take a moment. Please wait...")
        preview_path = generate_preview(src, slug=slug)
        if preview_path:
            self.fields["previewSrc"].set(ensure_leading_slash_if_local(preview_path))
            messagebox.showinfo("Preview Generated", f"Preview file created at {preview_path}")
        else:
            messagebox.showerror("Preview Error", "Failed to generate preview.")

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
    app = ContentEntryApp()
    app.mainloop()