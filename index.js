console.log("[INFO] Program started...");

require("dotenv").config();

const fs = require("fs");
const mqtt = require("mqtt");

const DatasetIndexes = require("./model/DatasetIndex");
const ControlQueue = require("./model/ControlQueue");
const Heartbeat = require("./model/Heartbeat");
const Control = require("./model/Control");
const Dataset = require("./model/Dataset");
const Device = require("./model/Device");
const Image = require("./model/Image");

const mongoose = require("mongoose");

mongoose.connect(
  `mongodb://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_AUTH}`,
  {
    useNewUrlParser: true,
    dbName: process.env.DB_NAME,
  }
);

var client = mqtt.connect("mqtt://smartfarmingunpad.com:8883", {
  username: "default",
  password: "default",
});

client.on("connect", function () {
  client.subscribe("friansh/float_data/+/+", (err) => {
    if (!err) console.log("The server is listening to the float data topic.");
  });
  client.subscribe("friansh/image/+/+", (err) => {
    if (!err) console.log("The server is listening to the image topic.");
  });
  client.subscribe("friansh/heartbeat", (err) => {
    if (!err) console.log("The server is listening to the heartbeat topic.");
  });
});

client.on("message", async (topic, message) => {
  const messageParams = {
    dataType: topic.split("/")[1],
    deviceToken: topic.split("/")[2],
    datasetId: topic.split("/")[3],
  };

  if (messageParams.dataType == "heartbeat") {
    let heartbeatData;
    try {
      heartbeatData = JSON.parse(message.toString());
    } catch {
      console.log("Failed to parse hearbeat data.");
      return;
    }

    const device = await Device.findOne({
      token: heartbeatData.device_token,
    })
      .exec()
      .catch(() => {
        console.log("Err4");
      });

    const searchHeartbeat = await Heartbeat.find({
      device_id: device._id,
    })
      .exec()
      .catch(() => {
        console.log("Err5");
      });

    if (searchHeartbeat.length == 0) {
      const newHeartbeat = new Heartbeat({
        device_id: device._id,
        firmware_version: heartbeatData.firmware_version,
      });

      newHeartbeat.save(() => {
        console.log(`[${device.name}] heartbeat (NEW)`);
      });
    } else {
      Heartbeat.updateOne(
        { device_id: device._id },
        {
          firmware_version: heartbeatData.firmware_version,
        },
        () => {
          console.log(`[${device.name}] heartbeat`);
        }
      );
    }

    return;
  }

  const dataset = await DatasetIndexes.findById(messageParams.datasetId)
    .exec()
    .catch(() => console.log("Err1"));

  if (!dataset) return;

  const device = await Device.findOne({
    user_id: dataset.user_id,
    token: messageParams.deviceToken,
  })
    .exec()
    .catch(() => console.log("Err2"));

  if (device == null) {
    console.log(
      `Dataset "${dataset.name}" does not linked with device "${messageParams.deviceToken}".`
    );
    return;
  }

  if (messageParams.dataType == "float_data") {
    let newDataset = new Dataset({
      index_id: messageParams.datasetId,
      device_id: messageParams.deviceToken,
      value: parseFloat(message.toString()),
    });

    newDataset
      .save()
      .then((doc) => {
        console.log(
          `[${messageParams.datasetId}] [${
            messageParams.deviceToken
          }] float data: ${parseFloat(message.toString())}`
        );
      })
      .catch(() => console.log("Err3"));
  } else if (messageParams.dataType == "image") {
    const timestamp = new Date().getTime();

    if (!fs.existsSync(`${process.env.IMAGE_DIR}/${messageParams.datasetId}`))
      fs.mkdirSync(`${process.env.IMAGE_DIR}/${messageParams.datasetId}`);

    fs.writeFile(
      `${process.env.IMAGE_DIR}/${messageParams.datasetId}/${timestamp}.jpg`,
      message.toString(),
      { encoding: process.env.IMAGE_ENCODING },
      () => console.log("Image file saved!")
    );

    let newImage = new Image({
      index_id: messageParams.datasetId,
      device_id: messageParams.deviceToken,
      file_name: `${timestamp}.jpg`,
    });

    newImage
      .save()
      .then((doc) => {
        console.log("The image record has been saved to the database ");
      })
      .catch(() => console.log("Err5"));
  }
});

setInterval(async () => {
  let controlQueues = await ControlQueue.find({}).exec();
  const devices = await Device.find({}).exec();

  controlQueues = controlQueues.map((val) => {
    Control.find({ control_id: val.control_id }, (err, doc) => {
      const parsed = {
        control_id: val.control_id,
        value: val.value,
        devices: doc.map((val) => {
          const device = devices.find((dev) => {
            if (val.device_id == dev._id) return true;
            return false;
          });

          return {
            name: device.name,
            description: device.description,
            token: device.token,
          };
        }),
        createdAt: val.createdAt,
      };

      parsed.devices.map((val, index) => {
        const topic = `friansh/control/${val.token}/${parsed.control_id}`;
        const value = parsed.value;

        console.log(`Publishing data to topic "${topic} with value: ${value}`);
        client.publish(topic, value);
      });

      ControlQueue.deleteOne(val, (err) => {
        if (err) console.error("Failed to delete the control queue.");
      });
    });
  });
}, 1000);
