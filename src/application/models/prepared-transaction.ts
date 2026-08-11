export interface PreparedTransaction {
  description: string;
  to: `0x${string}`;
  data: `0x${string}`;
  value: bigint;
  gas?: bigint;
}
