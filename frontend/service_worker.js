let socket;
let pc; //using this for rtc peer connection
let dataChannel;

//importScripts("https://cdn.socket.io/4.7.2/socket.io.min.js"); backend not ready yet 

const initializeSocket = () => {
    //socket = io("add backend link later");
    socket.on("processed-vid-chunk", (chunk) => {
        chrome.runtime.sendMessage( {
            type: "MODIFIED_CHUNK", chunk
        });
    });    
}

