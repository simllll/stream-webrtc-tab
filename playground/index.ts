import { startStream, launch } from "../src/stream.js";
import * as fs  from 'node:fs';

(async () => {
try {
	const browser = await launch({
		// executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
		// executablePath: '/usr/bin/google-chrome',
		// headless: true,
		// defaultViewport: null,
		devtools: true,
		args: ["--window-size=1920,1080", "--window-position=1921,0", "--autoplay-policy=no-user-gesture-required"],
		/*args: [
			// '--headless=chrome',
			/!* '--start-fullscreen', *!/ '--autoplay-policy=no-user-gesture-required',
			/!* '--window-size=1920,1080', *!/ '--no-default-browser-check'
		],
		ignoreDefaultArgs: ['--mute-audio', '--enable-automation'],
		defaultViewport: {
			width: 1920,
			height: 1080
		}*/
	});

	const page = await browser.newPage();

	await page.goto("https://hokify.at", {
		waitUntil: "load",
	});

	const stream = await startStream(page, {
		audio: true,
		video: true,
	});

	const file = fs.createWriteStream('./hokify.webm');
	stream.pipe(file);

	/*
	const page2 = await browser.newPage();

	await page2.goto("https://orf.at", {
		waitUntil: "load",
	});

	const stream2 = await getStream(page2, {
		audio: true,
		video: true,
	});

	const file2 = fs.createWriteStream('./orf.webm');
	stream2.pipe(file2);
*/
	/*
	setTimeout(async () => {
		await stream.destroy();
		await stream2.destroy();
		file.close();
		file2.close();
		console.log("finished");
	}, 10000);*/
} catch (err) {
	console.error(err);
}
})();

