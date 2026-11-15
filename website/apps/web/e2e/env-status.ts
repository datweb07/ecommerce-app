import { inspectedNames } from './safety.ts';

for (const name of inspectedNames)
  console.log(name + ' ' + (process.env[name] ? 'có' : 'không'));
