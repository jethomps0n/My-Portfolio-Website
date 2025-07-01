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

# ==== USER-CONFIGURABLE VARIABLES ====
DATA_JSON_PATH = "resources/json/data.json"  # Change this to your desired data.json location
PREVIEW_DIR = "resources/videos/previews"
IMAGE_DIR = "resources/images"
PREVIEW_EXTENSION = ".webm"

os.makedirs(PREVIEW_DIR, exist_ok=True)
os.makedirs(IMAGE_DIR, exist_ok=True)

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

def get_pdf_title(pdf_path):
    if PyPDF2 is None:
        return os.path.splitext(os.path.basename(pdf_path))[0]
    try:
        with open(pdf_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            title = reader.metadata.title if reader.metadata and reader.metadata.title else None
            if title:
                return title
    except Exception as e:
        print(f"Failed to read PDF: {e}")
    return os.path.splitext(os.path.basename(pdf_path))[0]

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
            # Use libvpx for webm, libx264 for mp4
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
    # Do not add a slash if this is the data.json file itself
    if os.path.abspath(path) == os.path.abspath(DATA_JSON_PATH):
        return path
    if not path.startswith("/"):
        return "/" + path
    return path

class CreditsEditor(tk.Toplevel):
    def __init__(self, master, credits):
        super().__init__(master)
        self.title("Edit Credits")
        self.geometry("400x400")
        self.credits = credits.copy()
        self.role_vars = []
        self.name_vars = []
        self.configure(bg="#f8f8f8")
        self.setup_ui()

    def setup_ui(self):
        self.frame = ttk.Frame(self)
        self.frame.pack(fill='both', expand=True, padx=10, pady=10)
        header = ttk.Frame(self.frame)
        header.pack(fill='x')
        ttk.Label(header, text="Role", width=15).pack(side='left')
        ttk.Label(header, text="Names (comma separated)").pack(side='left')
        for role, names in self.credits.items():
            self.add_row(role, ", ".join(names))
        add_btn = ttk.Button(self.frame, text="Add Role", command=lambda: self.add_row("", ""))
        add_btn.pack(pady=10)
        btns = ttk.Frame(self.frame)
        btns.pack(side='bottom', fill='x', pady=10)
        ttk.Button(btns, text="Save", command=self.save).pack(side='right', padx=5)
        ttk.Button(btns, text="Cancel", command=self.destroy).pack(side='right')

    def add_row(self, role, names):
        row = ttk.Frame(self.frame)
        row.pack(fill='x', pady=2)
        role_var = tk.StringVar(value=role)
        name_var = tk.StringVar(value=names)
        self.role_vars.append(role_var)
        self.name_vars.append(name_var)
        e1 = tk.Entry(row, textvariable=role_var, width=15, insertbackground='black', insertofftime=300,
                      bg="#f8f8f8", fg="black", insertwidth=2)
        e2 = tk.Entry(row, textvariable=name_var, insertbackground='black', insertofftime=300,
                      bg="#f8f8f8", fg="black", insertwidth=2)
        e1.pack(side='left')
        e2.pack(side='left', fill='x', expand=True)
        ttk.Button(row, text="Remove", command=lambda: self.remove_row(row, role_var, name_var)).pack(side='left')

    def remove_row(self, row, role_var, name_var):
        row.destroy()
        idx = self.role_vars.index(role_var)
        self.role_vars.pop(idx)
        self.name_vars.pop(idx)

    def save(self):
        new_credits = {}
        for r, n in zip(self.role_vars, self.name_vars):
            role = r.get().strip()
            names = [x.strip() for x in n.get().split(",") if x.strip()]
            if role and names:
                new_credits[role] = names
        self.credits = new_credits
        self.destroy()

class ContentEntryApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Content Entry Creator")
        self.geometry("750x900")
        self.minsize(700, 700)
        self.configure(bg="#f8f8f8")
        self.style = ttk.Style(self)
        self.style.theme_use("clam")
        self.data = load_data()
        self.credits = {}
        self.create_widgets()

    def create_widgets(self):
        self.mode_var = tk.StringVar(value="video")
        mode_frame = ttk.LabelFrame(self, text="Start from")
        mode_frame.pack(fill='x', padx=10, pady=5)
        ttk.Radiobutton(mode_frame, text="Video", variable=self.mode_var, value="video", command=self.switch_mode).pack(side='left', padx=10)
        ttk.Radiobutton(mode_frame, text="PDF", variable=self.mode_var, value="pdf", command=self.switch_mode).pack(side='left', padx=10)

        self.fields = {}
        form = tk.Frame(self, bg="#f8f8f8")
        form.pack(fill='both', expand=True, padx=10, pady=5)

        def add_field(label, var_type=tk.StringVar, **kwargs):
            row = tk.Frame(form, bg="#f8f8f8")
            row.pack(fill='x', pady=3)
            tk.Label(row, text=label, width=18, anchor='w', bg="#f8f8f8", fg="black").pack(side='left')
            var = var_type()
            entry = tk.Entry(row, textvariable=var, insertbackground='black', insertofftime=300,
                             bg="#f8f8f8", fg="black", insertwidth=2, **kwargs)
            entry.pack(side='left', fill='x', expand=True)
            self.fields[label] = var
            return entry

        self.source_label = tk.Label(form, text="Video Source:", bg="#f8f8f8", fg="black")
        self.source_label.pack(anchor='w')
        self.source_var = tk.StringVar()
        src_row = tk.Frame(form, bg="#f8f8f8")
        src_row.pack(fill='x', pady=3)
        self.src_entry = tk.Entry(src_row, textvariable=self.source_var, insertbackground='black', insertofftime=300,
                                 bg="#f8f8f8", fg="black", insertwidth=2)
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
        self.role_entry = add_field("role")

        row = tk.Frame(form, bg="#f8f8f8")
        row.pack(fill='both', pady=3, expand=True)
        tk.Label(row, text="description", width=18, anchor='nw', bg="#f8f8f8", fg="black").pack(side='left', anchor='n')
        self.description_text = tk.Text(row, height=10, wrap="word",
                                        insertbackground='black', insertofftime=300,
                                        bg="#f8f8f8", fg="black", insertwidth=2)
        self.description_text.pack(side='left', fill='both', expand=True)
        self.fields['description'] = self.description_text
        desc_scroll = ttk.Scrollbar(row, orient="vertical", command=self.description_text.yview)
        desc_scroll.pack(side="right", fill="y")
        self.description_text.configure(yscrollcommand=desc_scroll.set)

        self.type_entry = add_field("type")
        self.screenplay_entry = add_field("Screenplay")

        credits_frame = ttk.LabelFrame(form, text="Credits")
        credits_frame.pack(fill='x', pady=5)
        self.credits_label = ttk.Label(credits_frame, text="(No credits yet)")
        self.credits_label.pack(anchor='w')
        ttk.Button(credits_frame, text="Edit Credits", command=self.edit_credits).pack(anchor='w', pady=2)

        btns = ttk.Frame(self)
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
        else:
            self.source_label['text'] = "PDF File:"
            self.src_entry['state'] = 'normal'

    def browse_source(self):
        mode = self.mode_var.get()
        if mode == "video":
            filetypes = [('Video files', '*.mp4 *.webm *.mov'), ('All files', '*.*')]
        else:
            filetypes = [('PDF files', '*.pdf')]
        path = filedialog.askopenfilename(filetypes=filetypes)
        if path:
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
            self.description_text.delete(1.0, tk.END)

    def clear_fields(self):
        for key, var in self.fields.items():
            if key == "description":
                var.delete(1.0, tk.END)
            else:
                var.set('')
        self.credits = {}
        self.update_credits_label()
        self.source_var.set('')

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

        entry = {
            "imgSrc": add_slash_if_local(self.fields['imgSrc'].get()),
            "previewSrc": add_slash_if_local(self.fields['previewSrc'].get()),
            "videoSrc": add_slash_if_local(self.fields['videoSrc'].get()),
            "PDFSrc": add_slash_if_local(self.fields['PDFSrc'].get()),
            "slug": self.fields['slug'].get(),
            "title": self.fields['title'].get(),
            "date": self.fields['date'].get(),
            "role": self.fields['role'].get(),
            "description": self.description_text.get(1.0, tk.END).rstrip(),
            "credits": self.credits.copy(),
            "type": self.fields['type'].get(),
            "Screenplay": self.fields['Screenplay'].get()
        }
        if not entry["title"] or not entry["slug"]:
            messagebox.showerror("Missing fields", "Title and slug are required.")
            return
        self.data.append(entry)
        save_data(self.data)
        messagebox.showinfo("Saved", "Entry added to data.json.")
        self.clear_fields()

if __name__ == '__main__':
    app = ContentEntryApp()
    app.mainloop()