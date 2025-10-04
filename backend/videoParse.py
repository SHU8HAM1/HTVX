from flask import Flask, request
from azure.storage.blob import BlobServiceClient
from datetime import datetime
import os
from videoChunkHandler import handle_chunk, finalize_recording



app = Flask(__name__)
UPLOAD_FOLDER = 'video_chunks'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# get video link from frontend 
@app.route('/upload_chunk', methods=['POST'])
def upload_chunk():
    if 'chunk' not in request.files:
        return {'error': 'No chunk uploaded'}, 400
    
    file = request.files['chunk']
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S%f')
    filename = f"{UPLOAD_FOLDER}/chunk_{timestamp}.webm"
    file.save(filename)

    prompt_text = handle_chunk(file)

    return {'status': 'ok', 'prompt': prompt_text}

def upload_to_azure(file_bytes, file_name):
    ACCOUNT_NAME = "Account_Name"
    # change account name and key
    connect_str = "DefaultEndpointsProtocol=https;AccountName=MY_ACCOUNT;AccountKey=MY_KEY;EndpointSuffix=core.windows.net"
    container_name = "videos"

    
    blob_service_client = BlobServiceClient.from_connection_string(connect_str)
    container_client = blob_service_client.get_container_client(container_name)

    blob_path = f"uploads/{file_name}"
    blob_client = container_client.get_blob_client(blob_path)

    blob_client.upload_blob(file_bytes, overwrite=True, content_settings={"content_type": "video/mp4"})

    return f"https://{ACCOUNT_NAME}.blob.core.windows.net/{container_name}/{blob_path}"