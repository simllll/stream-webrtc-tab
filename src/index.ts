import * as os from "node:os";
import cors from "cors";
import moment from "moment";

import { Server } from "socket.io";

import express from "express";
import { readFile } from "fs/promises";
import { Page } from "puppeteer";
import { startStream, launch } from "./stream.js";
import { IPlayerStatus } from "./HokifyRTCDashboardReceiver.js";
import { ChromecastLookup } from "./ChromecastLookup.js";
import { ChromecastDevice } from "./ChromecastDevice.js";

const PORT = 8000;
const streamPingInterval = 60000; // in ms
const deviceScaleFactor = 0.75;
const width = 1920 * deviceScaleFactor; // 1280; // 1920,
const height = 1080 * deviceScaleFactor; // 720; // 1080

const roomBroadCasters: { [room: string]: string } = {};

const config = JSON.parse(
  await readFile(new URL("../config.json", import.meta.url), "utf-8")
);

const dashboardStreams: {
  [screen: string]: {
    started?: Date;
    lastPing?: Date;
    // lastExited?: Date;
    // lastError?: any;
    // lastPing?: Date;
    // lastOutput?: string;
  };
} = {};
const chromeCastDevices: {
  [device: string]: {
    host?: string;
    friendlyName?: string;
    statusUpdated?: Date;
    deviceStatus?: any;
    playerStatus?: IPlayerStatus;
  };
} = {};
console.log("starting up...");
const app = express();

const server = app.listen(PORT, () => {
  console.log(
    `listening on port ${PORT} Version: ${process.env.npm_package_version} (${process.env.RELEASE})`
  );
});
app.use(express.static("media"));

app.use(cors());

const io = new Server(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true,
  },
});

async function startBrowser() {
  console.log(`launching browser`);
  const browser = await launch({
    executablePath: config.browserExecutable,
    args: [
      "--headless=new", // from chrome v109 onwoards
      //  "--headless=chrome",
      /* '--start-fullscreen', */ "--autoplay-policy=no-user-gesture-required",
      /* '--window-size=1920,1080', */ "--no-default-browser-check",
    ],
    ignoreDefaultArgs: ["--mute-audio", "--enable-automation"],
    defaultViewport: {
      deviceScaleFactor,
      width, // 1920,
      height, // 1080
    },
  });

  const context = browser.defaultBrowserContext();
  context.clearPermissionOverrides();

  // mimeType: 'video/mp4; codecs="mpeg4, aac"'
  // mimeType: 'video/mp4; codecs="h264, aac"'
  // mimeType: video/webm;codecs=h264
  console.log(`browser started...`);

  return {
    browser,
    context,
  };
}

async function setupScreens(
  screens: {
    url: string;
    name: string;
    cookies: {
      name: string;
      value: {
        deviceName: string;
        audioOutput: { music: number; effect: number };
      };
      domain: string;
    }[];
  }[]
) {
  try {
    const { context, browser } = await startBrowser();

    for (const screen of screens) {
      if (!dashboardStreams[screen.name]) {
        dashboardStreams[screen.name] = {};
      }
      const url = new URL(screen.url);

      const startPage = async () => {
        context.overridePermissions(url.origin, ["camera", "microphone"]);
        const page = await context.newPage();
        // await page.setViewport({ deviceScaleFactor, width, height });

        if (screen.cookies) {
          page.setCookie(
            ...screen.cookies.map((c) => ({
              ...c,
              value:
                typeof c.value === "object" ? JSON.stringify(c.value) : c.value,
              domain: c.domain || url.host,
            }))
          );
        }
        await page.goto(url.href);
        return page;
      };

      const runStream = async (page: Page) => {
        try {
          console.log("start stream...", screen.name);
          await startStream(page, screen.name, deviceScaleFactor);

          const checkStream = async () => {
            console.log(`pinging stream...`, screen.name);
            io.sockets
              .in(roomBroadCasters[screen.name])
              .emit("ping", screen.name);

            const outdatedPing = new Date();
            outdatedPing.setMilliseconds(
              outdatedPing.getMilliseconds() - streamPingInterval * 2
            );
            if (
              !dashboardStreams[screen.name].lastPing ||
              dashboardStreams[screen.name].lastPing < outdatedPing
            ) {
              console.error(
                "got no pong from checksteram",
                screen.name,
                " restarging stream...."
              );
              runStream(page);
            } else {
              console.log(
                "ping/pong all good",
                screen.name,
                dashboardStreams[screen.name]
              );
              setTimeout(checkStream, streamPingInterval);
            }
          };

          setTimeout(checkStream, streamPingInterval);
        } catch (err) {
          console.log(
            `stream ${screen.name} failed, retrying in 1 second`,
            err
          );
          page.close();
          setTimeout(async () => {
            runStream(await startPage());
          }, 1000);
        }
      };
      await runStream(await startPage());
    }

    const restartScreen = async (err) => {
      console.log(`browser exited, restarting...: ${err}`);
      try {
        await browser.close();
      } catch (errClose) {
        // closing browser failed
      }
      setupScreens(screens);
    };

    browser.on("disconnected", (err) => {
      restartScreen(err);
    });

    // dashboardStreams[screen.name].room = dashboardScreen.room;
  } catch (err) {
    console.error("setup screen failed", err);
    // dashboardStreams[screen.name].lastError = err;
    setTimeout(() => setupScreens(screens), 5000);
  }
}

