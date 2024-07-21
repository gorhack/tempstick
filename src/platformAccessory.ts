import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';

import { TempStickHomebridgePlatform } from './platform.js';
import { formatErrorMessage, requestTempStickApi, Sensor } from './utils.js';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class TempStickAccessory {
  private readonly service: Service;

  private _sensorStates: {
    AmbientTemp: number;
    LowBattery: number;
    Humidity: number;
    Fault: number;
    ProbeTemp: number | undefined;
  } = {
      AmbientTemp: -10000.0,
      Fault: 1,
      Humidity: -1.0,
      LowBattery: 1,
      ProbeTemp: undefined,
    };

  get sensorStates(): { AmbientTemp: number; LowBattery: number; Humidity: number; Fault: number; ProbeTemp: number | undefined } {
    return this._sensorStates;
  }

  set sensorStates(sensor: Sensor) {
    this._sensorStates = {
      AmbientTemp: sensor.last_temp as number,
      Fault: parseInt(sensor.offline)
        ? this.platform.Characteristic.StatusFault.GENERAL_FAULT
        : this.platform.Characteristic.StatusFault.NO_FAULT,
      Humidity: sensor.last_humidity as number,
      LowBattery: sensor.battery_pct < 30
        ? this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
        : this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL,
      ProbeTemp: sensor.last_tcTemp ? parseFloat(sensor.last_tcTemp) : undefined,
    };
  }

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

    // initialize sensorStates from the constructor accessory device
    this.sensorStates = this.accessory.context.device;

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

    const ambientTemperatureService = this.accessory.getService('Ambient Temperature Sensor') ||
      this.accessory.addService(this.platform.Service.TemperatureSensor, 'Ambient Temperature Sensor', 'AmbientTemperatureSensor');
    ambientTemperatureService.setCharacteristic(this.platform.Characteristic.Name, accessory.displayName + ' Ambient Temp Sensor');

    // undocumented in V1 API, TODO: test if this exists without a probe
    const probe = !!accessory.context.device.last_tcTemp;
    let probeTemperatureService: Service | undefined = undefined;
    if (probe) {
      probeTemperatureService = this.accessory.getService('Probe Temperature Sensor') ||
          this.accessory.addService(this.platform.Service.TemperatureSensor, 'Probe Temperature Sensor', 'ProbeTemperatureSensor');
      probeTemperatureService.setCharacteristic(this.platform.Characteristic.Name, accessory.displayName + ' Probe Temp Sensor');
    }

    this.service = this.accessory.getService(this.platform.Service.HumiditySensor)
                    || this.accessory.addService(this.platform.Service.HumiditySensor);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.displayName + ' Humidity Sensor');

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
          const sensor = await requestTempStickApi(
            `${this.platform.tempstickApiUrl}sensor/${this.accessory.context.device.sensor_id}`,
            this.platform.config.apiKey);
          this.sensorStates = sensor;
          ambientTemperatureService.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.sensorStates.AmbientTemp);
          if (probeTemperatureService && sensor.last_tcTemp && this.sensorStates.ProbeTemp) {
            // Must reload Homebridge to rediscover devices if a probe is added
            probeTemperatureService.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.sensorStates.ProbeTemp);
          }
          services.forEach(service => {
            service.updateCharacteristic(this.platform.Characteristic.StatusLowBattery,
              this.sensorStates.LowBattery);
          });
          services.forEach(service => {
            service.updateCharacteristic(this.platform.Characteristic.StatusFault,
              this.sensorStates.Fault);
          });
          this.service.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, this.sensorStates.Humidity);
          // TODO use calibrated settings: probe_temp_offset, humidity_offset, temp_offset
          this.platform.log.info(`Updated accessory: ${sensor.sensor_name}. ` +
                `It is ${this.sensorStates.Fault ? 'offline' : 'online'}. `+
                `The latest ambient temp was ${this.sensorStates.AmbientTemp}°C, ` +
                `ambient humidity of ${this.sensorStates.Humidity}%, ` +
                `${sensor.last_tcTemp ? `probe temp of ${this.sensorStates.ProbeTemp}°C ` : ''}` +
                `and battery level at ${sensor.battery_pct}%`);

        } catch (err) {
          if (err instanceof TypeError) {
            this.platform.log.error(formatErrorMessage(err.message, 'Unknown TypeError.'));
          } else if (err instanceof Error) {
            this.platform.log.error(formatErrorMessage(err.message, 'Error requesting accessory.'));
          } else {
            this.platform.log.error(formatErrorMessage(String(err), 'Unknown error.'));
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
    return this.sensorStates.AmbientTemp;
  }

  handleProbeCurrentTemperatureGet(): CharacteristicValue {
    if (this.sensorStates.ProbeTemp) {
      return this.sensorStates.ProbeTemp;
    } else {
      // getting probe temperature for service but do not have probe accessory - incorrectly initialized
      this.platform.log.error(formatErrorMessage('Incorrectly initialized temperature probe.'));
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.RESOURCE_DOES_NOT_EXIST);
    }
  }

  handleCurrentRelativeHumidityGet(): CharacteristicValue {
    return this.sensorStates.Humidity;
  }

  handleStatusFaultGet(): CharacteristicValue {
    if (this.sensorStates.Fault) {
      // accessory is offline
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
    return this.sensorStates.Fault;
  }

  handleLowBatteryGet(): CharacteristicValue {
    return this.sensorStates.LowBattery;
  }
}