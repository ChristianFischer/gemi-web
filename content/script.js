import init, { Cartridge, WasmPlayer } from "./wasm/wasm-player.js";
await init();

const AUDIO_SAMPLE_RATE = 44100;
const TARGET_FRAME_TIME = 1000 / 59.7;

// auto save each 5 minutes
const AUTO_SAVE_TIMEOUT = 300000;


/**
 * A utility class to connect the HTML/JS frontend with the WASM backend.
 */
export class EmulatorGlue {
    canvas          = null;
    player          = null;
    romName         = null;

    audioCtx        = null;
    audioWorklet    = null;
    audioGainNode   = null;
    nextFrameTime   = null;

    isPaused        = false;
    currentVolume   = 0.10;

    onRomStarted    = null;
    onRomEnded      = null;

    saveTimeout     = AUTO_SAVE_TIMEOUT;
    configDirty     = false;


    constructor() {
        this.loadConfig();

        window.addEventListener('beforeunload', (_e) => {
            this.saveConfig();
            this.serializeCartridgeRam();
        });
    }


    /**
     * Register the canvas which will receive the emulator screen's content.
     */
    registerCanvas(c) {
        this.canvas = c;
    }


    /**
     * Register a component which should react on file drag & drop events to load a file.
     */
    registerFileDropOn(element) {
        element.addEventListener(
            "dragover",
            (ev) => {
                ev.dataTransfer.dropEffect = "copy";
                ev.preventDefault();
            }
        );

        element.addEventListener(
            "drop",
            (ev) => {
                ev.preventDefault();

                if (ev.dataTransfer.items) {
                    for (const item of [...ev.dataTransfer.items]) {
                        if (item.kind === "file") {
                            const file = item.getAsFile();
                            this.tryLoadCartridge(file).then(() => { })
                        }
                    }
                }

            }
        );
    }


    /**
     * Registers a component to react on click-events to open a ROM file.
     */
    registerClickToOpenOn(element) {
        element.addEventListener(
            "click",
            (ev) => {
                if (!this.player) {
                    let input = document.createElement("input");
                    input.type = "file";
                    input.onchange = function (_ev2){
                        for (const file of [...input.files]) {
                            this.tryLoadCartridge(file).then(() => { });
                        }
                    }.bind(this);

                    input.click();
                }

                ev.stopPropagation();
            }
        );
    }


    /**
     * Saves the current configuration to the local storage.
     */
    saveConfig() {
        if (this.configDirty) {
            localStorage.setItem(
                "_config",
                JSON.stringify({
                    "volume": this.currentVolume
                })
            );

            this.configDirty = false;
        }
    }


    /**
     * Loads the configuration from local storage.
     */
    loadConfig() {
        try {
            let config_string = localStorage.getItem("_config");
            if (config_string) {
                let config = JSON.parse(config_string);

                if (config.hasOwnProperty("volume")) {
                    this.currentVolume = config["volume"];
                }
            }

            this.configDirty = false;
        }
        catch (e) {
            console.log("Failed to load config: " + e);
        }
    }


    /**
     * Initialize the setup and install some mandatory event listener.
     */
    registerKeyEvents() {
        document.addEventListener(
            "keydown",
            (ev) => {
                if (this.player) {
                    this.player.set_key_pressed(ev.key, true);
                    ev.preventDefault();
                }
            }
        );

        document.addEventListener(
            "keyup",
            (ev) => {
                if (this.player) {
                    this.player.set_key_pressed(ev.key, false);
                    ev.preventDefault();
                }
            }
        );
    }


    /**
     * Tries to load a cartridge and instantiate a new emulator with that cartridge.
     * @param file A file to be loaded.
     */
    async tryLoadCartridge(file) {
        // clear previous player
        this.stopPlayer();

        try {
            let fileData = await file.arrayBuffer();
            let bytes    = new Uint8Array(fileData);
            let cart     = Cartridge.load_from_bytes(bytes);
            this.romName = cart.get_title();

            // try to load the cartridge RAM into the cartridge object
            // before instantiating the emulator.
            try {
                let ram = this.deserializeCartridgeRam(this.romName);
                if (ram) {
                    cart.load_ram_from_bytes(ram);
                }
            }
            catch(e) {
                console.log("Failed to load cartridge RAM: " + e);
            }

            this.player = WasmPlayer.create_with_cartridge(cart, this.canvas);
            await this.startEmulatorAudio(this.player);
            this.startMainLoop();
            this.fireOnRomStarted(this.romName)
        }
        catch (e) {
            alert("Failed to load Cartridge: " + e);
        }
    }


    /**
     * Tries to load a cartridge from a web address and instantiate a
     * new emulator with that cartridge.
     * @param url The URL from where to load the cartridge.
     */
    async tryLoadCartridgeFromUrl(url) {
        try {
            let response = await fetch(url);
            let data     = await response.blob();

            await this.tryLoadCartridge(data);
        }
        catch (e) {
            alert("Failed to load Cartridge: " + e);
        }
    }


    /**
     * Load the RAM image for a specific cartridge.
     */
    deserializeCartridgeRam(name) {
        try {
            let ram_as_str = localStorage.getItem(name);
            if (ram_as_str) {
                return JSON.parse(ram_as_str);
            }
        }
        catch (e) {
            console.log("Failed to deserialize cartridge RAM: " + e);
        }

        return null;
    }


