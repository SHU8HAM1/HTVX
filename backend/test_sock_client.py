import socketio
sio = socketio.Client()
sio.connect('http://localhost:5000', wait=True, wait_timeout=5)
print('connected', sio.connected)
sio.emit('video_uploaded', {'url': 'https://example.com/test.webm'})
sio.disconnect()