class EmulatorAudioProcessor extends AudioWorkletProcessor {

    constructor(options) {
        super(options);

        this.samples_buffer_size = 16 * 1024;
        this.samples             = new Float32Array(this.samples_buffer_size);
        this.samples_insert_pos  = 4096;
        this.samples_read_pos    = 0;

        this.port.onmessage = (event) => {
            // when receiving a 'push-samples' message, copy them into the samples buffer
            // on the current location of the insert pointer
            if (event.data.id === "push-samples") {
                let samples = event.data.samples;
                let samples_count = samples.length;

                // copy samples
                for(let i=0; i<samples_count; i++) {
                    this.samples[this.samples_insert_pos] = samples[i];
                    this.samples_insert_pos = (this.samples_insert_pos + 1) % this.samples_buffer_size;
                }

                // If we just did overwrite the samples currently being read,
                // 'reset' the reading pointer to a position distant to the insert pointer.
                // This may cause a single audio pop, but should avoid noise when the
                // currently played samples change all the time.
                if (
                        this.samples_read_pos < this.samples_insert_pos
                    &&  this.samples_read_pos > (this.samples_insert_pos - samples_count)
                ) {
                    this.samples_read_pos =
                        (this.samples_insert_pos + this.samples_buffer_size / 2)
                        % this.samples_buffer_size
                    ;
                }
            }
        };
    }


    process(inputs, outputs, _parameters) {
        if (outputs.length >= 1) {
            let output     = outputs[0];
            let channels   = output.length;
            let output_len = output[0].length;

            // copy samples from the samples buffer on the current read pointer
            for(let i=0; i<output_len; i++) {
                let l = this.samples[this.samples_read_pos];
                let r = this.samples[this.samples_read_pos + 1];

                if (channels >= 2) {
                    output[0][i] = l;
                    output[1][i] = r;
                }
                else if (channels >= 1) {
                    output[0][i] = (l + r) / 2;
                }

                this.samples_read_pos = (this.samples_read_pos + 2) % this.samples_buffer_size;
            }
        }

        return true;
    }
}

registerProcessor("emulator-audio", EmulatorAudioProcessor);
