const Peer = window.Peer;

(async function main() {
  const localVideo = document.getElementById('js-local-stream');
  const joinTrigger = document.getElementById('js-join-trigger');
  const leaveTrigger = document.getElementById('js-leave-trigger');
  const remoteVideos = document.getElementById('js-remote-streams');
  const roomIdForm = document.getElementById('js-room-id');
  const userNameForm = document.getElementById('user-name');
  const localText = document.getElementById('js-local-text');
  const sendTrigger = document.getElementById('js-send-trigger');
  const messages = document.getElementById('js-messages');

  joinTrigger.setAttribute('disabled', true);

  const localStream = await navigator.mediaDevices
    .getDisplayMedia({
      // audio: true,
      video: true,
    })
    .catch(console.error);

  // Render local stream
  localVideo.muted = true;
  localVideo.srcObject = localStream;
  localVideo.playsInline = true;
  await localVideo.play().catch(console.error);

  const peer = (window.peer = new Peer({
    key: window.__SKYWAY_KEY__,
    debug: 3,
  }));

  const enableLogin = () => {
    if (roomIdForm.value === undefined || roomIdForm.value === '' || userNameForm.value === undefined || userNameForm.value === '') return;
    joinTrigger.removeAttribute('disabled');
  };

  roomIdForm.addEventListener('input', enableLogin);
  userNameForm.addEventListener('input', enableLogin);

  const addMessage = text => {
    const message = document.createElement('p');
    message.textContent = text;
    messages.append(message);
  };

  // Register join handler
  joinTrigger.addEventListener('click', () => {
    // Note that you need to ensure the peer has connected to signaling server
    // before using methods of peer instance.
    if (roomIdForm.value === undefined || roomIdForm.value === '' || userNameForm.value === undefined || userNameForm.value === '') return;
    if (!peer.open) return;

    const roomId = roomIdForm.value;
    const userName = userNameForm.value;

    const room = peer.joinRoom(roomId, {
      mode: 'mesh',
      stream: localStream,
    });

    const container = document.getElementById('container');
    container.classList.add('room-display');
    container.classList.remove('login-display');

    room.once('open', () => {
      addMessage('=== You joined ===');
    });
    room.on('peerJoin', peerId => {
      addMessage(`=== ${userName} joined ===`);
    });

    // Render remote stream for new peer join in the room
    room.on('stream', async stream => {
      const newVideo = document.createElement('video');
      newVideo.srcObject = stream;
      newVideo.playsInline = true;
      // mark peerId to find it later at peerLeave event
      newVideo.setAttribute('data-peer-id', stream.peerId);
      remoteVideos.append(newVideo);
      await newVideo.play().catch(console.error);
    });

    room.on('data', ({ data, src }) => {
      // Show a message sent to the room and who sent
      addMessage(`${src}: ${data}`);
    });

    // for closing room members
    room.on('peerLeave', peerId => {
      const remoteVideo = remoteVideos.querySelector(
        `[data-peer-id="${peerId}"]`
      );
      remoteVideo.srcObject.getTracks().forEach(track => track.stop());
      remoteVideo.srcObject = null;
      remoteVideo.remove();

      addMessage(`=== ${peerId} left ===`);
    });

    // for closing myself
    room.once('close', () => {
      sendTrigger.removeEventListener('click', onClickSend);
      addMessage('== You left ===');
      Array.from(remoteVideos.children).forEach(remoteVideo => {
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        remoteVideo.srcObject = null;
        remoteVideo.remove();
      });
    });

    sendTrigger.addEventListener('click', onClickSend);
    leaveTrigger.addEventListener('click', () => room.close(), { once: true });

    function onClickSend() {
      // Send message to all of the peers in the room via websocket
      room.send(`${userName}: ${localText.value}`);

      addMessage(`${userName}: ${localText.value}`);
      localText.value = '';
    }
  });

  peer.on('error', console.error);
})();
