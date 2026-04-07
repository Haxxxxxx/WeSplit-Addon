/**
 * Minimal Web Bluetooth API type declarations.
 *
 * TypeScript's built-in DOM lib does not include Web Bluetooth.
 * This provides just the types used by lib/ble/bleCentral.ts.
 *
 * Spec: https://webbluetoothcg.github.io/web-bluetooth/
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
  interface Navigator {
    readonly bluetooth: Bluetooth;
  }

  interface Bluetooth extends EventTarget {
    getAvailability(): Promise<boolean>;
    requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice>;
  }

  interface RequestDeviceOptions {
    filters?: BluetoothLEScanFilter[];
    optionalServices?: BluetoothServiceUUID[];
    acceptAllDevices?: boolean;
  }

  interface BluetoothLEScanFilter {
    services?: BluetoothServiceUUID[];
    name?: string;
    namePrefix?: string;
  }

  type BluetoothServiceUUID = string | number;
  type BluetoothCharacteristicUUID = string | number;

  interface BluetoothDevice extends EventTarget {
    readonly id: string;
    readonly name: string | undefined;
    readonly gatt: BluetoothRemoteGATTServer | undefined;
  }

  interface BluetoothRemoteGATTServer {
    readonly device: BluetoothDevice;
    readonly connected: boolean;
    connect(): Promise<BluetoothRemoteGATTServer>;
    disconnect(): void;
    getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
  }

  interface BluetoothRemoteGATTService extends EventTarget {
    readonly device: BluetoothDevice;
    readonly uuid: string;
    getCharacteristic(characteristic: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic>;
  }

  interface BluetoothRemoteGATTCharacteristic extends EventTarget {
    readonly service: BluetoothRemoteGATTService;
    readonly uuid: string;
    readonly value: DataView | undefined;
    readValue(): Promise<DataView>;
    writeValue(value: ArrayBuffer | ArrayBufferView): Promise<void>;
    writeValueWithResponse(value: ArrayBuffer | ArrayBufferView): Promise<void>;
    writeValueWithoutResponse(value: ArrayBuffer | ArrayBufferView): Promise<void>;
    startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    addEventListener(
      type: 'characteristicvaluechanged',
      listener: (event: Event) => void,
      options?: boolean | AddEventListenerOptions,
    ): void;
    removeEventListener(
      type: 'characteristicvaluechanged',
      listener: (event: Event) => void,
      options?: boolean | EventListenerOptions,
    ): void;
  }
}

export {};
