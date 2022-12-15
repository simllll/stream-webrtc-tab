based on the idea of [stream-tab](https://github.com/simllll/stream-tab) and inspired by the 
library [puppeteer-stream](https://github.com/Flam3rboy/puppeteer-stream) a webrtc implementation was born.

# stream-webrtc-tab

cast one or more web pages to one or more chrome devices programatically (via web rtc stream). 
Very useful for streaming your dashboards!

* Auto restarts stream
* uses a custom app as webrtc receiver (APP ID 14E2E176)
* can stream one tab to several chromecasts
* allows you to set cookies (e.g. for login or similar things)

# Introduction
This app starts a puppeteer browser instance (in headless mode) and streams the 
screen via webRTC to specified chromecast devices. 

To get things started you need:
* one webpage you would like to stream ;)
* a chromecast device in your network

# Setup
1. Clone this repository and run `npm install`
2. run `npm run build` 
3. rename config.example.json to config.json and adapt it to your needs (inside of src directory)
4. start it with `npm run start`

## Config File

| Parameter         | Description                                                                                                                                                                                                                                                                                                                | Default Value |
|-------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------|
| networkInterface  | the network address where the server should run on, e.g. 192.168.0.1                                                                                                                                                                                                                                                       |               |                                                                                         | ffmpeg        |
| browserExecutable | path to a custom chromium/chrome installation, see [Puppeteer Launch Options](https://github.com/puppeteer/puppeteer/blob/main/docs/api.md#puppeteerlaunchoptions). E.g. you can set it also to your chrome installation. You need to use chrome (not chromium) if you want to use "directRenderMode"                      | null          |
| chromecastMapping | specifies which device should get which website stream, you can specify the same stream for several devices. E.g. <pre>{ <br>	"Küche": "KitchenScreen", <br>	"Inside Sales": "InsideSalesScreen", <br>	"Dev": "DevScreen", <br>        "Dev 2": "DevScreen"<br> }</pre>  this field is optional, if default screen is set. |               |
| defaultScreen     | for not explicitly mapped chromecast devices, which stream should be used                                                                                                                                                                                                                                                  |               |
| screens           | defines which streams / screens are avaialble. bascially what websites you want to stream.                                                                                                                                                                                                                                 |               |
| screens.url       | the url of the website                                                                                                                                                                                                                                                                                                     |               |
| screens.name      | a name that you use for chromecastMapping and the defaultScreen config                                                                                                                                                                                                                                                     |               |
| screens.cookies   | a name/value pair for setting cookies (optional)                                                                                                                                                                                                                                                                           |               |

# Known Issues
* the resolution for the webrtc screen is limited (due to chromecast limitations it seems), it would be possible technically speaken, but a custom app is not allowed to use the full resolution
 
CONTRIBUTIONS WELCOME! If you are willing to help, just open a PR or contact me via bug system or simon.tretter@hokify.com.

# Frontend
There is a little status page included, which runs on port 8000 by default.
Open `http://<networkInterface>:8000/` in your browser.

# About the code

There are three things in this repository:

1. a node js server with socket.io support ([/src](src))
   - this handles all the communication (with socket.io) and setup, it also listens for chromecast devices and brings them up.

2. a chrome extension ([/extension](extension))
   - this is used to create the webrtc stream source, that is streaming to the deviecs

3. a chromium app ([/dashboard-cast-receiver](dashboard-cast-receiver))
   - this is the receiver that is launched on the chromecasts


