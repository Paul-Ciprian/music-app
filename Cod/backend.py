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

load_dotenv() 

app = Flask(__name__)
CORS(app)

COOKIES_PATH = os.path.join(os.path.dirname(__file__), 'cookies.txt')

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
    ydl_opts = {'extract_flat': True, 'quiet': True}
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"scsearch10:{query}", download=False)
            results = []
            for entry in info.get('entries', []):
                results.append({
                    'id': str(entry.get('id', '')),
                    'title': entry.get('title', 'Unknown'),
                    'artist': entry.get('uploader', 'Unknown'),
                    'url': entry.get('webpage_url', ''),
                    'thumbnail': entry.get('thumbnail', '')
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
    for filename in os.listdir(DOWNLOAD