app.get("/", (_req, res) => {
  res.send(
    `<html>
					<head>
						<meta name="viewport" content="width=device-width, initial-scale=1">
					  <link rel="stylesheet" href="https://files.hokify.com/devops/led-boxes.css">
					</head>
					<body>
					  <h1><div class="led-green"></div> dasboard-streaming-server</h1>
					  Environment: ${process.env.NODE_ENV}<br>
					  Version: ${process.env.npm_package_version} (${process.env.RELEASE})<br>
					  <br>
					  <br>
						<hr>
					  <h2>Dashboard Streams:</h2>
					 
					  <ul>
					  ${Object.keys(dashboardStreams)
              .map(
                // Url: <strong><a href="${dashboardStreams[name].url}">${dashboardStreams[name].url}</a></strong><br>
                (name) => `<li><h3>${name}</h3>
								
								Last Ping: <strong>${
                  /* dashboardStreams[name].lastPing
                            ? moment(dashboardStreams[name].lastPing).fromNow()
                            : */ "-"
                }</strong><br>
								Last Output: <strong>${
                  /* dashboardStreams[name].lastOutput || */ "-"
                }</strong><br>
								Last Started: <strong>${
                  dashboardStreams[name].started
                    ? moment(dashboardStreams[name].started).fromNow()
                    : "-"
                }</strong><br>
								Last Exited: <strong>${
                  /* dashboardStreams[name].lastExited
                            ? moment(dashboardStreams[name].lastExited).fromNow()
                            : */ "-"
                }</strong><br>
								Last Error: <strong>${
                  /* dashboardStreams[name].lastError || */ "-"
                }</strong><br></li>`
              )

              .join("")}
					  </ul>
					  <hr>
					  <h2>Chromecast Devices:</h2>
					   <ul> 
					  ${Object.keys(chromeCastDevices)
              .map(
                (name) => `<li><h3>${
                  chromeCastDevices[name].friendlyName || name
                }</h3>
								Host: <strong>${chromeCastDevices[name].host}</strong><br>
								Last Status Update: <strong>${
                  chromeCastDevices[name].statusUpdated
                    ? moment(chromeCastDevices[name].statusUpdated).fromNow()
                    : "-"
                }</strong><br>
								Device Status: <strong><pre>${JSON.stringify(
                  chromeCastDevices[name].deviceStatus
                )}</pre></strong><br>
								Player Status: <strong><pre>${JSON.stringify(
                  chromeCastDevices[name].playerStatus
                )}</pre></strong><br>
								</li>`
              )
              // 								Player State: <strong>${chromeCastDevices[name].playerStatus?.playerState || '-'}</strong><br>
              .join("")}</ul>
					  <hr>
					  <small>${
              process.env.npm_package_name
            } - ${new Date().toLocaleString()}</small>
					</body>
					</html>`
  );
});

io.on("message", (data) => {
  console.log("HELLO", data);
});

