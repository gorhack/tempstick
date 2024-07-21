// TODO use calibrated settings: probe_temp_offset, humidity_offset, temp_offset
export interface Sensor {
  version: string;
  sensor_id: string;
  sensor_name: string;
  sensor_mac_addr: string;
  // owner_id: string;
  // type: "DHT"
  // alert_interval: "1800"
  send_interval: string;
  last_temp: number; // ambient sensor temp
  last_humidity: number; // ambient sensor humidity
  // last_voltage: 3
  battery_pct: number;
  // wifi_connect_time: 1
  // rssi: -37
  // last_checkin: "2022-05-12 19:09:41-00:00Z"
  // next_checkin: "2022-05-12 19:39:41-00:00Z"
  // ssid: ""
  offline: string;
  // alerts: []
  // use_sensor_settings: 0
  // temp_offset: "0"
  // humidity_offset: "0"
  // alert_temp_below: ""
  // alert_temp_above: ""
  // alert_humidity_below: ""
  // alert_humidity_above: ""
  // connection_sensitivity: "3"
  // use_alert_interval: 0
  // use_offset: "0",
  last_tcTemp?: string; // undocumented probe temperature
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