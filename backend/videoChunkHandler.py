import google.generativeai as genai
import os
import subprocess
from dotenv import load_dotenv

# loads env vars
load_dotenv()
model = genai.GenerativeModel("gemini-1.5-flash")
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

def video_to_audio(video_path, output_folder='audio_chunks'):
    os.makedirs(output_folder, exist_ok=True)
    # Create output file name
    base_name = os.path.splitext(os.path.basename(video_path))[0]
    audio_path = os.path.join(output_folder, f"{base_name}.wav")
    
    # command to convert video to audio
    command = [ # ffmpeg -y -i base_name.webm -ar 16000 -ac 1 -vn base_name.wav
        'ffmpeg',
        '-y',
        '-i', video_path,
        '-ar', '16000',
        '-ac', '1',
        '-vn',
        audio_path
    ]
    
    subprocess.run(command, check=True)
    return audio_path

# Example usage
video_file = 'temp_chunks/chunk_20251004163000.webm'
audio_file = video_to_audio(video_file)
UPLOAD_FOLDER = 'tmp_chunks'

def handle_chunk(video_file):
    audio_path = video_to_audio(video_file)
    audio_file = client.files.upload(file=audio_path)


    response = model.generate_content("Generate a prompt to ask a model to generate a video based on this information: {data}")
    # placeholder: real implementation would call your AI service asynchronously
    return response


def finalize_recording(session_id):
    """
    1. Merge stored chunks into a final video file.
    2. Combine partial prompts into a single final prompt.
    3. Generate the final video using your model.
    4. Upload to Azure Blob and return the file URL.
    """
    final_video_url = f"https://azure.blob.core.windows.net/videos/{session_id}.mp4"
    return final_video_url