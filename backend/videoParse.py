from flask import Flask, request

app = Flask(__name__)

# get video link from frontend 
@app.route('/api/video', methods=['POST'])
def get_video_data():
    if request.is_json:
        # data in JSON format
        data = request.json
        video = data.get('video') # video property in body has video

        # store video in cloud storage
        # connect storage bucket to Snowflake
    return "<p>Hello, World! </p>"

if __name__ == '__main__':
    app.run(debug=True)
