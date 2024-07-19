import {CharacteristicValue, PlatformAccessory, Service} from 'homebridge';

import {Sensor, TempStickHomebridgePlatform} from './platform.js';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class TempStickAccessory {
  private service: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private thermostatStates = {
    CurrentTemp: 0.0,
    BatteryPct: 100,
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
    this.service = this.accessory.getService(this.platform.Service.TemperatureSensor)
                   || this.accessory.addService(this.platform.Service.TemperatureSensor);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.displayName);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // register handlers for the Current Temperature Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.handleCurrentTemperatureGet.bind(this));               // GET - bind to the `getOn` method below

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
          const res = await fetch(this.platform.tempstickApiUrl + `sensor/${this.accessory.context.device.sensor_id}/readings`, {
            headers: headers,
          });
          const sensor = (await res.json()).data;

          this.platform.log.debug('response code ' + res.status);
          if (res.status === 200) {
            this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, sensor.last_temp);
            if (sensor.battery_pct < 30) {
              this.service.updateCharacteristic(this.platform.Characteristic.StatusLowBattery,
                this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW);
            } else {
              this.service.updateCharacteristic(this.platform.Characteristic.StatusLowBattery,
                this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
            }
          }

        } catch (err) {
        // TODO: Catch 406 and other errors and handle gracefully
          if (err instanceof TypeError) {
            this.platform.log.error(err.message);
          }
        }
      })();
    }, 1000);//parseInt(this.accessory.context.device.send_interval) * 1000);
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
  async handleCurrentTemperatureGet(): Promise<CharacteristicValue> {
    this.platform.log.debug('Triggered GET CurrentTemperature');

    return this.accessory.context.device.last_temp;
  }
}