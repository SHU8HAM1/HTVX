let socket;
let pc; //using this for rtc peer connection
let dataChannel;
let mediaRecorder;

//importScripts("https://cdn.socket.io/4.7.2/socket.io.min.js"); backend not ready yet 

//initialize socket connection
const initializeSocket = () => {
    //socket = io("add backend link later");
    socket.on("processed-vid-chunk", (chunk) => {
        chrome.runtime.sendMessage( {
            type: "MODIFIED_CHUNK", chunk
        });
    });    
}

//initialize webrtc peer connection
const initializeWebRTC = () => {
    pc = new RTCPeerConnection();

    //create data channel to send in the video chunks
    dataChannel = pc.createDataChannel("vid-chunks");

    //listen for incoming data from the backend
    pc.ondatachannel = (event) => {
        const channel = event.channel;

        //forward recieved messages from the backend to the extension
        channel.onmessage = (msgEvent) => {
            console.log("Recieve WebRTC message from backend: ", msgEvent.data);
            chrome.runtime.sendMessage({
                type: "MODIFIED_CHUNK", chunk: msgEvent.data
            });
        }
    }

    //handles ice candidate
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("ice-candidate", event.candidate);
        }
    };
}

/* 
screen n audio recording
*/
const startRecording = async () => {
    //get screen vid and mic audio
    const screenStream = await navigator.mediaDevices.getDisplayMedia( {
        video: true,
        audio: true
    });

    mediaRecorder = new MediaRecorder(screenStream, {
        mimeType: "video/webm"
    });

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            const reader = new FileReader();
            reader.onload = () => {
                const arrayBuffer = reader.result;
                //send video chunk to backend
                if (dataChannel && dataChannel.readyState === "open") {
                    dataChannel.send(arrayBuffer);
                }

                if (socket)
                    socket.emit("video-chunk", arrayBuffer)
            };
            reader.readAsArrayBuffer(event.data);
        }
    };
    mediaRecorder.start(/*not sure how much chunks*/);
};

const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
    }
}






