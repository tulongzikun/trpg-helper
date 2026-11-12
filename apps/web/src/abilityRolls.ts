/** 2024 ability generation: six rolls of 4d6, drop one lowest die. */
export type AbilityRoll = { dice:[number,number,number,number]; total:number };
export function rollAbilities(rollDie:()=>number):AbilityRoll[] {
  return Array.from({length:6},()=>{
    const dice=Array.from({length:4},()=>rollDie()) as [number,number,number,number];
    if(dice.some(n=>!Number.isInteger(n)||n<1||n>6))throw new Error('骰子结果必须是 1 至 6 的整数。');
    return {dice,total:dice.reduce((a,b)=>a+b,0)-Math.min(...dice)};
  });
}
export function secureD6():number {
  const values=new Uint8Array(1);
  do { crypto.getRandomValues(values); } while(values[0]>=252);
  return values[0]%6+1;
}
