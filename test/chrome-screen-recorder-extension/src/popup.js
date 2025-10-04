const startBtn = document.getElementById('startBtn');
const stopBtn  = document.getElementById('stopBtn');

startBtn.onclick = () => {
  chrome.runtime.sendMessage({ type: 'POPUP_START' }, () => {
    startBtn.disabled = true;
    // stopBtn.style.color = "red";
    window.close(); // allow popup to close; recording keeps going
  });
};

stopBtn.onclick = () => {
    console.log('Popup: stop button clicked');
  chrome.runtime.sendMessage({ type: 'POPUP_STOP' }, () => {
    console.log('Popup: stop acknowledged');
    startBtn.disabled = false;
    window.close();
  });
};