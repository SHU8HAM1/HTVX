from flask import Flask, request
from flask_socketio import SocketIO, emit
from azure.storage.blob import BlobServiceClient
from datetime import datetime
import os
from videoChunkHandler import handle_chunk



app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*") #enables CORS for frontend

UPLOAD_FOLDER = 'video_chunks'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ACCOUNT_NAME = "Account_Name"
CONNECT_STR = "DefaultEndpointsProtocol=https;AccountName=MY_ACCOUNT;AccountKey=MY_KEY;EndpointSuffix=core.windows.net"
CONTAINER_NAME = 'videos'


# get video link from frontend 
@socketio.on('upload_chunk')
def upload_chunk(data):
    
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S%f')
    filename = f"{UPLOAD_FOLDER}/chunk_{timestamp}.webm"
    filepath = os.path.join(UPLOAD_FOLDER, filename)

    with open(filepath, 'wb') as f:
        f.write(data)

    prompt_text = handle_chunk(filepath)

    emit('chunk_processed', {'status': 'ok', 'prompt': prompt_text})