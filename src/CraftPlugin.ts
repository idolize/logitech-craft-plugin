import WebSocket from 'ws';
import process from 'process';
import EventEmitter from 'events';

const LOGITECH_OPTIONS_URL = 'ws://127.0.0.1:10134';

const stringify = (obj: any) => JSON.stringify(obj);

const sendRegister = (pluginGuid: string) => stringify({
  PID: process.pid,
  application_version: '1.0',
  execName: process.title,
  message_type: 'register',
  plugin_guid: pluginGuid,
});

const sendToolChange = (sessionId: string, toolId: string) => stringify({
  message_type: 'tool_change',
  reset_options: true,
  session_id: sessionId,
  tool_id: toolId,
});

interface ReceiveMessage {
  message_type: 'register_ack' | 'crown_turn_event' | 'crown_touch_event';
}

interface RegisterMessage extends ReceiveMessage {
  message_type: 'register_ack';
  sequence_id: number;
  session_id: string;
  status: number; // e.g. 200
  enable: boolean;
}

interface CrownMessage extends ReceiveMessage {
  message_type: 'crown_turn_event' | 'crown_touch_event';
  device_id: number;
  unit_id: number;
  feature_id: number;
}

interface CrownTurnMessage extends CrownMessage {
  message_type: 'crown_turn_event';
  task_id: string; // 'changetoolvalue'
  task_options: {
    current_tool: string; // e.g. 'slider'
    current_tool_option: string; // e.g. 'numbers2'
  };
  // The number of steps/degrees turned.The value is positive if turned clockwise, negative if turned counter clockwise
  delta: number;
  // The number of ratchet steps turned. The value is positive if turned clockwise, negative if turned counter clockwise
  ratchet_delta: number;
  time_stamp: number;
}

interface CrownTouchMessage extends CrownMessage {
  message_type: 'crown_touch_event';
  touch_state: number; // 0 if the crown was released, 1 if the crown was touched
}

export type ListenerFn = (message: any) => any;
export type CraftPluginEventType =
  | 'connect:begin'
  | 'connect:done'
  | 'connect:failed'
  | 'crown:turn'
  | 'crown:turn:positive'
  | 'crown:turn:negative'
  | 'crown:touch'
  | 'crown:touch:released'
  | 'crown:touch:touched';

interface CraftPluginOptions {
  pluginGuid: string;
  reconnect?: boolean;
}

// https://github.com/Logitech/logi_craft_sdk/blob/master/documentation/Craft_Crown_SDK.md
export default class CraftPlugin {
  private ws!: WebSocket;
  private emitter: EventEmitter;
  private sessionId: string | undefined;
  private opts: CraftPluginOptions;

  constructor({ pluginGuid, reconnect = true }: CraftPluginOptions) {
    this.opts = { pluginGuid, reconnect };
    this.emitter = new EventEmitter();
    setTimeout(() => {
      this.connectWithManager();
    }, 1);
  }

  private connectWithManager() {
    if (this.ws && this.ws.readyState !== this.ws.CONNECTING && this.ws.readyState !== this.ws.CLOSED) {
      console.log('Already connected');
      return;
    }
    if (this.ws) {
      // We are reconnecting so clean up the old instance
      this.ws.removeAllListeners();
    }
    this.ws = new WebSocket(LOGITECH_OPTIONS_URL);
    this.emitter.emit('connect:begin');
    this.ws.once('open', () => {
      this.sessionId = undefined;
      this.ws.send(sendRegister(this.opts.pluginGuid));
      this.ws.on('message', (data: string) => {
        // route the message
        let message: ReceiveMessage;
        try {
          message = JSON.parse(data);
        } catch (e) {
          throw new Error('Unexpected message from Logi Options server: ' + e.message);
        }
        switch (message.message_type) {
          case 'register_ack':
            this.handleRegisterAck(message as RegisterMessage);
            break;
          case 'crown_turn_event':
            this.handleCrownTurn(message as CrownTurnMessage);
            break;
          case 'crown_touch_event':
            this.handleCrownTouch(message as CrownTouchMessage);
            break;
          default:
            break;
        }
      });
      this.ws.on('error', (err) => {
        this.emitter.emit('connect:failed', err);
        console.error('Failed to connect to Logitech Options', err.message);
        if (this.opts.reconnect) {
          setTimeout(() => {
            this.connectWithManager();
          }, 2000);
        }
      });
    });
  }

  private handleRegisterAck(message: RegisterMessage) {
    // Save the session id as this is used for any subsequent communication with Logi Options
    this.sessionId = message.session_id;
    this.emitter.emit('connect:done', message);
  }

  private handleCrownTurn(message: CrownTurnMessage) {
    this.emitter.emit('crown:turn', message);
    if (message.ratchet_delta > 0) {
      this.emitter.emit('crown:turn:positive', message);
    } else if (message.ratchet_delta < 0) {
      this.emitter.emit('crown:turn:negative', message);
    }
  }

  private handleCrownTouch(message: CrownTouchMessage) {
    this.emitter.emit('crown:touch', message);
    if (message.touch_state === 0) {
      this.emitter.emit('crown:touch:released', message);
    } else if (message.touch_state === 1) {
      this.emitter.emit('crown:touch:touched', message);
    }
  }

  public changeTool(toolId: string) {
    if (this.sessionId) {
      this.ws.send(sendToolChange(this.sessionId, toolId));
    } else {
      throw new Error('Not connected yet. Make sure to only send this once the "connect:done" event has occurred');
    }
  }

  public on(type: CraftPluginEventType, listener: ListenerFn) {
    this.emitter.on(type, listener);
  }

  public once(type: CraftPluginEventType, listener: ListenerFn) {
    this.emitter.once(type, listener);
  }

  public close() {
    this.emitter.removeAllListeners();
    this.ws.close();
  }

  public removeAllListeners(type: CraftPluginEventType) {
    this.emitter.removeAllListeners(type);
  }

  public removeListener(type: CraftPluginEventType, listener: ListenerFn) {
    this.emitter.removeListener(type, listener);
  }
}
