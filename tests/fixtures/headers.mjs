export async function cookies(){return {get(name){return globalThis.__testCookies?.[name]?{value:globalThis.__testCookies[name]}:undefined;}};}
