.PHONY: deps clean

WASM_PROJECT_LOCAL_PATH	= ../gb-emu/bin/wasm-player
WWW_ROOT_PACKAGE_PATH	= doc/wasm


deps:
	# Add WASM target for rust
	rustup target add wasm32-unknown-unknown

	# Install wasm-pack
	cargo install wasm-pack


clean:


# build the wasm package from the cargo project in this repositories root folder
# this has a dependency on the emulator's git repo and will pull the source code from there
wasm-player:
	wasm-pack build --release --target web --out-name wasm-player --out-dir $(WWW_ROOT_PACKAGE_PATH) .


# build the wasm package from a local folder
wasm-player-from-local:
	wasm-pack build --release --target web --out-name wasm-player --out-dir out/ $(WASM_PROJECT_LOCAL_PATH)
	rm -rf $(WWW_ROOT_PACKAGE_PATH)
	mv $(WASM_PROJECT_LOCAL_PATH)/out $(WWW_ROOT_PACKAGE_PATH)
