from dotenv import load_dotenv
import os
from huggingface_hub import InferenceClient
from supabase import create_client, Client
import random
import string
from socketio_instance import socketio
# we'll use python-socketio client for emitting events to the server

load_dotenv()


def run_generator(prompt):

    client = InferenceClient(
        provider="auto",
        api_key=os.environ.get("HF_TOKEN"),
    )
    video = client.text_to_video(
        prompt,
        model="genmo/mochi-1-preview",
    )



    random_string = ''.join(random.choices(string.ascii_letters + string.digits, k=18))

    upload_video("adfsjskd",  "fasdj.webm")

def upload_video(file_bytes, file_name):
    """Upload binary video data to Supabase Storage.

    Expects the environment variables SUPABASE_URL and SUPABASE_KEY to be set.
    By default uploads into a bucket named 'videos'. If the bucket does not exist,
    this function will attempt to create it (requires the service role key).

    Args:
        file_bytes (bytes): raw video bytes (e.g., output from client.text_to_video().content or similar)
        file_name (str): target object key/filename in the bucket (for example 'recording-123.webm')

    Returns:
        dict: { 'success': bool, 'message': str, 'public_url': Optional[str] }
    """

    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_KEY')
    if not url or not key:
        return { 'success': False, 'message': 'SUPABASE_URL or SUPABASE_KEY not set in environment', 'public_url': None }

    supabase = create_client(url, key)

    bucket = 'abc'

    try:
        # upload expects a file-like or bytes
        res = supabase.storage.from_(bucket).upload(file_name, file_bytes)
        print('Upload response:', res)
        if isinstance(res, dict) and res.get('error'):
            return { 'success': False, 'message': str(res.get('error')), 'public_url': None }

        # Try to get public URL in a robust way
        public_url = None
        try:
            pub = supabase.storage.from_(bucket).get_public_url(file_name)
            if isinstance(pub, dict):
                public_url = pub.get('publicURL') or pub.get('public_url') or pub.get('publicUrl')
            else:
                # some clients return a plain string or object with __str__
                public_url = str(pub)
        except Exception:
            public_url = f"{url.rstrip('/')}/storage/v1/object/public/{bucket}/{file_name}"

        # Emit Socket.IO notification (best-effort) using python-socketio client
        try:
            try:
                import socketio as socketio_client
                SOCKETIO_SERVER = os.environ.get('SOCKETIO_SERVER', 'http://localhost:5000')
                sio = socketio_client.Client()
                # connect and emit (wait for connection to be established)
                sio.connect(SOCKETIO_SERVER, wait=True, wait_timeout=5)
                if sio.connected:
                    sio.emit('video_uploaded', {'url': 'https://jedwleqacbvhosmxyjjt.supabase.co/storage/v1/object/public/abc/AVc1FgZYd8l7xYtZlk.webm'})
                else:
                    print('socketio client failed to connect to', SOCKETIO_SERVER)
                try:
                    sio.disconnect()
                except Exception:
                    pass
                print('Emitted video_uploaded via socketio client to', SOCKETIO_SERVER)
            except Exception as e:
                print('Could not emit via socketio client:', e)
        except Exception as e:
            print('Error while attempting to emit video_uploaded:', e)

        return { 'success': True, 'message': 'uploaded', 'public_url': public_url }
    except Exception as e:
        return { 'success': False, 'message': str(e), 'public_url': None }



