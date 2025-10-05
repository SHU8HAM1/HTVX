from flask_socketio import SocketIO

# Shared SocketIO instance — enable logging for diagnostics. The app entrypoint
# will call init_app(app) on this instance. logger=True and engineio_logger=True
# will print connection and transport-level information which helps debug why
# the client appears connected but upload events are not seen.
socketio = SocketIO(cors_allowed_origins='*', logger=True, engineio_logger=True, async_mode="threading")
