/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export function __wbg_wasmplayer_free(a: number): void;
export function wasmplayer_create_with_cartridge(a: number, b: number, c: number, d: number, e: number): void;
export function wasmplayer_get_device_type(a: number, b: number): void;
export function wasmplayer_is_gbc_mode(a: number): number;
export function wasmplayer_next_frame(a: number, b: number): void;
export function wasmplayer_open_audio(a: number, b: number, c: number): void;
export function wasmplayer_take_audio_samples(a: number, b: number): void;
export function wasmplayer_save_cartridge_ram(a: number, b: number): void;
export function wasmplayer_set_key_pressed(a: number, b: number, c: number, d: number): void;
export function __wbg_cartridge_free(a: number): void;
export function cartridge_load_from_bytes(a: number, b: number, c: number): void;
export function cartridge_load_ram_from_bytes(a: number, b: number, c: number, d: number): void;
export function cartridge_get_title(a: number, b: number): void;
export function cartridge_is_gbc(a: number): number;
export function __wbindgen_exn_store(a: number): void;
export function __wbindgen_add_to_stack_pointer(a: number): number;
export function __wbindgen_malloc(a: number, b: number): number;
export function __wbindgen_realloc(a: number, b: number, c: number, d: number): number;
export function __wbindgen_free(a: number, b: number, c: number): void;
