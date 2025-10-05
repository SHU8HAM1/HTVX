from flask import Flask, request
from flask_socketio import SocketIO, emit
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
    try:
        # data may arrive as raw bytes, bytearray, memoryview, a list of ints,
        # or a dict containing the binary in a field (e.g. {'data': ...}).
        payload = None
        if isinstance(data, dict) and 'data' in data:
            payload = data['data']
        else:
            payload = data

        # Normalize common binary-like containers to bytes
        if isinstance(payload, memoryview):
            payload = payload.tobytes()
        elif isinstance(payload, bytearray):
            payload = bytes(payload)
        elif isinstance(payload, list):
            # list of integers
            try:
                payload = bytes(payload)
            except Exception:
                # fallback to string representation
                payload = str(payload).encode('utf-8')

        # If it's a string, attempt base64 decode, otherwise encode
        if isinstance(payload, str):
            try:
                import base64
                payload = base64.b64decode(payload)
            except Exception:
                payload = payload.encode('utf-8')

        if not isinstance(payload, (bytes, bytearray)):
            # final fallback
            payload = str(payload).encode('utf-8')

        print(f'Received chunk payload: type={type(payload).__name__} size={len(payload)}')

        timestamp = datetime.now().strftime('%Y%m%d%H%M%S%f')
        filename = f"{UPLOAD_FOLDER}/chunk_{timestamp}.webm"
        filepath = os.path.join(UPLOAD_FOLDER, filename)

        with open(filepath, 'wb') as f:
            f.write(payload)

        # Acknowledge immediately that the chunk was saved so extension can show progress
        try:
            emit('chunk_saved', {'filename': filename, 'size': len(payload), 'timestamp': timestamp})
        except Exception:
            pass

        prompt_text = handle_chunk(filepath)

        emit('chunk_processed', {'status': 'ok', 'prompt': prompt_text})
    except Exception as exc:
        print('upload_chunk handler error:', exc)
        try:
            emit('chunk_processed', {'status': 'error', 'error': str(exc)})
        except Exception:
            pass


if __name__ == '__main__':
    # Run the Socket.IO server for local development
    port = int(os.environ.get('PORT', 5000))
    print(f'Starting server on port {port}...')
    # socketio.run will pick up the app via the shared instance
    # also log connect/disconnect events for diagnostics
    @socketio.on('connect')
    def on_connect():
        try:
            print('Socket.IO client connected:', request.sid)
        except Exception:
            print('Socket.IO client connected (sid unknown)')

    @socketio.on('disconnect')
    def on_disconnect():
        try:
            print('Socket.IO client disconnected:', request.sid)
        except Exception:
            print('Socket.IO client disconnected')

    socketio.run(app, host='0.0.0.0', port=port)