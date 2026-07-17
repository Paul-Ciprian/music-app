import os
import requests
import billboard
from supabase import create_client, Client
import yt_dlp
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import datetime
import unicodedata
import json
from dotenv import load_dotenv

# Incarca variabilele secrete din fisierul .env
load_dotenv()

app = Flask(__name__)
CORS(app)

COOKIES_PATH = os.path.join(os.path.dirname(__file__), 'cookies.txt')

# Preia cheile in siguranta
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

PLAYLIST_CACHE = {}
DOWNLOADS_DIR = "../downloads"
CUSTOM_PLAYLISTS_FILE = "custom_playlists.json"

if not os.path.exists(DOWNLOADS_DIR):
    os.makedirs(DOWNLOADS_DIR)


def normalize_text(text):
    if not text:
        return ""
    text = unicodedata.normalize('NFD', text)
    text = ''.join(char for char in text if unicodedata.category(char) != 'Mn')
    return text.lower().strip()


def load_custom_playlists():
    if not os.path.exists(CUSTOM_PLAYLISTS_FILE):
        return {}
    with open(CUSTOM_PLAYLISTS_FILE, 'r') as f:
        return json.load(f)


def save_custom_playlists(data):
    with open(CUSTOM_PLAYLISTS_FILE, 'w') as f:
        json.dump(data, f)


def download_song(video_url):
    print(f"Caut si descarc: {video_url}...")
    ydl_opts = {
        'format': 'best',
        'cookiefile': COOKIES_PATH,
        'outtmpl': f'{DOWNLOADS_DIR}/%(title)s.%(ext)s',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'quiet': True,
        'no_warnings': True
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(video_url, download=True)
        title = info.get('title', 'Unknown')
        artist = info.get('uploader', 'Unknown')
        return title, artist


@app.route('/api/custom_playlists', methods=['GET'])
def get_custom_playlists():
    return jsonify({"status": "success", "data": load_custom_playlists()}), 200


@app.route('/api/custom_playlists', methods=['POST'])
def create_custom_playlist():
    name = request.json.get('name')
    if not name:
        return jsonify({"error": "Nume lipsa"}), 400
    playlists = load_custom_playlists()
    if name not in playlists:
        playlists[name] = []
        save_custom_playlists(playlists)
    return jsonify({"status": "success", "data": playlists}), 200


@app.route('/api/custom_playlists/add', methods=['POST'])
def add_to_custom_playlist():
    name = request.json.get('name')
    song = request.json.get('song')
    playlists = load_custom_playlists()
    if name in playlists:
        if not any(s['title'] == song['title'] for s in playlists[name]):
            playlists[name].append(song)
            save_custom_playlists(playlists)
    return jsonify({"status": "success"}), 200


@app.route('/api/toggle_favorite', methods=['POST'])
def toggle_favorite():
    data = request.json
    title = data.get('title')
    artist = data.get('artist')
    res = supabase.table("favorite_songs").select(
        "*").eq("title", title).execute()
    if res.data:
        supabase.table("favorite_songs").delete().eq("title", title).execute()
        return jsonify({"status": "removed"}), 200
    else:
        supabase.table("favorite_songs").insert(
            {"title": title, "artist": artist, "is_offline": True}).execute()
        return jsonify({"status": "added"}), 200


@app.route('/api/check_local', methods=['POST'])
def check_local():
    data = request.json
    title = normalize_text(data.get('title', ''))
    for filename in os.listdir(DOWNLOADS_DIR):
        norm_file = normalize_text(filename)
        if title in norm_file and len(title) > 2:
            return jsonify({"status": "found", "title": filename}), 200
    return jsonify({"status": "not_found"}), 200


@app.route('/api/download', methods=['POST'])
def api_download():
    data = request.json
    video_url = data.get('url')
    title_hint = data.get('title')
    if title_hint:
        title_norm = normalize_text(title_hint)
        for filename in os.listdir(DOWNLOADS_DIR):
            if title_norm in normalize_text(filename):
                return jsonify({"status": "success", "title": title_hint}), 200
    if not video_url:
        return jsonify({"error": "Nu ai trimis niciun link!"}), 400
    try:
        titlu, artist = download_song(video_url)
        return jsonify({"status": "success", "title": titlu, "artist": artist}), 200
    except Exception as e:
        return jsonify({"error": "A aparut o eroare la descarcare."}), 500


@app.route('/api/search', methods=['POST'])
def api_search():
    data = request.json
    query = data.get('query')
    if not query:
        return jsonify({"error": "Nu ai trimis niciun text!"}), 400
    ydl_opts = {'extract_flat': True,
                'quiet': True, 'cookiefile': COOKIES_PATH}
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"scsearch10:{query}", download=False)
            results = []
            for entry in info.get('entries', []):
                results.append({
                    'id': entry['id'],
                    'title': entry.get('title', 'Unknown'),
                    'artist': entry.get('uploader', 'Unknown'),
                    'url': f"https://www.youtube.com/watch?v={entry['id']}",
                    'thumbnail': f"https://i.ytimg.com/vi/{entry['id']}/mqdefault.jpg"
                })
            return jsonify({"status": "success", "results": results}), 200
    except Exception as e:
        return jsonify({"error": "Eroare la cautare."}), 500


