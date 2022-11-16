let audioUtil = {};

let _beeping = false;
let _audioStream = null;
let _mediaRecorder = null;
let _isRecording = false;
let _currentAudioSource = null;

audioUtil.record = async function (dataCallback) { // see https://web.dev/media-recording-audio/
    if (!dataCallback) {
        return
    }
    if (!_audioStream) {
        _audioStream = await navigator.mediaDevices.getUserMedia({audio: true, video: false});
    }
    if (!_audioStream) {
        log.warn('no access to audio stream!');
        return;
    }

    let mimeTypes = ['audio/webm', 'audio/ogg', 'audio/mp4'];
    let supportedTypes = mimeTypes.filter(type => MediaRecorder.isTypeSupported(type));
    if (supportedTypes.length === 0) {
        log.warn("recorder supports no mimeType");
        return;
    }

    const recordedChunks = [];
    audioUtil.stopRecording();
    _mediaRecorder = new MediaRecorder(_audioStream, {mimeType: supportedTypes[0]});

    _mediaRecorder.addEventListener('dataavailable', function(e) {
        if (e.data.size > 0) recordedChunks.push(e.data);
    });

    _mediaRecorder.addEventListener('stop', async function() {
        let blob = new Blob(recordedChunks);
        let base64 = await blobToBase64(blob);
        dataCallback({
            base64: base64,
            mimeType: supportedTypes[0]
        });
    });

    _isRecording = true;
    _mediaRecorder.start();
}

audioUtil.stopRecording = function () {
    if (_mediaRecorder) {
        _isRecording = false;
        _mediaRecorder.stop();
        _mediaRecorder = null;
    }
}

audioUtil.isRecording = function () {
    return _isRecording;
}

/**
 * plays audio from base64 encoded string
 *
 * @param base64
 * @param options.onended optional callback that is called after audio playback was ended.
 */
audioUtil.playAudio = function (base64, options) {
    options = options || {};
    let buffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    let context = new AudioContext();
    context.decodeAudioData(buffer.buffer, play);


    function play(audioBuffer) {
        _currentAudioSource = context.createBufferSource();
        _currentAudioSource.buffer = audioBuffer;
        _currentAudioSource.connect(context.destination);
        _currentAudioSource.start(0);
        _currentAudioSource.onended = () => {
            if (options.onended) {
                options.onended();
            }
        };
    }
}

audioUtil.stopAudio = function () {
    if(_currentAudioSource) {
        _currentAudioSource.stop();
        _currentAudioSource = null;
    }
}

/**
 * see https://stackoverflow.com/a/29641185/9219743
 * @param duration of the tone in milliseconds. Default is 50
 * @param frequency of the tone in hertz. default is 440
 * @param volume of the tone. Default is 1, off is 0.
 * @param type of tone. Possible values are sine, square, sawtooth, triangle, and custom. Default is sine.
 * @param callback to use on end of tone
 */
audioUtil.beep = function (frequency, duration, volume, type, callback) {
    if (_beeping) {
        return;
    }
    _beeping = true;
    let audioCtx = new (window.AudioContext || window.webkitAudioContext || window.audioContext);

    let oscillator = audioCtx.createOscillator();
    let gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    gainNode.gain.value = volume || gainNode.gain.value;
    oscillator.frequency.value = frequency || 800;
    oscillator.type = type || oscillator.type;
    oscillator.onended = function() {
        _beeping = false;
        if (callback) {
            callback();
        }
    }
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + ((duration || 50) / 1000));
    setTimeout(() => {
        _beeping = false;
    }, 1000)
};

audioUtil.beepHigh = function () {
    audioUtil.beep(1600);
}

audioUtil.beepHighDouble = function () {
    audioUtil.beep(1600);
    setTimeout(() => {
        audioUtil.beep(1600);
    }, 100);
}

window.audioUtil = audioUtil;

function blobToBase64(blob) {
    return new Promise((resolve, _) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            let base64 = reader.result.substring(reader.result.indexOf(',') + 1);
            resolve(base64);
        }
        reader.readAsDataURL(blob);
    });
}

export {audioUtil};