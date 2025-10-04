import os
async def handle_chunk(session_id, chunk_bytes, chunk_number):
    """
    1. Temporarily save the chunk.
    2. Extract simple metadata (e.g. frame info, timestamps).
    3. Send partial data to Gemini API for prompt suggestions.
    4. Return partial prompt string.
    """
    #if not os.path.isdir("tmp"):
    # placeholder: real implementation would call your AI service asynchronously
    partial_prompt = f"Partial prompt for chunk {chunk_number}"
    return partial_prompt


async def finalize_recording(session_id):
    """
    1. Merge stored chunks into a final video file.
    2. Combine partial prompts into a single final prompt.
    3. Generate the final video using your model.
    4. Upload to Azure Blob and return the file URL.
    """
    final_video_url = f"https://azure.blob.core.windows.net/videos/{session_id}.mp4"
    return final_video_url