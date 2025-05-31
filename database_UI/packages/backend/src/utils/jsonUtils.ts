export function convertBigIntsToStrings(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
  
    if (Array.isArray(obj)) {
      // If it's an array, recursively process each element
      return obj.map(item => convertBigIntsToStrings(item));
    }
  
    if (typeof obj === 'bigint') {
      // If it's a BigInt, convert it to a string
      return obj.toString();
    }
  
    if (typeof obj === 'object') {
      // If it's an object, recursively process each value
      const newObj: { [key: string]: any } = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          newObj[key] = convertBigIntsToStrings(obj[key]);
        }
      }
      return newObj;
    }
  
    // Return primitive values directly
    return obj;
  }