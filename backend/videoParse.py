from flask import Flask, request
from azure.storage.blob import BlobServiceClient
# import snowflake.connector
# from websockets.sync.client import connect
# from datetime import datetime

import asyncio
import websockets
import json
from videoChunkHandler import handle_chunk, finalize_recording

active_sessions = {}

async def connection_handler(websocket, path):
    session_id = "some_unique_id"   # e.g. generate UUID
    active_sessions[session_id] = []

    try:
        async for message in websocket:
            data = json.loads(message)

            if data["type"] == "start":
                # Frontend has started recording
                active_sessions[session_id] = []

            elif data["type"] == "chunk":
                # Each chunk arrives here as base64 or bytes
                chunk_bytes = data["chunk_data"]
                chunk_number = data["chunk_number"]

                # Handle the incoming chunk (save temporarily, call Gemini, etc.)
                partial_prompt = await handle_chunk(session_id, chunk_bytes, chunk_number)

                # Optionally send the partial prompt back to frontend
                await websocket.send(json.dumps({
                    "type": "partial_prompt",
                    "content": partial_prompt
                }))

            elif data["type"] == "end":
                # Recording ended — merge chunks and generate video
                result_link = await finalize_recording(session_id)

                await websocket.send(json.dumps({
                    "type": "video_ready",
                    "url": result_link
                }))
                break

    except Exception as e:
        print(f"Error in session {session_id}: {e}")

    finally:
        # Clean up resources
        del active_sessions[session_id]


async def main():
    async with websockets.serve(connection_handler, "localhost", 8765):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())



app = Flask(__name__)

# get video link from frontend 
@app.route('/api/video', methods=['POST'])
def get_video_data():
    if request.is_json:
        # data in JSON format
        data = request.json
        video = data.get('video') # video property in body has video
        # frontend should send chunks of the video to the backend

        # get filebytes and filename
        # call function to put in azure
        # video_url = upload_to_azure(file_bytes, file_name)
        # take stream and put into gemini API
        # take res and put into model
        # model returns video, save in azure and send link
    return "<p>Hello, World!</p>"

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

# def save_video(video_url, user_id):
#     # change credentials
#     conn = snowflake.connector.connect(
#         user="YOUR_USER",
#         password="YOUR_PASSWORD",
#         account="YOUR_ACCOUNT",
#         warehouse="COMPUTE_WH",
#         database="VIDEO_DB",
#         schema="PUBLIC"
#     )

#     try:
#         cursor = conn.cursor()

        
#         cursor.execute("""
#             INSERT INTO video_metadata (user_id, video_url, uploaded_at)
#             VALUES (%s, %s, %s)
#         """, (user_id, video_url, datetime.now()))

#         conn.commit()

#     finally:
#         cursor.close()
#         conn.close()


# if __name__ == '__main__':
#     app.run(debug=True)
