import { DefaultMediaReceiver } from "castv2-client";
import { autoPromiseTimeout } from "./PromiseHelper.js";

export interface IPlayerStatus {
  playerState: "BUFFERING" | "PLAYING" | "IDLE" | "STOPPED";
}

export class HokifyRTCDashboardReceiverApp extends DefaultMediaReceiver {
  static APP_ID = "14E2E176";

  declare session: any;

  on(event: "error", listener: (err: Error) => void): this;
  on(event: "status", listener: (result: IPlayerStatus) => void): this;
  on(event: any, listener: any) {
    return super.on(event, listener);
  }

  seek(_time, _cb) {
    return null;
    // return super.seek(time, cb);
  }

  async getStatus(): Promise<IPlayerStatus> {
    return new Promise<IPlayerStatus>((resolve, reject) => {
      super.getStatus((err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      });
    });
  }

  async load(resource: {
    room: string;
    signalHost: string;
  }): Promise<IPlayerStatus> {
    // https://developers.google.com/cast/docs/reference/web_receiver/cast.framework.messages.MediaInformation
    const media = {
      room: resource.room,
      signalHost: resource.signalHost,
      // contentId: resource.url,
      // contentType: resource.contentType || 'video/mp4',
      // streamType: 'LIVE'
      // hlsSegmentFormat,
      // https://developers.google.com/cast/docs/reference/web_receiver/cast.framework.messages#.HlsVideoSegmentFormat
      // hlsVideoSegmentFormat
    };

    return autoPromiseTimeout<IPlayerStatus>(
      new Promise((resolve, reject) => {
        super.load.call(this, media, { autoplay: true }, (err, result) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(result);
        });
      }),
      60000,
      "took too long to start playing"
    );
  }
}
