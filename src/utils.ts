import { readFileSync } from 'fs';

export const readJsonFile = <T>(path: string): T => {
  return JSON.parse(readFileSync(path, 'utf-8'));
};

/**
 * package.json
 */
export type PackageJson = {
  name: string;
  displayName: string;
  version: string;
};

export const getModDisplayName = (packageJson: PackageJson, withVersion = false): string => {
  if (withVersion) {
    return `${packageJson.displayName} v${packageJson.version}`;
  }
  return `${packageJson.displayName}`;
};

// deep clone taken on stackoverflow
export function deepClone<T>(item: T): T {
  if (!item) {
    return item;
  } // null, undefined values check

  const types = [Number, String, Boolean];
  let result: any;

  // normalizing primitives if someone did new String('aaa'), or new Number('444');
  types.forEach(function (type) {
    if (item instanceof type) {
      result = type(item);
    }
  });

  if (typeof result == 'undefined') {
    if (Object.prototype.toString.call(item) === '[object Array]') {
      result = [];
      (item as unknown as any[]).forEach(function (child, index) {
        result[index] = deepClone(child);
      });
    } else if (typeof item == 'object') {
      if (item && !(item as any).prototype) {
        // check that this is a literal
        if (item instanceof Date) {
          result = new Date(item);
        } else {
          // it is an object literal
          result = {};
          for (const i in item) {
            result[i] = deepClone(item[i]);
          }
        }
      } else {
        // just keep the reference
        result = item;
        // depending what you would like here,
      }
    } else {
      result = item;
    }
  }

  return result as T;
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function noop(): void {}

export const isEmptyArray = <T>(arr: T[] | undefined): boolean => {
  return Boolean(arr && arr.length > 0);
};

export const isLetter = (char: string): boolean => {
  return char.length === 1 && char.toUpperCase() !== char.toLowerCase();
};

export const isDigit = (char: string): boolean => {
  return char.length === 1 && char >= '0' && char <= '9';
};
