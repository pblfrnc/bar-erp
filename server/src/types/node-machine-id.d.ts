declare module 'node-machine-id' {
  export function machineId(original?: boolean): Promise<string>;
  export function machineIdSync(original?: boolean): string;
}
