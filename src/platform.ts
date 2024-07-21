import { API, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { TempStickAccessory } from './platformAccessory.js';
import { formatErrorMessage, requestTempStickApi, Sensor } from './utils.js';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class TempStickHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  // public api (latest)
  public readonly tempstickApiUrl: string = 'https://tempstickapi.com/api/v1/';

  constructor(
    public readonly log: Logging,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    this.log.debug('Finished initializing platform:', this.config.name);

    // Homebridge 1.8.0 introduced a `log.success` method that can be used to log success messages
    // For users that are on a version prior to 1.8.0, we need a 'polyfill' for this method
    if (!log.success) {
      log.success = log.info;
    }

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to set up event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.debug('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache, so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices() {
    this.log.debug('Discovering devices with apikey ' + this.config.apiKey);
    (async () => {
      try {
        const request = await requestTempStickApi(this.tempstickApiUrl + 'sensors/all', this.config.apiKey);
        const sensors: [Sensor] = request.items;
        // loop over the discovered devices and register each one if it has not already been registered
        sensors.forEach(sensor => {
          // generate a unique id for the accessory this should be generated from
          // something globally unique, but constant, for example, the device serial
          // number or MAC address
          const uuid = this.api.hap.uuid.generate(sensor.sensor_mac_addr);

          // see if an accessory with the same uuid has already been registered and restored from
          // the cached devices we stored in the `configureAccessory` method above
          const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
          if (existingAccessory) {
            // the accessory already exists
            this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

            // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. e.g.:
            existingAccessory.context.device = sensor;
            this.api.updatePlatformAccessories([existingAccessory]);

            // create the accessory handler for the restored accessory
            // this is imported from `platformAccessory.ts`
            new TempStickAccessory(this, existingAccessory);

            // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, e.g.:
            // remove platform accessories when no longer present
            // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
            // this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
          } else {
            // the accessory does not yet exist, so we need to create it
            // create a new accessory
            const accessory = new this.api.platformAccessory(sensor.sensor_name, uuid);

            // store a copy of the device object in the `accessory.context`
            // the `context` property can be used to store any data about the accessory you may need
            accessory.context.device = sensor;

            // create the accessory handler for the newly create accessory
            // this is imported from `platformAccessory.ts`
            new TempStickAccessory(this, accessory);

            // link the accessory to your platform
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          }

          // TODO use calibrated settings: probe_temp_offset, humidity_offset, temp_offset
          this.log.info(`Initialized accessory ${sensor.sensor_name}. ` +
                `It is ${parseInt(sensor.offline) ? 'offline' : 'online'}. ` +
                `The latest ambient temp was ${sensor.last_temp}°C, ` +
                `ambient humidity of ${sensor.last_humidity}%, ` +
                `${sensor.last_tcTemp ? `probe temp of ${sensor.last_tcTemp}°C ` : ''}` +
                `and battery level at ${sensor.battery_pct}%`);
        });

      } catch (err) {
        if (err instanceof TypeError) {
          this.log.error(formatErrorMessage(err.message, 'Unknown TypeError.'));
        } else if (err instanceof Error) {
          this.log.error(formatErrorMessage(err.message, 'Error requesting all devices'));
        } else {
          this.log.error(formatErrorMessage(String(err), 'Unknown error.'));
        }
      }
    })();
  }
}