io.on("connection", (socket) => {
  console.log("connection incoming...");

  socket.on("pong", (room) => {
    console.log("PONG", room);
    dashboardStreams[room].lastPing = new Date();
  });

  socket.on("message", (message, room) => {
    // console.log('configuration[room]?.socketId', configuration[room]?.socketId, room, socket.id);
    if (
      roomBroadCasters[room] === undefined ||
      socket.id === roomBroadCasters[room]
    ) {
      console.log(
        `got message from broadcaster (${socket.id}), forwarding it to `,
        room,
        message.type
      );
      socket.to(room).emit("message", message);
    } else {
      console.log(
        `got message from client (${socket.id}), forwarding it to broadcaster`,
        message.type
      );
      if (!roomBroadCasters[room]) {
        console.log("NO STREAMER FOUND FOR ", room);
        return;
      }
      socket.to(roomBroadCasters[room]).emit("message", message, socket.id);
    }
  });

  socket.on("disconnect", () => {
    console.log(`client has disconnected: ${socket.id}, ${socket.data}`);
  });

  socket.on("join", async (room, broadcaster) => {
    console.log(
      `Received request join room ${room}`,
      broadcaster ? " as broadcaster" : " as viewer"
    );

    socket.data.room = room;
    socket.join(room);

    if (broadcaster) {
      console.log("### we got a broadcaster for room", room);
      // this is the broadcastre, save desrciption for new clients and send it to all connected ones
      io.sockets.in(room).emit("ready");
      roomBroadCasters[room] = socket.id;
    } else if (roomBroadCasters[room]) {
      console.log("### new watcher for room", room);
      socket.to(roomBroadCasters[room]).emit("joined", room, socket.id);
      // socket.emit('message', configuration[room].sessionDescription);
    } else {
      console.log("NO BROADCASTER YET...", room);
    }

    const clientsInsRoom = await io.in(room).allSockets(); // io.sockets.adapter.rooms.get(room).size;
    console.log("clientsInRoom", clientsInsRoom);
    console.log(`Room ${room} now has ${clientsInsRoom.size} client(s)`);
  });

  socket.on("ipaddr", () => {
    const ifaces = os.networkInterfaces();
    console.log("ipaddr", ifaces);
    for (const dev in ifaces) {
      ifaces[dev]?.forEach((details) => {
        if (details.family === "IPv4" && details.address !== "127.0.0.1") {
          socket.emit("ipaddr", details.address);
        }
      });
    }
  });

  socket.on("bye", () => {
    console.log("received bye");
  });
});

await setupScreens(config.screens);

console.log("all streams up and running, connecting chrome cast devices...");

const chromecastLookup = new ChromecastLookup(config.networkInterface);
chromecastLookup.on("newdevice", async (host, friendlyName) => {
  try {
    if (chromeCastDevices[host]) {
      // console.log('we got this already', host);
      return;
    }

    chromeCastDevices[host] = {
      friendlyName,
      host,
    };

    const room =
      (config.chromecastMapping as { [key: string]: string })[friendlyName] ||
      config.defaultScreen ||
      "";

    console.log("new device", host, friendlyName, room);

    const deviceInstance = new ChromecastDevice(
      {
        room,
        signalHost: `http://${config.networkInterface}:${PORT}`,
      },
      host,
      friendlyName
    );

    deviceInstance.on("status", (status) => {
      if (!status || !chromeCastDevices[host]) return;
      chromeCastDevices[host].statusUpdated = new Date();
      chromeCastDevices[host].deviceStatus = status;
    });

    deviceInstance.on("playerStatus", (status) => {
      if (!status || !chromeCastDevices[host]) return;
      chromeCastDevices[host].playerStatus = status;
    });
    const client = await deviceInstance.start();

    client.on("error", () => {
      delete chromeCastDevices[host];

      // start rediscovery
      chromecastLookup.startLookup();
    });
  } catch (err) {
    console.error(err);
    delete chromeCastDevices[host];

    setTimeout(() => {
      // try again after a while
      chromecastLookup.emit("newdevice", host, friendlyName);
    }, 60000);
  }
});

// test: chromecastLookup.emit('newdevice', '10.1.0.114', 'Test Device');

chromecastLookup.startLookup();
