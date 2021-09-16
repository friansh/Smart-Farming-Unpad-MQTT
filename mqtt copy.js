const mqtt = require("mqtt");
const fs = require("fs");
const User = require("../model/user");

// const DatasetIndexes = require("../model/datasetindexes");
// const Datasets = require("../model/datasets");
// const Devices = require("../model/devices");
// const Images = require("../model/images");
// const Users = require("../model/users");

const mqttClient = mqtt.connect(
  `mqtt://${process.env.MQTT_SERVER}:${process.env.MQTT_PORT}`,
  {
    username: process.env.MQTT_USERNAME,
    username: process.env.MQTT_PASSWORD,
  }
);

const redis = require("redis");

const redisSettings = {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  user: process.env.REDIS_USER,
  password: process.env.REDIS_PASSWORD,
};

const redisClient = redis.createClient(redisSettings);
const subscriber = redis.createClient(redisSettings);
const publisher = redis.createClient(redisSettings);

const io = require("socket.io")(3000, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const redisAdapter = require("socket.io-redis");
io.adapter(
  redisAdapter({
    pubClient: publisher,
    subClient: subscriber,
  })
);

const mqttPublish = (message, token) => {
  function twoDigits(number) {
    if (number < 10) return "0" + number;
    return number;
  }

  mqttClient.publish(
    "smartfarmer/feedback" + (token ? `/${token}` : ""),
    `[${twoDigits(new Date().getHours())}:${twoDigits(
      new Date().getMinutes()
    )}:${twoDigits(new Date().getSeconds())}] ${message}`
  );
};

const mqttPublishBroadcast = (message) => {
  mqttClient.publish("smartfarmer/broadcast", message);
};

mqttClient.on("connect", (connack) => {
  mqttClient.subscribe("friansh/float_data/initoken/inidatasetid", () => {
    console.log("[INFO] MQTT is subscribing to 'smartfarmer/data'...");
    mqttPublishBroadcast(
      "[INFO] The server has started listening to the MQTT data topic..."
    );
  });
});

mqttClient.on("message", async (topic, message) => {
  let data = undefined;

  try {
    data = JSON.parse(message.toString());
  } catch {
    mqttPublishBroadcast(
      "[WARN] I received a data from somebody but i dont understand it!"
    );
    return;
  }

  console.log(
    `[INFO] A data update received from device token '${data.token.slice(
      0,
      10
    )}...'`
  );

  const user = await User.findOne({ device_token: data.token });

  if (!user) {
    mqttPublishBroadcast(
      "[WARN] I received a data from somebody but i dont know who!"
    );
    return;
  }

  let timestamp = new Date().getTime();

  if (data.type == "image") {
    if (!fs.existsSync(`${process.env.IMAGE_DIR}/${user._id}`))
      fs.mkdirSync(`${process.env.IMAGE_DIR}/${user._id}`);

    mqttPublish("Saving the received image to local storage...", data.token);

    fs.writeFile(
      `${process.env.IMAGE_DIR}/${user._id}/${timestamp}.jpg`,
      data.image,
      { encoding: process.env.IMAGE_ENCODING },
      () => {
        const newImage = new ImageFeed({
          user_id: user._id,
          temperature: data.temperature,
          location: data.location,
          point: data.point,
          // image_filename: `${timestamp}.jpg`,
        });

        redisClient.DEL(`${user._id}:images`);

        newImage.save().then(() => {
          mqttPublish(
            "The received image has been recorded to the database.",
            data.token
          );
        });
      }
    );
  }

  if (data.type == "temperatureandhumidity") {
    const newTemperature = new Temperature({
      user_id: user._id,
      temperature: data.temperature,
      location: data.location,
      point: data.point,
      // image_filename: `${timestamp}.jpg`,
    });

    newTemperature.save().then(() => {
      mqttPublish(
        "The temperature data has been saved to the database.",
        data.token
      );
    });

    const newHumidity = new Humidity({
      user_id: user._id,
      humidity: data.humidity,
      location: data.location,
      point: data.point,
    });

    newHumidity.save().then(() => {
      mqttPublish(
        "The humidity data has been saved to the database.",
        data.token
      );
    });

    mqttPublish(
      "Clearing the temperature and humidity Redis cache...",
      data.token
    );
    redisClient.DEL(`${user._id}:temperatures`);
    redisClient.DEL(`${user._id}:humidities`);
  }

  if (data.type == "soilmoisture") {
    const newSoilMoisture = new SoilMoisture({
      user_id: user._id,
      moisture: data.moisture,
      location: data.location,
      point: data.point,
      // image_filename: `${timestamp}.jpg`,
    });

    newSoilMoisture.save().then(() => {
      mqttPublish(
        "The soil moisture data has been saved to the database.",
        data.token
      );
    });

    mqttPublish("Clearing the soil moisture Redis cache...", data.token);
    redisClient.DEL(`${user._id}:soilmoistures`);
  }

  if (data.type == "lightintensity") {
    const newLightIntensity = new LightIntensity({
      user_id: user._id,
      intensity: data.intensity,
      location: data.location,
      point: data.point,
    });

    newLightIntensity.save().then(() => {
      mqttPublish(
        "The light intensity data has been saved to the database.",
        data.token
      );
    });

    mqttPublish("Clearing the light intensity Redis cache...", data.token);
    redisClient.DEL(`${user._id}:lightintensities`);
  }

  if (data.type == "phandtds") {
    const newPH = new pH({
      user_id: user._id,
      ph: data.ph,
      location: data.location,
      point: data.point,
    });

    newPH.save().then(() => {
      mqttPublish("The pH data has been saved to the database.", data.token);
    });

    const newTDS = new TDS({
      user_id: user._id,
      tds: data.humidity,
      location: data.location,
      point: data.point,
    });

    newTDS.save().then(() => {
      mqttPublish("The TDS data has been saved to the database.", data.token);
    });

    mqttPublish("Clearing the pH and TDS Redis cache...", data.token);
    redisClient.DEL(`${user._id}:phs`);
    redisClient.DEL(`${user._id}:tdses`);
  }

  if (data.type == "watertemperature") {
    const newWaterTemperature = new WaterTemperature({
      user_id: user._id,
      temperature: data.temperature,
      location: data.location,
      point: data.point,
    });

    newWaterTemperature.save().then(() => {
      mqttPublish(
        "The water temperature data has been saved to the database.",
        data.token
      );
    });

    mqttPublish("Clearing the water temperature Redis cache...", data.token);
    redisClient.DEL(`${user._id}:watertemperatures`);
  }

  if (data.type == "windspeed") {
    const newWindSpeed = new WindSpeed({
      user_id: user._id,
      speed: data.speed,
      location: data.location,
      point: data.point,
    });

    newWindSpeed.save().then(() => {
      mqttPublish(
        "The wind speed data has been saved to the database.",
        data.token
      );
    });

    mqttPublish("Clearing the wind speed Redis cache...", data.token);
    redisClient.DEL(`${user._id}:windspeeds`);
  }

  // io.emit(
  //   user._id,
  //   JSON.stringify({
  //     user_id: user._id,
  //     temperature: data.temperature,
  //     humidity: data.humidity,
  //     ph: data.ph,
  //     light_intensity: data.light_intensity,
  //     nutrient_flow: data.nutrient_flow,
  //     nutrient_level: data.nutrient_level,
  //     acid_solution_level: data.acid_solution_level,
  //     base_solution_level: data.base_solution_level,
  //     tds: data.tds,
  //     ec: data.ec,
  //     image_url: `${process.env.APP_URL}/log/image/${user._id}/${timestamp}.jpg`,
  //   })
  // );
});
