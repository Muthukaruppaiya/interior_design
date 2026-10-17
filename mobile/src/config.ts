import { Platform } from 'react-native';

/**
 * Android emulator → 10.0.2.2 maps to host machine localhost.
 * Physical device → use your PC LAN IP (e.g. 192.168.x.x).
 * iOS simulator / web → localhost works.
 */
const DEV_HOST = Platform.select({
  android: '10.0.2.2',
  default: 'localhost',
});

export const API_BASE_URL = `http://${DEV_HOST}:4001`;
