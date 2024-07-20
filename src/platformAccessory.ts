import {CharacteristicValue, PlatformAccessory, Service} from 'homebridge';

import {TempStickHomebridgePlatform} from './platform.js';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class TempStickAccessory {
  private service: Service;

  /**
   * TODO These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private sensorStates = {
    Active: false,
    LowBattery: true,
  };

  constructor(
    private readonly platform: TempStickHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Ideal Sciences, Inc.')
      // TODO verify type / version equivalent to model
      .setCharacteristic(this.platform.Characteristic.Model,
        'TempStick-' + accessory.context.device.type + '-' + accessory.context.device.version)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.sensor_id);

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    /**
     * Creating multiple services of the same type.
     *
     * To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
     * when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
     * this.accessory.getService('NAME') || this.accessory.addService(this.platform.Service.Lightbulb, 'NAME', 'USER_DEFINED_SUBTYPE_ID');
     *
     * The USER_DEFINED_SUBTYPE must be unique to the platform accessory (if you platform exposes multiple accessories, each accessory
     * can use the same subtype id.)
     */

    // Example: add two "motion sensor" services to the accessory
    const ambientTemperatureService = this.accessory.getService('Ambient Temperature Sensor') ||
      this.accessory.addService(this.platform.Service.TemperatureSensor, 'Ambient Temperature Sensor', 'AmbientTemperatureSensor');

    // undocumented in V1 API, TODO: test if this exists without a probe
    const probe = !!accessory.context.device.last_tcTemp;
    let probeTemperatureService: Service | undefined = undefined;
    if (probe) {
      probeTemperatureService = this.accessory.getService('Probe Temperature Sensor') ||
          this.accessory.addService(this.platform.Service.TemperatureSensor, 'Probe Temperature Sensor', 'ProbeTemperatureSensor');
    }

    this.service = this.accessory.getService(this.platform.Service.HumiditySensor)
                    || this.accessory.addService(this.platform.Service.HumiditySensor);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.displayName);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // register handlers for the Current Temperature Characteristic
    ambientTemperatureService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.handleAmbientCurrentTemperatureGet.bind(this));
    if (probeTemperatureService) {
      probeTemperatureService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
        .onGet(this.handleProbeCurrentTemperatureGet.bind(this));
    }
    this.service.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
      .onGet(this.handleCurrentRelativeHumidityGet.bind(this));
    let services: Service[];
    if (probeTemperatureService) {
      services = [this.service, ambientTemperatureService, probeTemperatureService];
    } else {
      services = [this.service, ambientTemperatureService];
    }
    services.forEach(service => {
      service.getCharacteristic(this.platform.Characteristic.StatusFault).onGet(this.handleStatusFaultGet.bind(this));
      service.getCharacteristic(this.platform.Characteristic.StatusLowBattery).onGet(this.handleLowBatteryGet.bind(this));
    });

    /**
     * Updating characteristics values asynchronously.
     *
     * Example showing how to update the state of a Characteristic asynchronously instead
     * of using the `on('get')` handlers.
     * Here we change update the motion sensor trigger states on and off every 10 seconds
     * the `updateCharacteristic` method.
     *
     */
    setInterval(() => {
      (async () => {
        try {
          const headers = new Headers();
          headers.append('X-API-KEY', this.platform.config.apiKey);
          headers.append('Content-Type', 'text/plain');
          const res = await fetch(this.platform.tempstickApiUrl + `sensor/${this.accessory.context.device.sensor_id}`, {
            headers: headers,
          });
          const sensor = (await res.json()).data;

          if (res.status === 200 && sensor) {
            ambientTemperatureService.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, sensor.last_temp);
            if (probeTemperatureService && sensor.last_tcTemp) {
              probeTemperatureService.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, sensor.last_tcTemp);
            }
            if (sensor.battery_pct < 30) {
              services.forEach(service => {
                service.updateCharacteristic(this.platform.Characteristic.StatusLowBattery,
                  this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW);
              });
            } else {
              services.forEach(service => {
                service.updateCharacteristic(this.platform.Characteristic.StatusLowBattery,
                  this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
              });
            }
            if (parseInt(sensor.offline)) {
              services.forEach(service => {
                service.updateCharacteristic(this.platform.Characteristic.StatusFault,
                  this.platform.Characteristic.StatusFault.GENERAL_FAULT);
              });
            } else {
              services.forEach(service => {
                service.updateCharacteristic(this.platform.Characteristic.StatusFault,
                  this.platform.Characteristic.StatusFault.NO_FAULT);
              });
            }
            this.service.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, sensor.last_humidity);
            // TODO use calibrated settings: probe_temp_offset, humidity_offset, temp_offset
            this.platform.log.info(`Updated accessory ${sensor.sensor_name}. ` +
                `It is ${parseInt(sensor.offline) ? 'offline' : 'online'} with the last ambient temp was ${sensor.last_temp}°C ` +
                `and ambient humidity of ${sensor.last_humidity}% ` +
                `${sensor.last_tcTemp ? `and a probe temp of ${sensor.last_tcTemp}°C ` : ''}` +
                `with a battery level at ${sensor.battery_pct}%`);
          }

        } catch (err) {
        // TODO: Catch 406 and other errors and handle gracefully
          if (err instanceof TypeError) {
            this.platform.log.error(err.message);
          }
        }
      })();
      // seconds to milliseconds - at worst case will be delayed by how often the sensor should wake up and send readings
    }, parseInt(this.accessory.context.device.send_interval) * 1000);
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possible. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  handleAmbientCurrentTemperatureGet(): CharacteristicValue {
    return this.accessory.context.device.last_temp;
  }

  handleProbeCurrentTemperatureGet(): CharacteristicValue {
    if (this.accessory.context.device.last_tcTemp) {
      return this.accessory.context.device.last_tcTemp;
    } else {
      this.platform.log.error('Error getting probe temperature that no longer exists.');
      return -100000; // should never be called if probe is false
    }
  }

  handleCurrentRelativeHumidityGet(): CharacteristicValue {
    return this.accessory.context.device.last_humidity;
  }

  handleStatusFaultGet(): CharacteristicValue {
    if (parseInt(this.accessory.context.device.offline)) {
      return this.platform.Characteristic.StatusFault.GENERAL_FAULT;
    } else {
      return this.platform.Characteristic.StatusFault.NO_FAULT;
    }
  }

  handleLowBatteryGet(): CharacteristicValue {
    if (this.accessory.context.device.battery_pct < 30) {
      return this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW;
    } else {
      return this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
    }
  }
}