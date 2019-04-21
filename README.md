# logitech-craft-plugin

A JavaScript (and TypeScript) API for creating a Logitech Options Craft keyboard plugin.

Make sure to reference the [official Craft SDK documentation as well](https://github.com/Logitech/logi_craft_sdk/blob/master/documentation/Craft_Crown_SDK.md).

### API and Example

```ts
import { CraftPlugin } from 'logitech-craft-plugin';

// Create the plugin instance by passing your unique plugin GUID
const craftKeyboard = new CraftPlugin({
  pluginGuid: '93928702-2f0b-4b5d-b125-394b29d9fba5', // Required. Your plugin GUID.
  reconnect: true // Optional. Should the plugin automatically try to reconnect
                  // to the Logitech Options server if an error happens?
                  // Defaults to 'true'.
});

// Listen to connection attempt events
craftKeyboard.on('connect:begin', () => {
  console.log('Connecting to Craft keyboard');
});

// Listen to connection success events
craftKeyboard.on('connect:done', () => {
  console.log('Connected to Craft keyboard');
});

// Listen to connection failure events
craftKeyboard.on('connect:failed', (ex) => {
  console.log('Failed to connect to Craft keyboard', ex.message);
});

// Listen to ANY crown turn event
craftKeyboard.on('crown:turn', () => {
  console.log('Crown turned some amount');
});

// Listen to specificly left crown turn events
craftKeyboard.on('crown:turn:positive', () => {
  console.log('Crown turned right');
});

// Listen to specificly right crown turn events
craftKeyboard.on('crown:turn:negative', () => {
  console.log('\nCrown turned left');
});

// Listen to ANY crown touch event
craftKeyboard.on('crown:touch', () => {
  console.log('Crown touched or released');
});

// Listen to specificly crown touched events
craftKeyboard.on('crown:touch:touched', () => {
  console.log('Crown touched');
});

// Listen to specificly turn released events
craftKeyboard.on('crown:touch:released', () => {
  console.log('Crown released');
});

// Change the active tool (e.g. user switched to a different tool in your app)
craftKeyboard.changeTool(toolIdString);

// Close the connection
craftKeyboard.close();
```

### More extensive example

This code is used in the [Logitech Craft VS Code extension](https://github.com/idolize/logitech-craft-vscode).
