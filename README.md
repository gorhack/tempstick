<p align="center">

<img src="https://github.com/homebridge/branding/raw/latest/logos/homebridge-wordmark-logo-vertical.png" width="150">


<p align="center">
<a href="https://www.npmjs.com/package/homebridge-tempstick"><img title="npm version" src="https://badgen.net/npm/v/homebridge-tempstick?label=stable"></a>
<a href="https://www.npmjs.com/package/homebridge-tempstick"><img title="npm downloads" src="https://badgen.net/npm/dt/homebridge-tempstick"></a>
<a href="https://github.com/gorhack/tempstick/actions/workflows/build.yml"><img title="Node Build" src="https://github.com/gorhack/tempstick/actions/workflows/build.yml/badge.svg"></a>
</p>

# Ideal Sciences Temp Stick Homebridge Plugin

### This is an unofficial plugin to use your [Temp Stick](https://tempstick.com/) sensor with [Homebridge](https://homebridge.io/).

You will need your API key, provided in your [account](https://mytempstick.com/account#developers) settings. This plugin relies on the API provided by Temp
Stick and is dependent on its uptime to retrieve your latest sensors and readings. 

Once loaded, this plugin will display all Temp Stick sensors' ambient temperature and humidity. If you are using a
thermocouple probe, it will also display the probe's temperature. This plugin updates the sensor data at roughly the
same interval set within your account's `Sensor Settings` (once every 15 minutes to 24 hours). Temp Stick, nor this
plugin, will display live Temp Stick readings as the sensor is only active during its `next_checkin`.

If you change any settings or names in your Temp Stick account you may have to reload the plugin to see those changes
reflected and receive timely results.

### Development Roadmap:
- [x] Discover all sensors and probes
- [x] Ambient temperature, ambient humidity, and probe temperature
- [x] Handle API errors gracefully
- [x] Use offsets (`probe_temp_offset`, `humidity_offset`, `temp_offset`) for calibrated sensors
  - `last_tcTemp`, `last_humidity`, and `last_temp` include any user-set offset
- [x] Request latest readings based on `send_interval` and `next_checkin`
- [ ] Homebridge [verified](https://github.com/homebridge/verified)
- [x] Request updated documentation in [API](https://tempstickapi.com/docs/) for undocumented parameters
(`last_tcTemp` and `groups` for example)
  - Response: "...you don't need to worry about these values as they don't have a direct impact
    on the data readings"
- [ ] User config `groups` of sensors instead of retrieving all sensors
