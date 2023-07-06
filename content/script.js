import init, { Cartridge, WasmPlayer } from "./wasm/wasm-player.js";
await init();

const AUDIO_SAMPLE_RATE = 44100;
const TARGET_FRAME_TIME = 1000 / 59.7;

let canvas = null;
let player = null;

let audioCtx = null;
let audioWorklet = null;
let audioGainNode = null;

let nextFrameTime = null;

let isPaused = false;
let currentVolume = 0.10;


/**
 * Initialize the setup and install some mandatory event listener.
 */
export function initialize() {
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup",   onKeyUp);
}


/**
 * Register the canvas which will receive the emulator screen's content.
 */
export function registerCanvas(c) {
    c.addEventListener("dblclick", onDoubleClick);

    canvas = c;
}


/**
 * Register a component which should react on file drag & drop events to load a file.
 */
export function registerFileDropOn(element) {
    element.addEventListener("dragover", canAllowDrop);
    element.addEventListener("drop",     onDrop);
    element.addEventListener("click",    onClick)
}


/**
 * Checks if a drop event is valid.
 */
function canAllowDrop(ev) {
    ev.dataTransfer.dropEffect = "copy";
    ev.preventDefault();
}


/**
 * React on drop events by trying to load a file.
 */
async function onDrop(ev) {
    ev.preventDefault();

    if (ev.dataTransfer.items) {
        [... ev.dataTransfer.items].forEach((item, _i) => {
            if (item.kind === "file") {
                const file = item.getAsFile();
                tryLoadCartridge(file);
            }
        })
    }
}


/**
 * OnClick event which will display a file open dialogue to load a file.
 */
async function onClick(_ev) {
    if (!player) {
        let input = document.createElement("input");
        input.type = "file";
        input.onchange = function (_ev2) {
            [... input.files].forEach((file) => {
                tryLoadCartridge(file);
            })
        };

        input.click();
    }
}


/**
 * Reacts on double click events to switch a canvas into fullscreen.
 */
function onDoubleClick(_ev) {
    setCanvasFullScreen(true);
}


/**
 * Global "KeyDown" event to forward input events to the emulator.
 */
function onKeyDown(ev) {
    if (player) {
        player.set_key_pressed(ev.key, true);
    }
}


/**
 * Global "KeyUp" event to forward input events to the emulator.
 */
function onKeyUp(ev) {
    if (player) {
        player.set_key_pressed(ev.key, false);
    }
}


/**
 * Tries to load a cartridge and instantiate a new emulator with that cartridge.
 * @param file A file to be loaded.
 */
async function tryLoadCartridge(file) {
    // clear previous player
    stopPlayer();

    try {
        let fileData = await file.arrayBuffer();
        let bytes    = new Uint8Array(fileData);
        let cart     = Cartridge.load_from_bytes(bytes);

        player = WasmPlayer.create_with_cartridge(cart, canvas);
        await startEmulatorAudio(player);
        startMainLoop();
    }
    catch (e) {
        alert("Failed to load Cartridge: " + e);
    }
}


/**
 * Stop a previous emulator instance, if any.
 * The emulator player will be cleared after this.
 */
function stopPlayer() {
    if (player) {
        player.stop();
        player = null;
    }

    stopEmulatorAudio();
}


/**
 * Checks whether the emulator is currently paused.
 * If there's currently no emulator running, this also returns true.
 */
export function isEmulatorPaused() {
    return !player || isPaused;
}


/**
 * Set the emulator's paused state.
 */
export async function setEmulatorPaused(paused) {
    isPaused = paused;

    // reset 'nextFrameTime' so the next frame should be produced immediately
    nextFrameTime = window.performance.now();

    // pause or resume audio
    if (audioCtx) {
        if (isPaused) {
            await audioCtx.suspend();
        }
        else {
            await audioCtx.resume();
        }
    }
}


