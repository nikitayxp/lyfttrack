import { DeviceEventEmitter } from 'react-native';

/** Fired after a successful Hevy (or other) workout import so feed/profile can reload. */
export const WORKOUTS_IMPORTED_EVENT = 'lyfttrack:workouts-imported';

export function notifyWorkoutsImported(): void {
  DeviceEventEmitter.emit(WORKOUTS_IMPORTED_EVENT);
}