@app.route('/api/play/<path:title>', methods=['GET'])
def play_song(title):
    file_path = os.path.join(DOWNLOADS_DIR, title)
    if os.path.exists(file_path):
        return send_file(file_path)
    for filename in os.listdir(DOWNLOADS_DIR):
        if filename.startswith(title):
            return send_file(os.path.join(DOWNLOADS_DIR, filename))
    return jsonify({"error": "Melodia nu a fost gasita"}), 404


@app.route('/api/local_library', methods=['GET'])
def get_local_library():
    songs = []
    if os.path.exists(DOWNLOADS_DIR):
        for filename in os.listdir(DOWNLOADS_DIR):
            if filename.endswith('.mp3'):
                title = os.path.splitext(filename)[0]
                artist = "Local"
                if " - " in title:
                    parts = title.split(" - ", 1)
                    artist = parts[0]
                    title = parts[1]
                songs.append({"title": title, "artist": artist, "url": ""})
    return jsonify({"status": "success", "data": songs}), 200


@app.route('/api/favorites', methods=['GET'])
def get_favorites():
    try:
        response = supabase.table("favorite_songs").select("*").execute()
        return jsonify({"status": "success", "data": response.data}), 200
    except Exception as e:
        return jsonify({"error": "Nu am putut prelua datele"}), 500


@app.route('/api/playlist/<chart_name>', methods=['GET'])
def get_playlist(chart_name):
    date = request.args.get('date')
    today = datetime.date.today().strftime("%Y-%m-%d")
    cache_date = date if date else today
    cache_key = f"{chart_name}_{cache_date}"
    if cache_key in PLAYLIST_CACHE:
        return jsonify(PLAYLIST_CACHE[cache_key]), 200
    try:
        chart = billboard.ChartData(chart_name, date=date)
        songs = []
        for song in chart:
            songs.append({
                "rank": song.rank,
                "title": song.title,
                "artist": song.artist,
                "last_week": getattr(song, 'lastPos', None),
                "peak": getattr(song, 'peakPos', None),
                "weeks": getattr(song, 'weeks', None)
            })
        response_data = {"status": "success", "playlist_name": chart.title,
                         "date": chart.date, "total_songs": len(songs), "songs": songs}
        PLAYLIST_CACHE[cache_key] = response_data
        return jsonify(response_data), 200
    except Exception as e:
        return jsonify({"error": "Nu am putut incarca playlistul."}), 500


