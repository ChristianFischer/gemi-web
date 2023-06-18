import init, { Cartridge, WasmPlayer } from "./wasm/wasm-player.js";
await init();


let canvas = null;
let player = null;


export function initialize() {
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup",   onKeyUp);
}


export function registerCanvas(c) {
    c.addEventListener("dblclick", onDoubleClick);

    canvas = c;
}


export function registerFileDropOn(element) {
    element.addEventListener("dragover", canAllowDrop);
    element.addEventListener("drop",     onDrop);
    element.addEventListener("click",    onClick)
}


function canAllowDrop(ev) {
    ev.dataTransfer.dropEffect = "copy";
    ev.preventDefault();
}


function onDrop(ev) {
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


function onClick(_ev) {
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


function onDoubleClick(_ev) {
    setCanvasFullScreen(true);
}


function onKeyDown(ev) {
    if (player) {
        player.set_key_pressed(ev.key, true);
    }
}


function onKeyUp(ev) {
    if (player) {
        player.set_key_pressed(ev.key, false);
    }
}


function tryLoadCartridge(file) {
    // clear previous player
    if (player) {
        player.stop();
        player = null;
    }

    let reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onloadend = function() {
        try {
            let result = reader.result;
            if (result) {
                let bytes = new Uint8Array(result);
                let cart  = Cartridge.load_from_bytes(bytes);

                player = WasmPlayer.create_with_cartridge(cart, canvas);
                startMainLoop();
            }
        }
        catch (e) {
            alert("Failed to load Cartridge: " + e);
        }
    };
}


function startMainLoop() {
    setPowerLedOn(true);

    requestAnimationFrame(mainloop);
}


function mainloop() {
    if (player) {
        player.next_frame();

        requestAnimationFrame(mainloop);
    }
    else {
        onMainLoopExit();
    }
}


function onMainLoopExit() {
    setPowerLedOn(false);

    // on exit, leave fullscreen
    setCanvasFullScreen(false);

    player = null;
}


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


function setPowerLedOn(on) {
    let led = document.getElementById("power-led");
    if (led) {
        led.className = on ? "power-led-on" : "power-led-off";
    }
}
