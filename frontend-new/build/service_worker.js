let socket;
let pc; //using this for rtc peer connection
let dataChannel;

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
    }

}



