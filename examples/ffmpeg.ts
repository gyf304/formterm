import { type Asker, Form, markdown } from "formterm";

import { $ } from "zx";

interface FFprobeOutput {
	streams: Stream[]
	format: Format
}

interface Stream {
	index: number
	codec_name: string
	codec_type: string
}

interface Format {
	filename: string
	nb_streams: number
	format_name: string
	duration: string
}


export default new Form({
	id: "ffmpeg",
	title: "FFmpeg",
	// description supports markdown
	description: markdown`
		A form that implements a simple FFmpeg command builder.
	`
}, async (asker: Asker) => {
	const filename = await asker.text({
		title: "Input filename",
	});
	const ffprobeOutput = await $`ffprobe -v quiet -print_format json -show_format -show_streams ${filename}`;
	let { streams, format } = JSON.parse(ffprobeOutput.stdout) as FFprobeOutput;
	streams = streams.filter((stream: Stream) => stream.codec_type === "video" || stream.codec_type === "audio");

	const config = await asker.group({
		title: "Options",
		questions: {
			streams: asker.group({
				title: "Streams",
				questions: Object.fromEntries(streams.map((stream) => [
					String(stream.index),
					stream.codec_type === "video" ? asker.group({
						title: `Video Stream ${stream.index}`,
						questions: {
							enabled: asker.radio({
								title: "Enabled",
								choices: {
									"yes": "Yes",
									"no": "No",
								},
								default: "yes",
							}),
							codec: asker.dropdown({
								title: "Codec",
								choices: {
									"libx264": "H.264",
									"libvpx-vp9": "VP9",
									"libaom-av1": "AV1",
								},
							}),
						},
					}) : asker.group({
						title: `Audio Stream ${stream.index}`,
						questions: {
							enabled: asker.radio({
								title: "Enabled",
								choices: {
									"yes": "Yes",
									"no": "No",
								},
								default: "yes",
							}),
							codec: asker.dropdown({
								title: "Codec",
								choices: {
									"libfdk_aac": "AAC",
									"libopus": "Opus",
									"libvorbis": "Vorbis",
								},
							}),
						},
					})
				] as const)),
			}),
		}
	});

	const outputFilename = await asker.text({
		title: "Output filename",
	});

	const args: string[] = [];
	args.push("-i", filename);
	for (const [index, stream] of Object.entries(config.streams)) {
		if (stream.enabled === "yes") {
			args.push("-c:" + index, stream.codec);
		}
	}
	args.push(outputFilename);

	await $`ffmpeg ${args}`;
});
