export interface ContractQuery {
  abi: string;
  address: string;
  functionName: string;
  args: readonly unknown[];
}
