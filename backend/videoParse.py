from flask import Flask, request
from flask_socketio import emit
from socketio_instance import socketio
from datetime import datetime
import os
from videoChunkHandler import handle_chunk



app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio.init_app(app)

UPLOAD_FOLDER = 'video_chunks'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)



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


if __name__ == '__main__':
    # Run the Socket.IO server for local development
    port = int(os.environ.get('PORT', 5000))
    # socketio.run will pick up the app via the shared instance
    socketio.run(app, host='0.0.0.0', port=port)