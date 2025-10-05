from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import os
from videoChunkHandler import handle_chunk

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'

# Enable CORS for Chrome extension
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

UPLOAD_FOLDER = 'video_chunks'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/upload_chunk', methods=['POST', 'OPTIONS'])
def upload_chunk():
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        # Get raw binary data from request body
        payload = request.data
        
        if not payload:
            return jsonify({'status': 'error', 'error': 'No data received'}), 400
        
        print(f'Received chunk: size={len(payload)} bytes')
        
        # Save chunk with timestamp
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S%f')
        filename = f"chunk_{timestamp}.webm"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        
        with open(filepath, 'wb') as f:
            f.write(payload)
        
        print(f'Saved chunk to: {filepath}')
        
        # Process chunk (transcription, etc.)
        try:
            prompt_text = handle_chunk(filepath)
            print(f'Processed chunk, prompt: {prompt_text[:100]}...' if prompt_text else 'Processed chunk')
        except Exception as e:
            print(f'Warning: handle_chunk failed: {e}')
            prompt_text = None
        
        return jsonify({
            'status': 'ok',
            'filename': filename,
            'size': len(payload),
            'timestamp': timestamp,
            'prompt': prompt_text
        })
    
    except Exception as e:
        print(f'Error in upload_chunk: {e}')
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'message': 'Server is running'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f'Starting server on port {port}...')
    print(f'Upload folder: {os.path.abspath(UPLOAD_FOLDER)}')
    app.run(host='0.0.0.0', port=port, debug=True)