    /**
     * Save the emulator's current state into LocalStorage.
     */
    serializeCartridgeRam() {
        if (this.player) {
            let ram = this.player.save_cartridge_ram();

            if (ram && this.romName) {
                let ram_as_str = JSON.stringify(Array.from(ram));

                localStorage.setItem(
                    this.romName,
                    ram_as_str
                );
            }
        }
    }


    /**
     * Stop a previous emulator instance, if any.
     * The emulator player will be cleared after this.
     */
    stopPlayer() {
        // save cartridge RAM before closing the player
        if (this.player) {
            this.serializeCartridgeRam();
        }

        // clear the player
        this.player = null;

        // stop all audio
        this.stopEmulatorAudio();
    }


    /**
     * Checks whether the emulator is currently paused.
     * If there's currently no emulator running, this also returns true.
     */
    isEmulatorPaused() {
        return !this.player || this.isPaused;
    }


    /**
     * Set the emulator's paused state.
     */
    async setEmulatorPaused(paused) {
        this.isPaused = paused;

        // reset 'nextFrameTime' so the next frame should be produced immediately
        this.nextFrameTime = window.performance.now();

        // pause or resume audio
        if (this.audioCtx) {
            if (this.isPaused) {
                await this.audioCtx.suspend();
            }
            else {
                await this.audioCtx.resume();
            }
        }
    }


    /**
     * Start the emulator's main loop.
     * This will continuously invoke 'mainloop' until being stopped.
     */
    startMainLoop() {
        this.nextFrameTime = window.performance.now();
        requestAnimationFrame(() => { this.mainloop(); });
    }


    /**
     * The main function of the emulator which will calculate a single frame,
     * present its display content into the registered canvas and submits
     * any audio samples created.
     * This will being called continuously until being stopped.
     */
    mainloop() {
        if (this.player) {
            if (!this.isPaused) {
                // current time
                let now = window.performance.now();

                // checks if enough time has passed to calculate the next frame
                if (now >= this.nextFrameTime) {
                    // run the emulator's CPU until a new frame was generated
                    this.player.next_frame();

                    // calculate the time for the next frame being created
                    this.nextFrameTime += TARGET_FRAME_TIME;

                    // update the auto save timeout
                    this.saveTimeout -= TARGET_FRAME_TIME;

                    // when the save timeout passed...
                    if (this.saveTimeout <= 0) {
                        // save the cartridge RAM
                        this.serializeCartridgeRam();

                        // and reset the timeout
                        this.saveTimeout = AUTO_SAVE_TIMEOUT;
                    }
                }

                // if the audio context exists, take any generated audio samples
                // and forward them into the audio worklet processor
                if (this.audioWorklet) {
                    let samples = this.player.take_audio_samples();

                    if (samples.length !== 0) {
                        this.audioWorklet.port.postMessage({ id: "push-samples", samples: samples });
                    }
                }
            }

            requestAnimationFrame(() => { this.mainloop(); });
        }
        else {
            this.onMainLoopExit();
        }
    }


    /**
     * Invoked when the emulator has been stopped and the mainloop stops playing.
     */
    onMainLoopExit() {
        this.fireOnRomEnded();

        // on exit, leave fullscreen
        this.setCanvasFullScreen(false);

        this.player = null;
    }


    /**
     * Create a new audio context, if necessary, and a new audio node for the current player
     * to allow audio playback.
     * @param player The emulator instance which sound will be played.
     */
    async startEmulatorAudio(player) {
        try {
            if (!this.audioCtx) {
                // set up audio context
                let newAudioCtx = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
                await newAudioCtx.audioWorklet.addModule("./content/audio.js");

                this.audioCtx = newAudioCtx;
            }

            // create the gain node to control the audio volume
            this.audioGainNode = this.audioCtx.createGain();
            this.audioGainNode.gain.setValueAtTime(this.currentVolume, this.audioCtx.currentTime);

            // create the node responsible for the actual playback
            this.audioWorklet = new AudioWorkletNode(
                this.audioCtx,
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
            this.audioGainNode.connect(this.audioCtx.destination);
            this.audioWorklet.connect(this.audioGainNode);

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
    stopEmulatorAudio() {
        if (this.audioCtx) {
            this.audioCtx.close();
            this.audioCtx = null;
        }

        this.audioGainNode = null;
        this.audioWorklet = null;
    }


    /**
     * Get the current volume configured for emulator audio.
     */
    getVolume() {
        return this.currentVolume * 100;
    }


    /**
     * Chance the volume for emulator audio.
     */
    setVolume(volume) {
        let newVolume = volume / 100.0;

        if (this.currentVolume !== newVolume) {
            this.currentVolume = newVolume;
            this.configDirty = true;

            if (this.audioGainNode) {
                this.audioGainNode.gain.setValueAtTime(
                    this.currentVolume,
                    this.audioCtx.currentTime
                );
            }
        }
    }


    /**
     * Switch or leave fullscreen.
     * @param fs Whether to enable or disable fullscreen mode.
     */
    setCanvasFullScreen(fs) {
        if (fs) {
            if (this.canvas && this.player) {
                this.canvas.requestFullscreen()
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


    fireOnRomStarted(name) {
        if (typeof(this.onRomStarted) === 'function') {
            this.onRomStarted(name);
        }
    }


    fireOnRomEnded() {
        if (typeof(this.onRomEnded) === 'function') {
            this.onRomEnded();
        }
    }
}
