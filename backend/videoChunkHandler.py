import google.generativeai as genai
import os
from model import run_generator
import subprocess
from dotenv import load_dotenv

# loads env vars
load_dotenv()
model = genai.GenerativeModel("gemini-2.0-flash")
genai.configure(api_key=os.getenv("GOOGLE_API_KEY")) # configure api key


current_prompt = "We test the linear algebra theory today."

UPLOAD_FOLDER = 'tmp_chunks'

def handle_chunk(video_file):
    audio_path = video_to_audio(video_file)
    transcription = model.generate_content(
        contents=[
            "Transcribe this audio into text:",
            {"audio": open(audio_path, "rb")}
        ]
    )
    text_data = transcription.text

    response = model.generate_content(f"Generate a prompt to ask a model to generate a video based on this information: {text_data}")
    return response.text

def video_to_audio(video_path, output_folder='audio_chunks'):
    os.makedirs(output_folder, exist_ok=True)
    
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



my_prompt = """# Gemini Eager Visualizer Directives for Mochi-1

## ROLE AND GOAL
The AI's role is a **Visual Concept Detector and Prompt Synthesizer**.
The goal is to generate a single, highly-detailed Mochi-1 prompt whenever any new **educational** visualizable concept is introduced in the transcript. The model is **highly biased toward generating a function call.**

## OPERATIONAL MODE & CONSTRAINTS
1.  **Input:** The full, accumulated transcript is provided.
3.  **Output Format:** The final output **MUST** be one of two things, and nothing else:
    * **Decision to SKIPAB:** The single word: `SKIPAB`
    * **Mochi-1 Prompt:** A single, continuous text string for the video model.
3.  **Clip Duration:** The generated prompt must visualize a simple, focused sub-concept lasting **4 to 6 seconds**.
4.  **Generation Delay:** The prompt should visualize the **most recently mentioned visual idea**, regardless of its completeness.

## DECISION CRITERIA
**Generate a Video Prompt IF:**
1.  The last 3-5 sentences of the transcript contain **any concrete, visualizable equation or major educational topic.**
2.  The content is not identical to the previous turn.
3.  **The only reason not to SKIPAB is if the content is non-educational.**
4. **If there is a major concept that can be visualized, and is being explained more, generate a prompt.**
5. If the content is purely verbal or non-educational, respond with "SKIPAB"
6. If the verbs are purely about speaking, listening, or other non-visual actions, respond with "SKIPAB"
7. If the content is a repetition of previous content, respond with "SKIPAB"
8 If the content is about administrative or logistical matters, respond with "SKIPAB"
9. If the content is about social interactions, respond with "SKIPAB"
10. If the content is about personal anecdotes or experiences, respond with "SKIPAB"
11. If the content is about non-educational topics, respond with "SKIPAB"
12. If the content is about abstract concepts without a clear visual representation, respond with "SKIPAB"
13. If the content is about emotions or feelings, respond with "SKIPAB"
14. If the content is about opinions or subjective statements, respond with "SKIPAB"
15. If the content is about future plans or intentions, respond with "SKIPAB"
16. If the content is about past events or history, respond with "SKIPAB"
17. If the content is about someone's introduction, respond with "SKIPAB"
18. If the content is about greetings or farewells, respond with "SKIPAB"
19. If the content is just introduced with no prior sentence relating to it (e.g., "Now, let's discuss..."), respond with "SKIPAB"
20. If the content is about classroom management or behavior, respond with "SKIPAB"
21. If a new noun is introduced without any associated action or description before, respond with "SKIPAB"
22. If the noun hasn't been explained or described in any way and just mentioned, respond with "SKIPAB"


## PROMPT GENERATION CONSTRAINTS (IF GENERATING)
* **Visual Style:** Use **2D educational animation, vector art, bright colors, infographic style, white background.**
* **Action/Motion:** The prompt must feature a single, clear movement related to the concept (e.g., a simple rotation, an item appearing, an arrow indicating direction). Avoid complex sequences or multiple simultaneous actions, and give all details regarding the motion with exact timing.
The action must be simple and easy for the model to make and emphasize on the action and clarity with a lot of details ensuring it follows exactly as told. You may give it more context for it to better follow instructions.
* **Details:** The prompt must include all minor details to leave no room for misinterpretation (e.g. if you mention diplaying an arrow, mention when the arrow is first formed and till when it must remain.)
* **Structure:**
    $$
    Prompt [Title of Video]: [Specific Visual Subject/Object/Scene] \cdot [A Simple Action/Movement] \cdot [Style Modifiers]  \\cdot [Details]
    $$

## INSTRUCTION FOR FINAL OUTPUT
Analyze the complete transcript below. **You are required to call the `send_to_mochi1_generator` function for nearly every turn unless the input is completely devoid of visual content.** If a prompt is generated, it must be the sole argument passed to the function. If you absolutely must SKIPAB, respond with the single text: "Waiting."

**COMPLETE ACCUMULATED TRANSCRIPT:**

"""

def add_chunk_to_prompt(chunk_text):
    global current_prompt
    current_prompt += f" {chunk_text}"
    return current_prompt

def decide_prompt(transcript):
    decision = model.generate_content(f"""{my_prompt}
    {transcript}
    """)
    if not "SKIPAB" in decision.text:
        print("Generating video for prompt:", decision.text)
        run_generator(decision.text.strip())
    
    return decision.text


add_chunk_to_prompt("Hello everyone.")
print(decide_prompt(current_prompt))
add_chunk_to_prompt("I see a lot of attendance.")
print(decide_prompt(current_prompt))
add_chunk_to_prompt("We will discuss friction.")
print(decide_prompt(current_prompt))

add_chunk_to_prompt("Whenever friction is applied, we have one force that is acting on the object forcing it to move a specific direction. The rough surfaces from the object and the surface interlock and friction applies force the opposite direction.")
print(decide_prompt(current_prompt))