let pc;

/// //////////////////////////////////////////


const context = cast.framework.CastReceiverContext.getInstance();

const options = new cast.framework.CastReceiverOptions();
options.disableIdleTimeout = true;

context.start(options);

const playerManager = context.getPlayerManager();

let socket;
playerManager.setMessageInterceptor(cast.framework.messages.MessageType.LOAD, loadRequestData => {
	console.log('loadRequestData', loadRequestData);

	const { room, signalHost } = loadRequestData.media;

	if (socket) {
		// disconnect current socket
		socket.disconnect();
	}
	socket = io.connect(signalHost);

	/// /////////////////////////////////////////////

	function sendMessage(message) {
		console.log('sending message: ', message);
		socket.emit('message', message, room);
	}

	// This client receives a message
	socket.on('message', async message => {
		console.log('Client received message:', message);
		if (message.type === 'offer') {
			createPeerConnection();
			console.log('set remote description via offer');
			pc.setRemoteDescription(new RTCSessionDescription(message));
			// const id = await pc.createAnswer()
			// setLocalAndSendMessage();
			const localDescription = await pc.createAnswer();
			pc.setLocalDescription(localDescription);
			console.log('set local and sending answer');
			sendMessage(localDescription);
		} else if (message.type === 'candidate') {
			const candidate = new RTCIceCandidate(message.candidate);
			await pc.addIceCandidate(candidate);
			console.log('addIceCandidate');
		} else {
			console.error('!!! unhandled message', message);
		}
	});

	/// /////////////////////////////////////////////////

	const remoteVideo = document.querySelector('#remoteVideo');

	window.onbeforeunload = function () {
		sendMessage('bye');
	};

	/// //////////////////////////////////////////////////////

	function createPeerConnection() {
		try {
			if (remoteVideo) {
				remoteVideo.srcObject = null;
			}
			if (pc) {
				pc.close();
			}
			pc = new RTCPeerConnection();
			pc.onicecandidate = handleIceCandidate;
			pc.ontrack = handletrack;
			pc.onconnectionstatechange = ev => {
				console.log('connectionState', ev.currentTarget.connectionState, pc.connectionState);
				if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
					remoteVideo.srcObject = null;
				}
			};
			pc.onicegatheringstatechange = ev => {
				console.log('iceGatheringState', ev.currentTarget.iceGatheringState, pc.iceGatheringState);
			};
			pc.onicecandidateerror = ev => {
				console.log('onicecandidateerror', ev);
			};

			/* pc.onnegotiationneeded = async () => {
                console.log('CLIENT onnegotiationneeded');
                try {
                    // makingOffer = true;
                    await pc.setLocalDescription();
                    sendMessage(pc.localDescription);
                } catch (err) {
                    console.error(err);
                } finally {
                    // makingOffer = false;
                }
            }; */
			pc.oniceconnectionstatechange = ev => {
				console.log(
					'iceConnectionState',
					ev.currentTarget.iceConnectionState,
					pc.iceConnectionState
				);
				if (pc.iceConnectionState === 'failed') {
					pc.restartIce();
				}
			};

			// pc.onaddstream = handleRemoteStreamAdded;
			// pc.onremovestream = handleRemoteStreamRemoved;
			console.log('Created RTCPeerConnnection');
		} catch (e) {
			console.log(`Failed to create PeerConnection, exception: ${e.message}`);
			alert('Cannot create RTCPeerConnection object.');
			throw new Error(e);
		}
	}

	function handletrack({ track, streams }) {
		console.log('on track', streams);

		if (remoteVideo.srcObject !== streams[0]) {
			console.log('new track');
			remoteVideo.srcObject = streams[0];
		}
	}

	function handleIceCandidate(event) {
		if (event.candidate !== null) {
			sendMessage({
				type: 'candidate',
				candidate: event.candidate.toJSON()
			});
		} else {
			console.log('End of candidates.');
		}
	}

	socket.on('connect', () => {
		console.log('connect socket');
		socket.emit('join', room);
		console.log('join room', room);
	});

	socket.on('ready', () => {
		console.log('socket ready');
		socket.emit('join', room);
		console.log('join room', room);
	});
});