@app.route('/api/lyrics', methods=['POST'])
def api_lyrics():
    data = request.json
    title = data.get('title', '')
    artist = data.get('artist', '')
    try:
        res = requests.get(
            f"https://lrclib.net/api/get?track_name={title}&artist_name={artist}")
        if res.status_code == 200:
            return jsonify({"status": "success", "data": res.json()}), 200

        search_res = requests.get(
            f"https://lrclib.net/api/search?q={title} {artist}")
        if search_res.status_code == 200 and len(search_res.json()) > 0:
            return jsonify({"status": "success", "data": search_res.json()[0]}), 200

        return jsonify({"status": "not_found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/delete_local', methods=['POST'])
def delete_local():
    data = request.json
    title_hint = normalize_text(data.get('title', ''))
    for filename in os.listdir(DOWNLOADS_DIR):
        if title_hint in normalize_text(filename) and len(title_hint) > 2:
            try:
                os.remove(os.path.join(DOWNLOADS_DIR, filename))
                return jsonify({"status": "success"}), 200
            except:
                pass
    return jsonify({"status": "not_found"}), 404


@app.route('/api/home', methods=['GET'])
def api_home():
    categories = [
        {"id": "hot-100", "title": "Billboard Hot 100",
            "thumbnail": "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500&q=80"},
        {"id": "romania-songs", "title": "Top România",
            "thumbnail": "https://images.unsplash.com/photo-1599839619722-39751411ea63?w=500&q=80"},
        {"id": "billboard-global-200", "title": "Global 200",
            "thumbnail": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80"},
        {"id": "pop-songs", "title": "Pop",
            "thumbnail": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&q=80"},
        {"id": "country-songs", "title": "Country",
            "thumbnail": "https://images.unsplash.com/photo-1594908900066-3f47337549d8?w=500&q=80"},
        {"id": "rock-songs", "title": "Rock",
            "thumbnail": "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=500&q=80"},
        {"id": "r-b-hip-hop-songs", "title": "R&B/Hip-Hop",
            "thumbnail": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&q=80"},
        {"id": "latin-songs", "title": "Latin",
            "thumbnail": "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=500&q=80"},
        {"id": "dance-electronic-songs", "title": "Dance & Electronic",
            "thumbnail": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&q=80"},
        {"id": "hot-rap-songs", "title": "Rap",
            "thumbnail": "https://images.unsplash.com/photo-1550184658-ff6132a71714?w=500&q=80"},
        {"id": "uk-singles", "title": "UK Top 100",
            "thumbnail": "https://images.unsplash.com/photo-1485686531765-ba63b07845a7?w=500&q=80"},
        {"id": "south-korea-songs", "title": "K-Pop",
            "thumbnail": "https://images.unsplash.com/photo-1546707012-0c9f63bb2f09?w=500&q=80"}
    ]
    return jsonify({"status": "success", "categories": categories}), 200


@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    try:
        res = supabase.auth.sign_up({"email": email, "password": password})
        return jsonify({"status": "success", "user": res.user.id}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    try:
        res = supabase.auth.sign_in_with_password(
            {"email": email, "password": password})
        return jsonify({"status": "success", "user": res.user.id}), 200
    except Exception as e:
        return jsonify({"error": "Email sau parolă incorectă."}), 400


@app.route('/api/stream', methods=['POST'])
def api_stream():
    data = request.json
    video_url = data.get('url')
    if not video_url:
        return jsonify({"error": "Lipsă URL"}), 400
    ydl_opts = {'format': 'best', 'quiet': True, 'cookiefile': COOKIES_PATH}
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            return jsonify({"status": "success", "stream_url": info['url']}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/sync', methods=['POST'])
def sync_data():
    data = request.json
    user_id = data.get('user_id')
    if not user_id:
        return jsonify({"error": "Lipsa user_id"}), 400

    payload = {
        "user_id": user_id,
        "history": data.get('history', {}),
        "playlists": data.get('playlists', {}),
        "favorites": data.get('favorites', []),
        "theme": data.get('theme', '#1db954')
    }
    try:
        supabase.table("user_data").upsert(payload).execute()
        return jsonify({"status": "success"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/sync/<user_id>', methods=['GET'])
def get_sync(user_id):
    try:
        res = supabase.table("user_data").select(
            "*").eq("user_id", user_id).execute()
        if res.data:
            return jsonify({"status": "success", "data": res.data[0]}), 200
        return jsonify({"status": "not_found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(port=5000, debug=True)
