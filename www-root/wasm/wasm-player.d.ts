/* tslint:disable */
/* eslint-disable */
/**
* A wrapper around the internal cartridge type to expose it to the JS side.
*/
export class Cartridge {
  free(): void;
/**
* Load a cartridge from a byte array.
* @param {Uint8Array} bytes
* @returns {Cartridge}
*/
  static load_from_bytes(bytes: Uint8Array): Cartridge;
/**
* Get the title of the cartridge.
* @returns {string}
*/
  get_title(): string;
/**
* Checks whether this cartridge supports GameBoy Color features or not.
* @returns {boolean}
*/
  is_gbc(): boolean;
}
/**
* Web Assembly frontend for the emulator.
* This will be instantiated from JS provides an interface to the emulator backend.
*/
export class WasmPlayer {
  free(): void;
/**
* Create a new emulator instance with an existing cartridge and a canvas element
* where to send the frame data to.
* @param {Cartridge} cartridge
* @param {HTMLCanvasElement} canvas
* @returns {WasmPlayer}
*/
  static create_with_cartridge(cartridge: Cartridge, canvas: HTMLCanvasElement): WasmPlayer;
/**
* Process the next frame and publish it to the canvas.
*/
  next_frame(): void;
/**
* Set the pressed state of a key.
* `key` is the key identifier as provided by the JS key event and will be mapped into
* the corresponding emulator [InputButton] value.
* @param {string} key
* @param {boolean} pressed
*/
  set_key_pressed(key: string, pressed: boolean): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_wasmplayer_free: (a: number) => void;
  readonly wasmplayer_create_with_cartridge: (a: number, b: number, c: number) => void;
  readonly wasmplayer_next_frame: (a: number, b: number) => void;
  readonly wasmplayer_set_key_pressed: (a: number, b: number, c: number, d: number) => void;
  readonly __wbg_cartridge_free: (a: number) => void;
  readonly cartridge_load_from_bytes: (a: number, b: number, c: number) => void;
  readonly cartridge_get_title: (a: number, b: number) => void;
  readonly cartridge_is_gbc: (a: number) => number;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_malloc: (a: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number) => number;
  readonly __wbindgen_free: (a: number, b: number) => void;
  readonly __wbindgen_exn_store: (a: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {SyncInitInput} module
*
* @returns {InitOutput}
*/
export function initSync(module: SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {InitInput | Promise<InitInput>} module_or_path
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: InitInput | Promise<InitInput>): Promise<InitOutput>;
