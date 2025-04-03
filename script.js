const $ = document.querySelector.bind(document);

let port;
let reader;
let writer;
let readLoopActive = false;


let controller_state = "connect";
$("#controller").addEventListener("click", () => {
    switch (controller_state) {
        case "connect":
            controller_state = "connecting";
            $("#connect-error").innerText = "";
            connectSerial().then(() => {
                controller_state = "connected";
                onSerialConnect();
            }).catch((err) => {
                $("#connect-error").innerText = err.toString();
                controller_state = "connect";
            });
            break;
        
        case "connected":
            break;
        
    }
});

const keys = new Set();
document.addEventListener("keydown", (event) => {
    if (!port) return;
    const k = toDir(event.key.toLowerCase());
    
    if (!k) return;
    keys.add(k);

    sendSerialMessage(k).catch(console.error);
});

document.addEventListener("keyup", (event) => {
    if (!port) return;
    const k = toDir(event.key.toLowerCase());

    if (!k) return;
    keys.delete(k);

    // Send space to stop
    if (keys.size == 0) {
        sendSerialMessage(" ").catch(console.error);
    }

});

setInterval(() => {
    
    if (!port?.readable) {
        port = null;
        onDisconnect()
    }
    
    // Occasionally send stop command
    if (port && keys.size == 0) {
        sendSerialMessage(" ").catch(console.error);
    }
}, 500);

function toDir(key) {
    switch (key) {
        case 'w':
        case "arrowup":
            return 'w';
        case 'a':
        case "arrowleft":
            return 'a';
        case 's':
        case "arrowdown":
            return 's';
        case 'd':
        case "arrowright":
            return  'd';
    }

    return null;
}

function onSerialConnect() {
    $("#controller").classList.remove("unconnected");
}

function onDisconnect() {
    $("#controller").classList.add("unconnected");
}



/**
 * Connect to a USB serial device.
 * @returns {Promise<void>}
 */
function connectSerial() {
    return new Promise(async (resolve, reject) => {
        try {
            port = await navigator.serial.requestPort();
            await port.open({ baudRate: 115200 });

            writer = port.writable.getWriter();
            console.log("Connected to serial device.");
            resolve();
        } catch (err) {
            reject("Error connecting to serial device: " + err.message);
        }
    });
}

/**
 * Send a message to the serial device.
 * @param {string} message The message to send.
 * @returns {Promise<void>}
 */
function sendSerialMessage(message) {
    return new Promise(async (resolve, reject) => {
        if (!writer) {
            return reject("Serial device is not connected.");
        }

        try {
            const encoder = new TextEncoder();
            await writer.write(encoder.encode(message));
            resolve();
        } catch (err) {
            reject("Error sending message: " + err.message);
            port = null;
            onDisconnect();
        }
    });
}

/**
 * Start listening for messages from the serial device.
 * @param {function(string)} callback Function to handle received messages.
 * @returns {Promise<void>}
 */
function handleSerialMessages(callback) {
    return new Promise(async (resolve, reject) => {
        if (!port) {
            return reject("Serial device is not connected.");
        }

        readLoopActive = true;
        reader = port.readable.getReader();
        const decoder = new TextDecoder();

        try {
            while (readLoopActive) {
                const { value, done } = await reader.read();
                if (done) break;
                if (value) {
                    callback(decoder.decode(value));
                }
            }
            resolve();
        } catch (err) {
            reject("Error reading from serial device: " + err.message);
        } finally {
            reader.releaseLock();
        }
    });
}

/**
 * Disconnect the serial device.
 * @returns {Promise<void>}
 */
function disconnectSerial() {
    return new Promise(async (resolve, reject) => {
        try {
            readLoopActive = false;
            if (reader) {
                await reader.cancel();
                reader.releaseLock();
            }
            if (writer) {
                writer.releaseLock();
            }
            if (port) {
                await port.close();
                port = null;
            }
            console.log("Serial device disconnected.");
            resolve();
        } catch (err) {
            reject("Error disconnecting serial device: " + err.message);
        }
    });
}
