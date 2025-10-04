from flask import Flask, request
#from azure.storage.blob import BlobServiceClient

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
    return "<p>Hello, World!</p>"

def upload_to_azure(file_bytes, file_name):
    # change account name and key
    connect_str = "DefaultEndpointsProtocol=https;AccountName=MY_ACCOUNT;AccountKey=MY_KEY;EndpointSuffix=core.windows.net"
    container_name = "videos"



if __name__ == '__main__':
    app.run(debug=True)
