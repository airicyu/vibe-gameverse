export function turnLog(scope: string, msg: string): void {
  console.log(`${new Date().toISOString().slice(11, 23)}  [${scope}] ${msg}`);
}