/**
 * Start the emulator's main loop.
 * This will continuously invoke 'mainloop' until being stopped.
 */
function startMainLoop() {
    setPowerLedOn(true);

    nextFrameTime = window.performance.now();
    requestAnimationFrame(mainloop);
}


/**
 * The main function of the emulator which will calculate a single frame,
 * present its display content into the registered canvas and submits
 * any audio samples created.
 * This will being called continuously until being stopped.
 */
function mainloop() {
    if (player) {
        if (!isPaused) {
            // current time
            let now = window.performance.now();

            // checks if enough time has passed to calculate the next frame
            if (now >= nextFrameTime) {
                // run the emulator's CPU until a new frame was generated
                player.next_frame();

                // calculate the time for the next frame being created
                nextFrameTime += TARGET_FRAME_TIME;
            }

            // if the audio context exists, take any generated audio samples
            // and forward them into the audio worklet processor
            if (audioWorklet) {
                let samples = player.take_audio_samples();

                if (samples.length !== 0) {
                    audioWorklet.port.postMessage({ id: "push-samples", samples: samples });
                }
            }
        }

        requestAnimationFrame(mainloop);
    }
    else {
        onMainLoopExit();
    }
}


/**
 * Invoked when the emulator has been stopped and the mainloop stops playing.
 */
function onMainLoopExit() {
    setPowerLedOn(false);

    // on exit, leave fullscreen
    setCanvasFullScreen(false);

    player = null;
}


/**
 * Create a new audio context, if necessary, and a new audio node for the current player
 * to allow audio playback.
 * @param player The emulator instance which sound will be played.
 */
async function startEmulatorAudio(player) {
    try {
        if (!audioCtx) {
            // set up audio context
            let newAudioCtx = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
            await newAudioCtx.audioWorklet.addModule("./content/audio.js");

            audioCtx = newAudioCtx;
        }

        // create the gain node to control the audio volume
        audioGainNode = audioCtx.createGain();
        audioGainNode.gain.setValueAtTime(currentVolume, audioCtx.currentTime);

        // create the node responsible for the actual playback
        audioWorklet = new AudioWorkletNode(
            audioCtx,
            "emulator-audio",
            {
                numberOfInputs: 0,
                numberOfOutputs: 1,
                channelCount: 2,
                processorOptions: {
                }
            }
        );

        // connect the node into the audio context
        audioGainNode.connect(audioCtx.destination);
        audioWorklet.connect(audioGainNode);

        // open the channel from the emulator backend
        player.open_audio(AUDIO_SAMPLE_RATE);
    }
    catch(e) {
        console.log("Failed to start AudioPlayer: " + e);
    }
}


/**
 * Stops the audio playback and clears any remaining audio context and nodes.
 */
function stopEmulatorAudio() {
    if (audioCtx) {
        audioCtx.close();
        audioCtx = null;
    }

    audioGainNode = null;
    audioWorklet = null;
}


/**
 * Get the current volume configured for emulator audio.
 */
export function getVolume() {
    return currentVolume * 100;
}


/**
 * Chance the volume for emulator audio.
 */
export function setVolume(volume) {
    currentVolume = volume / 100.0;

    if (audioGainNode) {
        audioGainNode.gain.setValueAtTime(currentVolume, audioCtx.currentTime);
    }
}


/**
 * Switch or leave fullscreen.
 * @param fs Whether to enable or disable fullscreen mode.
 */
function setCanvasFullScreen(fs) {
    if (fs) {
        if (canvas && player) {
            canvas.requestFullscreen()
                .then(() => { })
            ;
        }
    }
    else {
        document.exitFullscreen()
            .then(() => { })
        ;
    }
}


/**
 * Change the power LED to display either 'on' or 'off'.
 * @param on Whether to enable or disable the power LED.
 */
function setPowerLedOn(on) {
    let led = document.getElementById("power-led");
    if (led) {
        led.className = on ? "power-led-on" : "power-led-off";
    }
}
