export interface Sensor {
  version: string;
  sensor_id: string;
  sensor_name: string;
  sensor_mac_addr: string;
  send_interval: string; // In seconds, how often the sensor should wake up and send readings
  last_temp: number; // ambient sensor temp
  last_humidity: number; // ambient sensor humidity
  battery_pct: number;
  // API: All timestamps returned by the API are in the UTC time zone (denoted with "Z" or time offset +00:00).
  // Actually returns `YYYY-MM-DD HH:MM:SS` with no timezone information
  next_checkin: string; // Next DTG when sensor will wake and send reading
  wifi_connect_time: number; // Time sensor takes to connect to Wi-Fi
  offline: string; // Whether the sensor is offline or online
  // last_tcTemp has returned both strings and numbers of valid temperatures
  last_tcTemp?: string; // undocumented thermocouple probe temperature - returns "n" when no probe
  TC_TYPE?: string; // undocumented thermocouple probe type
}

export const requestTempStickApi = async (apiUrl: string, apiKey: string) => {
  // https://tempstickapi.com/docs/ v1.0.0
  // returns the `data` from the requested API
  /*
     * TempStick API Response: {
     *  "type": string,
     *  "message": string,
     *  "data": JSON
     */
  const headers = new Headers();
  headers.append('X-API-KEY', apiKey);
  headers.append('Content-Type', 'text/plain');
  const res = await fetch(apiUrl, {headers: headers});
  if (res.status !== 200) {
    // catch all non-200 error codes (400, 500, etc)
    throw new Error(formatErrorMessage(JSON.stringify(res),
      `Received a bad response code ${apiUrl} (not '200') resulting in the inability to request your device(s). ` +
        'Check the API at https://tempstickapi.com/docs/'));
  }
  const jsonData = (await res.json());
  if (jsonData.type !== 'success') {
    // catch APi errors that have a valid 200 return but are not successful
    throw new Error(formatErrorMessage(JSON.stringify(jsonData),
      `Received an unsuccessful response ${apiUrl} (not 'success')  resulting in the ` +
        'inability to request your device(s).'));
  }
  return jsonData.data;
};

export const formatErrorMessage = (errorMessage: string, errorContext?: string): string => {
  return `${errorContext ? errorContext : ''} Report the following response in our issue tracker: ` +
          'https://github.com/gorhack/tempstick/issues\n' +
          `${errorMessage}`;
};